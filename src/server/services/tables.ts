import { assertCan, type TenantContext } from "@/server/auth/context";
import { repos } from "@/server/repositories";
import { computeTotals } from "@/lib/billing";
import { uid } from "@/lib/utils";
import type { Order, RestaurantTable } from "@/types/domain";
import { DomainError } from "./orders";

export interface TableView extends RestaurantTable {
  order?: Pick<Order, "id" | "number" | "total" | "status" | "paymentStatus" | "createdAt"> & { itemCount: number };
}

export function listTables(ctx: TenantContext): TableView[] {
  assertCan(ctx, "tables.view");
  const r = repos(ctx);
  return r
    .tables()
    .sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }))
    .map((t) => {
      const o = t.orderId ? r.order(t.orderId) : undefined;
      return {
        ...t,
        order: o ? { id: o.id, number: o.number, total: o.total, status: o.status, paymentStatus: o.paymentStatus, createdAt: o.createdAt, itemCount: o.items.reduce((s, i) => s + i.qty, 0) } : undefined,
      };
    });
}

function need(ctx: TenantContext, id: string) {
  const t = repos(ctx).table(id);
  if (!t) throw new DomainError("Table not found.");
  return t;
}

export function addTable(ctx: TenantContext, name: string, seats: number, section: string) {
  assertCan(ctx, "tables.manage");
  const r = repos(ctx);
  if (r.tables().some((t) => t.name.toLowerCase() === name.toLowerCase())) throw new DomainError(`${name} already exists.`);
  r.addTable({ id: uid("tbl"), outletId: ctx.outletId, name, seats, section: section || "Main hall", status: "AVAILABLE" });
  r.restaurant().setup.tables = true;
}

/** Attach an unassigned open dine-in order to an available table. */
export function assignTable(ctx: TenantContext, tableId: string, orderId: string) {
  assertCan(ctx, "tables.manage");
  const t = need(ctx, tableId);
  const o = repos(ctx).order(orderId);
  if (!o || o.type !== "DINE_IN" || o.tableId) throw new DomainError("Pick an open dine-in order without a table.");
  if (t.status !== "AVAILABLE" && t.status !== "RESERVED") throw new DomainError(`${t.name} isn't free.`);
  Object.assign(t, { status: "OCCUPIED", orderId: o.id, occupiedSince: o.createdAt, reservedFor: undefined, reservedAt: undefined });
  o.tableId = t.id;
  o.tableName = t.name;
  o.events.push({ at: Date.now(), actor: ctx.userName, action: "Table assigned", detail: t.name });
}

export function transferTable(ctx: TenantContext, fromId: string, toId: string) {
  assertCan(ctx, "tables.manage");
  const from = need(ctx, fromId);
  const to = need(ctx, toId);
  if (!from.orderId) throw new DomainError(`${from.name} has no order to move.`);
  if (to.status !== "AVAILABLE" && to.status !== "RESERVED") throw new DomainError(`${to.name} isn't free.`);
  const o = repos(ctx).order(from.orderId)!;
  Object.assign(to, { status: from.status, orderId: o.id, occupiedSince: from.occupiedSince, reservedFor: undefined, reservedAt: undefined });
  Object.assign(from, { status: "AVAILABLE", orderId: undefined, occupiedSince: undefined });
  o.tableId = to.id;
  o.tableName = to.name;
  o.events.push({ at: Date.now(), actor: ctx.userName, action: "Table transferred", detail: `${from.name} → ${to.name}` });
}

/** Merge other tables' unpaid orders into the primary table's order. */
export function mergeTables(ctx: TenantContext, primaryId: string, otherIds: string[]) {
  assertCan(ctx, "tables.manage");
  const r = repos(ctx);
  const primary = need(ctx, primaryId);
  const target = primary.orderId ? r.order(primary.orderId) : undefined;
  if (!target) throw new DomainError(`${primary.name} has no open order.`);
  if (target.paymentStatus === "PAID") throw new DomainError(`${primary.name} is already paid.`);
  const names: string[] = [];
  for (const id of otherIds.filter((x) => x !== primaryId)) {
    const t = need(ctx, id);
    const o = t.orderId ? r.order(t.orderId) : undefined;
    if (!o || o.paymentStatus === "PAID") throw new DomainError(`${t.name} has no unpaid order to merge.`);
    target.items.push(...o.items);
    names.push(t.name);
    r.removeOrder(o.id);
    Object.assign(t, { status: "AVAILABLE", orderId: undefined, occupiedSince: undefined });
  }
  if (!names.length) throw new DomainError("Choose at least one other table.");
  Object.assign(target, computeTotals(target.items, target.discount, r.restaurant().gstEnabled));
  if (target.status === "READY") target.status = "PREPARING";
  target.events.push({ at: Date.now(), actor: ctx.userName, action: "Tables merged", detail: `${names.join(", ")} → ${primary.name}` });
}

export function closeTable(ctx: TenantContext, tableId: string) {
  assertCan(ctx, "tables.manage");
  const r = repos(ctx);
  const t = need(ctx, tableId);
  const o = t.orderId ? r.order(t.orderId) : undefined;
  if (o) {
    if (o.paymentStatus !== "PAID") throw new DomainError("Collect payment before closing the table.");
    o.status = "COMPLETED";
    o.events.push({ at: Date.now(), actor: ctx.userName, action: "Table closed", detail: t.name });
  }
  Object.assign(t, { status: "AVAILABLE", orderId: undefined, occupiedSince: undefined });
}

export function reserveTable(ctx: TenantContext, tableId: string, guest: string, at: number) {
  assertCan(ctx, "tables.manage");
  const t = need(ctx, tableId);
  if (t.status !== "AVAILABLE") throw new DomainError(`${t.name} isn't free.`);
  Object.assign(t, { status: "RESERVED", reservedFor: guest, reservedAt: at });
}

export function releaseReservation(ctx: TenantContext, tableId: string) {
  assertCan(ctx, "tables.manage");
  const t = need(ctx, tableId);
  Object.assign(t, { status: "AVAILABLE", reservedFor: undefined, reservedAt: undefined });
}

export function unassignedDineInOrders(ctx: TenantContext): Order[] {
  assertCan(ctx, "tables.view");
  return repos(ctx).orders().filter((o) => o.type === "DINE_IN" && !o.tableId && (o.status === "OPEN" || o.status === "PREPARING" || o.status === "READY") && o.paymentStatus === "UNPAID");
}
