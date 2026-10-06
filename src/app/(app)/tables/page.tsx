import { PageBody, PageHeader } from "@/components/ui/primitives";
import { TablesView } from "@/features/tables/tables-view";
import { can } from "@/server/auth/rbac";
import { requirePage } from "@/server/auth/session";
import { listTables, unassignedDineInOrders } from "@/server/services/tables";
import { getWorkspace } from "@/server/services/tenant";

export const metadata = { title: "Tables" };
export const dynamic = "force-dynamic";

export default async function TablesPage() {
  const ctx = await requirePage("tables.view");
  const ws = getWorkspace(ctx);
  const tables = listTables(ctx);
  const unassigned = unassignedDineInOrders(ctx).map((o) => ({ id: o.id, number: o.number, total: o.total, items: o.items }));
  return (
    <>
      <PageHeader title="Tables" description={`${ws.outlet.name} · floor status`} />
      <PageBody>
        <TablesView tables={structuredClone(tables)} unassigned={unassigned} canManage={can(ctx.role, "tables.manage")} canPos={can(ctx.role, "pos.use")} serverNow={Date.now()} />
      </PageBody>
    </>
  );
}
