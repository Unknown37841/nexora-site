import { jsonResponse, jsonError, requireAdmin, logError } from "../_utils.js";
import { ensureDatabaseSchema } from "./admin-migrate.js";

// GET /api/admin-orders → لیست کامل سفارش‌ها همراه با فیش‌ها و اطلاعات تحویل برای ادمین
export async function onRequestGet(context) {
  const { request, env } = context;
  const { error } = await requireAdmin(request, env);
  if (error) return error;

  await ensureDatabaseSchema(env);

  const url = new URL(request.url);
  const statusFilter = url.searchParams.get("status") || "";

  let query = `
    SELECT o.id, o.user_id, o.items, o.total, o.status, o.created_at,
           o.tracking_code, o.sender_card, o.customer_contact,
           o.receipt_text, o.receipt_image, o.admin_note,
           o.delivery_text, o.delivered_at, o.paid_at, o.submitted_at,
           u.name AS user_name, u.email AS user_email
    FROM orders o
    LEFT JOIN users u ON u.id = o.user_id
  `;

  const bindings = [];
  if (statusFilter && ["pending", "awaiting_verification", "paid", "rejected", "cancelled"].includes(statusFilter)) {
    query += ` WHERE o.status = ? `;
    bindings.push(statusFilter);
  }

  query += ` ORDER BY o.created_at DESC LIMIT 200`;

  const stmt = env.DB.prepare(query);
  const { results } = bindings.length ? await stmt.bind(...bindings).all() : await stmt.all();

  const orders = (results || []).map((o) => ({
    ...o,
    items: JSON.parse(o.items || "[]"),
  }));

  return jsonResponse({ ok: true, orders });
}

// PUT /api/admin-orders?id=ord-xxx → تغییر وضعیت یا تحویل اشتراک و ارسال متن به کاربر
export async function onRequestPut(context) {
  const { request, env } = context;
  const { error } = await requireAdmin(request, env);
  if (error) return error;

  await ensureDatabaseSchema(env);

  const url = new URL(request.url);
  const id = url.searchParams.get("id") || "";
  if (!id) return jsonError("شناسه سفارش مشخص نیست.", 400);

  let body;
  try {
    body = await request.json();
  } catch {
    return jsonError("درخواست نامعتبر است.", 400);
  }

  const validStatuses = ["pending", "awaiting_verification", "paid", "rejected", "cancelled"];
  const status = (body.status || "").toString().trim();
  if (status && !validStatuses.includes(status)) {
    return jsonError("وضعیت معتبر نیست.", 400);
  }

  const existing = await env.DB.prepare("SELECT id, status, delivery_text FROM orders WHERE id = ?")
    .bind(id)
    .first();
  if (!existing) return jsonError("سفارش پیدا نشد.", 404);

  const now = Date.now();
  const updates = [];
  const params = [];

  if (status) {
    updates.push("status = ?");
    params.push(status);
    if (status === "paid") {
      updates.push("paid_at = ?");
      params.push(now);
    }
  }

  if (body.adminNote !== undefined) {
    updates.push("admin_note = ?");
    params.push(String(body.adminNote).trim().slice(0, 500));
  }

  if (body.deliveryText !== undefined) {
    const dText = String(body.deliveryText).trim().slice(0, 3000);
    updates.push("delivery_text = ?");
    params.push(dText);
    updates.push("delivered_at = ?");
    params.push(now);
    // اگر متن تحویل فرستاده شد و وضعیتی تعیین نشده بود، اتوماتیک به paid تغییر یابد
    if (!status && existing.status !== "paid") {
      updates.push("status = 'paid'");
      updates.push("paid_at = ?");
      params.push(now);
    }
  }

  if (!updates.length) {
    return jsonError("تغییری مشخص نشده است.", 400);
  }

  params.push(id);
  const sql = `UPDATE orders SET ${updates.join(", ")} WHERE id = ?`;

  try {
    await env.DB.prepare(sql).bind(...params).run();
    return jsonResponse({ ok: true, message: "سفارش و اطلاعات تحویل با موفقیت ذخیره شد." });
  } catch (err) {
    logError("admin-orders: update", err);
    return jsonError("خطا در به‌روزرسانی سفارش.", 500);
  }
}

// DELETE /api/admin-orders?id=ord-xxx → حذف سفارش
export async function onRequestDelete(context) {
  const { request, env } = context;
  const { error } = await requireAdmin(request, env);
  if (error) return error;

  const url = new URL(request.url);
  const id = url.searchParams.get("id") || "";
  if (!id) return jsonError("شناسه سفارش مشخص نیست.", 400);

  try {
    await env.DB.prepare("DELETE FROM orders WHERE id = ?").bind(id).run();
    return jsonResponse({ ok: true, message: "سفارش حذف شد." });
  } catch (err) {
    logError("admin-orders: delete", err);
    return jsonError("خطا در حذف سفارش.", 500);
  }
}
