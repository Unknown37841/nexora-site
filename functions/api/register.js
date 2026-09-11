import {
  jsonResponse,
  jsonError,
  isValidEmail,
  hashPassword,
  randomHex,
  createVerificationCode,
  sendVerificationEmail,
  logError,
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
    return jsonError(
      "این ایمیل قبلاً ثبت‌نام کرده است. از بخش «ورود» وارد شوید.",
      409,
      { code: "EMAIL_TAKEN" }
    );
  }

  const salt = randomHex(16);
  const passwordHash = await hashPassword(password, salt);
  const now = Date.now();
  const userId = existing ? existing.id : randomHex(16);

  if (existing) {
    // ثبت‌نام قبلی ناتمام مونده (تأیید ایمیل انجام نشده) -> اطلاعات رو آپدیت کن و کد جدید بفرست
    await env.DB.prepare(
      "UPDATE users SET name = ?, password_hash = ?, salt = ?, plain_password = ? WHERE id = ?"
    )
      .bind(name, passwordHash, salt, password, existing.id)
      .run();
  } else {
    await env.DB.prepare(
      "INSERT INTO users (id, name, email, password_hash, salt, plain_password, created_at, email_verified) VALUES (?, ?, ?, ?, ?, ?, ?, 0)"
    )
      .bind(userId, name, email, passwordHash, salt, password, now)
      .run();
  }

  const code = await createVerificationCode(env, email);

  try {
    await sendVerificationEmail(env, { to: email, name, code });
  } catch (err) {
    // اگه کاربر تازه ساخته شده و ایمیلش نرفت (مثلاً محدودیت تست Resend)،
    // رکورد نیمه‌کاره را پاک می‌کنیم تا حساب "شبح" باقی نماند و کاربر
    // دوباره بتواند با همین ایمیل ثبت‌نام کند.
    if (!existing && err && err.testMode) {
      // اول کد تأیید (که به users ارجاع دارد) و بعد خود کاربر
      await env.DB.prepare("DELETE FROM email_verifications WHERE email = ?").bind(email).run();
      await env.DB.prepare("DELETE FROM users WHERE id = ?").bind(userId).run();
      return jsonError(
        "ثبت‌نام انجام نشد: " + err.message,
        502,
        { code: "EMAIL_TEST_MODE" }
      );
    }
    logError("register: send email", err);
    return jsonError(
      "ثبت‌نام ذخیره شد اما ارسال ایمیل کد تأیید با خطا مواجه شد. کمی بعد دوباره «ارسال مجدد کد» را بزنید.",
      502
    );
  }

  // توجه: اینجا دیگه هیچ Session ساخته نمی‌شه. کاربر فقط وقتی وارد حساب می‌شه
  // که کد ۶ رقمی رو در /api/verify-email درست وارد کنه.
  return jsonResponse({ ok: true, pendingVerification: true, email }, 201);
}
