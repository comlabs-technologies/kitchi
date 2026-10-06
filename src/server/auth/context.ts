import type { Role } from "@/types/domain";
import { can, ForbiddenError, type Permission } from "./rbac";

/**
 * TenantContext is derived on the server from the authenticated session.
 * It is never constructed from request input. Every service takes one.
 */
export interface TenantContext {
  userId: string;
  userName: string;
  organizationId: string;
  restaurantId: string;
  outletId: string;
  outletIds: string[];
  role: Role;
}

export function assertCan(ctx: TenantContext, permission: Permission): void {
  if (!can(ctx.role, permission)) throw new ForbiddenError(permission);
}
