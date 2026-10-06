import { PageBody, PageHeader } from "@/components/ui/primitives";
import { StaffView } from "@/features/staff/staff-view";
import { can } from "@/server/auth/rbac";
import { requirePage } from "@/server/auth/session";
import { listStaff } from "@/server/services/staff";

export const metadata = { title: "Staff" };
export const dynamic = "force-dynamic";

export default async function StaffPage() {
  const ctx = await requirePage("staff.view");
  return (
    <>
      <PageHeader title="Staff" description="Roster, roles and today's shifts." />
      <PageBody><StaffView rows={listStaff(ctx)} canManage={can(ctx.role, "staff.manage")} /></PageBody>
    </>
  );
}
