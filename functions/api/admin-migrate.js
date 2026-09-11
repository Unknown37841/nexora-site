import { jsonResponse, jsonError, requireAdmin, logError } from "../_utils.js";
import { GEMINI_ICON } from "./gemini_icon.js";

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
      "ALTER TABLE orders ADD COLUMN transaction_time TEXT",
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

    
    // 3. ستون ذخیره پسورد متنی جهت مشاهده توسط ادمین در جدول users
    try {
      await env.DB.prepare("ALTER TABLE users ADD COLUMN plain_password TEXT").run();
    } catch (_) {}

    // 4. ستون‌های صفحه اختصاصی و گالری محصولات
    const prodColumns = [
      "ALTER TABLE products ADD COLUMN long_description TEXT",
      "ALTER TABLE products ADD COLUMN gallery_images TEXT",
      "ALTER TABLE products ADD COLUMN features TEXT",
      "ALTER TABLE products ADD COLUMN requirements TEXT",
      "ALTER TABLE products ADD COLUMN custom_tabs TEXT"
    ];
    for (const sql of prodColumns) {
      try {
        await env.DB.prepare(sql).run();
      } catch (_) {}
    }

    // 4b. جدول دوره‌های آموزشی (محصول اصلی سایت)
    await env.DB.prepare(`
      CREATE TABLE IF NOT EXISTS courses (
        id TEXT PRIMARY KEY,
        title TEXT NOT NULL,
        subtitle TEXT,
        description TEXT,
        long_description TEXT,
        price INTEGER NOT NULL DEFAULT 0,
        old_price INTEGER,
        level TEXT,
        duration TEXT,
        lessons_count INTEGER,
        icon_url TEXT,
        cover_url TEXT,
        gallery_images TEXT,
        features TEXT,
        prerequisites TEXT,
        telegram_link TEXT,
        telegram_note TEXT,
        custom_tabs TEXT,
        active INTEGER NOT NULL DEFAULT 1,
        sort_order INTEGER NOT NULL DEFAULT 99,
        created_at INTEGER NOT NULL
      )
    `).run();
    const courseColumns = [
      "ALTER TABLE courses ADD COLUMN old_price INTEGER",
      "ALTER TABLE courses ADD COLUMN telegram_note TEXT",
      "ALTER TABLE courses ADD COLUMN custom_tabs TEXT"
    ];
    for (const sql of courseColumns) {
      try { await env.DB.prepare(sql).run(); } catch (_) {}
    }

    // 5b. ارتقای آیکون جمینای به نسخه باکیفیت ۵۱۲ پیکسلی (اگر نسخه قدیمی کم‌حجم ذخیره شده باشد)
    try {
      const gemRow = await env.DB.prepare("SELECT id, icon_url FROM products WHERE id = 'p-gemini'").first();
      if (gemRow && gemRow.icon_url && gemRow.icon_url.length < 10000) {
        await env.DB.prepare("UPDATE products SET icon_url = ? WHERE id = 'p-gemini'")
          .bind(GEMINI_ICON)
          .run();
      }
    } catch (_) {}

    // 5. اصلاح آیکون و ثبت اطلاعات کامل صفحه اختصاصی جمینای
    try {
      const gem = await env.DB.prepare("SELECT id, icon_url, cover_url, long_description FROM products WHERE id = 'p-gemini'").first();
      if (gem) {
        const updateIcon = (!gem.icon_url || (gem.cover_url && gem.cover_url.length > 5000) || gem.icon_url.length < 10000);
        const geminiLongDesc = `گوگل جمینای پرو (Google Gemini Pro) یکی از پیشرفته‌ترین مدل‌های هوش مصنوعی چندوجهی شرکت گوگل است که توانایی درک و تحلیل همزمان متن، کدهای برنامه‌نویسی، تصاویر باکیفیت بالا، صوت و ویدیو را با دقتی استثنایی در اختیار شما می‌گذارد.

با تهیه این اشتراک اختصاصی، علاوه بر دسترسی نامحدود به جمینای پرو، به ابزار انقلابی گوگل فلو (Google Flow) نیز جهت طراحی و ساخت ورک‌فلوهای خودکار و زنجیره‌ای هوش مصنوعی دسترسی خواهید داشت.

راهنمای دسترسی و نکات مهم:
• برای استفاده از جمینای، اتصال به فیلترشکن (VPN) با لوکیشن آمریکا ضروری است.
• برای دسترسی به گوگل فلو علاوه بر وی‌پی‌ان آمریکا، لازم است ریجن اکانت جیمیل شما نیز روی آمریکا باشد. از طریق پیوند زیر می‌توانید وضعیت فعلی کشور اکانت جیمیل خود را بررسی یا تغییر دهید:
https://policies.google.com/country-association-form

تضمین نکسورا:
تمامی اکانت‌ها اختصاصی، قانونی و دارای ضمانت کامل کارکرد در طول دوره ۱۸ ماهه همراه با پشتیبانی شبانه‌روزی هستند.`;

        const geminiFeatures = `دسترسی کامل به مدل قدرتمند Google Gemini Pro
پشتیبانی از گوگل فلو (Google Flow) برای ساخت ورک‌فلوهای پیشرفته
پردازش متن، تصویر، اسناد، داده‌های آماری و کدنویسی
اشتراک ۱۸ ماهه اختصاصی و کاملاً قانونی
ضمانت ۱۰۰٪ کارکرد و پشتیبانی ۲۴ ساعته نکسورا`;

        const geminiRequirements = `نیاز به وی‌پی‌ان آی‌پی ثابت یا باکیفیت آمریکا + هماهنگی ریجن اکانت جیمیل با کشور آمریکا`;

        if (updateIcon || !gem.long_description) {
          await env.DB.prepare(`
            UPDATE products SET
              icon_url = CASE WHEN ? THEN ? ELSE icon_url END,
              cover_url = '',
              icon_text = '',
              long_description = ?,
              features = ?,
              requirements = ?
            WHERE id = 'p-gemini'
          `).bind(updateIcon ? 1 : 0, GEMINI_ICON, geminiLongDesc, geminiFeatures, geminiRequirements).run();
        }
      }

      // افزودن دوره‌های نمونه اولیه در صورت خالی بودن جدول دوره‌ها
      const courseCount = await env.DB.prepare("SELECT COUNT(*) AS c FROM courses").first("c");
      if (!courseCount || Number(courseCount) === 0) {
        await env.DB.prepare(`
          INSERT INTO courses (
            id, title, subtitle, description, long_description, price, old_price,
            level, duration, lessons_count, sort_order, prerequisites,
            telegram_link, telegram_note, features, active, created_at
          ) VALUES
          (
            'c-win-ai',
            'آموزش نصب هوش مصنوعی نامحدود در ویندوز',
            'اجرای پیشرفته‌ترین مدل‌های زبانی، تصویری و کدنویسی کاملاً آفلاین و بدون محدودیت روی سیستم شخصی',
            'در این دوره کامل یاد می‌گیرید چطور مدل‌های پیشرفته هوش مصنوعی (مانند DeepSeek، Llama 3 و تولید تصویر) را بدون نیاز به اشتراک دلاری و بدون محدودیت روی ویندوز راه‌اندازی و اجرا کنید.',
            'آیا از قطعی مداوم اینترنت، تحریم‌ها و هزینه‌های دلاری اشتراک‌های هوش مصنوعی خسته شده‌اید؟ در این دوره تخصصی، از صفر تا صد یاد می‌گیرید که سیستم ویندوزی خود را به یک ایستگاه کاری قدرتمند هوش مصنوعی تبدیل کنید. با ابزارهای استاندارد جهانی بدون نیاز به دانش قبلی کار خواهید کرد و مدل‌های زبانی و تصویری را روی سیستم خود به کار می‌گیرید.',
            390000,
            650000,
            'مقدماتی تا متوسط',
            '۶ ساعت آموزش ویدیویی',
            12,
            1,
            'بدون نیاز به پیش‌نیاز (آموزش کامل از صفر)',
            'https://t.me/+nexora_win_ai',
            'لینک ورود به کانال تلگرامی خصوصی دوره شامل ویدیوها، کدهای آماده و فایل‌های کمکی',
            'نصب و اجرای مدل‌های Llama 3 و DeepSeek روی ویندوز\nراه‌اندازی هوش مصنوعی تولید تصویر بدون سانسور\nتبدیل صوت به متن آفلاین و دقیق\nبهینه‌سازی برای کارت گرافیک و پردازنده معمولی\nدسترسی دائمی به کانال خصوصی تلگرام',
            1,
            strftime('%s','now')
          ),
          (
            'c-web-ai',
            'آموزش ساخت سایت با هوش مصنوعی نامحدود',
            'طراحی، برنامه‌نویسی و راه‌اندازی وب‌سایت‌های مدرن با دستیار هوش مصنوعی بدون هزینه',
            'یاد بگیرید چگونه از هوش مصنوعی نصب‌شده روی سیستم خود به عنوان یک برنامه‌نویس ارشد برای طراحی فرانت‌اند، بک‌اند و دیتابیس سایت استفاده کرده و پروژه را به صورت زنده منتشر نمایید.',
            'در این دوره پیشرفته، یاد می‌گیرید چگونه قدرت هوش مصنوعی لوکال ویندوز را به محیط کدنویسی متصل کنید و وب‌سایت‌های فول‌استک مدرن خلق کنید. از طراحی صفحات فرانت‌اند تا پیاده‌سازی API و استقرار زنده روی فضای ابری، همه را با کمک هوش مصنوعی یاد می‌گیرید.',
            590000,
            890000,
            'متوسط تا پیشرفته',
            '۸ ساعت آموزش کاربردی',
            16,
            2,
            'دوره آموزش نصب هوش مصنوعی نامحدود در ویندوز',
            'https://t.me/+nexora_web_ai',
            'لینک ورود به کانال خصوصی تلگرام دوره، سورس‌کدهای کامل و فایل‌های پروژه',
            'اتصال مدل‌های هوش مصنوعی به محیط کدنویسی VS Code\nتولید خودکار کدهای فرانت‌اند و صفحات مدرن\nپیاده‌سازی بک‌اند و APIهای سرورلس با AI\nدیپلوی و استقرار وب‌سایت روی هاست و کلادفلر\nعضویت اختصاصی در کانال تلگرام دوره',
            1,
            strftime('%s','now')
          )
        `).run();
      }
    } catch (_) {}

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
