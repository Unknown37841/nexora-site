import {
  jsonResponse,
  jsonError,
  isValidEmail,
  hashPassword,
  createVerificationCode,
  sendVerificationEmail,
  verificationCooldownRemainingMs,
  logError,
} from "../_utils.js";

// ورود دومرحله‌ای:
// مرحله ۱) ایمیل + رمز بررسی می‌شود؛ اگر درست بود، کد ۶ رقمی به ایمیل ارسال می‌شود
//          (اگر کاربر وجود نداشته باشد یا رمز غلط باشد: خطای 401 — به مرحله کد نمی‌رسد)
// مرحله ۲) کد با /api/login-verify تأیید و Session ساخته می‌شود
export async function onRequestPost(context) {
  const { request, env } = context;

  let body;
  try {
    body = await request.json();
  } catch {
    return jsonError("درخواست نامعتبر است.", 400);
  }

  const email = (body.email || "").toString().trim().toLowerCase();
  const password = (body.password || "").toString();

  if (!isValidEmail(email)) return jsonError("لطفاً یک ایمیل معتبر وارد کنید.", 400);
  if (!password) return jsonError("لطفاً رمز عبور را وارد کنید.", 400);

  const user = await env.DB.prepare(
    "SELECT id, name, email, password_hash, salt, email_verified FROM users WHERE email = ?"
  )
    .bind(email)
    .first();

  // کاربر وجود ندارد → اصلاً به مرحله کد نمی‌رویم
  if (!user) {
    return jsonError(
      "کاربری با این ایمیل پیدا نشد. ابتدا ثبت‌نام کنید.",
      401,
      { code: "USER_NOT_FOUND" }
    );
  }

  const computedHash = await hashPassword(password, user.salt);
  if (computedHash !== user.password_hash) {
    return jsonError("ایمیل یا رمز عبور اشتباه است.", 401);
  }

  // کد ۶ رقمی بساز و بفرست (کول‌داون ۶۰ ثانیه بین دو ارسال)
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
    await sendVerificationEmail(env, {
      to: email,
      name: user.name,
      code,
    });
  } catch (err) {
    logError("login: send code", err);
    return jsonError(
      "ارسال کد ورود با خطا مواجه شد. کمی بعد دوباره تلاش کنید.",
      502
    );
  }

  // توجه: اینجا عمداً هیچ Session ساخته نمی‌شود؛ فقط بعد از تأیید کد
  return jsonResponse({ ok: true, loginCodeSent: true, email }, 200);
}
