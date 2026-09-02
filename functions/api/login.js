import {
  jsonResponse,
  jsonError,
  isValidEmail,
  hashPassword,
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

  const email = (body.email || "").toString().trim().toLowerCase();
  const password = (body.password || "").toString();

  if (!isValidEmail(email)) return jsonError("لطفاً یک ایمیل معتبر وارد کنید.", 400);
  if (!password) return jsonError("لطفاً رمز عبور را وارد کنید.", 400);

  const user = await env.DB.prepare(
    "SELECT id, name, email, password_hash, salt FROM users WHERE email = ?"
  )
    .bind(email)
    .first();

  if (!user) return jsonError("ایمیل یا رمز عبور اشتباه است.", 401);

  const computedHash = await hashPassword(password, user.salt);
  if (computedHash !== user.password_hash) {
    return jsonError("ایمیل یا رمز عبور اشتباه است.", 401);
  }

  const token = await createSession(env, user.id);

  return jsonResponse(
    { ok: true, user: { id: user.id, name: user.name, email: user.email } },
    200,
    { "Set-Cookie": sessionCookieHeader(token) }
  );
}
