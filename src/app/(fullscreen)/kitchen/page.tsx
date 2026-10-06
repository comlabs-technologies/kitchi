import { Kds } from "@/features/kitchen/kds";
import { can } from "@/server/auth/rbac";
import { requirePage } from "@/server/auth/session";
import { MAIN_NAV } from "@/features/shell/nav";
import { kdsOrders } from "@/server/services/orders";
import { getWorkspace } from "@/server/services/tenant";

export const metadata = { title: "Kitchen" };
export const dynamic = "force-dynamic";

export default async function KitchenPage() {
  const ctx = await requirePage("kitchen.view");
  const ws = getWorkspace(ctx);
  // Chefs live on this screen; everyone else gets a way back into the app.
  const back = ctx.role === "CHEF" ? undefined : MAIN_NAV.find((n) => !n.permission || can(ctx.role, n.permission))?.href;
  return <Kds orders={structuredClone(kdsOrders(ctx))} outletName={ws.outlet.name} canManage={can(ctx.role, "kitchen.manage")} serverNow={Date.now()} backHref={back} />;
}
