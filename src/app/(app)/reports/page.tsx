import { SalesChart } from "@/components/charts";
import { PageBody, PageHeader, Stat } from "@/components/ui/primitives";
import { Badge } from "@/components/ui/badge";
import { Table, TBody, Td, Th, THead } from "@/components/ui/table";
import { DailySummaryCard } from "@/features/reports/daily-summary";
import { ExportCsv, ReportRange, ReportTabs } from "@/features/reports/controls";
import { formatMoney, formatMoneyPrecise } from "@/lib/money";
import { formatDate, formatDateYear, type RangeKey } from "@/lib/time";
import { pct } from "@/lib/utils";
import { requirePage } from "@/server/auth/session";
import { getDailySummary } from "@/server/services/overview";
import { inventoryReport, itemPerformance, paymentReport, salesReport } from "@/server/services/reports";
import { rangeFor } from "@/server/services/sales";
import { getWorkspace } from "@/server/services/tenant";
import { repos } from "@/server/repositories";

export const metadata = { title: "Reports" };
export const dynamic = "force-dynamic";

const TABS = [{ value: "sales", label: "Sales" }, { value: "items", label: "Item performance" }, { value: "payments", label: "Payments" }, { value: "inventory", label: "Inventory" }, { value: "summary", label: "Daily summary" }];
const KEYS = ["today", "yesterday", "7d", "30d", "custom"];
const METHOD: Record<string, string> = { UPI: "UPI", CASH: "Cash", CARD: "Card" };
const TYPE: Record<string, string> = { DINE_IN: "Dine in", TAKEAWAY: "Takeaway", DELIVERY: "Delivery" };

export default async function ReportsPage({ searchParams }: { searchParams: Promise<{ tab?: string; range?: string; from?: string; to?: string }> }) {
  const ctx = await requirePage("reports.view");
  const sp = await searchParams;
  const tab = TABS.some((t) => t.value === sp.tab) ? sp.tab! : "sales";
  const key = (KEYS.includes(sp.range ?? "") ? sp.range : "7d") as RangeKey;
  const range = rangeFor(key, Date.now(), { from: sp.from, to: sp.to });
  const ws = getWorkspace(ctx);

  return (
    <>
      <PageHeader title="Reports" description={`${ws.outlet.name}${tab !== "summary" ? ` · ${range.label}` : ""}`} actions={tab !== "summary" ? <ReportRange value={key} from={sp.from} to={sp.to} /> : undefined}>
        <ReportTabs tabs={TABS} value={tab} />
      </PageHeader>
      <PageBody className="space-y-6">
        {tab === "sales" && <Sales ctx={ctx} range={range} />}
        {tab === "items" && <Items ctx={ctx} range={range} />}
        {tab === "payments" && <Payments ctx={ctx} range={range} />}
        {tab === "inventory" && <Inventory ctx={ctx} range={range} />}
        {tab === "summary" && <DailySummaryCard s={getDailySummary(ctx)} defaultPhone={repos(ctx).employees().find((e) => e.role === "OWNER")?.phone ?? ""} />}
      </PageBody>
    </>
  );
}

type Ctx = Awaited<ReturnType<typeof requirePage>>;
type R = ReturnType<typeof rangeFor>;

