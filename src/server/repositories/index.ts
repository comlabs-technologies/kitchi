import { store } from "@/server/data/store";
import type { TenantContext } from "@/server/auth/context";

/**
 * Repository layer. The only code allowed to touch the store (→ Prisma/Drizzle later).
 * Every accessor is scoped by the TenantContext: organisation + restaurant for catalogue data,
 * and the active outlet for operational data. There is no way to ask for another tenant's rows.
 */
export function repos(ctx: TenantContext) {
  const inTenant = <T extends { restaurantId: string }>(r: T) => r.restaurantId === ctx.restaurantId;
  const inOutlet = <T extends { outletId: string }>(r: T) => r.outletId === ctx.outletId;

  return {
    organization: () => store.organizations.find((o) => o.id === ctx.organizationId)!,
    restaurant: () => store.restaurants.find((r) => r.id === ctx.restaurantId && r.organizationId === ctx.organizationId)!,
    outlets: () => store.outlets.filter((o) => o.restaurantId === ctx.restaurantId && ctx.outletIds.includes(o.id)),
    outlet: () => store.outlets.find((o) => o.id === ctx.outletId && o.restaurantId === ctx.restaurantId)!,
    settings: () => store.outletSettings.find((s) => s.outletId === ctx.outletId)!,

    categories: () => store.categories.filter(inTenant).sort((a, b) => a.sortOrder - b.sortOrder),
    addCategory: (c: (typeof store.categories)[number]) => void store.categories.push(c),
    menuItems: (opts: { includeDeleted?: boolean } = {}) => store.menuItems.filter((m) => inTenant(m) && (opts.includeDeleted || !m.deletedAt)),
    menuItem: (id: string) => store.menuItems.find((m) => m.id === id && inTenant(m) && !m.deletedAt),
    addMenuItem: (m: (typeof store.menuItems)[number]) => void store.menuItems.push(m),
    modifierGroups: () => store.modifierGroups.filter(inTenant),

    tables: () => store.tables.filter(inOutlet),
    table: (id: string) => store.tables.find((t) => t.id === id && inOutlet(t)),
    addTable: (t: (typeof store.tables)[number]) => void store.tables.push(t),

    orders: () => store.orders.filter(inOutlet),
    order: (id: string) => store.orders.find((o) => o.id === id && inOutlet(o)),
    orderByClientRef: (ref: string) => store.orders.find((o) => o.clientRef === ref && inOutlet(o)),
    addOrder: (o: (typeof store.orders)[number]) => void store.orders.push(o),
    removeOrder: (id: string) => {
      const i = store.orders.findIndex((o) => o.id === id && inOutlet(o));
      if (i >= 0) store.orders.splice(i, 1);
    },
    nextOrderNumber: (dayKey: string) => {
      const key = `${ctx.outletId}:${dayKey}`;
      store.orderCounters[key] = (store.orderCounters[key] ?? 1000) + 1;
      return store.orderCounters[key]!;
    },

    customers: () => store.customers.filter(inTenant),
    customer: (id: string) => store.customers.find((c) => c.id === id && inTenant(c)),
    addCustomer: (c: (typeof store.customers)[number]) => void store.customers.push(c),

    inventory: () => store.inventory.filter(inOutlet),
    inventoryItem: (id: string) => store.inventory.find((i) => i.id === id && inOutlet(i)),
    addInventoryItem: (i: (typeof store.inventory)[number]) => void store.inventory.push(i),
    movements: () => store.movements.filter(inOutlet).sort((a, b) => b.createdAt - a.createdAt),
    addMovement: (m: (typeof store.movements)[number]) => void store.movements.push(m),

    employees: () => store.employees.filter((e) => inTenant(e) && ctx.outletIds.includes(e.outletId)),
    addEmployee: (e: (typeof store.employees)[number]) => void store.employees.push(e),
  };
}
export type Repos = ReturnType<typeof repos>;
