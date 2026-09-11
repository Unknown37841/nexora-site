import { jsonResponse, jsonError, requireAdmin, logError } from "../_utils.js";
import { ensureDatabaseSchema } from "./admin-migrate.js";

const MAX_IMAGE_CHARS = 700_000; // حدود ۷۰۰ کیلوبایت برای هر data URL

function cleanText(v, max = 300) {
  return (v ?? "").toString().trim().slice(0, max);
}

function validateImage(v, label) {
  const s = (v ?? "").toString();
  if (!s) return "";
  if (s.length > MAX_IMAGE_CHARS) {
    throw new Error(`حجم ${label} زیاد است (حداکثر حدود ۷۰۰ کیلوبایت).`);
  }
  if (!/^data:image\/(png|jpe?g|webp|gif|svg\+xml);base64,/.test(s)) {
    throw new Error(`فرمت ${label} معتبر نیست.`);
  }
  return s;
}

// GET /api/admin-courses → همه دوره‌ها (حتی غیرفعال) فقط برای ادمین
export async function onRequestGet(context) {
  const { request, env } = context;
  const { error } = await requireAdmin(request, env);
  if (error) return error;

  await ensureDatabaseSchema(env);

  const { results } = await env.DB.prepare(
    `SELECT * FROM courses ORDER BY sort_order ASC, created_at ASC`
  ).all();

  return jsonResponse({ ok: true, courses: results || [] });
}

