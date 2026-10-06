import { DAY, HOUR, dayKey, formatDate, istHour, resolveRange, type RangeKey, type ResolvedRange } from "@/lib/time";
import { assertCan, type TenantContext } from "@/server/auth/context";
import { repos } from "@/server/repositories";
import type { Order, PaymentMethod } from "@/types/domain";

export interface SalesSummary {
  range: string;
  gross: number;
  discounts: number;
  taxes: number;
  net: number;
  collected: number; // net + taxes + round-off, what the till actually took
  orders: number;
  aov: number;
  customers: number;
  /** % change of collected vs previous comparable period (null when no baseline). */
  deltaPct: number | null;
  prevCollected: number;
}

export function rangeFor(key: RangeKey, now = Date.now(), custom?: { from?: string; to?: string }): ResolvedRange {
  const r = resolveRange(key, now, custom);
  // Today is compared against yesterday *up to the same time of day*.
  if (key === "today") return { ...r, prevTo: r.prevFrom + (now - r.from) };
  return r;
}

/** Sales are paid, non-cancelled orders. */
export const isSale = (o: Order) => o.status !== "CANCELLED" && o.paymentStatus === "PAID";
const within = (o: Order, from: number, to: number) => o.createdAt >= from && o.createdAt < to;

export function salesOrders(ctx: TenantContext, from: number, to: number): Order[] {
  return repos(ctx).orders().filter((o) => isSale(o) && within(o, from, to));
}

export function summarize(orders: Order[]) {
  let gross = 0, discounts = 0, taxes = 0, collected = 0;
  const cust = new Set<string>();
  let walkins = 0;
  for (const o of orders) {
    gross += o.subtotal;
    discounts += o.discount;
    taxes += o.tax;
    collected += o.total;
    if (o.customerId) cust.add(o.customerId);
    else walkins += 1;
  }
  const net = gross - discounts;
  return { gross, discounts, taxes, net, collected, orders: orders.length, aov: orders.length ? Math.round(collected / orders.length) : 0, customers: cust.size + walkins };
}

export function getSalesSummary(ctx: TenantContext, range: ResolvedRange): SalesSummary {
  assertCan(ctx, "reports.view");
  return salesSummaryUnchecked(ctx, range);
}

/** Used by services that already authorised the caller for a narrower permission (e.g. overview.view). */
export function salesSummaryUnchecked(ctx: TenantContext, range: ResolvedRange): SalesSummary {
  const cur = summarize(salesOrders(ctx, range.from, range.to));
  const prev = summarize(salesOrders(ctx, range.prevFrom, range.prevTo));
  return {
    range: range.label,
    ...cur,
    prevCollected: prev.collected,
    deltaPct: prev.collected > 0 ? ((cur.collected - prev.collected) / prev.collected) * 100 : null,
  };
}

export interface SeriesPoint {
  label: string;
  /** null for hours that haven't happened yet (renders as a gap, not a drop to zero). */
  value: number | null;
  prev: number;
  orders: number;
}

export function salesSeries(ctx: TenantContext, range: ResolvedRange, now = Date.now()): SeriesPoint[] {
  const all = repos(ctx).orders().filter(isSale);
  if (range.key === "today" || range.key === "yesterday") {
    const out: SeriesPoint[] = [];
    for (let h = 8; h <= 23; h++) {
      const cur = all.filter((o) => within(o, range.from + h * HOUR, range.from + (h + 1) * HOUR));
      const prev = all.filter((o) => within(o, range.prevFrom + h * HOUR, range.prevFrom + (h + 1) * HOUR));
      out.push({
        label: `${h % 12 === 0 ? 12 : h % 12}${h < 12 ? "a" : "p"}`,
        value: range.from + h * HOUR > now ? null : cur.reduce((s, o) => s + o.total, 0),
        prev: prev.reduce((s, o) => s + o.total, 0),
        orders: cur.length,
      });
    }
    return out;
  }
  const days = Math.round((range.to - range.from) / DAY);
  const out: SeriesPoint[] = [];
  for (let i = 0; i < days; i++) {
    const f = range.from + i * DAY;
    const pf = range.prevFrom + i * DAY;
    const cur = all.filter((o) => within(o, f, f + DAY));
    const prev = all.filter((o) => within(o, pf, pf + DAY));
    out.push({ label: formatDate(f), value: cur.reduce((s, o) => s + o.total, 0), prev: prev.reduce((s, o) => s + o.total, 0), orders: cur.length });
  }
  return out;
}

export interface ItemStat {
  menuItemId: string;
  name: string;
  qty: number;
  revenue: number; // pre-tax net of line (price × qty)
  orders: number;
  avgPrice: number;
}

export function topItems(ctx: TenantContext, range: ResolvedRange, limit = 5): ItemStat[] {
  const map = new Map<string, ItemStat>();
  for (const o of salesOrders(ctx, range.from, range.to)) {
    for (const i of o.items) {
      const e = map.get(i.menuItemId) ?? { menuItemId: i.menuItemId, name: i.name, qty: 0, revenue: 0, orders: 0, avgPrice: 0 };
      e.qty += i.qty;
      e.revenue += i.unitPrice * i.qty;
      e.orders += 1;
      map.set(i.menuItemId, e);
    }
  }
  const list = [...map.values()].map((e) => ({ ...e, avgPrice: e.qty ? Math.round(e.revenue / e.qty) : 0 }));
  return list.sort((a, b) => b.qty - a.qty).slice(0, limit);
}

export interface PaymentStat {
  method: PaymentMethod;
  amount: number;
  count: number;
  sharePct: number;
}

export function paymentBreakdown(ctx: TenantContext, range: ResolvedRange): PaymentStat[] {
  const acc: Record<PaymentMethod, { amount: number; count: number }> = { UPI: { amount: 0, count: 0 }, CASH: { amount: 0, count: 0 }, CARD: { amount: 0, count: 0 } };
  for (const o of salesOrders(ctx, range.from, range.to)) {
    for (const p of o.payments) {
      acc[p.method].amount += p.amount;
      acc[p.method].count += 1;
    }
  }
  const total = Object.values(acc).reduce((s, x) => s + x.amount, 0);
  return (Object.keys(acc) as PaymentMethod[]).map((m) => ({ method: m, ...acc[m], sharePct: total ? (acc[m].amount / total) * 100 : 0 }));
}

export interface DailyRow {
  date: number;
  key: string;
  orders: number;
  gross: number;
  discounts: number;
  taxes: number;
  net: number;
  collected: number;
  aov: number;
}

export function dailyRows(ctx: TenantContext, range: ResolvedRange): DailyRow[] {
  const orders = repos(ctx).orders().filter(isSale);
  const days = Math.max(1, Math.round((range.to - range.from) / DAY));
  const rows: DailyRow[] = [];
  for (let i = days - 1; i >= 0; i--) {
    const f = range.from + i * DAY;
    const s = summarize(orders.filter((o) => within(o, f, f + DAY)));
    rows.push({ date: f, key: dayKey(f), ...s });
  }
  return rows;
}

export function hourOf(ts: number) {
  return istHour(ts);
}
