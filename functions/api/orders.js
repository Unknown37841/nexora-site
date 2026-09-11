import { jsonResponse, jsonError, getSessionUser, logError } from "../_utils.js";
import { ensureDatabaseSchema } from "./admin-migrate.js";

// POST /api/orders → ثبت سفارش از سبد خرید (نیاز به ورود)
export async function onRequestPost(context) {
  const { request, env } = context;
  const user = await getSessionUser(request, env);
  if (!user) return jsonError("برای ثبت سفارش ابتدا وارد حساب شوید.", 401);

  await ensureDatabaseSchema(env);

  let body;
  try {
    body = await request.json();
  } catch {
    return jsonError("درخواست نامعتبر است.", 400);
  }

  const items = Array.isArray(body.items) ? body.items : [];
  if (!items.length) return jsonError("سبد خرید خالی است.", 400);
  if (items.length > 30) return jsonError("تعداد اقلام بیش از حد مجاز است.", 400);

  // قیمت‌ها هرگز از سمت کاربر قبول نمی‌شوند؛ از دیتابیس خوانده می‌شوند
  const cleanItems = [];
  for (const it of items) {
    const qty = Math.min(20, Math.max(1, parseInt(it.qty, 10) || 1));
    cleanItems.push({ id: (it.id || "").toString().slice(0, 40), qty });
  }

  const priceRows = await env.DB.prepare(
    `SELECT id, name, price FROM products WHERE active = 1`
  ).all();
  const priceMap = new Map((priceRows.results || []).map((r) => [r.id, r]));

  let total = 0;
  const finalItems = [];
  for (const it of cleanItems) {
    const p = priceMap.get(it.id);
    if (!p) return jsonError("یکی از محصولات سبد دیگر موجود نیست.", 400);
    total += p.price * it.qty;
    finalItems.push({ id: p.id, name: p.name, price: p.price, qty: it.qty });
  }

  const id = "ord-" + crypto.randomUUID().replace(/-/g, "").slice(0, 14);
  const now = Date.now();

  try {
    await env.DB.prepare(
      "INSERT INTO orders (id, user_id, items, total, status, created_at) VALUES (?, ?, ?, ?, 'pending', ?)"
    )
      .bind(id, user.id, JSON.stringify(finalItems), total, now)
      .run();
  } catch (err) {
    logError("orders: insert", err);
    return jsonError("ثبت سفارش ناموفق بود. دوباره تلاش کنید.", 500);
  }

  return jsonResponse({ ok: true, orderId: id, total, items: finalItems }, 201);
}

// GET /api/orders → سفارش‌های خود کاربر همراه با اطلاعات فیش و اکانت تحویل داده شده
export async function onRequestGet(context) {
  const { request, env } = context;
  const user = await getSessionUser(request, env);
  if (!user) return jsonError("ابتدا وارد حساب شوید.", 401);

  await ensureDatabaseSchema(env);

  // لغو خودکار سفارش‌های در انتظار پرداخت که بیش از ۲۴ ساعت از ثبت آنها گذشته است
  const twentyFourHoursAgo = Date.now() - 24 * 60 * 60 * 1000;
  try {
    await env.DB.prepare(
      "UPDATE orders SET status = 'cancelled' WHERE status = 'pending' AND created_at < ?"
    ).bind(twentyFourHoursAgo).run();
  } catch (_) {}

  const { results } = await env.DB.prepare(`
    SELECT id, items, total, status, created_at,
           tracking_code, sender_card, customer_contact, receipt_text, receipt_image,
           admin_note, delivery_text, delivered_at, paid_at, submitted_at
    FROM orders
    WHERE user_id = ?
    ORDER BY created_at DESC
    LIMIT 50
  `)
    .bind(user.id)
    .all();

  const orders = (results || []).map((o) => ({
    ...o,
    items: JSON.parse(o.items || "[]"),
  }));

  return jsonResponse({ ok: true, orders });
}

// DELETE /api/orders?id=ORD-XXX → لغو و حذف سفارش در انتظار توسط خود مشتری
export async function onRequestDelete(context) {
  const { request, env } = context;
  const user = await getSessionUser(request, env);
  if (!user) return jsonError("ابتدا وارد حساب شوید.", 401);

  const url = new URL(request.url);
  let id = url.searchParams.get("id");
  if (!id) {
    try {
      const body = await request.json();
      id = body && body.id;
    } catch (_) {}
  }
  if (!id) return jsonError("شناسه سفارش الزامی است.", 400);

  const order = await env.DB.prepare(
    "SELECT id, status, delivery_text FROM orders WHERE id = ? AND user_id = ?"
  )
    .bind(id, user.id)
    .first();

  if (!order) return jsonError("سفارش پیدا نشد.", 404);

  // در صورتی که سفارش تایید و تحویل شده باشد، لغو نمی‌شود
  if (order.status === "paid" || order.delivery_text) {
    return jsonError("این سفارش تحویل داده شده و امکان لغو آن وجود ندارد.", 400);
  }

  // حذف سفارش از دیتابیس (طبق درخواست کاربر تا از لیست کلاً پاک شود)
  await env.DB.prepare("DELETE FROM orders WHERE id = ? AND user_id = ?")
    .bind(id, user.id)
    .run();

  return jsonResponse({ ok: true, message: "سفارش با موفقیت لغو و حذف شد." });
}