function Sales({ ctx, range }: { ctx: Ctx; range: R }) {
  const { summary: s, series, rows } = salesReport(ctx, range);
  const single = range.to - range.from <= 24 * 3600_000;
  return (
    <>
      <dl className="grid grid-cols-2 gap-x-6 gap-y-5 rounded-xl border border-line bg-surface p-5 md:grid-cols-3 xl:grid-cols-6">
        <Stat label="Gross sales" value={formatMoney(s.gross)} />
        <Stat label="Discounts" value={s.discounts ? `−${formatMoney(s.discounts)}` : "₹0"} />
        <Stat label="Taxes" value={formatMoney(s.taxes)} />
        <Stat label="Net sales" value={formatMoney(s.net)} sub={s.deltaPct == null ? undefined : `${pct(s.deltaPct)} vs previous`} tone={s.deltaPct != null && s.deltaPct >= 0 ? "up" : "down"} />
        <Stat label="Orders" value={String(s.orders)} />
        <Stat label="Average order value" value={s.orders ? formatMoney(s.aov) : "—"} />
      </dl>
      <p className="-mt-3 text-xs text-fg-subtle">Net sales = gross − discounts. Total collected = net + taxes ({formatMoney(s.collected)}).</p>
      {s.orders === 0 ? <p className="rounded-xl border border-line bg-surface py-14 text-center text-[13px] text-fg-muted">No sales in this period.</p> : (
        <>
          <section className="rounded-xl border border-line bg-surface p-4">
            <h2 className="mb-1 text-[13px] font-semibold">{single ? "Sales by hour" : "Sales by day"}</h2>
            <SalesChart data={series} kind={single ? "bar" : "area"} prevLabel="Previous period" />
          </section>
          <section>
            <div className="mb-2.5 flex items-center justify-between"><h2 className="text-[13px] font-semibold">{single ? "By hour" : "By day"}</h2>
              <ExportCsv filename={`kitchi-sales-${range.key}`} rows={[["Date", "Orders", "Gross", "Discounts", "Taxes", "Net", "Collected", "AOV"], ...rows.map((r) => [formatDateYear(r.date), r.orders, r.gross / 100, r.discounts / 100, r.taxes / 100, r.net / 100, r.collected / 100, r.aov / 100])]} /></div>
            {single ? (
              <Table><THead><tr><Th>Hour</Th><Th align="right">Orders</Th><Th align="right">Sales</Th></tr></THead><TBody>
                {series.filter((p) => p.orders > 0).map((p) => <tr key={p.label}><Td>{p.label.replace("a", " AM").replace("p", " PM")}</Td><Td align="right" className="tnum">{p.orders}</Td><Td align="right" className="tnum font-medium">{formatMoney(p.value ?? 0)}</Td></tr>)}
              </TBody></Table>
            ) : (
              <Table><THead><tr><Th>Date</Th><Th align="right">Orders</Th><Th align="right">Gross</Th><Th align="right">Discounts</Th><Th align="right">Taxes</Th><Th align="right">Net sales</Th><Th align="right">Collected</Th><Th align="right">Avg order</Th></tr></THead><TBody>
                {rows.map((r) => <tr key={r.key} className="transition-colors hover:bg-muted/50"><Td>{formatDate(r.date)}</Td><Td align="right" className="tnum">{r.orders}</Td><Td align="right" className="tnum">{formatMoney(r.gross)}</Td><Td align="right" className="tnum text-fg-muted">{r.discounts ? `−${formatMoney(r.discounts)}` : "—"}</Td><Td align="right" className="tnum text-fg-muted">{formatMoney(r.taxes)}</Td><Td align="right" className="tnum">{formatMoney(r.net)}</Td><Td align="right" className="tnum font-medium">{formatMoney(r.collected)}</Td><Td align="right" className="tnum text-fg-muted">{r.orders ? formatMoney(r.aov) : "—"}</Td></tr>)}
              </TBody></Table>
            )}
          </section>
        </>
      )}
    </>
  );
}

function Items({ ctx, range }: { ctx: Ctx; range: R }) {
  const rows = itemPerformance(ctx, range);
  if (!rows.length) return <p className="rounded-xl border border-line bg-surface py-14 text-center text-[13px] text-fg-muted">No items sold in this period.</p>;
  return (
    <>
      <div className="flex justify-end"><ExportCsv filename={`kitchi-items-${range.key}`} rows={[["Item", "Category", "Qty", "Revenue", "Avg price", "Share %"], ...rows.map((r) => [r.name, r.category, r.qty, r.revenue / 100, r.avgPrice / 100, r.sharePct.toFixed(1)])]} /></div>
      <Table><THead><tr><Th>#</Th><Th>Item</Th><Th>Category</Th><Th align="right">Qty sold</Th><Th align="right">Avg price</Th><Th align="right">Revenue</Th><Th>Share</Th></tr></THead><TBody>
        {rows.map((r, i) => (
          <tr key={r.menuItemId} className="transition-colors hover:bg-muted/50"><Td className="tnum text-fg-subtle">{i + 1}</Td><Td className="font-medium">{r.name}</Td><Td className="text-fg-muted">{r.category}</Td><Td align="right" className="tnum">{r.qty}</Td><Td align="right" className="tnum text-fg-muted">{formatMoney(r.avgPrice)}</Td><Td align="right" className="tnum font-medium">{formatMoney(r.revenue)}</Td>
            <Td><div className="flex items-center gap-2"><div className="h-1.5 w-24 overflow-hidden rounded-full bg-muted"><div className="h-full rounded-full bg-brand" style={{ width: `${Math.min(100, r.sharePct * 3)}%` }} /></div><span className="tnum w-10 text-xs text-fg-muted">{r.sharePct.toFixed(1)}%</span></div></Td></tr>
        ))}
      </TBody></Table>
      <p className="text-xs text-fg-subtle">Revenue is item sales before discounts and GST.</p>
    </>
  );
}

