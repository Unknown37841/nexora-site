import { jsonResponse } from "../_utils.js";
import { ensureDatabaseSchema } from "./admin-migrate.js";

// لیست عمومی دوره‌های آموزشی فعال (برای صفحه اصلی — محصول اصلی سایت)
export async function onRequestGet(context) {
  const { env } = context;

  await ensureDatabaseSchema(env);

  const { results } = await env.DB.prepare(
    `SELECT id, title, subtitle, description, long_description, price, old_price,
            level, duration, lessons_count, icon_url, cover_url, gallery_images,
            features, prerequisites, custom_tabs
     FROM courses
     WHERE active = 1
     ORDER BY sort_order ASC, created_at ASC`
  ).all();

  const courses = (results || []).map((c) => ({
    ...c,
    price: Number(c.price),
    active: true,
  }));

  return jsonResponse({ ok: true, courses });
}
