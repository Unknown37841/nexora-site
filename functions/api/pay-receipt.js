import { jsonResponse, jsonError, getSessionUser, logError } from "../_utils.js";
import { ensureDatabaseSchema } from "./admin-migrate.js";

const MAX_IMAGE_CHARS = 950_000; // حدود ۷۰۰-۸۰۰ کیلوبایت برای تصویر رسید فشرده‌شده

export async function onRequestPost(context) {
  const { request, env } = context;
  const user = await getSessionUser(request, env);
  if (!user) return jsonError("برای ثبت فیش پرداخت ابتدا وارد حساب خود شوید.", 401);

  await ensureDatabaseSchema(env);

  let body;
  try {
    body = await request.json();
  } catch {
    return jsonError("درخواست نامعتبر است.", 400);
  }

  const orderId = (body.orderId || "").toString().trim();
  if (!orderId) return jsonError("شناسه سفارش الزامی است.", 400);

  // شماره یا کد پیگیری اجباری است
  const trackingCode = (body.trackingCode || "").toString().trim().slice(0, 80);
  if (!trackingCode) {
    return jsonError("شماره یا کد پیگیری بانکی الزامی است.", 400);
  }

  // عکس رسید الزامی است
  let receiptImage = (body.receiptImage || "").toString().trim();
  if (!receiptImage) {
    return jsonError("بارگذاری تصویر فیش یا رسید واریزی الزامی است.", 400);
  }
  if (receiptImage.length > MAX_IMAGE_CHARS) {
    return jsonError("حجم تصویر رسید زیاد است. لطفاً تصویر کم‌حجم‌تری انتخاب کنید.", 400);
  }
  if (!/^data:image\/(png|jpe?g|webp|gif);base64,/.test(receiptImage)) {
    return jsonError("فرمت تصویر رسید معتبر نیست (فقط JPG، PNG و WebP مجاز است).", 400);
  }

  // اطلاعات تماس مشتری (شماره موبایل یا آیدی تلگرام برای هماهنگی و ارسال)
  const customerContact = (body.customerContact || "").toString().trim().slice(0, 100);
  if (!customerContact) {
    return jsonError("شماره تماس یا آیدی تلگرام جهت ارتباط و هماهنگی الزامی است.", 400);
  }

  const senderCard = (body.senderCard || "").toString().trim().slice(0, 30);
  const receiptText = (body.receiptText || "").toString().trim().slice(0, 600);

  // بررسی سفارش در دیتابیس
  const order = await env.DB.prepare(
    "SELECT id, user_id, total, status FROM orders WHERE id = ?"
  ).bind(orderId).first();

  if (!order) {
    return jsonError("سفارش مورد نظر یافت نشد.", 404);
  }

  if (order.user_id !== user.id) {
    return jsonError("شما دسترسی به این سفارش ندارید.", 403);
  }

  if (order.status === "paid") {
    return jsonError("این سفارش قبلاً تأیید و پرداخت شده است.", 400);
  }

  const now = Date.now();

  try {
    await env.DB.prepare(`
      UPDATE orders SET
        status = 'awaiting_verification',
        tracking_code = ?,
        sender_card = ?,
        customer_contact = ?,
        receipt_text = ?,
        receipt_image = ?,
        submitted_at = ?,
        admin_note = NULL
      WHERE id = ?
    `).bind(
      trackingCode,
      senderCard,
      customerContact,
      receiptText,
      receiptImage,
      now,
      orderId
    ).run();

    return jsonResponse({
      ok: true,
      message: "فیش واریزی و اطلاعات تماس شما با موفقیت ثبت شد و در صف بررسی مدیر قرار گرفت."
    });
  } catch (err) {
    logError("pay-receipt: submit", err);
    return jsonError("خطا در ثبت اطلاعات فیش واریز. لطفاً دوباره تلاش کنید.", 500);
  }
}
