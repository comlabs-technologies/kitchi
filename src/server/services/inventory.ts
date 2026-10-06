import { uid } from "@/lib/utils";
import { assertCan, type TenantContext } from "@/server/auth/context";
import { repos } from "@/server/repositories";
import type { InventoryItem, StockMovement, StockReason, StockStatus } from "@/types/domain";
import { DomainError } from "./orders";

export function stockStatus(i: Pick<InventoryItem, "stock" | "minLevel">): StockStatus {
  if (i.stock <= i.minLevel * 0.5) return "CRITICAL";
  if (i.stock <= i.minLevel) return "LOW";
  return "HEALTHY";
}

export type InventoryRow = InventoryItem & { status: StockStatus };

export function getStock(ctx: TenantContext): InventoryRow[] {
  assertCan(ctx, "inventory.view");
  return repos(ctx).inventory().map((i) => ({ ...i, status: stockStatus(i) })).sort((a, b) => a.name.localeCompare(b.name));
}

export function getLowStock(ctx: TenantContext): InventoryRow[] {
  return getStock(ctx)
    .filter((i) => i.status !== "HEALTHY")
    .sort((a, b) => a.stock / a.minLevel - b.stock / b.minLevel);
}

export function getMovements(ctx: TenantContext, limit = 100, itemId?: string): StockMovement[] {
  assertCan(ctx, "inventory.view");
  return repos(ctx).movements().filter((m) => !itemId || m.inventoryItemId === itemId).slice(0, limit);
}

const SIGN: Record<Exclude<StockReason, "SALE" | "CORRECTION">, 1 | -1> = { PURCHASE: 1, WASTAGE: -1, INTERNAL: -1 };

export function adjustStock(ctx: TenantContext, input: { itemId: string; quantity: number; reason: Exclude<StockReason, "SALE">; note?: string }) {
  assertCan(ctx, "inventory.manage");
  const item = repos(ctx).inventoryItem(input.itemId);
  if (!item) throw new DomainError("Item not found.");
  let delta: number;
  if (input.reason === "CORRECTION") delta = input.quantity - item.stock; // quantity = counted stock
  else delta = SIGN[input.reason] * input.quantity;
  delta = Math.round(delta * 100) / 100;
  if (delta === 0) throw new DomainError("Nothing to change.");
  if (item.stock + delta < 0) throw new DomainError(`Only ${item.stock} ${item.unit} in stock.`);
  item.stock = Math.round((item.stock + delta) * 100) / 100;
  item.updatedAt = Date.now();
  repos(ctx).addMovement({
    id: uid("mv"), outletId: ctx.outletId, inventoryItemId: item.id, itemName: item.name, unit: item.unit, reason: input.reason, delta,
    balanceAfter: item.stock, note: input.note?.trim() || undefined, createdBy: ctx.userName, createdAt: Date.now(),
  });
  return item;
}

export function addInventoryItem(ctx: TenantContext, input: { name: string; unit: string; stock: number; minLevel: number }) {
  assertCan(ctx, "inventory.manage");
  const r = repos(ctx);
  if (r.inventory().some((i) => i.name.toLowerCase() === input.name.toLowerCase())) throw new DomainError("That item already exists.");
  const item: InventoryItem = { id: uid("inv"), outletId: ctx.outletId, ...input, updatedAt: Date.now() };
  r.addInventoryItem(item);
  if (input.stock > 0)
    r.addMovement({ id: uid("mv"), outletId: ctx.outletId, inventoryItemId: item.id, itemName: item.name, unit: item.unit, reason: "PURCHASE", delta: input.stock, balanceAfter: input.stock, note: "Opening stock", createdBy: ctx.userName, createdAt: Date.now() });
  return item;
}
