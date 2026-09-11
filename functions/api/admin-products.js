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

// GET /api/admin-products → همه محصولات (حتی غیرفعال) فقط برای ادمین
export async function onRequestGet(context) {
  const { request, env } = context;
  const { error } = await requireAdmin(request, env);
  if (error) return error;

  const { results } = await env.DB.prepare(
    `SELECT * FROM products ORDER BY sort_order ASC, created_at ASC`
  ).all();

  return jsonResponse({ ok: true, products: results || [] });
}

// POST /api/admin-products → محصول جدید
export async function onRequestPost(context) {
  const { request, env } = context;
  const { error } = await requireAdmin(request, env);
  if (error) return error;

  let body;
  try {
    body = await request.json();
  } catch {
    return jsonError("درخواست نامعتبر است.", 400);
  }

  const name = cleanText(body.name, 120);
  if (!name) return jsonError("نام محصول الزامی است.", 400);

  let iconUrl, coverUrl;
  try {
    iconUrl = validateImage(body.icon_url, "آیکون");
    coverUrl = validateImage(body.cover_url, "کاور");
  } catch (err) {
    return jsonError(err.message, 400);
  }

  const longDescription = (body.long_description ?? "").toString().trim().slice(0, 10000);
  const galleryImages = (body.gallery_images ?? "").toString().trim().slice(0, 3000000);
  const features = (body.features ?? "").toString().trim().slice(0, 4000);
  const requirements = (body.requirements ?? "").toString().trim().slice(0, 1000);
  const customTabs = (body.custom_tabs ?? "").toString().trim().slice(0, 30000);

  const id = "p-" + crypto.randomUUID().slice(0, 8);
  const now = Date.now();

  await env.DB.prepare(
    `INSERT INTO products
       (id, name, description, price, period, icon_text, color, badge,
        icon_url, cover_url, active, sort_order, created_at,
        long_description, gallery_images, features, requirements, custom_tabs)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  )
    .bind(
      id,
      name,
      cleanText(body.description, 500),
      Math.max(0, parseInt(body.price, 10) || 0),
      cleanText(body.period, 40) || "ماهانه",
      cleanText(body.icon_text, 4),
      cleanText(body.color, 40),
      cleanText(body.badge, 30),
      iconUrl,
      coverUrl,
      body.active === false ? 0 : 1,
      parseInt(body.sort_order, 10) || 99,
      now,
      longDescription,
      galleryImages,
      features,
      requirements,
      customTabs
    )
    .run();

  return jsonResponse({ ok: true, id }, 201);
}

// PUT /api/admin-products?id=p-xxxx → ویرایش محصول
export async function onRequestPut(context) {
  const { request, env } = context;
  const { error } = await requireAdmin(request, env);
  if (error) return error;

  const url = new URL(request.url);
  const id = url.searchParams.get("id") || "";
  if (!id) return jsonError("شناسه محصول مشخص نیست.", 400);

  let body;
  try {
    body = await request.json();
  } catch {
    return jsonError("درخواست نامعتبر است.", 400);
  }

  const existing = await env.DB.prepare("SELECT id FROM products WHERE id = ?")
    .bind(id)
    .first();
  if (!existing) return jsonError("محصول پیدا نشد.", 404);

  let iconUrl, coverUrl;
  try {
    iconUrl = validateImage(body.icon_url, "آیکون");
    coverUrl = validateImage(body.cover_url, "کاور");
  } catch (err) {
    return jsonError(err.message, 400);
  }

  const longDescription = (body.long_description ?? "").toString().trim().slice(0, 10000);
  const galleryImages = (body.gallery_images ?? "").toString().trim().slice(0, 3000000);
  const features = (body.features ?? "").toString().trim().slice(0, 4000);
  const requirements = (body.requirements ?? "").toString().trim().slice(0, 1000);
  const customTabs = (body.custom_tabs ?? "").toString().trim().slice(0, 30000);

  await env.DB.prepare(
    `UPDATE products SET
       name = ?, description = ?, price = ?, period = ?, icon_text = ?,
       color = ?, badge = ?, icon_url = ?, cover_url = ?, active = ?, sort_order = ?,
       long_description = ?, gallery_images = ?, features = ?, requirements = ?, custom_tabs = ?
     WHERE id = ?`
  )
    .bind(
      cleanText(body.name, 120),
      cleanText(body.description, 500),
      Math.max(0, parseInt(body.price, 10) || 0),
      cleanText(body.period, 40) || "ماهانه",
      cleanText(body.icon_text, 4),
      cleanText(body.color, 40),
      cleanText(body.badge, 30),
      iconUrl,
      coverUrl,
      body.active === false ? 0 : 1,
      parseInt(body.sort_order, 10) || 99,
      longDescription,
      galleryImages,
      features,
      requirements,
      customTabs,
      id
    )
    .run();

  return jsonResponse({ ok: true });
}

// DELETE /api/admin-products?id=p-xxxx → حذف محصول
export async function onRequestDelete(context) {
  const { request, env } = context;
  const { error } = await requireAdmin(request, env);
  if (error) return error;

  const url = new URL(request.url);
  const id = url.searchParams.get("id") || "";
  if (!id) return jsonError("شناسه محصول مشخص نیست.", 400);

  await env.DB.prepare("DELETE FROM products WHERE id = ?").bind(id).run();
  return jsonResponse({ ok: true });
}
