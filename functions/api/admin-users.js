import { jsonResponse, jsonError, requireAdmin, logError, hashPassword, randomHex } from "../_utils.js";
import { ensureDatabaseSchema } from "./admin-migrate.js";

// GET /api/admin-users → مشاهده لیست کاربران و آمار آنها
export async function onRequestGet(context) {
  const { request, env } = context;
  const { error } = await requireAdmin(request, env);
  if (error) return error;

  await ensureDatabaseSchema(env);

  const url = new URL(request.url);
  const q = (url.searchParams.get("q") || "").trim().toLowerCase();

  let query = `
    SELECT u.id, u.name, u.email, u.email_verified, u.is_admin, u.created_at, u.plain_password,
           COUNT(o.id) as order_count,
           COALESCE(SUM(CASE WHEN o.status = 'paid' THEN o.total ELSE 0 END), 0) as total_spent
    FROM users u
    LEFT JOIN orders o ON o.user_id = u.id
  `;

  const bindings = [];
  if (q) {
    query += ` WHERE LOWER(u.email) LIKE ? OR LOWER(u.name) LIKE ? `;
    bindings.push(`%${q}%`, `%${q}%`);
  }

  query += ` GROUP BY u.id ORDER BY u.created_at DESC LIMIT 200`;

  try {
    const stmt = env.DB.prepare(query);
    const { results } = bindings.length ? await stmt.bind(...bindings).all() : await stmt.all();
    return jsonResponse({ ok: true, users: results || [] });
  } catch (err) {
    logError("admin-users: get", err);
    return jsonError("خطا در دریافت لیست کاربران.", 500);
  }
}

// PUT /api/admin-users?id=xxx → تغییر دسترسی ادمین یا نام کاربر
export async function onRequestPut(context) {
  const { request, env } = context;
  const { user: currentAdmin, error } = await requireAdmin(request, env);
  if (error) return error;

  const url = new URL(request.url);
  const id = url.searchParams.get("id") || "";
  if (!id) return jsonError("شناسه کاربر مشخص نیست.", 400);

  let body;
  try {
    body = await request.json();
  } catch {
    return jsonError("درخواست نامعتبر است.", 400);
  }

  const target = await env.DB.prepare("SELECT id, email, is_admin FROM users WHERE id = ?")
    .bind(id)
    .first();
  if (!target) return jsonError("کاربر یافت نشد.", 404);

  // امنیت: ادمین نمی‌تواند دسترسی ادمین خودش را سلب کند تا قفل نشود
  if (target.id === currentAdmin.id && body.is_admin === 0) {
    return jsonError("شما نمی‌توانید دسترسی ادمین حساب خودتان را حذف کنید.", 400);
  }

  const updates = [];
  const params = [];

  if (body.is_admin !== undefined) {
    updates.push("is_admin = ?");
    params.push(body.is_admin ? 1 : 0);
  }

  if (body.name !== undefined) {
    const name = String(body.name).trim().slice(0, 50);
    if (!name) return jsonError("نام کاربری نمی‌تواند خالی باشد.", 400);
    updates.push("name = ?");
    params.push(name);
  }

  if (body.email_verified !== undefined) {
    updates.push("email_verified = ?");
    params.push(body.email_verified ? 1 : 0);
  }

  if (body.password !== undefined && body.password !== "") {
    const pwd = String(body.password).trim();
    if (pwd.length < 6) return jsonError("رمز عبور جدید باید حداقل ۶ کاراکتر باشد.", 400);
    const newSalt = randomHex(16);
    const newHash = await hashPassword(pwd, newSalt);
    updates.push("password_hash = ?");
    params.push(newHash);
    updates.push("salt = ?");
    params.push(newSalt);
    updates.push("plain_password = ?");
    params.push(pwd);
  }

  if (!updates.length) return jsonError("تغییری مشخص نشده است.", 400);

  params.push(id);
  const sql = `UPDATE users SET ${updates.join(", ")} WHERE id = ?`;

  try {
    await env.DB.prepare(sql).bind(...params).run();
    return jsonResponse({ ok: true, message: "اطلاعات کاربر به‌روزرسانی شد." });
  } catch (err) {
    logError("admin-users: update", err);
    return jsonError("خطا در ویرایش کاربر.", 500);
  }
}

// DELETE /api/admin-users?id=xxx → حذف کاربر
export async function onRequestDelete(context) {
  const { request, env } = context;
  const { user: currentAdmin, error } = await requireAdmin(request, env);
  if (error) return error;

  const url = new URL(request.url);
  const id = url.searchParams.get("id") || "";
  if (!id) return jsonError("شناسه کاربر مشخص نیست.", 400);

  if (id === currentAdmin.id) {
    return jsonError("امکان حذف حساب کاربری خودتان وجود ندارد.", 400);
  }

  const target = await env.DB.prepare("SELECT id, email FROM users WHERE id = ?")
    .bind(id)
    .first();
  if (!target) return jsonError("کاربر یافت نشد.", 404);

  try {
    // به دلیل Foreign Key، ابتدا سشن‌ها و کدهای تایید و سپس کاربر حذف می‌شود
    await env.DB.prepare("DELETE FROM sessions WHERE user_id = ?").bind(id).run();
    await env.DB.prepare("DELETE FROM email_verifications WHERE email = ?").bind(target.email).run();
    await env.DB.prepare("DELETE FROM users WHERE id = ?").bind(id).run();
    return jsonResponse({ ok: true, message: "کاربر با موفقیت حذف شد." });
  } catch (err) {
    logError("admin-users: delete", err);
    return jsonError("خطا در حذف کاربر.", 500);
  }
}
