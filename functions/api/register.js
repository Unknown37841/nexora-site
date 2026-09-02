import {
  jsonResponse,
  jsonError,
  isValidEmail,
  hashPassword,
  randomHex,
  createVerificationCode,
  sendVerificationEmail,
} from "../_utils.js";

export async function onRequestPost(context) {
  const { request, env } = context;

  let body;
  try {
    body = await request.json();
  } catch {
    return jsonError("درخواست نامعتبر است.", 400);
  }

  const name = (body.name || "").toString().trim();
  const email = (body.email || "").toString().trim().toLowerCase();
  const password = (body.password || "").toString();

  if (!name) return jsonError("لطفاً نام خود را وارد کنید.", 400);
  if (!isValidEmail(email)) return jsonError("لطفاً یک ایمیل معتبر وارد کنید.", 400);
  if (password.length < 6) return jsonError("رمز عبور باید حداقل ۶ کاراکتر باشد.", 400);

  const existing = await env.DB.prepare(
    "SELECT id, email_verified FROM users WHERE email = ?"
  )
    .bind(email)
    .first();

  // اگه قبلاً با همین ایمیل ثبت‌نام شده و تأیید هم شده، دیگه اجازه نده.
  if (existing && existing.email_verified) {
    return jsonError("این ایمیل قبلاً ثبت‌نام کرده است.", 409);
  }

  const salt = randomHex(16);
  const passwordHash = await hashPassword(password, salt);
  const now = Date.now();

  if (existing) {
    // ثبت‌نام قبلی ناتمام مونده (تأیید ایمیل انجام نشده) -> اطلاعات رو آپدیت کن و کد جدید بفرست
    await env.DB.prepare(
      "UPDATE users SET name = ?, password_hash = ?, salt = ? WHERE id = ?"
    )
      .bind(name, passwordHash, salt, existing.id)
      .run();
  } else {
    const id = randomHex(16);
    await env.DB.prepare(
      "INSERT INTO users (id, name, email, password_hash, salt, created_at, email_verified) VALUES (?, ?, ?, ?, ?, ?, 0)"
    )
      .bind(id, name, email, passwordHash, salt, now)
      .run();
  }

  const code = await createVerificationCode(env, email);

  try {
    await sendVerificationEmail(env, { to: email, name, code });
  } catch (err) {
    return jsonError(
      "ثبت‌نام ذخیره شد اما ارسال ایمیل کد تأیید با خطا مواجه شد. کمی بعد دوباره «ارسال مجدد کد» را بزنید.",
      502
    );
  }

  // توجه: اینجا دیگه هیچ Session ساخته نمی‌شه. کاربر فقط وقتی وارد حساب می‌شه
  // که کد ۶ رقمی رو در /api/verify-email درست وارد کنه.
  return jsonResponse({ ok: true, pendingVerification: true, email }, 201);
}
