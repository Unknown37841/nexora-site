import { jsonResponse, getCookie, clearSessionCookieHeader } from "../_utils.js";

export async function onRequestPost(context) {
  const { request, env } = context;
  const token = getCookie(request, "session");
  if (token) {
    await env.DB.prepare("DELETE FROM sessions WHERE token = ?").bind(token).run();
  }
  return jsonResponse({ ok: true }, 200, { "Set-Cookie": clearSessionCookieHeader() });
}
