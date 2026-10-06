"use server";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { onboardingSchema, type OnboardingFormInput } from "@/lib/schemas";
import type { ActionResult } from "@/lib/action";
import { OUTLET_COOKIE, SESSION_COOKIE, getContext } from "@/server/auth/session";
import { store } from "@/server/data/store";
import { createRestaurant } from "@/server/services/tenant";
import { homeFor } from "@/features/shell/nav";
import { signSession } from "@/server/auth/token";
import { safe } from "./safe";

const COOKIE_OPTS = { httpOnly: true, sameSite: "lax" as const, secure: process.env.NODE_ENV === "production", path: "/", maxAge: 60 * 60 * 24 * 30 };

/** Demo sign-in: pick a seeded user. Replace with a real provider; the rest of the app only reads the session cookie. */
export async function signInDemo(userId: string) {
  if (!store.users.some((u) => u.id === userId)) redirect("/login");
  const jar = await cookies();
  jar.set(SESSION_COOKIE, signSession(userId), COOKIE_OPTS);
  jar.delete(OUTLET_COOKIE);
  const m = store.memberships.find((x) => x.userId === userId);
  redirect(m ? homeFor(m.role) : "/overview");
}

export async function signOut() {
  const jar = await cookies();
  jar.delete(SESSION_COOKIE);
  jar.delete(OUTLET_COOKIE);
  redirect("/login");
}

export async function switchOutlet(outletId: string): Promise<ActionResult> {
  return safe(async () => {
    const ctx = await getContext();
    if (!ctx || !ctx.outletIds.includes(outletId)) throw new Error("Not allowed");
    (await cookies()).set(OUTLET_COOKIE, outletId, COOKIE_OPTS);
  });
}

export async function completeOnboarding(raw: OnboardingFormInput): Promise<ActionResult<{ userId: string }>> {
  return safe(
    async () => {
      const input = onboardingSchema.parse(raw);
      const { userId } = createRestaurant(input);
      const jar = await cookies();
      jar.set(SESSION_COOKIE, signSession(userId), COOKIE_OPTS);
      jar.delete(OUTLET_COOKIE);
      return { userId };
    },
    { revalidate: false },
  );
}
