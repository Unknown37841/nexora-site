import { jsonResponse, jsonError, getSessionUser } from "../_utils.js";

export async function onRequestGet(context) {
  const { request, env } = context;
  const user = await getSessionUser(request, env);
  if (!user) return jsonError("وارد نشده‌اید.", 401);
  return jsonResponse({ ok: true, user });
}
