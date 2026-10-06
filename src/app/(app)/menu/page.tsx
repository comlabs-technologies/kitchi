import { PageBody, PageHeader } from "@/components/ui/primitives";
import { MenuView } from "@/features/menu/menu-view";
import { can } from "@/server/auth/rbac";
import { requirePage } from "@/server/auth/session";
import { getCatalogue } from "@/server/services/menu";

export const metadata = { title: "Menu" };
export const dynamic = "force-dynamic";

export default async function MenuPage() {
  const ctx = await requirePage("menu.view");
  const { categories, items, groups } = getCatalogue(ctx);
  return (
    <>
      <PageHeader title="Menu" description="Items, prices, availability and add-ons. Changes appear in POS immediately." />
      <PageBody>
        <MenuView categories={structuredClone(categories)} items={structuredClone(items)} groups={structuredClone(groups)} canManage={can(ctx.role, "menu.manage")} />
      </PageBody>
    </>
  );
}
