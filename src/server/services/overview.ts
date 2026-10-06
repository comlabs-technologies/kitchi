import { formatMoney } from "@/lib/money";
import { formatTime, timeAgo, type RangeKey } from "@/lib/time";
import { assertCan, type TenantContext } from "@/server/auth/context";
import { repos } from "@/server/repositories";
import { getLowStock } from "./inventory";
import { paymentBreakdown, rangeFor, salesSeries, salesSummaryUnchecked, topItems } from "./sales";

export interface DailySummary {
  generatedAt: number;
  outletName: string;
  sales: number;
  orders: number;
  aov: number;
  customers: number;
  deltaPct: number | null;
  payments: { UPI: number; CASH: number; CARD: number };
  topItem?: { name: string; qty: number };
  lowStock: { name: string; stock: number; unit: string }[];
  whatsappText: string;
}

/** Owner's end-of-day digest. Also the single source for the WhatsApp message and the `reports.get_daily_summary` MCP tool. */
export function getDailySummary(ctx: TenantContext, now = Date.now()): DailySummary {
  assertCan(ctx, "reports.view");
  const range = rangeFor("today", now);
  const s = salesSummaryUnchecked(ctx, range);
  const pay = paymentBreakdown(ctx, range);
  const get = (m: "UPI" | "CASH" | "CARD") => pay.find((p) => p.method === m)?.amount ?? 0;
  const top = topItems(ctx, range, 1)[0];
  const low = getLowStock(ctx).slice(0, 3);
  const outletName = repos(ctx).outlet().name;
  const delta = s.deltaPct == null ? "" : `\n${s.deltaPct >= 0 ? "▲" : "▼"} ${Math.abs(s.deltaPct).toFixed(1)}% vs yesterday (same time)`;
  const whatsappText = [
    `*Kitchi · Daily summary*`,
    `${outletName} · ${formatTime(now)}`,
    ``,
    `*Sales ${formatMoney(s.collected)}* · ${s.orders} orders · ${formatMoney(s.aov)} avg${delta}`,
    ``,
    `UPI ${formatMoney(get("UPI"))} · Cash ${formatMoney(get("CASH"))} · Card ${formatMoney(get("CARD"))}`,
    top ? `Top item: ${top.name} (${top.qty} sold)` : ``,
    low.length ? `Low stock: ${low.map((l) => l.name).join(", ")}` : `Stock looks healthy.`,
  ].filter((l) => l !== undefined).join("\n");
  return {
    generatedAt: now, outletName, sales: s.collected, orders: s.orders, aov: s.aov, customers: s.customers, deltaPct: s.deltaPct,
    payments: { UPI: get("UPI"), CASH: get("CASH"), CARD: get("CARD") },
    topItem: top ? { name: top.name, qty: top.qty } : undefined,
    lowStock: low.map((l) => ({ name: l.name, stock: l.stock, unit: l.unit })),
    whatsappText,
  };
}

export function getOverview(ctx: TenantContext, key: RangeKey = "today", now = Date.now()) {
  assertCan(ctx, "overview.view");
  const today = rangeFor("today", now);
  const range = rangeFor(key, now);
  const r = repos(ctx);
  const orders = r.orders();
  const recent = orders
    .flatMap((o) => o.events.map((e) => ({ ...e, orderId: o.id, number: o.number })))
    .filter((e) => e.at <= now)
    .sort((a, b) => b.at - a.at)
    .slice(0, 8)
    .map((e) => ({ at: e.at, ago: timeAgo(e.at, now), text: `#${e.number} · ${e.action}${e.detail ? ` — ${e.detail}` : ""}`, actor: e.actor, orderId: e.orderId }));
  return {
    today: salesSummaryUnchecked(ctx, today),
    range: salesSummaryUnchecked(ctx, range),
    series: salesSeries(ctx, range),
    top: topItems(ctx, range, 5),
    payments: paymentBreakdown(ctx, range),
    lowStock: getLowStock(ctx).slice(0, 4),
    recent,
    openOrders: orders.filter((o) => o.status === "OPEN" || o.status === "PREPARING" || o.status === "READY").length,
    setup: r.restaurant().setup,
  };
}
