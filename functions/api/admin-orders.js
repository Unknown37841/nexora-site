import { jsonResponse, jsonError, requireAdmin } from "../_utils.js";

// GET /api/admin-orders → همه سفارش‌ها فقط برای ادمین
export async function onRequestGet(context) {
  const { request, env } = context;
  const { error } = await requireAdmin(request, env);
  if (error) return error;

  const { results } = await env.DB.prepare(
    `SELECT o.id, o.items, o.total, o.status, o.created_at,
            u.name AS user_name, u.email AS user_email
     FROM orders o LEFT JOIN users u ON u.id = o.user_id
     ORDER BY o.created_at DESC LIMIT 200`
  ).all();

  const orders = (results || []).map((o) => ({
    ...o,
    items: JSON.parse(o.items || "[]"),
  }));

  return jsonResponse({ ok: true, orders });
}

// PUT /api/admin-orders?id=ord-xxx  body: {status} → تغییر وضعیت سفارش
export async function onRequestPut(context) {
  const { request, env } = context;
  const { error } = await requireAdmin(request, env);
  if (error) return error;

  const url = new URL(request.url);
  const id = url.searchParams.get("id") || "";
  if (!id) return jsonError("شناسه سفارش مشخص نیست.", 400);

  let body;
  try {
    body = await request.json();
  } catch {
    return jsonError("درخواست نامعتبر است.", 400);
  }

  const status = (body.status || "").toString();
  if (!["pending", "paid", "cancelled"].includes(status)) {
    return jsonError("وضعیت معتبر نیست.", 400);
  }

  const existing = await env.DB.prepare("SELECT id FROM orders WHERE id = ?")
    .bind(id)
    .first();
  if (!existing) return jsonError("سفارش پیدا نشد.", 404);

  await env.DB.prepare("UPDATE orders SET status = ? WHERE id = ?")
    .bind(status, id)
    .run();

  return jsonResponse({ ok: true });
}
