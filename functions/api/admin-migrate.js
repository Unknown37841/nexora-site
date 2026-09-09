import { jsonResponse, jsonError, requireAdmin, logError } from "../_utils.js";

// تابع تضمینی برای اجرای مهاجرت در D1 به صورت خودکار و بدون نیاز به دسترسی دستی
export async function ensureDatabaseSchema(env) {
  try {
    // 1. جدول تنظیمات
    await env.DB.prepare(`
      CREATE TABLE IF NOT EXISTS settings (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL
      )
    `).run();

    // تنظیمات کارت بانکی محمد اورک
    const defaultSettings = [
      ['card_number', '6219-8619-1265-2186'],
      ['card_holder', 'محمد اورک'],
      ['card_bank', 'بانک سامان'],
      ['card_sheba', 'IR000000000000000000000000'],
      ['card_help', 'لطفاً مبلغ سفارش را به شماره کارت بالا واریز نمایید و سپس عکس فیش و کد رهگیری را ثبت کنید. پس از تأیید، مشخصات اشتراک در حساب کاربری شما تحویل داده می‌شود.']
    ];

    for (const [k, v] of defaultSettings) {
      await env.DB.prepare(
        "INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?)"
      ).bind(k, v).run();
    }

    // در صورتی که قبلاً مقدار تستی ثبت شده بود، به کارت جدید آقای اورک به‌روزرسانی شود
    await env.DB.prepare(`
      UPDATE settings SET value = '6219-8619-1265-2186'
      WHERE key = 'card_number' AND value LIKE '6037%'
    `).run();
    await env.DB.prepare(`
      UPDATE settings SET value = 'بانک سامان'
      WHERE key = 'card_bank' AND value LIKE 'بانک ملی%'
    `).run();

    // 2. ستون‌های جدید برای جدول orders
    const newColumns = [
      "ALTER TABLE orders ADD COLUMN tracking_code TEXT",
      "ALTER TABLE orders ADD COLUMN sender_card TEXT",
      "ALTER TABLE orders ADD COLUMN customer_contact TEXT",
      "ALTER TABLE orders ADD COLUMN receipt_text TEXT",
      "ALTER TABLE orders ADD COLUMN receipt_image TEXT",
      "ALTER TABLE orders ADD COLUMN admin_note TEXT",
      "ALTER TABLE orders ADD COLUMN delivery_text TEXT",
      "ALTER TABLE orders ADD COLUMN delivered_at INTEGER",
      "ALTER TABLE orders ADD COLUMN paid_at INTEGER",
      "ALTER TABLE orders ADD COLUMN submitted_at INTEGER"
    ];

    for (const sql of newColumns) {
      try {
        await env.DB.prepare(sql).run();
      } catch (e) {
        // اگر ستون از قبل بود، خطای تکراری نادیده گرفته می‌شود
      }
    }

    return { ok: true };
  } catch (err) {
    logError("ensureDatabaseSchema", err);
    return { ok: false, error: err.message };
  }
}

// اندپوینت ادمین برای فراخوانی یا بررسی وضعیت مایگریشن
export async function onRequestPost(context) {
  const { request, env } = context;
  const { error } = await requireAdmin(request, env);
  if (error) return error;

  const res = await ensureDatabaseSchema(env);
  if (!res.ok) return jsonError(res.error || "خطا در ارتقای دیتابیس", 500);
  return jsonResponse({ ok: true, message: "دیتابیس با موفقیت به‌روزرسانی شد." });
}
