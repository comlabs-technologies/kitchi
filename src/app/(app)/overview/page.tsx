import Link from "next/link";
import { ArrowRight, Package, Receipt } from "lucide-react";
import { SalesChart } from "@/components/charts";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState, PageBody, Section } from "@/components/ui/primitives";
import { RangeTabs } from "@/features/overview/range-tabs";
import { SetupChecklist } from "@/features/overview/checklist";
import { formatMoney } from "@/lib/money";
import { formatLongDate, greeting, type RangeKey } from "@/lib/time";
import { cn, pct } from "@/lib/utils";
import { can } from "@/server/auth/rbac";
import { requirePage } from "@/server/auth/session";
import { getOverview } from "@/server/services/overview";
import { getWorkspace } from "@/server/services/tenant";

export const metadata = { title: "Overview" };
export const dynamic = "force-dynamic";

const RANGES = [{ value: "today", label: "Today" }, { value: "7d", label: "7 days" }, { value: "30d", label: "30 days" }];
const METHOD: Record<string, string> = { UPI: "UPI", CASH: "Cash", CARD: "Card" };
const METHOD_COLOR: Record<string, string> = { UPI: "#2c5a4b", CASH: "#8fa89d", CARD: "#cfd8d3" };

export default async function OverviewPage({ searchParams }: { searchParams: Promise<{ range?: string }> }) {
  const ctx = await requirePage("overview.view");
  const sp = await searchParams;
  const range = (["today", "7d", "30d"].includes(sp.range ?? "") ? sp.range : "today") as RangeKey;
  const now = Date.now();
  const ws = getWorkspace(ctx);
  const o = getOverview(ctx, range, now);
  const t = o.today;
  const first = ctx.userName.split(" ")[0];
  const noSales = t.orders === 0;
  const rangeTotal = o.payments.reduce((s, p) => s + p.amount, 0);

  return (
    <>
      <div className="border-b border-line">
        <div className="mx-auto flex max-w-[1400px] flex-wrap items-end justify-between gap-3 px-4 pb-4 pt-6 sm:px-6">
          <div>
            <h1 className="text-[22px] font-semibold tracking-[-0.025em]">{greeting(now)}, {first}</h1>
            <p className="mt-1 text-[13px] text-fg-muted">{ws.outlet.name} <span className="mx-1 text-fg-subtle">·</span> {formatLongDate(now)}</p>
          </div>
          <div className="flex gap-2">
            {can(ctx.role, "reports.view") && <Button asChild size="sm"><Link href="/reports?tab=summary"><Receipt className="size-3.5" /> Daily summary</Link></Button>}
            {can(ctx.role, "pos.use") && <Button asChild size="sm" variant="primary"><Link href="/pos">New order</Link></Button>}
          </div>
        </div>
      </div>

      <PageBody className="space-y-7">
        <SetupChecklist setup={o.setup} />

        {/* Primary metrics — one surface, hairline dividers */}
        <dl className="grid grid-cols-2 overflow-hidden rounded-xl border border-line bg-surface lg:grid-cols-4">
          <Metric label="Today's sales" value={formatMoney(t.collected)} sub={t.deltaPct == null ? "No comparison yet" : `${pct(t.deltaPct)} vs yesterday`} tone={t.deltaPct == null ? "muted" : t.deltaPct >= 0 ? "up" : "down"} />
          <Metric label="Orders" value={String(t.orders)} sub={o.openOrders ? `${o.openOrders} in progress` : "None in progress"} />
          <Metric label="Average order value" value={t.orders ? formatMoney(t.aov) : "—"} sub={t.orders ? `${formatMoney(t.net)} net` : "Per paid order"} />
          <Metric label="Customers" value={String(t.customers)} sub="Served today" />
        </dl>

        <Section
          title="Sales"
          action={<RangeTabs value={range} options={RANGES} size="sm" />}
        >
          <div className="rounded-xl border border-line bg-surface p-4">
            <div className="mb-1 flex flex-wrap items-baseline gap-x-3">
              <span className="tnum text-xl font-semibold tracking-tight">{formatMoney(o.range.collected)}</span>
              <span className="text-xs text-fg-muted">{o.range.range} · {o.range.orders} orders</span>
              {o.range.deltaPct != null && <Badge tone={o.range.deltaPct >= 0 ? "ok" : "danger"}>{pct(o.range.deltaPct)}</Badge>}
              <span className="ml-auto hidden items-center gap-3 text-xs text-fg-subtle sm:flex"><span className="flex items-center gap-1.5"><i className="size-2 rounded-full bg-brand" />This period</span><span className="flex items-center gap-1.5"><i className="h-px w-3 border-t border-dashed border-fg-subtle" />{range === "today" ? "Yesterday" : "Previous"}</span></span>
            </div>
            {o.range.orders === 0 ? (
              <EmptyState icon={<Receipt />} title="No sales yet" description="Your first order will appear here once billing starts." action={can(ctx.role, "pos.use") ? <Button asChild variant="primary" size="sm"><Link href="/pos">Open POS</Link></Button> : undefined} className="py-12" />
            ) : (
              <SalesChart data={o.series} prevLabel={range === "today" ? "Yesterday" : "Previous period"} kind={range === "30d" ? "bar" : "area"} />
            )}
          </div>
        </Section>

        <div className="grid gap-x-10 gap-y-8 lg:grid-cols-2">
          <Section title="Top selling items" action={can(ctx.role, "reports.view") && <Link href="/reports?tab=items" className="inline-flex items-center gap-1 text-xs font-medium text-fg-muted hover:text-fg">All items <ArrowRight className="size-3" /></Link>}>
            {o.top.length === 0 ? <p className="py-6 text-[13px] text-fg-muted">Nothing sold in this period yet.</p> : (
              <ol className="divide-y divide-line border-y border-line">
                {o.top.map((i, idx) => (
                  <li key={i.menuItemId} className="flex items-center gap-3 py-2.5">
                    <span className="tnum w-4 text-xs text-fg-subtle">{idx + 1}</span>
                    <div className="min-w-0 flex-1"><p className="truncate text-[13.5px] font-medium">{i.name}</p><p className="tnum text-xs text-fg-muted">{i.qty} orders</p></div>
                    <span className="tnum text-[13.5px] font-medium">{formatMoney(i.revenue)}</span>
                  </li>
                ))}
              </ol>
            )}
          </Section>

          <Section title="Payment breakdown">
            {rangeTotal === 0 ? <p className="py-6 text-[13px] text-fg-muted">No payments recorded in this period.</p> : (
              <div>
                <div className="flex h-2 overflow-hidden rounded-full bg-muted" role="img" aria-label="Payment split">
                  {o.payments.map((p) => <div key={p.method} style={{ width: `${p.sharePct}%`, background: METHOD_COLOR[p.method] }} />)}
                </div>
                <ul className="mt-3 divide-y divide-line border-y border-line">
                  {o.payments.map((p) => (
                    <li key={p.method} className="flex items-center gap-3 py-2.5 text-[13.5px]">
                      <i className="size-2.5 rounded-sm" style={{ background: METHOD_COLOR[p.method] }} />
                      <span className="flex-1 font-medium">{METHOD[p.method]}</span>
                      <span className="tnum text-xs text-fg-muted">{p.sharePct.toFixed(0)}%</span>
                      <span className="tnum w-24 text-right font-medium">{formatMoney(p.amount)}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </Section>

          {can(ctx.role, "inventory.view") && (
            <Section title="Low inventory" action={<Link href="/inventory?status=low" className="inline-flex items-center gap-1 text-xs font-medium text-fg-muted hover:text-fg">Inventory <ArrowRight className="size-3" /></Link>}>
              {o.lowStock.length === 0 ? <EmptyState icon={<Package />} title="No low-stock items" description="Everything looks healthy." className="py-8" /> : (
                <ul className="divide-y divide-line border-y border-line">
                  {o.lowStock.map((i) => (
                    <li key={i.id} className="flex items-center gap-3 py-2.5">
                      <span className="flex-1 text-[13.5px] font-medium">{i.name}</span>
                      <span className={cn("tnum text-[13px]", i.status === "CRITICAL" ? "text-danger" : "text-warn")}>{i.stock} {i.unit} left</span>
                      <Badge tone={i.status === "CRITICAL" ? "danger" : "warn"}>{i.status === "CRITICAL" ? "Critical" : "Low"}</Badge>
                    </li>
                  ))}
                </ul>
              )}
            </Section>
          )}

          <Section title="Recent activity">
            {o.recent.length === 0 ? <p className="py-6 text-[13px] text-fg-muted">Activity will show up here as orders come in.</p> : (
              <ul className="border-y border-line">
                {o.recent.map((e, i) => (
                  <li key={i} className="flex items-baseline gap-3 border-b border-line py-2 last:border-b-0">
                    <Link href={`/orders?open=${e.orderId}`} className="min-w-0 flex-1 truncate text-[13px] hover:underline">{e.text}</Link>
                    <span className="shrink-0 text-xs text-fg-subtle">{e.ago}</span>
                  </li>
                ))}
              </ul>
            )}
          </Section>
        </div>
      </PageBody>
    </>
  );
}

function Metric({ label, value, sub, tone }: { label: string; value: string; sub: string; tone?: "up" | "down" | "muted" }) {
  return (
    <div className="border-line px-5 py-4 max-lg:nth-[-n+2]:border-b max-lg:odd:border-r lg:border-r lg:last:border-r-0">
      <dt className="text-xs font-medium text-fg-muted">{label}</dt>
      <dd className="tnum mt-1.5 text-[28px] font-semibold leading-none tracking-[-0.03em]">{value}</dd>
      <dd className={cn("tnum mt-2 text-xs", tone === "up" ? "text-ok" : tone === "down" ? "text-danger" : "text-fg-muted")}>{sub}</dd>
    </div>
  );
}
