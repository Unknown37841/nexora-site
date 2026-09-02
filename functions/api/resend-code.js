import {
  jsonResponse,
  jsonError,
  isValidEmail,
  createVerificationCode,
  sendVerificationEmail,
  verificationCooldownRemainingMs,
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
  if (!isValidEmail(email)) return jsonError("ایمیل نامعتبر است.", 400);

  const user = await env.DB.prepare(
    "SELECT id, name, email_verified FROM users WHERE email = ?"
  )
    .bind(email)
    .first();

  if (!user) return jsonError("کاربری با این ایمیل پیدا نشد.", 404);

  const existing = await env.DB.prepare(
    "SELECT last_sent_at FROM email_verifications WHERE email = ?"
  )
    .bind(email)
    .first();

  if (existing) {
    const remainingMs = verificationCooldownRemainingMs(existing.last_sent_at);
    if (remainingMs > 0) {
      const waitSec = Math.ceil(remainingMs / 1000);
      return jsonError(`لطفاً ${waitSec} ثانیه دیگر دوباره تلاش کنید.`, 429, {
        code: "COOLDOWN",
        retryAfterSeconds: waitSec,
      });
    }
  }

  const code = await createVerificationCode(env, email);

  try {
    await sendVerificationEmail(env, { to: email, name: user.name, code });
  } catch (err) {
    return jsonError("ارسال ایمیل با خطا مواجه شد. کمی بعد دوباره تلاش کنید.", 502);
  }

  return jsonResponse({ ok: true });
}
