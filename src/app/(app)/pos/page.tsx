import { PosTerminal } from "@/features/pos/pos-terminal";
import { can } from "@/server/auth/rbac";
import { requirePage } from "@/server/auth/session";
import { getPosCatalogue } from "@/server/services/menu";
import { getOrder } from "@/server/services/orders";
import { listTables } from "@/server/services/tables";
import { getWorkspace } from "@/server/services/tenant";

export const metadata = { title: "POS" };
export const dynamic = "force-dynamic";

export default async function PosPage({ searchParams }: { searchParams: Promise<{ table?: string; order?: string }> }) {
  const ctx = await requirePage("pos.use");
  const sp = await searchParams;
  const { categories, items, groups } = getPosCatalogue(ctx);
  const ws = getWorkspace(ctx);
  const tables = can(ctx.role, "tables.view") ? listTables(ctx) : [];
  const table = sp.table ? tables.find((t) => t.id === sp.table) : undefined;
  const orderId = sp.order ?? table?.orderId;
  const existing = orderId && can(ctx.role, "orders.view") ? getOrder(ctx, orderId) : null;
  const editable = existing && existing.paymentStatus === "UNPAID" && existing.status !== "COMPLETED" && existing.status !== "CANCELLED" ? existing : undefined;

  return (
    <div className="absolute inset-0">
      <PosTerminal
        categories={categories}
        items={items}
        groups={groups}
        tables={tables.map((t) => ({ id: t.id, name: t.name, seats: t.seats, status: t.status, orderId: t.orderId }))}
        gstEnabled={ws.restaurant.gstEnabled}
        accept={{ upi: ws.settings.acceptUpi, cash: ws.settings.acceptCash, card: ws.settings.acceptCard }}
        upiId={ws.settings.upiId}
        autoPrintKot={false}
        receiptMeta={{ restaurant: ws.restaurant.name, outlet: ws.outlet.name, address: ws.outlet.address, gstin: ws.restaurant.gstEnabled ? ws.restaurant.gstin : undefined, footer: ws.settings.receiptFooter }}
        existing={editable ? structuredClone(editable) : undefined}
        presetTableId={table && !table.orderId ? table.id : undefined}
      />
    </div>
  );
}
