import { OrdersView } from "@/features/orders/orders-view";
import { RangeTabs } from "@/features/overview/range-tabs";
import { PageBody, PageHeader } from "@/components/ui/primitives";
import { can } from "@/server/auth/rbac";
import { requirePage } from "@/server/auth/session";
import { listOrders } from "@/server/services/orders";
import { rangeFor } from "@/server/services/sales";
import { getWorkspace } from "@/server/services/tenant";
import type { RangeKey } from "@/lib/time";

export const metadata = { title: "Orders" };
export const dynamic = "force-dynamic";

export default async function OrdersPage({ searchParams }: { searchParams: Promise<{ range?: string; open?: string }> }) {
  const ctx = await requirePage("orders.view");
  const sp = await searchParams;
  const key = (["today", "yesterday", "7d"].includes(sp.range ?? "") ? sp.range : "today") as RangeKey;
  const r = rangeFor(key);
  const ws = getWorkspace(ctx);
  // An order opened via deep link (?open=) may be outside the chosen range; widen the window so it can render.
  const orders = listOrders(ctx, { from: r.from, to: r.to });
  const deep = sp.open ? listOrders(ctx).find((o) => o.id === sp.open) : undefined;
  const list = deep && !orders.some((o) => o.id === deep.id) ? [deep, ...orders] : orders;

  return (
    <>
      <PageHeader title="Orders" description={`${ws.outlet.name} · ${r.label}`} actions={<RangeTabs value={key} options={[{ value: "today", label: "Today" }, { value: "yesterday", label: "Yesterday" }, { value: "7d", label: "7 days" }]} size="sm" />} />
      <PageBody>
        <OrdersView
          orders={structuredClone(list)} rangeLabel={r.label} canManage={can(ctx.role, "orders.manage")} canPos={can(ctx.role, "pos.use")}
          meta={{ restaurant: ws.restaurant.name, outlet: ws.outlet.name, address: ws.outlet.address, gstin: ws.restaurant.gstEnabled ? ws.restaurant.gstin : undefined, footer: ws.settings.receiptFooter }}
        />
      </PageBody>
    </>
  );
}