function Payments({ ctx, range }: { ctx: Ctx; range: R }) {
  const { rows, total, split, byType } = paymentReport(ctx, range);
  if (total === 0) return <p className="rounded-xl border border-line bg-surface py-14 text-center text-[13px] text-fg-muted">No payments in this period.</p>;
  return (
    <>
      <div className="flex h-3 overflow-hidden rounded-full bg-muted" role="img" aria-label="Payment mix">{rows.map((r, i) => <div key={r.method} style={{ width: `${r.sharePct}%`, background: ["#064327", "#8fa89d", "#cfd8d3"][i] }} />)}</div>
      <Table><THead><tr><Th>Method</Th><Th align="right">Payments</Th><Th align="right">Share</Th><Th align="right">Amount</Th></tr></THead><TBody>
        {rows.map((r) => <tr key={r.method} className="transition-colors hover:bg-muted/50"><Td className="font-medium">{METHOD[r.method]}</Td><Td align="right" className="tnum">{r.count}</Td><Td align="right" className="tnum text-fg-muted">{r.sharePct.toFixed(1)}%</Td><Td align="right" className="tnum font-medium">{formatMoneyPrecise(r.amount)}</Td></tr>)}
        <tr className="bg-muted/40 font-semibold"><Td>Total collected</Td><Td align="right" className="tnum">{rows.reduce((s, r) => s + r.count, 0)}</Td><Td align="right" className="tnum">100%</Td><Td align="right" className="tnum">{formatMoneyPrecise(total)}</Td></tr>
      </TBody></Table>
      <div className="grid gap-6 md:grid-cols-2">
        <section><h2 className="mb-2.5 text-[13px] font-semibold">By order type</h2><Table><THead><tr><Th>Type</Th><Th align="right">Orders</Th><Th align="right">Amount</Th></tr></THead><TBody>{byType.map((t) => <tr key={t.type}><Td>{TYPE[t.type]}</Td><Td align="right" className="tnum">{t.orders}</Td><Td align="right" className="tnum font-medium">{formatMoney(t.amount)}</Td></tr>)}</TBody></Table></section>
        <section><h2 className="mb-2.5 text-[13px] font-semibold">Split bills</h2><div className="rounded-xl border border-line bg-surface p-4 text-[13px]"><p className="tnum text-[26px] font-semibold tracking-tight">{split}</p><p className="mt-1 text-fg-muted">orders were settled with more than one method.</p></div></section>
      </div>
    </>
  );
}

function Inventory({ ctx, range }: { ctx: Ctx; range: R }) {
  const rows = inventoryReport(ctx, range);
  return (
    <>
      <div className="flex justify-end"><ExportCsv filename="kitchi-inventory" rows={[["Item", "Stock", "Unit", "Minimum", "Status", "Purchased", "Wasted", "Internal"], ...rows.map((r) => [r.name, r.stock, r.unit, r.minLevel, r.status, r.purchased, r.wasted, r.consumed])]} /></div>
      <Table><THead><tr><Th>Item</Th><Th align="right">In stock</Th><Th align="right">Purchased</Th><Th align="right">Wasted</Th><Th align="right">Internal use</Th><Th>Status</Th></tr></THead><TBody>
        {rows.map((r) => <tr key={r.id} className="transition-colors hover:bg-muted/50"><Td className="font-medium">{r.name}</Td><Td align="right" className="tnum">{r.stock} {r.unit}</Td><Td align="right" className="tnum text-ok">{r.purchased ? `+${Math.round(r.purchased * 10) / 10}` : "—"}</Td><Td align="right" className="tnum text-danger">{r.wasted ? Math.round(r.wasted * 10) / 10 : "—"}</Td><Td align="right" className="tnum text-fg-muted">{r.consumed ? Math.round(r.consumed * 10) / 10 : "—"}</Td><Td><Badge tone={r.status === "HEALTHY" ? "ok" : r.status === "LOW" ? "warn" : "danger"} dot>{r.status === "HEALTHY" ? "Healthy" : r.status === "LOW" ? "Low" : "Critical"}</Badge></Td></tr>)}
      </TBody></Table>
      <p className="text-xs text-fg-subtle">Purchased, wasted and internal use cover {range.label.toLowerCase()}.</p>
    </>
  );
}
