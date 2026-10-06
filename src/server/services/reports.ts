import { assertCan, type TenantContext } from "@/server/auth/context";
import { repos } from "@/server/repositories";
import type { ResolvedRange } from "@/lib/time";
import { dailyRows, getSalesSummary, paymentBreakdown, salesOrders, salesSeries, topItems } from "./sales";
import { getStock } from "./inventory";

export function salesReport(ctx: TenantContext, range: ResolvedRange) {
  assertCan(ctx, "reports.view");
  return { summary: getSalesSummary(ctx, range), series: salesSeries(ctx, range), rows: dailyRows(ctx, range) };
}

export function itemPerformance(ctx: TenantContext, range: ResolvedRange) {
  assertCan(ctx, "reports.view");
  const items = topItems(ctx, range, 200);
  const total = items.reduce((s, i) => s + i.revenue, 0);
  const cats = new Map(repos(ctx).menuItems({ includeDeleted: true }).map((m) => [m.id, m.categoryId]));
  const catNames = new Map(repos(ctx).categories().map((c) => [c.id, c.name]));
  return items.map((i) => ({ ...i, category: catNames.get(cats.get(i.menuItemId) ?? "") ?? "—", sharePct: total ? (i.revenue / total) * 100 : 0 }));
}

export function paymentReport(ctx: TenantContext, range: ResolvedRange) {
  assertCan(ctx, "reports.view");
  const rows = paymentBreakdown(ctx, range);
  const orders = salesOrders(ctx, range.from, range.to);
  const split = orders.filter((o) => o.payments.length > 1).length;
  const byType = (["DINE_IN", "TAKEAWAY", "DELIVERY"] as const).map((t) => {
    const os = orders.filter((o) => o.type === t);
    return { type: t, orders: os.length, amount: os.reduce((s, o) => s + o.total, 0) };
  });
  return { rows, split, total: rows.reduce((s, r) => s + r.amount, 0), byType };
}

export function inventoryReport(ctx: TenantContext, range: ResolvedRange) {
  assertCan(ctx, "reports.view");
  const stock = getStock(ctx);
  const mv = repos(ctx).movements().filter((m) => m.createdAt >= range.from && m.createdAt < range.to);
  const per = new Map<string, { purchased: number; wasted: number; consumed: number }>();
  for (const m of mv) {
    const e = per.get(m.inventoryItemId) ?? { purchased: 0, wasted: 0, consumed: 0 };
    if (m.reason === "PURCHASE") e.purchased += m.delta;
    else if (m.reason === "WASTAGE") e.wasted += -m.delta;
    else if (m.reason === "INTERNAL") e.consumed += -m.delta;
    per.set(m.inventoryItemId, e);
  }
  return stock.map((s) => ({ ...s, ...(per.get(s.id) ?? { purchased: 0, wasted: 0, consumed: 0 }) }));
}
