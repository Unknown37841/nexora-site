import { jsonResponse } from "../_utils.js";
import { ensureDatabaseSchema } from "./admin-migrate.js";

// GET /api/auth-config → دریافت تنظیمات عمومی احراز هویت (مانند Google Client ID)
export async function onRequestGet(context) {
  const { env } = context;

  await ensureDatabaseSchema(env);

  let googleClientId = (env.GOOGLE_CLIENT_ID || "").toString().trim();

  if (!googleClientId) {
    try {
      const row = await env.DB.prepare(
        "SELECT value FROM settings WHERE key = 'google_client_id'"
      ).first();
      if (row && row.value) {
        googleClientId = row.value.trim();
      }
    } catch (_) {}
  }

  return jsonResponse({
    ok: true,
    googleClientId,
  });
}
