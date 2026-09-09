import { jsonResponse, jsonError, requireAdmin, logError } from "../_utils.js";
import { ensureDatabaseSchema } from "./admin-migrate.js";

// GET /api/payment-settings → دریافت تنظیمات پرداخت کارت به کارت
export async function onRequestGet(context) {
  const { env } = context;

  // اطمینان از وجود جداول و تنظیمات
  await ensureDatabaseSchema(env);

  try {
    const { results } = await env.DB.prepare(
      "SELECT key, value FROM settings WHERE key IN ('card_number', 'card_holder', 'card_bank', 'card_sheba', 'card_help')"
    ).all();

    const map = {};
    for (const r of (results || [])) {
      map[r.key] = r.value;
    }

    return jsonResponse({
      ok: true,
      settings: {
        cardNumber: map.card_number || "6219-8619-1265-2186",
        cardHolder: map.card_holder || "محمد اورک",
        cardBank: map.card_bank || "بانک سامان",
        cardSheba: map.card_sheba || "",
        cardHelp: map.card_help || "لطفاً مبلغ سفارش را به شماره کارت بالا واریز نمایید و سپس عکس فیش و کد رهگیری را ثبت کنید. پس از تأیید، مشخصات اشتراک در حساب کاربری شما تحویل داده می‌شود."
      }
    });
  } catch (err) {
    logError("payment-settings: get", err);
    return jsonError("خطا در دریافت اطلاعات پرداخت.", 500);
  }
}

// PUT /api/payment-settings → ویرایش اطلاعات کارت توسط مدیر
export async function onRequestPut(context) {
  const { request, env } = context;
  const { error } = await requireAdmin(request, env);
  if (error) return error;

  await ensureDatabaseSchema(env);

  let body;
  try {
    body = await request.json();
  } catch {
    return jsonError("درخواست نامعتبر است.", 400);
  }

  const allowed = {
    cardNumber: 'card_number',
    cardHolder: 'card_holder',
    cardBank: 'card_bank',
    cardSheba: 'card_sheba',
    cardHelp: 'card_help'
  };

  try {
    for (const [prop, key] of Object.entries(allowed)) {
      if (body[prop] !== undefined) {
        const val = String(body[prop]).trim().slice(0, 500);
        await env.DB.prepare(
          "INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value"
        ).bind(key, val).run();
      }
    }
    return jsonResponse({ ok: true, message: "تنظیمات پرداخت ذخیره شد." });
  } catch (err) {
    logError("payment-settings: put", err);
    return jsonError("خطا در ذخیره تنظیمات.", 500);
  }
}
