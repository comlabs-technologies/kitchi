import type { Role } from "@/types/domain";

export const PERMISSIONS = [
  "overview.view",
  "pos.use",
  "orders.view",
  "orders.manage",
  "tables.view",
  "tables.manage",
  "kitchen.view",
  "kitchen.manage",
  "menu.view",
  "menu.manage",
  "inventory.view",
  "inventory.manage",
  "customers.view",
  "customers.manage",
  "staff.view",
  "staff.manage",
  "reports.view",
  "settings.view",
  "settings.manage",
  "ai.use",
] as const;
export type Permission = (typeof PERMISSIONS)[number];

const ALL: Permission[] = [...PERMISSIONS];

/** Role → permission grants. Enforced server-side in services; the UI only mirrors it. */
export const ROLE_PERMISSIONS: Record<Role, readonly Permission[]> = {
  OWNER: ALL,
  MANAGER: ALL.filter((p) => p !== "settings.manage"),
  CASHIER: [
    "pos.use",
    "orders.view",
    "orders.manage",
    "tables.view",
    "tables.manage",
    "customers.view",
    "customers.manage",
    "kitchen.view",
  ],
  WAITER: ["pos.use", "orders.view", "tables.view", "tables.manage", "kitchen.view"],
  CHEF: ["kitchen.view", "kitchen.manage", "inventory.view"],
};

export const ROLE_LABEL: Record<Role, string> = {
  OWNER: "Owner",
  MANAGER: "Manager",
  CASHIER: "Cashier",
  WAITER: "Waiter",
  CHEF: "Chef",
};

export class ForbiddenError extends Error {
  constructor(public permission: Permission) {
    super(`Missing permission: ${permission}`);
    this.name = "ForbiddenError";
  }
}

export function can(role: Role, permission: Permission): boolean {
  return ROLE_PERMISSIONS[role].includes(permission);
}
