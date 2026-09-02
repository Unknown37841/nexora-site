-- ============================================================
--  مهاجرت نسخه ۲ — فقط برای دیتابیس موجود (nexora-db)
--  یک بار در Console دیتابیس یا با wrangler اجرا شود.
-- ============================================================

-- نقش ادمین برای کاربرها
ALTER TABLE users ADD COLUMN is_admin INTEGER NOT NULL DEFAULT 0;

-- محصولات
CREATE TABLE IF NOT EXISTS products (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  price INTEGER NOT NULL DEFAULT 0,
  period TEXT NOT NULL DEFAULT 'ماهانه',
  icon_text TEXT NOT NULL DEFAULT '',
  color TEXT NOT NULL DEFAULT '',
  badge TEXT NOT NULL DEFAULT '',
  icon_url TEXT NOT NULL DEFAULT '',
  cover_url TEXT NOT NULL DEFAULT '',
  active INTEGER NOT NULL DEFAULT 1,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL
);

-- سفارش‌ها
CREATE TABLE IF NOT EXISTS orders (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  items TEXT NOT NULL,
  total INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  created_at INTEGER NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE INDEX IF NOT EXISTS idx_orders_user_id ON orders(user_id);

-- محصولات اولیه (همان ۶ سرویس فعلی سایت)
INSERT INTO products (id, name, description, price, period, icon_text, color, badge, active, sort_order, created_at) VALUES
('p-gemini',  'Gemini Pro',      'دسترسی کامل به هوش مصنوعی پیشرفته گوگل با قابلیت‌های پریمیوم.', 189000, 'ماهانه', 'G', '#4285f4|#34a853', 'محبوب',  1, 1, 1788000000000),
('p-chatgpt', 'ChatGPT Plus',    'اشتراک رسمی OpenAI با دسترسی به GPT-4 و ابزارهای پیشرفته.',     249000, 'ماهانه', 'C', '#10a37f|#0d8a6a', 'پرفروش', 1, 2, 1788000000000),
('p-claude',  'Claude Pro',      'دستیار هوشمند Anthropic با قابلیت‌های تحلیلی و نوشتاری قوی.',   229000, 'ماهانه', 'A', '#d97757|#c2410c', '',       1, 3, 1788000000000),
('p-spotify', 'Spotify Premium', 'میلیون‌ها آهنگ و پادکست بدون تبلیغات و با کیفیت بالا.',          89000, 'ماهانه', 'S', '#1db954|#0f7a37', '',       1, 4, 1788000000000),
('p-youtube', 'YouTube Premium', 'تماشای ویدیو بدون تبلیغات + YouTube Music به صورت رایگان.',     119000, 'ماهانه', 'Y', '#ff0000|#cc0000', '',       1, 5, 1788000000000),
('p-netflix', 'Netflix Premium', 'تماشای فیلم و سریال‌های روز دنیا با کیفیت 4K و بدون محدودیت.',  149000, 'ماهانه', 'N', '#e50914|#831010', '',       1, 6, 1788000000000);
