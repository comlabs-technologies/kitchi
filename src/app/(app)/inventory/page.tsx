import { PageBody, PageHeader } from "@/components/ui/primitives";
import { InventoryView } from "@/features/inventory/inventory-view";
import { can } from "@/server/auth/rbac";
import { requirePage } from "@/server/auth/session";
import { getMovements, getStock } from "@/server/services/inventory";
import { getWorkspace } from "@/server/services/tenant";

export const metadata = { title: "Inventory" };
export const dynamic = "force-dynamic";

export default async function InventoryPage() {
  const ctx = await requirePage("inventory.view");
  const ws = getWorkspace(ctx);
  return (
    <>
      <PageHeader title="Inventory" description={`${ws.outlet.name} · stock levels and movement history`} />
      <PageBody>
        <InventoryView items={getStock(ctx)} movements={structuredClone(getMovements(ctx, 150))} canManage={can(ctx.role, "inventory.manage")} serverNow={Date.now()} />
      </PageBody>
    </>
  );
}
