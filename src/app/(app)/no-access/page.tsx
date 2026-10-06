import { ShieldAlert } from "lucide-react";
import Link from "next/link";
import { EmptyState } from "@/components/ui/primitives";
import { Button } from "@/components/ui/button";
import { requirePage } from "@/server/auth/session";
import { ROLE_LABEL, can } from "@/server/auth/rbac";
import { MAIN_NAV } from "@/features/shell/nav";

export const metadata = { title: "No access" };

export default async function NoAccess() {
  const ctx = await requirePage();
  const home = MAIN_NAV.find((n) => !n.permission || can(ctx.role, n.permission));
  return (
    <EmptyState
      className="min-h-[60vh]"
      icon={<ShieldAlert />}
      title="You don't have access to this page"
      description={`Your role (${ROLE_LABEL[ctx.role]}) doesn't include it. Ask an owner or manager if you need access.`}
      action={home && <Button asChild variant="secondary"><Link href={home.href}>Go to {home.label}</Link></Button>}
    />
  );
}
