// Shared helpers used by every /functions/api/*.js endpoint.
// This file is prefixed with "_" so Cloudflare Pages does NOT treat it as a route.

export function jsonResponse(data, status = 200, extraHeaders = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8", ...extraHeaders },
  });
}

export function jsonError(message, status = 400) {
  return jsonResponse({ ok: false, error: message }, status);
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
    "SELECT id, name, email, created_at FROM users WHERE id = ?"
  )
    .bind(session.user_id)
    .first();
  return user || null;
}
