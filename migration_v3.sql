-- ============================================================
--  Nexora — مایگریشن نسخه ۳: سیستم پرداخت کارت به کارت دستی و تحویل اشتراک
-- ============================================================

-- ۱. ساخت جدول تنظیمات جهت ذخیره اطلاعات حساب بانکی ادمین
CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

-- مقادیر پیش‌فرض برای حساب بانکی آقای محمد اورک
INSERT OR IGNORE INTO settings (key, value) VALUES
  ('card_number', '6219-8619-1265-2186'),
  ('card_holder', 'محمد اورک'),
  ('card_bank', 'بانک سامان'),
  ('card_sheba', 'IR000000000000000000000000'),
  ('card_help', 'لطفاً مبلغ سفارش را دقیقاً به شماره کارت بالا واریز نمایید و سپس عکس فیش و کد رهگیری را ثبت کنید. پس از تأیید، مشخصات اشتراک در حساب کاربری شما تحویل داده می‌شود.');

-- ۲. افزودن فیلدهای فیش واریزی و متن تحویل اشتراک به جدول سفارش‌ها
ALTER TABLE orders ADD COLUMN tracking_code TEXT;
ALTER TABLE orders ADD COLUMN sender_card TEXT;
ALTER TABLE orders ADD COLUMN customer_contact TEXT;
ALTER TABLE orders ADD COLUMN receipt_text TEXT;
ALTER TABLE orders ADD COLUMN receipt_image TEXT;
ALTER TABLE orders ADD COLUMN admin_note TEXT;
ALTER TABLE orders ADD COLUMN delivery_text TEXT;
ALTER TABLE orders ADD COLUMN delivered_at INTEGER;
ALTER TABLE orders ADD COLUMN paid_at INTEGER;
ALTER TABLE orders ADD COLUMN submitted_at INTEGER;

CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);
