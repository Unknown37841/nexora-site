# Nexora — راهنمای دیپلوی رایگان (GitHub + Cloudflare Pages + D1)

این پروژه یک بک‌اند کاملاً رایگان و بدون سرور (serverless) داره:

- **فرانت‌اند**: فایل `public/index.html` (همون سایت شما)
- **بک‌اند**: توابع Cloudflare Pages Functions در پوشه `functions/api` (ثبت‌نام، ورود، خروج، بررسی نشست)
- **دیتابیس**: Cloudflare D1 (یک دیتابیس SQLite رایگان)

همه‌چیز روی پلن رایگان Cloudflare جواب می‌ده و هیچ پولی نیاز نیست.

چرا GitHub Pages به‌تنهایی کافی نبود؟ چون GitHub Pages فقط فایل‌های استاتیک (HTML/CSS/JS) رو سرو می‌کنه و نمی‌تونه کد بک‌اند اجرا کنه یا به دیتابیس وصل بشه. برای همین از **Cloudflare Pages** استفاده کردیم که هم می‌تونه کد رو از یک ریپوی GitHub بخونه و به‌صورت خودکار دیپلوی کنه (پس GitHub همچنان جای نگهداری کدتونه)، هم امکان اجرای بک‌اند (Functions) و دیتابیس (D1) رو به‌صورت رایگان می‌ده.

---

## مرحله ۱: آپلود پروژه در گیت‌هاب

