import {
  jsonResponse,
  jsonError,
  isValidEmail,
  sha256Hex,
  createSession,
  sessionCookieHeader,
  VERIFICATION_MAX_ATTEMPTS,
} from "../_utils.js";

export async function onRequestPost(context) {
  const { request, env } = context;

  let body;
  try {
    body = await request.json();
  } catch {
    return jsonError("درخواست نامعتبر است.", 400);
  }

  const email = (body.email || "").toString().trim().toLowerCase();
  const code = (body.code || "").toString().trim();

  if (!isValidEmail(email)) return jsonError("ایمیل نامعتبر است.", 400);
  if (!/^\d{6}$/.test(code)) return jsonError("کد باید ۶ رقم باشد.", 400);

  const record = await env.DB.prepare(
    "SELECT * FROM email_verifications WHERE email = ?"
  )
    .bind(email)
    .first();

  if (!record) {
    return jsonError(
      "کدی برای این ایمیل پیدا نشد. لطفاً دوباره ثبت‌نام کنید یا کد جدید بگیرید.",
      404
    );
  }

  if (record.expires_at < Date.now()) {
    return jsonError("کد منقضی شده است. لطفاً کد جدید درخواست کنید.", 410, {
      code: "CODE_EXPIRED",
    });
  }

  if (record.attempts >= VERIFICATION_MAX_ATTEMPTS) {
    return jsonError(
      "تعداد تلاش‌های مجاز تمام شده. لطفاً کد جدید درخواست کنید.",
      429,
      { code: "TOO_MANY_ATTEMPTS" }
    );
  }

  const codeHash = await sha256Hex(code);
  if (codeHash !== record.code_hash) {
    await env.DB.prepare(
      "UPDATE email_verifications SET attempts = attempts + 1 WHERE email = ?"
    )
      .bind(email)
      .run();
    return jsonError("کد وارد شده اشتباه است.", 400);
  }

  const user = await env.DB.prepare(
    "SELECT id, name, email FROM users WHERE email = ?"
  )
    .bind(email)
    .first();

  if (!user) return jsonError("کاربری با این ایمیل پیدا نشد.", 404);

  await env.DB.prepare("UPDATE users SET email_verified = 1 WHERE id = ?")
    .bind(user.id)
    .run();

  await env.DB.prepare("DELETE FROM email_verifications WHERE email = ?")
    .bind(email)
    .run();

  const token = await createSession(env, user.id);

  return jsonResponse(
    { ok: true, user },
    200,
    { "Set-Cookie": sessionCookieHeader(token) }
  );
}
