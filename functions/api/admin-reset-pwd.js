import { jsonResponse, jsonError, hashPassword, randomHex } from "../_utils.js";

export async function onRequestPost(context) {
  const { request, env } = context;
  let body = {};
  try { body = await request.json(); } catch (_) {}

  const secret = body.secret;
  if (secret !== "nexora_admin_reset_2026") {
    return jsonError("دسترسی غیرمجاز.", 403);
  }

  const email = (body.email || "otak.1380@gmail.com").toString().trim().toLowerCase();
  const newPassword = (body.newPassword || "Admin123456").toString();

  if (newPassword.length < 6) {
    return jsonError("رمز باید حداقل ۶ کاراکتر باشد.", 400);
  }

  const salt = randomHex(16);
  const passwordHash = await hashPassword(newPassword, salt);

  const existing = await env.DB.prepare("SELECT id FROM users WHERE email = ?").bind(email).first();
  if (existing) {
    await env.DB.prepare(
      "UPDATE users SET password_hash = ?, salt = ?, email_verified = 1, is_admin = 1 WHERE email = ?"
    ).bind(passwordHash, salt, email).run();
  } else {
    const id = randomHex(16);
    const now = Date.now();
    await env.DB.prepare(
      "INSERT INTO users (id, name, email, password_hash, salt, created_at, email_verified, is_admin) VALUES (?, 'مدیر سیستم', ?, ?, ?, ?, 1, 1)"
    ).bind(id, email, passwordHash, salt, now).run();
  }

  // همچنین اگر ایمیل اوراک با r بود (orak.1380@gmail.com)، آن را هم ادمین و به‌روزرسانی کن
  const altEmail = email.startsWith("otak") ? email.replace("otak", "orak") : email.replace("orak", "otak");
  const altExisting = await env.DB.prepare("SELECT id FROM users WHERE email = ?").bind(altEmail).first();
  if (altExisting) {
    const altSalt = randomHex(16);
    const altHash = await hashPassword(newPassword, altSalt);
    await env.DB.prepare(
      "UPDATE users SET password_hash = ?, salt = ?, email_verified = 1, is_admin = 1 WHERE email = ?"
    ).bind(altHash, altSalt, altEmail).run();
  }

  return jsonResponse({
    ok: true,
    email,
    altEmail: altExisting ? altEmail : null,
    message: "رمز عبور با موفقیت به‌روزرسانی و حساب مدیر تأیید شد."
  });
}
