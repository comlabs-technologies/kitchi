import { PageBody, PageHeader } from "@/components/ui/primitives";
import { CustomersView } from "@/features/customers/customers-view";
import { can } from "@/server/auth/rbac";
import { requirePage } from "@/server/auth/session";
import type { Order } from "@/types/domain";
import { getCustomer, listCustomers } from "@/server/services/customers";

export const metadata = { title: "Customers" };
export const dynamic = "force-dynamic";

export default async function CustomersPage() {
  const ctx = await requirePage("customers.view");
  const rows = listCustomers(ctx);
  const recent: Record<string, Order[]> = {};
  for (const r of rows.slice(0, 200)) recent[r.id] = structuredClone(getCustomer(ctx, r.id)?.recent ?? []);
  return (
    <>
      <PageHeader title="Customers" description="Everyone who has ordered, with their history." />
      <PageBody><CustomersView rows={rows} recent={recent} canManage={can(ctx.role, "customers.manage")} serverNow={Date.now()} /></PageBody>
    </>
  );
}
