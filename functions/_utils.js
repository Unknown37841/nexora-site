// Shared helpers used by every /functions/api/*.js endpoint.
// This file is prefixed with "_" so Cloudflare Pages does NOT treat it as a route.

export function jsonResponse(data, status = 200, extraHeaders = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8", ...extraHeaders },
  });
}

export function jsonError(message, status = 400, extra = {}) {
  return jsonResponse({ ok: false, error: message, ...extra }, status);
}

export function isValidEmail(v) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
}

// ---- Password hashing (PBKDF2 via Web Crypto, no external deps) ----
export async function hashPassword(password, saltHex) {
  const enc = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey(
    "raw",
    enc.encode(password),
    "PBKDF2",
    false,
    ["deriveBits"]
  );
  const bits = await crypto.subtle.deriveBits(
    {
      name: "PBKDF2",
      salt: enc.encode(saltHex),
      iterations: 100000,
      hash: "SHA-256",
    },
    keyMaterial,
    256
  );
  return [...new Uint8Array(bits)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

export function randomHex(bytes = 16) {
  const arr = new Uint8Array(bytes);
  crypto.getRandomValues(arr);
  return [...arr].map((b) => b.toString(16).padStart(2, "0")).join("");
}

// ---- Sessions (stored in D1, referenced via an HttpOnly cookie) ----
const SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 30; // 30 days

export async function createSession(env, userId) {
  const token = randomHex(32);
  const now = Date.now();
  const expiresAt = now + SESSION_MAX_AGE_SECONDS * 1000;
  await env.DB.prepare(
    "INSERT INTO sessions (token, user_id, created_at, expires_at) VALUES (?, ?, ?, ?)"
  )
    .bind(token, userId, now, expiresAt)
    .run();
  return token;
}

export function sessionCookieHeader(token) {
  return `session=${token}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${SESSION_MAX_AGE_SECONDS}`;
}

export function clearSessionCookieHeader() {
  return "session=deleted; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0";
}

export function getCookie(request, name) {
  const cookieHeader = request.headers.get("Cookie") || "";
  const match = cookieHeader.match(new RegExp(`(?:^|; )${name}=([^;]*)`));
  return match ? decodeURIComponent(match[1]) : null;
}

// ---- Email verification codes (6-digit, stored hashed in D1) ----
const VERIFICATION_CODE_TTL_MS = 10 * 60 * 1000; // ۱۰ دقیقه اعتبار کد
const VERIFICATION_RESEND_COOLDOWN_MS = 60 * 1000; // فاصله مجاز بین دو ارسال
export const VERIFICATION_MAX_ATTEMPTS = 5; // حداکثر تلاش اشتباه قبل از نیاز به کد جدید

export function generateVerificationCode() {
  const arr = new Uint8Array(4);
  crypto.getRandomValues(arr);
  const num = ((arr[0] << 24) | (arr[1] << 16) | (arr[2] << 8) | arr[3]) >>> 0;
  return String(num % 1000000).padStart(6, "0");
}

export async function sha256Hex(text) {
  const enc = new TextEncoder();
  const digest = await crypto.subtle.digest("SHA-256", enc.encode(text));
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

// یک کد جدید می‌سازد، هشش را در D1 ذخیره می‌کند و خود کد (متن ساده) را برمی‌گرداند
// تا فقط همان لحظه برای ارسال ایمیل استفاده شود. کد خام هرگز در دیتابیس ذخیره نمی‌شود.
export async function createVerificationCode(env, email) {
  const code = generateVerificationCode();
  const codeHash = await sha256Hex(code);
  const now = Date.now();
  const expiresAt = now + VERIFICATION_CODE_TTL_MS;

  await env.DB.prepare(
    `INSERT INTO email_verifications (email, code_hash, expires_at, attempts, last_sent_at)
     VALUES (?, ?, ?, 0, ?)
     ON CONFLICT(email) DO UPDATE SET
       code_hash = excluded.code_hash,
       expires_at = excluded.expires_at,
       attempts = 0,
       last_sent_at = excluded.last_sent_at`
  )
    .bind(email, codeHash, expiresAt, now)
    .run();

  return code;
}

export function verificationCooldownRemainingMs(lastSentAt) {
  return VERIFICATION_RESEND_COOLDOWN_MS - (Date.now() - lastSentAt);
}

// ---- ارسال ایمیل کد تأیید از طریق Resend ----
// نیاز به Secret به اسم RESEND_API_KEY در Cloudflare Pages داره (Settings → Environment variables).
// اختیاری: RESEND_FROM برای تعیین آدرس فرستنده (پیش‌فرض روی دامنه تست Resend هست).
export async function sendVerificationEmail(env, { to, name, code }) {
  if (!env.RESEND_API_KEY) {
    throw new Error("RESEND_API_KEY تنظیم نشده است.");
  }

  const fromAddress = env.RESEND_FROM || "Nexora <onboarding@resend.dev>";

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${env.RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: fromAddress,
      to: [to],
      subject: "کد تأیید ایمیل شما در Nexora",
      html: `
        <div dir="rtl" style="font-family: Tahoma, Arial, sans-serif; text-align:right; line-height:1.8;">
          <p>سلام ${name || ""} 👋</p>
          <p>کد تأیید ایمیل شما در Nexora:</p>
          <p style="font-size:28px; font-weight:bold; letter-spacing:6px; direction:ltr; text-align:center;">${code}</p>
          <p>این کد تا ۱۰ دقیقه دیگر معتبره. اگه شما این درخواست رو نداده‌اید، همین ایمیل رو نادیده بگیرید.</p>
        </div>
      `,
    }),
  });

  if (!res.ok) {
    const errText = await res.text().catch(() => "");
    // حالت تست Resend: فقط به آدرس اکانت Resend می‌توان ایمیل زد (خطای 403)
    if (res.status === 403 || /testing emails/i.test(errText)) {
      const m = errText.match(/\(([^()]+@[^()]+)\)/);
      const allowed = m ? m[1] : "همان ایمیلی که با آن در Resend ثبت‌نام کرده‌اید";
      const e = new Error(
        "سایت فعلاً در حالت تست Resend است و ایمیل فقط به آدرس «" +
          allowed +
          "» ارسال می‌شود. برای فعال‌سازی ارسال به همه‌ی کاربران، یک دامنه را در Resend وریفای کنید و متغیر RESEND_FROM را تنظیم کنید."
      );
      e.testMode = true;
      e.allowedTo = m ? m[1] : null;
      throw e;
    }
    throw new Error("ارسال ایمیل تأیید ناموفق بود: " + errText.slice(0, 300));
  }
}

