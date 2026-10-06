import "server-only";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { cache } from "react";
import { store } from "@/server/data/store";
import type { TenantContext } from "./context";
import { can, ForbiddenError, type Permission } from "./rbac";
import { verifySession } from "./token";

/**
 * AUTH PLACEHOLDER.
 * The session cookie carries only a signed user id. Tenant, restaurant, role and outlet access are
 * resolved from Membership on the server. Replace `readSessionUserId` with Auth.js / Clerk /
 * a signed JWT and nothing else needs to change.
 */
export const SESSION_COOKIE = "kitchi_session";
export const OUTLET_COOKIE = "kitchi_outlet";

export async function readSessionUserId(): Promise<string | null> {
  const jar = await cookies();
  return verifySession(jar.get(SESSION_COOKIE)?.value);
}

export const getContext = cache(async (): Promise<TenantContext | null> => {
  const userId = await readSessionUserId();
  if (!userId) return null;
  const user = store.users.find((u) => u.id === userId);
  const membership = store.memberships.find((m) => m.userId === userId);
  if (!user || !membership) return null;
  const jar = await cookies();
  const requested = jar.get(OUTLET_COOKIE)?.value;
  // The outlet cookie is a *preference*; it is only honoured if the membership grants it.
  const outletId = requested && membership.outletIds.includes(requested) ? requested : membership.outletIds[0]!;
  return {
    userId,
    userName: user.name,
    organizationId: membership.organizationId,
    restaurantId: membership.restaurantId,
    outletId,
    outletIds: membership.outletIds,
    role: membership.role,
  };
});

/** For pages: redirect to login when signed out, render a no-access state (via redirect) when forbidden. */
export async function requirePage(permission?: Permission): Promise<TenantContext> {
  const ctx = await getContext();
  if (!ctx) redirect("/login");
  if (permission && !can(ctx.role, permission)) redirect(`/no-access?need=${encodeURIComponent(permission)}`);
  return ctx;
}

/** For server actions / route handlers: throws instead of redirecting. */
export async function requireAction(permission: Permission): Promise<TenantContext> {
  const ctx = await getContext();
  if (!ctx) throw new Error("Not signed in");
  if (!can(ctx.role, permission)) throw new ForbiddenError(permission);
  return ctx;
}
