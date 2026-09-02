import {
  jsonResponse,
  jsonError,
  isValidEmail,
  hashPassword,
  randomHex,
  createSession,
  sessionCookieHeader,
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

  const existing = await env.DB.prepare("SELECT id FROM users WHERE email = ?")
    .bind(email)
    .first();
  if (existing) return jsonError("این ایمیل قبلاً ثبت‌نام کرده است.", 409);

  const salt = randomHex(16);
  const passwordHash = await hashPassword(password, salt);
  const id = randomHex(16);
  const now = Date.now();

  await env.DB.prepare(
    "INSERT INTO users (id, name, email, password_hash, salt, created_at) VALUES (?, ?, ?, ?, ?, ?)"
  )
    .bind(id, name, email, passwordHash, salt, now)
    .run();

  const token = await createSession(env, id);

  return jsonResponse(
    { ok: true, user: { id, name, email } },
    201,
    { "Set-Cookie": sessionCookieHeader(token) }
  );
}
