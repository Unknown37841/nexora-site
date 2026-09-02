-- این فایل رو فقط یک بار، توی Cloudflare D1 Console (تب Console دیتابیس nexora-db) اجرا کن.
-- برای دیتابیسی نوشته شده که از قبل schema.sql قدیمی (بدون email_verified) روش اجرا شده.
-- اگر داری از صفر دیتابیس می‌سازی، لازم نیست این فایل رو اجرا کنی؛ همون schema.sql جدید کافیه.

ALTER TABLE users ADD COLUMN email_verified INTEGER NOT NULL DEFAULT 0;

CREATE TABLE IF NOT EXISTS email_verifications (
  email TEXT PRIMARY KEY,
  code_hash TEXT NOT NULL,
  expires_at INTEGER NOT NULL,
  attempts INTEGER NOT NULL DEFAULT 0,
  last_sent_at INTEGER NOT NULL,
  FOREIGN KEY (email) REFERENCES users(email)
);

-- نکته: کاربرهایی که قبلاً (با کد قدیمی) ثبت‌نام کرده‌اند، email_verified = 0 می‌شوند
-- و تا وقتی کد تأیید رو نزنن نمی‌تونن Login کنن. اگه می‌خوای کاربرهای قدیمی رو معاف کنی،
-- این خط رو هم اجرا کن (اختیاری):
-- UPDATE users SET email_verified = 1;