export async function getSessionUser(request, env) {
  const token = getCookie(request, "session");
  if (!token) return null;

  const session = await env.DB.prepare(
    "SELECT * FROM sessions WHERE token = ?"
  )
    .bind(token)
    .first();
  if (!session) return null;
  if (session.expires_at < Date.now()) {
    await env.DB.prepare("DELETE FROM sessions WHERE token = ?").bind(token).run();
    return null;
  }

  const user = await env.DB.prepare(
    "SELECT id, name, email, created_at, is_admin FROM users WHERE id = ?"
  )
    .bind(session.user_id)
    .first();
  return user || null;
}

// فقط کاربرهای ادمین اجازه عبور دارند؛ در غیر این صورت 403 برمی‌گردد
export async function requireAdmin(request, env) {
  const user = await getSessionUser(request, env);
  if (!user) return { user: null, error: jsonError("ابتدا وارد حساب شوید.", 401) };
  if (!user.is_admin) return { user: null, error: jsonError("دسترسی فقط برای مدیر سایت.", 403) };
  return { user, error: null };
}

// لاگ خطا در لاگ کلادفلر (با wrangler pages deployment tail قابل مشاهده است)
export function logError(context, err) {
  console.error("[NEXORA-ERROR]", context, err && err.stack ? err.stack : String(err));
}
