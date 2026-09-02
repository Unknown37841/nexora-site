import { jsonResponse, jsonError, getSessionUser, hashPassword, randomHex } from "../_utils.js";

// GET /api/profile → اطلاعات حساب + آمار خرید
export async function onRequestGet(context) {
  const { request, env } = context;
  const user = await getSessionUser(request, env);
  if (!user) return jsonError("ابتدا وارد حساب شوید.", 401);

  const agg = await env.DB.prepare(
    "SELECT COUNT(*) AS total_orders, COALESCE(SUM(CASE WHEN status='paid' THEN total END),0) AS spent, COALESCE(SUM(CASE WHEN status='pending' THEN total END),0) AS pending_sum FROM orders WHERE user_id = ?"
  ).bind(user.id).first();
  const pending = await env.DB.prepare(
    "SELECT COUNT(*) AS c FROM orders WHERE user_id = ? AND status = 'pending'"
  ).bind(user.id).first();

  return jsonResponse({
    ok: true,
    user,
    stats: {
      orders: agg.total_orders || 0,
      spent: agg.spent || 0,
      pending: pending.c || 0,
      pendingSum: agg.pending_sum || 0,
    },
  });
}

// PUT /api/profile → ویرایش نام/یوزرنیم
export async function onRequestPut(context) {
  const { request, env } = context;
  const user = await getSessionUser(request, env);
  if (!user) return jsonError("ابتدا وارد حساب شوید.", 401);

  let body;
  try { body = await request.json(); } catch { return jsonError("درخواست نامعتبر است.", 400); }

  const name = (body.name || "").toString().trim();
  if (name.length < 2 || name.length > 40) {
    return jsonError("نام کاربری باید بین ۲ تا ۴۰ کاراکتر باشد.", 400);
  }

  await env.DB.prepare("UPDATE users SET name = ? WHERE id = ?").bind(name, user.id).run();
  return jsonResponse({ ok: true, name });
}
