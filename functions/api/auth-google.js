import {
  jsonResponse,
  jsonError,
  isValidEmail,
  hashPassword,
  randomHex,
  createSession,
  sessionCookieHeader,
  logError,
} from "../_utils.js";
import { ensureDatabaseSchema } from "./admin-migrate.js";

// POST /api/auth-google → ورود یا ثبت‌نام مستقیم و امن با حساب گوگل (Gmail)
export async function onRequestPost(context) {
  const { request, env } = context;

  await ensureDatabaseSchema(env);

  let body;
  try {
    body = await request.json();
  } catch {
    return jsonError("درخواست نامعتبر است.", 400);
  }

  const credential = (body.credential || "").toString().trim();
  const accessToken = (body.access_token || "").toString().trim();

  if (!credential && !accessToken) {
    return jsonError("توکن احراز هویت گوگل ارسال نشده است.", 400);
  }

  let email = "";
  let name = "";
  let emailVerified = false;

  try {
    if (credential) {
      // اعتبارسنجی ID Token با اندپوینت رسمی گوگل
      const verifyRes = await fetch(
        `https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(credential)}`
      );
      if (!verifyRes.ok) {
        return jsonError("اعتبارسنجی حساب گوگل ناموفق بود (توکن منقضی یا نامعتبر است).", 401);
      }
      const data = await verifyRes.json();
      email = (data.email || "").toString().trim().toLowerCase();
      name = (data.name || "").toString().trim();
      emailVerified = data.email_verified === "true" || data.email_verified === true;
    } else {
      // اعتبارسنجی Access Token با اندپوینت userinfo گوگل
      const userinfoRes = await fetch("https://www.googleapis.com/oauth2/v3/userinfo", {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      if (!userinfoRes.ok) {
        return jsonError("خطا در دریافت مشخصات حساب از گوگل.", 401);
      }
      const data = await userinfoRes.json();
      email = (data.email || "").toString().trim().toLowerCase();
      name = (data.name || "").toString().trim();
      emailVerified = data.email_verified === true || data.email_verified === "true";
    }
  } catch (err) {
    logError("auth-google: verify token", err);
    return jsonError("خطا در ارتباط با سرورهای گوگل برای تایید حساب.", 502);
  }

  if (!isValidEmail(email)) {
    return jsonError("ایمیل معتبری از حساب گوگل دریافت نشد.", 400);
  }

  if (!emailVerified) {
    return jsonError("این حساب جیمیل هنوز تایید نشده است.", 403);
  }

  try {
    // بررسی وجود کاربر در دیتابیس
    let user = await env.DB.prepare(
      "SELECT id, name, email, is_admin FROM users WHERE email = ?"
    )
      .bind(email)
      .first();

    if (!user) {
      // ثبت‌نام خودکار کاربر جدید با جیمیل
      const userId = "u-" + crypto.randomUUID().slice(0, 8);
      const userName = (name || email.split("@")[0] || "کاربر نکسورا").slice(0, 80);
      const salt = randomHex(16);
      const plainPassword = randomHex(12);
      const pwdHash = await hashPassword(plainPassword, salt);
      const now = Date.now();
      const isAdmin = email === "otak.1380@gmail.com" ? 1 : 0;

      await env.DB.prepare(
        `INSERT INTO users (id, name, email, password_hash, salt, plain_password, email_verified, created_at, is_admin)
         VALUES (?, ?, ?, ?, ?, ?, 1, ?, ?)`
      )
        .bind(userId, userName, email, pwdHash, salt, plainPassword, now, isAdmin)
        .run();

      user = {
        id: userId,
        name: userName,
        email,
        is_admin: isAdmin,
      };
    } else {
      // اگر قبلاً ثبت‌نام کرده بود اما تایید نشده بود، تاییدش کن
      await env.DB.prepare(
        "UPDATE users SET email_verified = 1 WHERE id = ?"
      )
        .bind(user.id)
        .run();
    }

    // ایجاد سشن ورود
    const sessionToken = await createSession(env, user.id);

    return jsonResponse(
      {
        ok: true,
        user: {
          id: user.id,
          name: user.name,
          email: user.email,
          is_admin: !!user.is_admin,
        },
      },
      200,
      { "Set-Cookie": sessionCookieHeader(sessionToken) }
    );
  } catch (err) {
    logError("auth-google: db session", err);
    return jsonError("خطا در ایجاد نشست ورود.", 500);
  }
}
