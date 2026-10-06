import type { MenuItemInput } from "@/lib/schemas";
import { toPaise } from "@/lib/money";
import { uid } from "@/lib/utils";
import { assertCan, type TenantContext } from "@/server/auth/context";
import { repos } from "@/server/repositories";
import type { MenuItem } from "@/types/domain";
import { DomainError } from "./orders";

export function getCatalogue(ctx: TenantContext) {
  assertCan(ctx, "menu.view");
  const r = repos(ctx);
  return { categories: r.categories(), items: r.menuItems(), groups: r.modifierGroups() };
}

/** POS needs the catalogue with only `pos.use`. */
export function getPosCatalogue(ctx: TenantContext) {
  assertCan(ctx, "pos.use");
  const r = repos(ctx);
  return { categories: r.categories(), items: r.menuItems(), groups: r.modifierGroups() };
}

export function listMenuItems(ctx: TenantContext, opts: { categoryId?: string; availableOnly?: boolean } = {}) {
  assertCan(ctx, "menu.view");
  return repos(ctx).menuItems().filter((m) => (!opts.categoryId || m.categoryId === opts.categoryId) && (!opts.availableOnly || m.available));
}

export function getMenuItem(ctx: TenantContext, id: string) {
  assertCan(ctx, "menu.view");
  return repos(ctx).menuItem(id) ?? null;
}

function apply(ctx: TenantContext, m: MenuItem, input: MenuItemInput) {
  const r = repos(ctx);
  if (!r.categories().some((c) => c.id === input.categoryId)) throw new DomainError("Unknown category.");
  const groups = r.modifierGroups().map((g) => g.id);
  m.name = input.name;
  m.description = input.description;
  m.categoryId = input.categoryId;
  m.price = toPaise(input.price);
  m.taxRate = input.taxRate;
  m.foodType = input.foodType;
  m.sku = input.sku || m.sku;
  m.available = input.available;
  m.variants = input.variants.map((v, i) => ({ id: m.variants[i]?.id ?? uid("mv"), name: v.name, price: toPaise(v.price) }));
  m.modifierGroupIds = input.modifierGroupIds.filter((g) => groups.includes(g));
  m.updatedAt = Date.now();
}

export function createMenuItem(ctx: TenantContext, input: MenuItemInput): MenuItem {
  assertCan(ctx, "menu.manage");
  const now = Date.now();
  const m: MenuItem = {
    id: uid("mi"), restaurantId: ctx.restaurantId, categoryId: input.categoryId, name: input.name, description: "", price: 0, taxRate: 5, foodType: "VEG",
    sku: `SKU-${Math.floor(Math.random() * 9000 + 1000)}`, available: true, popular: false, variants: [], modifierGroupIds: [], createdAt: now, updatedAt: now,
  };
  apply(ctx, m, input);
  const r = repos(ctx);
  r.addMenuItem(m);
  r.restaurant().setup.menu = true;
  return m;
}

export function updateMenuItem(ctx: TenantContext, id: string, input: MenuItemInput): MenuItem {
  assertCan(ctx, "menu.manage");
  const m = repos(ctx).menuItem(id);
  if (!m) throw new DomainError("Item not found.");
  apply(ctx, m, input);
  return m;
}

export function duplicateMenuItem(ctx: TenantContext, id: string): MenuItem {
  assertCan(ctx, "menu.manage");
  const r = repos(ctx);
  const m = r.menuItem(id);
  if (!m) throw new DomainError("Item not found.");
  const now = Date.now();
  const copy: MenuItem = { ...m, id: uid("mi"), name: `${m.name} (copy)`, sku: `${m.sku}-C`, popular: false, variants: m.variants.map((v) => ({ ...v, id: uid("mv") })), createdAt: now, updatedAt: now };
  r.addMenuItem(copy);
  return copy;
}

export function setAvailability(ctx: TenantContext, id: string, available: boolean): MenuItem {
  assertCan(ctx, "menu.manage");
  const m = repos(ctx).menuItem(id);
  if (!m) throw new DomainError("Item not found.");
  m.available = available;
  m.updatedAt = Date.now();
  return m;
}

export function deleteMenuItem(ctx: TenantContext, id: string) {
  assertCan(ctx, "menu.manage");
  const m = repos(ctx).menuItem(id);
  if (!m) throw new DomainError("Item not found.");
  m.deletedAt = Date.now(); // soft delete: historical orders keep their line items
}

export function addCategory(ctx: TenantContext, name: string) {
  assertCan(ctx, "menu.manage");
  const r = repos(ctx);
  const n = name.trim();
  if (n.length < 2) throw new DomainError("Category name is too short.");
  if (r.categories().some((c) => c.name.toLowerCase() === n.toLowerCase())) throw new DomainError("That category already exists.");
  r.addCategory({ id: uid("cat"), restaurantId: ctx.restaurantId, name: n, sortOrder: r.categories().length });
}
