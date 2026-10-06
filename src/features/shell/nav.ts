import { Armchair, ChartColumn, ChefHat, ClipboardList, CreditCard, IdCard, LayoutDashboard, Package, UtensilsCrossed, Users, Settings, CircleHelp } from "lucide-react";
import { can, type Permission } from "@/server/auth/rbac";
import type { Role } from "@/types/domain";

export interface NavItem {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  /** Omit to show to everyone. The server still enforces access on every page and action. */
  permission?: Permission;
}

export const MAIN_NAV: NavItem[] = [
  { href: "/overview", label: "Overview", icon: LayoutDashboard, permission: "overview.view" },
  { href: "/pos", label: "POS", icon: CreditCard, permission: "pos.use" },
  { href: "/orders", label: "Orders", icon: ClipboardList, permission: "orders.view" },
  { href: "/tables", label: "Tables", icon: Armchair, permission: "tables.view" },
  { href: "/kitchen", label: "Kitchen", icon: ChefHat, permission: "kitchen.view" },
  { href: "/menu", label: "Menu", icon: UtensilsCrossed, permission: "menu.view" },
  { href: "/inventory", label: "Inventory", icon: Package, permission: "inventory.view" },
  { href: "/customers", label: "Customers", icon: Users, permission: "customers.view" },
  { href: "/staff", label: "Staff", icon: IdCard, permission: "staff.view" },
  { href: "/reports", label: "Reports", icon: ChartColumn, permission: "reports.view" },
];

export const SECONDARY_NAV: NavItem[] = [
  { href: "/settings", label: "Settings", icon: Settings, permission: "settings.view" },
  { href: "/help", label: "Help", icon: CircleHelp },
];

/** Landing page for a role: the first main-nav destination they're allowed to see. */
export function homeFor(role: Role): string {
  return MAIN_NAV.find((n) => !n.permission || can(role, n.permission))?.href ?? "/help";
}
