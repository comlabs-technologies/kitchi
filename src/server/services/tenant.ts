import type { OnboardingInput } from "@/lib/schemas";
import { uid } from "@/lib/utils";
import { assertCan, type TenantContext } from "@/server/auth/context";
import { buildMenu } from "@/server/data/menu-data";
import { seedTables } from "@/server/data/seed";
import { store } from "@/server/data/store";
import { repos } from "@/server/repositories";
import type { OutletSettings } from "@/types/domain";

/**
 * Registration path: the only place that creates a tenant. It returns the new user's id,
 * which the caller stores in the (httpOnly) session cookie. Tenant ids are generated here, never accepted from input.
 */
export function createRestaurant(input: OnboardingInput): { userId: string } {
  const now = Date.now();
  const orgId = uid("org");
  const restId = uid("rest");
  const outletId = uid("out");
  const userId = uid("usr");
  store.organizations.push({ id: orgId, name: `${input.restaurantName} Account`, plan: "TRIAL", createdAt: now });
  store.restaurants.push({
    id: restId, organizationId: orgId, name: input.restaurantName, type: input.type, legalName: input.legalName || undefined,
    gstEnabled: input.gstEnabled, gstin: input.gstEnabled ? input.gstin || undefined : undefined, defaultTaxRate: input.defaultTaxRate, pricesIncludeTax: false,
    setup: { menu: input.menuMode === "STARTER", tables: input.tableCount > 0, tax: true, firstOrder: false }, createdAt: now,
  });
  store.outlets.push({ id: outletId, organizationId: orgId, restaurantId: restId, name: input.outletName, city: input.city, address: input.address, phone: input.phone, createdAt: now });
  store.users.push({ id: userId, name: input.ownerName, email: input.email, createdAt: now });
  store.memberships.push({ id: uid("mem"), userId, organizationId: orgId, restaurantId: restId, outletIds: [outletId], role: "OWNER" });
  const settings: OutletSettings = { outletId, acceptUpi: true, acceptCash: true, acceptCard: true, upiId: "", receiptFooter: "Thank you! Visit again.", autoPrintKot: true, kotPrinter: "Kitchen Printer (browser)", receiptPrinter: "Counter Printer (browser)" };
  store.outletSettings.push(settings);
  store.employees.push({ id: uid("emp"), outletId, restaurantId: restId, name: input.ownerName, role: "OWNER", phone: input.phone, shiftStartMin: 9 * 60, shiftEndMin: 18 * 60, offToday: false });
  if (input.menuMode === "STARTER") {
    const m = buildMenu(restId, now);
    store.categories.push(...m.categories);
    store.modifierGroups.push(...m.groups);
    store.menuItems.push(...m.items);
  } else {
    const m = buildMenu(restId, now);
    store.categories.push(...m.categories);
    store.modifierGroups.push(...m.groups);
  }
  seedTables(store, outletId, input.tableCount, now);
  return { userId };
}

export function getWorkspace(ctx: TenantContext) {
  const r = repos(ctx);
  return { organization: r.organization(), restaurant: r.restaurant(), outlet: r.outlet(), outlets: r.outlets(), settings: r.settings() };
}

export function updateRestaurant(ctx: TenantContext, patch: { name?: string; legalName?: string; gstEnabled?: boolean; gstin?: string; defaultTaxRate?: number }) {
  assertCan(ctx, "settings.manage");
  const rest = repos(ctx).restaurant();
  if (patch.name !== undefined) rest.name = patch.name.trim() || rest.name;
  if (patch.legalName !== undefined) rest.legalName = patch.legalName.trim() || undefined;
  if (patch.gstEnabled !== undefined) rest.gstEnabled = patch.gstEnabled;
  if (patch.gstin !== undefined) rest.gstin = patch.gstin.trim() || undefined;
  if (patch.defaultTaxRate !== undefined) rest.defaultTaxRate = patch.defaultTaxRate;
  rest.setup.tax = true;
}

export function updateOutlet(ctx: TenantContext, patch: { name?: string; city?: string; address?: string; phone?: string; fssai?: string }) {
  assertCan(ctx, "settings.manage");
  const o = repos(ctx).outlet();
  Object.assign(o, Object.fromEntries(Object.entries(patch).filter(([, v]) => v !== undefined)));
}

export function updateSettings(ctx: TenantContext, patch: Partial<Omit<OutletSettings, "outletId">>) {
  assertCan(ctx, "settings.manage");
  Object.assign(repos(ctx).settings(), patch);
}
