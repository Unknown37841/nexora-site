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

## مرحله ۵: تست

آدرس `https://nexora-site.pages.dev` (یا هر آدرسی که Cloudflare بهتون داد) رو باز کنید، روی آیکون پروفایل بزنید و با یک ایمیل تست ثبت‌نام کنید. اگه پیام «ثبت‌نام با موفقیت انجام شد» رو دیدید، یعنی همه‌چیز درست وصل شده و اطلاعات واقعاً توی D1 ذخیره می‌شه (نه فقط توی مرورگر شما).

می‌تونید از داشبورد Cloudflare → دیتابیس `nexora-db` → Console → `SELECT * FROM users;` بزنید تا کاربر تازه ثبت‌شده رو ببینید.

---

## نکات مهم

- **دامنه اختصاصی**: اگه دامنه دارید، از تب **Custom domains** توی پروژه Pages می‌تونید وصلش کنید — کاملاً رایگانه.
- **رمزهای عبور**: هش می‌شن (با PBKDF2 و salt تصادفی) و هیچ‌جا به‌صورت متن ساده ذخیره نمی‌شن.
- **نشست (Session)**: با یک کوکی امن (`HttpOnly`) به مدت ۳۰ روز مدیریت می‌شه.
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