// POST /api/admin-courses → دوره جدید
export async function onRequestPost(context) {
  const { request, env } = context;
  const { error } = await requireAdmin(request, env);
  if (error) return error;

  await ensureDatabaseSchema(env);

  let body;
  try {
    body = await request.json();
  } catch {
    return jsonError("درخواست نامعتبر است.", 400);
  }

  const title = cleanText(body.title, 160);
  if (!title) return jsonError("عنوان دوره الزامی است.", 400);

  let iconUrl, coverUrl;
  try {
    iconUrl = validateImage(body.icon_url, "آیکون دوره");
    coverUrl = validateImage(body.cover_url, "کاور دوره");
  } catch (err) {
    return jsonError(err.message, 400);
  }

  const id = "c-" + crypto.randomUUID().slice(0, 8);
  const now = Date.now();

  const telegramLink = cleanText(body.telegram_link, 300);
  if (telegramLink && !/^(https?:\/\/)?t\.me\/.+/i.test(telegramLink) && !/^(https?:\/\/)?telegram\.me\/.+/i.test(telegramLink)) {
    return jsonError("لینک تلگرام باید معتبر باشد (مثلاً https://t.me/YourPrivateChannel).", 400);
  }

  try {
    await env.DB.prepare(
      `INSERT INTO courses
         (id, title, subtitle, description, long_description, price, old_price,
          level, duration, lessons_count, icon_url, cover_url, gallery_images,
          features, prerequisites, telegram_link, telegram_note, custom_tabs,
          active, sort_order, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
      .bind(
        id,
        title,
        cleanText(body.subtitle, 200),
        cleanText(body.description, 500),
        (body.long_description ?? "").toString().trim().slice(0, 10000),
        Math.max(0, parseInt(body.price, 10) || 0),
        Math.max(0, parseInt(body.old_price, 10) || 0) || null,
        cleanText(body.level, 40),
        cleanText(body.duration, 60),
        Math.max(0, parseInt(body.lessons_count, 10) || 0) || null,
        iconUrl,
        coverUrl,
        (body.gallery_images ?? "").toString().trim().slice(0, 3000000),
        (body.features ?? "").toString().trim().slice(0, 4000),
        (body.prerequisites ?? "").toString().trim().slice(0, 2000),
        telegramLink,
        (body.telegram_note ?? "").toString().trim().slice(0, 500),
        (body.custom_tabs ?? "").toString().trim().slice(0, 30000),
        body.active === false ? 0 : 1,
        parseInt(body.sort_order, 10) || 99,
        now
      )
      .run();

    return jsonResponse({ ok: true, id }, 201);
  } catch (err) {
    logError("admin-courses: insert", err);
    return jsonError("ثبت دوره ناموفق بود.", 500);
  }
}

// PUT /api/admin-courses?id=c-xxxx → ویرایش دوره
export async function onRequestPut(context) {
  const { request, env } = context;
  const { error } = await requireAdmin(request, env);
  if (error) return error;

  await ensureDatabaseSchema(env);

  const url = new URL(request.url);
  const id = url.searchParams.get("id") || "";
  if (!id) return jsonError("شناسه دوره مشخص نیست.", 400);

  let body;
  try {
    body = await request.json();
  } catch {
    return jsonError("درخواست نامعتبر است.", 400);
  }

  const existing = await env.DB.prepare("SELECT id FROM courses WHERE id = ?")
    .bind(id)
    .first();
  if (!existing) return jsonError("دوره پیدا نشد.", 404);

  const title = cleanText(body.title, 160);
  if (!title) return jsonError("عنوان دوره الزامی است.", 400);

  let iconUrl, coverUrl;
  try {
    iconUrl = validateImage(body.icon_url, "آیکون دوره");
    coverUrl = validateImage(body.cover_url, "کاور دوره");
  } catch (err) {
    return jsonError(err.message, 400);
  }

  const telegramLink = cleanText(body.telegram_link, 300);
  if (telegramLink && !/^(https?:\/\/)?t\.me\/.+/i.test(telegramLink) && !/^(https?:\/\/)?telegram\.me\/.+/i.test(telegramLink)) {
    return jsonError("لینک تلگرام باید معتبر باشد (مثلاً https://t.me/YourPrivateChannel).", 400);
  }

  try {
    await env.DB.prepare(
      `UPDATE courses SET
         title = ?, subtitle = ?, description = ?, long_description = ?,
         price = ?, old_price = ?, level = ?, duration = ?, lessons_count = ?,
         icon_url = ?, cover_url = ?, gallery_images = ?, features = ?,
         prerequisites = ?, telegram_link = ?, telegram_note = ?, custom_tabs = ?,
         active = ?, sort_order = ?
       WHERE id = ?`
    )
      .bind(
        title,
        cleanText(body.subtitle, 200),
        cleanText(body.description, 500),
        (body.long_description ?? "").toString().trim().slice(0, 10000),
        Math.max(0, parseInt(body.price, 10) || 0),
        Math.max(0, parseInt(body.old_price, 10) || 0) || null,
        cleanText(body.level, 40),
        cleanText(body.duration, 60),
        Math.max(0, parseInt(body.lessons_count, 10) || 0) || null,
        iconUrl,
        coverUrl,
        (body.gallery_images ?? "").toString().trim().slice(0, 3000000),
        (body.features ?? "").toString().trim().slice(0, 4000),
        (body.prerequisites ?? "").toString().trim().slice(0, 2000),
        telegramLink,
        (body.telegram_note ?? "").toString().trim().slice(0, 500),
        (body.custom_tabs ?? "").toString().trim().slice(0, 30000),
        body.active === false ? 0 : 1,
        parseInt(body.sort_order, 10) || 99,
        id
      )
      .run();

    return jsonResponse({ ok: true });
  } catch (err) {
    logError("admin-courses: update", err);
    return jsonError("به‌روزرسانی دوره ناموفق بود.", 500);
  }
}

// DELETE /api/admin-courses?id=c-xxxx → حذف دوره
export async function onRequestDelete(context) {
  const { request, env } = context;
  const { error } = await requireAdmin(request, env);
  if (error) return error;

  const url = new URL(request.url);
  const id = url.searchParams.get("id") || "";
  if (!id) return jsonError("شناسه دوره مشخص نیست.", 400);

  try {
    await env.DB.prepare("DELETE FROM courses WHERE id = ?").bind(id).run();
    return jsonResponse({ ok: true });
  } catch (err) {
    logError("admin-courses: delete", err);
    return jsonError("حذف دوره ناموفق بود.", 500);
  }
}
