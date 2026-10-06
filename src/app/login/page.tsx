import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowRight } from "lucide-react";
import { Wordmark } from "@/components/logo";
import { Badge } from "@/components/ui/badge";
import { homeFor } from "@/features/shell/nav";
import { signInDemo } from "@/server/actions/auth";
import { ROLE_LABEL } from "@/server/auth/rbac";
import { getContext } from "@/server/auth/session";
import { DEMO } from "@/server/data/seed";
import { store } from "@/server/data/store";
import { initials } from "@/lib/utils";

export const metadata = { title: "Sign in" };

const BLURB: Record<string, string> = {
  [DEMO.owner]: "Everything, across both outlets",
  [DEMO.manager]: "Operations, menu, inventory, reports",
  [DEMO.cashier]: "POS, orders, tables, customers",
  [DEMO.chef]: "Kitchen display and stock only",
};

export default async function Login() {
  const ctx = await getContext();
  if (ctx) redirect(homeFor(ctx.role));
  const demo = [DEMO.owner, DEMO.manager, DEMO.cashier, DEMO.chef].map((id) => ({ user: store.users.find((u) => u.id === id)!, role: store.memberships.find((m) => m.userId === id)!.role }));
  return (
    <main id="main" className="grid min-h-dvh lg:grid-cols-[1fr_minmax(0,520px)]">
      <section className="hidden flex-col justify-between border-r border-line bg-muted/60 p-10 lg:flex">
        <Wordmark />
        <div className="max-w-md">
          <h2 className="text-[28px] font-semibold leading-tight tracking-[-0.03em]">The operating system for independent restaurants.</h2>
          <p className="mt-3 text-[14px] leading-relaxed text-fg-muted">Billing, tables, kitchen, menu, stock and reports in one calm, fast workspace — built for the lunch rush.</p>
        </div>
        <p className="text-xs text-fg-subtle">Demo workspace · data resets when the server restarts</p>
      </section>
      <section className="flex flex-col justify-center px-6 py-12 sm:px-12">
        <div className="mx-auto w-full max-w-sm">
          <Wordmark className="mb-8 lg:hidden" />
          <h1 className="text-xl font-semibold tracking-tight">Welcome to Kitchi</h1>
          <p className="mt-1 text-[13px] text-fg-muted">Choose a demo account for Kitchi Demo Café. Each role sees a different product.</p>
          <ul className="mt-6 space-y-2">
            {demo.map(({ user, role }) => (
              <li key={user.id}>
                <form action={signInDemo.bind(null, user.id)}>
                  <button type="submit" className="group flex w-full items-center gap-3 rounded-lg border border-line bg-surface p-3 text-left transition-colors hover:border-line-strong hover:bg-muted/50">
                    <span className="grid size-9 place-items-center rounded-full bg-muted-2 text-xs font-semibold text-fg-muted">{initials(user.name)}</span>
                    <span className="min-w-0 flex-1">
                      <span className="flex items-center gap-2 text-[13.5px] font-medium">{user.name} <Badge tone={role === "OWNER" ? "brand" : "neutral"}>{ROLE_LABEL[role]}</Badge></span>
                      <span className="block truncate text-xs text-fg-muted">{BLURB[user.id]}</span>
                    </span>
                    <ArrowRight className="size-4 text-fg-subtle transition-transform group-hover:translate-x-0.5" />
                  </button>
                </form>
              </li>
            ))}
          </ul>
          <div className="mt-6 border-t border-line pt-5 text-[13px] text-fg-muted">
            New to Kitchi? <Link href="/onboarding" className="font-medium text-brand hover:underline">Set up your restaurant</Link>
          </div>
        </div>
      </section>
    </main>
  );
}
