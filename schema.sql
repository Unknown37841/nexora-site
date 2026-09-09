-- ============================================================
--  Nexora — ساختار کامل دیتابیس (نسخه ۳)
-- ============================================================

CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  salt TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  email_verified INTEGER NOT NULL DEFAULT 0,
  is_admin INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS sessions (
  token TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  expires_at INTEGER NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON sessions(user_id);

-- کدهای تأیید ایمیل / کد ورود دومرحله‌ای (۶ رقمی، هش‌شده)
CREATE TABLE IF NOT EXISTS email_verifications (
  email TEXT PRIMARY KEY,
  code_hash TEXT NOT NULL,
  expires_at INTEGER NOT NULL,
  attempts INTEGER NOT NULL DEFAULT 0,
  last_sent_at INTEGER NOT NULL,
  FOREIGN KEY (email) REFERENCES users(email)
);

-- محصولات (سرویس‌هایی که در سایت فروخته می‌شوند)
CREATE TABLE IF NOT EXISTS products (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  price INTEGER NOT NULL DEFAULT 0,          -- تومان
  period TEXT NOT NULL DEFAULT 'ماهانه',
  icon_text TEXT NOT NULL DEFAULT '',        -- حرف/متن آیکون اگر عکس نبود
  color TEXT NOT NULL DEFAULT '',            -- «رنگ۱|رنگ۲» برای گرادیان آیکون
  badge TEXT NOT NULL DEFAULT '',            -- برچسب مثل «پرفروش»
  icon_url TEXT NOT NULL DEFAULT '',         -- آیکون به‌صورت data URL (اختیاری)
  cover_url TEXT NOT NULL DEFAULT '',        -- کاور به‌صورت data URL (اختیاری)
  active INTEGER NOT NULL DEFAULT 1,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL
);

-- سفارش‌ها (سبد خرید ثبت‌شده؛ پرداخت کارت به کارت دستی و تحویل اشتراک)
CREATE TABLE IF NOT EXISTS orders (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  items TEXT NOT NULL,                       -- JSON: [{id, name, price, qty}]
  total INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',    -- pending | awaiting_verification | paid | rejected | cancelled
  tracking_code TEXT,                        -- شماره یا کد پیگیری بانکی
  sender_card TEXT,                          -- شماره کارت یا ۴ رقم آخر واریزکننده
  customer_contact TEXT,                     -- شماره تماس یا آیدی تلگرام مشتری
  receipt_text TEXT,                         -- توضیحات یا تاریخ و ساعت واریز
  receipt_image TEXT,                        -- تصویر رسید بانکی (data URL)
  admin_note TEXT,                           -- یادداشت ادمین (مثلاً دلیل رد یا توضیحات)
  delivery_text TEXT,                        -- متن اکانت/اشتراک تحویل داده شده به مشتری
  delivered_at INTEGER,                      -- زمان تحویل اشتراک
  paid_at INTEGER,                           -- زمان تایید پرداخت توسط مدیر
  submitted_at INTEGER,                      -- زمان ارسال فیش توسط کاربر
  created_at INTEGER NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE INDEX IF NOT EXISTS idx_orders_user_id ON orders(user_id);
CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);

-- تنظیمات سایت و حساب بانکی جهت دریافت کارت به کارت
CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);
