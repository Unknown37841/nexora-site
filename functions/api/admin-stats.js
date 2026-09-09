import { jsonResponse, jsonError, requireAdmin, logError } from "../_utils.js";
import { ensureDatabaseSchema } from "./admin-migrate.js";

// GET /api/admin-stats → آمار داشبورد مدیریت
export async function onRequestGet(context) {
  const { request, env } = context;
  const { error } = await requireAdmin(request, env);
  if (error) return error;

  await ensureDatabaseSchema(env);

  try {
    const userCount = await env.DB.prepare("SELECT COUNT(*) as count FROM users").first();
    const prodCount = await env.DB.prepare("SELECT COUNT(*) as count FROM products WHERE active = 1").first();
    const orderStats = await env.DB.prepare(`
      SELECT
        COUNT(*) as total_orders,
        COALESCE(SUM(CASE WHEN status = 'awaiting_verification' THEN 1 ELSE 0 END), 0) as pending_receipts,
        COALESCE(SUM(CASE WHEN status = 'paid' THEN 1 ELSE 0 END), 0) as paid_orders,
        COALESCE(SUM(CASE WHEN status = 'paid' THEN total ELSE 0 END), 0) as total_revenue
      FROM orders
    `).first();

    const recentPending = await env.DB.prepare(`
      SELECT o.id, o.total, o.created_at, o.tracking_code, o.submitted_at, o.status,
             u.name as user_name, u.email as user_email
      FROM orders o
      LEFT JOIN users u ON u.id = o.user_id
      WHERE o.status = 'awaiting_verification'
      ORDER BY o.submitted_at DESC
      LIMIT 5
    `).all();

    return jsonResponse({
      ok: true,
      stats: {
        totalUsers: userCount?.count || 0,
        activeProducts: prodCount?.count || 0,
        totalOrders: orderStats?.total_orders || 0,
        pendingReceipts: orderStats?.pending_receipts || 0,
        paidOrders: orderStats?.paid_orders || 0,
        totalRevenue: orderStats?.total_revenue || 0,
        recentPending: recentPending?.results || []
      }
    });
  } catch (err) {
    logError("admin-stats", err);
    return jsonError("خطا در بارگذاری آمار مدیریت.", 500);
  }
}
