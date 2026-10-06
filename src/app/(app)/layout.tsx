import { requirePage } from "@/server/auth/session";
import { can } from "@/server/auth/rbac";
import { AppShell } from "@/features/shell/app-shell";
import { getWorkspace } from "@/server/services/tenant";
import { getLowStock } from "@/server/services/inventory";
import { repos } from "@/server/repositories";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const ctx = await requirePage();
  const ws = getWorkspace(ctx);
  const notifications: React.ComponentProps<typeof AppShell>["notifications"] = [];
  if (can(ctx.role, "inventory.view")) {
    for (const i of getLowStock(ctx).slice(0, 3)) {
      notifications.push({ id: `inv-${i.id}`, title: `${i.name} is ${i.status === "CRITICAL" ? "critically low" : "running low"}`, detail: `${i.stock} ${i.unit} left · minimum ${i.minLevel} ${i.unit}`, href: "/inventory?status=low", tone: i.status === "CRITICAL" ? "danger" : "warn" });
    }
  }
  if (can(ctx.role, "kitchen.view")) {
    const ready = repos(ctx).orders().filter((o) => o.status === "READY" && !o.servedAt).length;
    if (ready) notifications.push({ id: "ready", title: `${ready} order${ready > 1 ? "s" : ""} ready to serve`, detail: "Waiting at the pass", href: "/kitchen", tone: "neutral" });
  }
  return (
    <AppShell
      user={{ name: ctx.userName, role: ctx.role }}
      restaurantName={ws.restaurant.name}
      outlets={ws.outlets.map((o) => ({ id: o.id, name: `${o.name}`, city: o.city }))}
      activeOutletId={ctx.outletId}
      notifications={notifications}
    >
      {children}
    </AppShell>
  );
}
