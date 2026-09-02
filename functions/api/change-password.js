import { jsonResponse, jsonError, getSessionUser, hashPassword, randomHex, logError } from "../_utils.js";

// PUT /api/change-password → تغییر رمز عبور (نیاز به رمز فعلی)
export async function onRequestPut(context) {
  const { request, env } = context;
  const user = await getSessionUser(request, env);
  if (!user) return jsonError("ابتدا وارد حساب شوید.", 401);

  let body;
  try { body = await request.json(); } catch { return jsonError("درخواست نامعتبر است.", 400); }

  const current = (body.current || "").toString();
  const next = (body.next || "").toString();
  if (next.length < 6) return jsonError("رمز جدید باید حداقل ۶ کاراکتر باشد.", 400);

  const row = await env.DB.prepare("SELECT salt, password_hash FROM users WHERE id = ?")
    .bind(user.id).first();
  if (!row) return jsonError("کاربر پیدا نشد.", 404);

  const currentHash = await hashPassword(current, row.salt);
  if (currentHash !== row.password_hash) {
    return jsonError("رمز فعلی اشتباه است.", 401);
  }

  const salt = randomHex(16);
  const newHash = await hashPassword(next, salt);
  try {
    await env.DB.prepare("UPDATE users SET password_hash = ?, salt = ? WHERE id = ?")
      .bind(newHash, salt, user.id).run();
  } catch (err) {
    logError("change-password", err);
    return jsonError("تغییر رمز ناموفق بود.", 500);
  }
  return jsonResponse({ ok: true });
}
