import { redirect } from "next/navigation";
import { Wizard } from "@/features/onboarding/wizard";
import { homeFor } from "@/features/shell/nav";
import { getContext } from "@/server/auth/session";

export const metadata = { title: "Set up your restaurant" };

export default async function OnboardingPage() {
  // Signed-in users already have a workspace. Sign out to create another one.
  const ctx = await getContext();
  if (ctx) redirect(homeFor(ctx.role));
  return <Wizard />;
}
