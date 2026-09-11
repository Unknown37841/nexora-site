import { jsonResponse } from "../_utils.js";
import { ensureDatabaseSchema } from "./admin-migrate.js";

// لیست عمومی محصولات فعال سایت (برای صفحه اصلی)
export async function onRequestGet(context) {
  const { env } = context;

  await ensureDatabaseSchema(env);

  const { results } = await env.DB.prepare(
    `SELECT id, name, description, price, period, icon_text, color, badge, icon_url, cover_url
     FROM products
     WHERE active = 1
     ORDER BY sort_order ASC, created_at ASC`
  ).all();

  const products = (results || []).map((p) => ({
    ...p,
    price: Number(p.price),
    active: true,
  }));

  return jsonResponse({ ok: true, products });
}
