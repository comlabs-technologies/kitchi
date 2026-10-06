import { PageBody, PageHeader } from "@/components/ui/primitives";
import { SettingsView } from "@/features/settings/settings-view";
import { SETTINGS_TABS } from "@/features/settings/tabs";
import { PERMISSIONS, ROLE_LABEL, ROLE_PERMISSIONS, can } from "@/server/auth/rbac";
import { requirePage } from "@/server/auth/session";
import { repos } from "@/server/repositories";
import { getWorkspace } from "@/server/services/tenant";
import type { Role } from "@/types/domain";

export const metadata = { title: "Settings" };
export const dynamic = "force-dynamic";

const LABELS: Record<string, string> = {
  "overview.view": "View overview", "pos.use": "Use POS", "orders.view": "View orders", "orders.manage": "Cancel & complete orders", "tables.view": "View tables", "tables.manage": "Manage tables",
  "kitchen.view": "View kitchen", "kitchen.manage": "Operate kitchen", "menu.view": "View menu", "menu.manage": "Edit menu", "inventory.view": "View inventory", "inventory.manage": "Adjust stock",
  "customers.view": "View customers", "customers.manage": "Edit customers", "staff.view": "View staff", "staff.manage": "Manage staff", "reports.view": "View reports", "settings.view": "View settings", "settings.manage": "Change settings", "ai.use": "Ask Kitchi",
};

export default async function SettingsPage({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  const ctx = await requirePage("settings.view");
  const sp = await searchParams;
  const tab = SETTINGS_TABS.some((t) => t.id === sp.tab) ? sp.tab! : "restaurant";
  const ws = getWorkspace(ctx);
  const outlets = new Map(ws.outlets.map((o) => [o.id, o.name]));
  return (
    <>
      <PageHeader title="Settings" description={ws.restaurant.name} />
      <PageBody>
        <SettingsView
          tab={tab} canManage={can(ctx.role, "settings.manage")} restaurant={ws.restaurant} outlet={ws.outlet} settings={ws.settings}
          roles={(Object.keys(ROLE_LABEL) as Role[]).map((r) => ({ role: r, label: ROLE_LABEL[r], permissions: [...ROLE_PERMISSIONS[r]] }))}
          permissions={PERMISSIONS.map((p) => ({ id: p, label: LABELS[p] ?? p }))}
          members={repos(ctx).employees().map((e) => ({ name: e.name, role: ROLE_LABEL[e.role], outlets: outlets.get(e.outletId) ?? "" }))}
        />
      </PageBody>
    </>
  );
}