۱. یک ریپازیتوری جدید در [github.com](https://github.com/new) بسازید (مثلاً `nexora-site`).
۲. محتوای این پوشه (`nexora-backend`) رو داخلش پوش کنید:

```bash
cd nexora-backend
git init
git add .
git commit -m "اولیه: سایت Nexora + بک‌اند ثبت‌نام"
git branch -M main
git remote add origin https://github.com/USERNAME/nexora-site.git
git push -u origin main
```

(به‌جای `USERNAME` نام کاربری خودتون رو بذارید.)

---

## مرحله ۲: ساخت پروژه در Cloudflare Pages

۱. یک اکانت رایگان در [dash.cloudflare.com](https://dash.cloudflare.com) بسازید (اگر ندارید).
۲. از منوی سمت چپ: **Workers & Pages → Create → Pages → Connect to Git**.
۳. ریپازیتوری `nexora-site` که ساختید رو انتخاب کنید.
۴. در تنظیمات build:
   - **Framework preset**: `None`
   - **Build command**: خالی بذارید
   - **Build output directory**: `public`
۵. روی **Save and Deploy** بزنید. بعد از چند ثانیه یک آدرس مثل `nexora-site.pages.dev` بهتون می‌ده — سایتتون همین الان آنلاینه (بخش ثبت‌نام هنوز کار نمی‌کنه چون دیتابیس وصل نیست).

---

## مرحله ۳: ساخت دیتابیس D1

۱. در همون داشبورد Cloudflare: **Workers & Pages → D1 SQL Database → Create database**.
۲. اسمش رو بذارید `nexora-db` و بسازیدش.
۳. وارد دیتابیس بشید، تب **Console** رو باز کنید و کل محتوای فایل `schema.sql` (همین پوشه) رو کپی/پیست کنید و اجرا (Execute) کنید. این کار دو جدول `users` و `sessions` رو می‌سازه.

---

## مرحله ۴: وصل کردن دیتابیس به سایت (Binding)

۱. برگردید به پروژه Pages‌تون (`nexora-site`) → **Settings → Functions**.
۲. پایین صفحه بخش **D1 database bindings** رو پیدا کنید → **Add binding**.
۳. مقادیر زیر رو بزنید:
   - **Variable name**: `DB`   (دقیقاً همین، حروف بزرگ — کد بک‌اند دقیقاً همین اسم رو صدا می‌زنه)
   - **D1 database**: `nexora-db`
۴. ذخیره کنید.
۵. چون بایندینگ جدیده، باید یک دیپلوی تازه بزنید تا اعمال بشه: به تب **Deployments** برید و روی آخرین دیپلوی، گزینه **Retry deployment** رو بزنید (یا فقط یک کامیت خالی به گیت‌هاب پوش کنید).

---

## مرحله ۵: تنظیم Resend برای ارسال کد تأیید ایمیل

از این نسخه به بعد، ثبت‌نام دیگه بلافاصله کاربر رو Login نمی‌کنه؛ یک کد ۶ رقمی به ایمیلش می‌فرسته و فقط بعد از وارد کردن درست کد، حساب فعال و Session ساخته می‌شه (فایل‌های `functions/api/register.js`، `functions/api/verify-email.js` و `functions/api/resend-code.js`). برای اینکه ایمیل واقعاً ارسال بشه باید [Resend](https://resend.com) رو وصل کنید:

۱. توی [resend.com](https://resend.com/onboarding) ثبت‌نام کنید (پلن رایگان روزانه ۱۰۰ ایمیل و ماهانه ۳۰۰۰ ایمیل می‌ده).
۲. از داشبورد Resend یک **API Key** بسازید (بخش **API Keys → Create API Key**).
۳. برگردید به پروژه Pages‌تون در Cloudflare → **Settings → Environment variables** (نه Functions bindings؛ این بخش جداست).
۴. یک متغیر جدید اضافه کنید:
   - **Variable name**: `RESEND_API_KEY`
   - **Value**: کلیدی که از Resend گرفتید
   - نوعش رو روی **Secret** بذارید (نه Text) تا رمزنگاری‌شده ذخیره بشه.
۵. اختیاری: اگه دامنه‌ی خودتون رو توی Resend Verify کردید، یک متغیر دیگه هم اضافه کنید:
   - **Variable name**: `RESEND_FROM`
   - **Value**: مثلاً `Nexora <noreply@yourdomain.com>`
   - اگه این رو نذارید، ایمیل‌ها از آدرس تستی `onboarding@resend.dev` ارسال می‌شن که **فقط به ایمیل خود شما (همونی که با Resend ثبت‌نام کردید)** قابل تحویله؛ برای تست شخصی کافیه ولی برای کاربرای واقعی سایت باید یک دامنه رو توی Resend وریفای کنید.
۶. بعد از اضافه‌کردن متغیر، یک دیپلوی جدید بزنید (تب **Deployments → Retry deployment**، یا یک کامیت خالی پوش کنید) تا متغیر اعمال بشه.

### اگه دیتابیس رو از قبل ساخته بودید

اگه قبلاً `schema.sql` قدیمی (بدون `email_verified`) رو روی `nexora-db` اجرا کرده بودید، کافیه فایل جدید `migration_add_email_verification.sql` رو یک بار توی **Console** دیتابیس اجرا کنید. اگه از صفر دیتابیس می‌سازید، همون `schema.sql` جدید (که جدول `email_verifications` و ستون `email_verified` رو داره) کافیه.

---

## مرحله ۶: تست

آدرس `https://nexora-site.pages.dev` (یا هر آدرسی که Cloudflare بهتون داد) رو باز کنید، روی آیکون پروفایل بزنید و با یک ایمیل تست ثبت‌نام کنید. اگه پیام «ثبت‌نام با موفقیت انجام شد» رو دیدید، یعنی همه‌چیز درست وصل شده و اطلاعات واقعاً توی D1 ذخیره می‌شه (نه فقط توی مرورگر شما).

می‌تونید از داشبورد Cloudflare → دیتابیس `nexora-db` → Console → `SELECT * FROM users;` بزنید تا کاربر تازه ثبت‌شده رو ببینید.

---

## نکات مهم

- **دامنه اختصاصی**: اگه دامنه دارید، از تب **Custom domains** توی پروژه Pages می‌تونید وصلش کنید — کاملاً رایگانه.
- **رمزهای عبور**: هش می‌شن (با PBKDF2 و salt تصادفی) و هیچ‌جا به‌صورت متن ساده ذخیره نمی‌شن.
- **نشست (Session)**: با یک کوکی امن (`HttpOnly`) به مدت ۳۰ روز مدیریت می‌شه.
- **تأیید ایمیل**: کد ۶ رقمی ۱۰ دقیقه اعتبار داره، حداکثر ۵ بار تلاش اشتباه مجازه، و بین دو درخواست «ارسال مجدد» باید حداقل ۶۰ ثانیه فاصله باشه (برای جلوگیری از اسپم/سوءاستفاده). این مقادیر بالای `functions/_utils.js` قابل تغییرن.
- **بدون RESEND_API_KEY**: اگه این Secret رو تنظیم نکنید، درخواست ثبت‌نام با خطای ۵۰۲ برمی‌گرده (کاربر توی دیتابیس ساخته می‌شه ولی کد تأییدش نمی‌رسه) — پس قبل از تست، حتماً مرحله ۵ رو انجام بدید.
- **حد رایگان Cloudflare**: روزانه ۱۰۰٬۰۰۰ درخواست Functions و ۵ گیگابایت فضای D1 — برای شروع کار کاملاً کافیه.
- **ثبت‌نام با شماره موبایل ایران**: فعلاً غیرفعاله (دکمه «به‌زودی»). وقتی آماده بودید یک سرویس پیامکی (کاوه‌نگار / ippanel و مشابه) انتخاب کنید، من یک endpoint جدید (`/api/send-otp` و `/api/verify-otp`) بهتون اضافه می‌کنم — کد فعلی طوری نوشته شده که این کار راحت اضافه بشه.

---

## توسعه محلی (اختیاری)

اگه بخواید قبل از دیپلوی، روی سیستم خودتون تست کنید:

```bash
npm install -g wrangler
wrangler login
wrangler d1 execute nexora-db --local --file=./schema.sql
wrangler pages dev public --d1=DB=nexora-db
```
