import { computeTotals, resolveDiscount } from "@/lib/billing";
import { dayKey, formatTime } from "@/lib/time";
import { uid } from "@/lib/utils";
import { formatMoney } from "@/lib/money";
import type { SubmitOrderInput } from "@/lib/schemas";
import { assertCan, type TenantContext } from "@/server/auth/context";
import { repos } from "@/server/repositories";
import type { Order, OrderEvent, OrderItem, OrderStatus, OrderType, Payment } from "@/types/domain";

export class DomainError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "DomainError";
  }
}

export interface OrderFilters {
  type?: OrderType | "ALL";
  status?: OrderStatus | "ALL";
  from?: number;
  to?: number;
  q?: string;
}

export function listOrders(ctx: TenantContext, f: OrderFilters = {}): Order[] {
  assertCan(ctx, "orders.view");
  const q = f.q?.trim().toLowerCase();
  return repos(ctx)
    .orders()
    .filter((o) => (!f.type || f.type === "ALL" || o.type === f.type) && (!f.status || f.status === "ALL" || o.status === f.status))
    .filter((o) => (f.from == null || o.createdAt >= f.from) && (f.to == null || o.createdAt < f.to))
    .filter((o) => !q || `#${o.number} ${o.tableName ?? ""} ${o.customerName ?? ""}`.toLowerCase().includes(q))
    .sort((a, b) => b.createdAt - a.createdAt);
}

export function getOrder(ctx: TenantContext, id: string): Order | null {
  assertCan(ctx, "orders.view");
  return repos(ctx).order(id) ?? null;
}

function ev(actor: string, action: string, detail?: string): OrderEvent {
  return { at: Date.now(), actor, action, detail };
}

/** Builds priced order lines from the catalogue. Client-supplied prices are never trusted. */
function buildLines(ctx: TenantContext, input: SubmitOrderInput["items"]): OrderItem[] {
  const r = repos(ctx);
  const groups = r.modifierGroups();
  return input.map((line) => {
    const m = r.menuItem(line.menuItemId);
    if (!m) throw new DomainError("An item on this order is no longer on the menu.");
    if (!m.available) throw new DomainError(`${m.name} is unavailable.`);
    const v = line.variantId ? m.variants.find((x) => x.id === line.variantId) : undefined;
    if (line.variantId && !v) throw new DomainError(`Unknown size for ${m.name}.`);
    const mods = line.modifierIds.map((id) => {
      const mod = groups.filter((g) => m.modifierGroupIds.includes(g.id)).flatMap((g) => g.modifiers).find((x) => x.id === id);
      if (!mod) throw new DomainError(`Unknown add-on for ${m.name}.`);
      return { name: mod.name, price: mod.price };
    });
    const base = v?.price ?? m.price;
    return {
      id: uid("oi"), menuItemId: m.id, name: m.name, variantName: v?.name, basePrice: base,
      unitPrice: base + mods.reduce((s, x) => s + x.price, 0), qty: line.qty, taxRate: m.taxRate,
      foodType: m.foodType, modifiers: mods, note: line.note?.trim() || undefined,
    };
  });
}

export interface SubmitResult {
  order: Order;
  created: boolean;
}

/**
 * Create or amend an order from the POS, optionally taking payment in the same call.
 * Idempotent on clientRef so the offline queue can safely retry.
 */
export function submitOrder(ctx: TenantContext, input: SubmitOrderInput): SubmitResult {
  assertCan(ctx, "pos.use");
  const r = repos(ctx);
  const restaurant = r.restaurant();
  const now = Date.now();

  const dup = r.orderByClientRef(input.clientRef);
  if (dup) return { order: dup, created: false };

  const items = buildLines(ctx, input.items);
  const subtotal = items.reduce((s, i) => s + i.unitPrice * i.qty, 0);
  const discount = resolveDiscount(subtotal, input.discount ?? null);
  const totals = computeTotals(items, discount, restaurant.gstEnabled);
  const customer = input.customerId ? r.customer(input.customerId) : undefined;
  const table = input.tableId ? r.table(input.tableId) : undefined;
  if (input.type === "DINE_IN" && input.tableId && !table) throw new DomainError("That table doesn't exist.");

  let order: Order | undefined = input.orderId ? r.order(input.orderId) : undefined;
  const prevDiscount = order?.discount ?? 0;
  let created = false;
  if (input.orderId && !order) throw new DomainError("This order no longer exists.");
  if (order && (order.paymentStatus === "PAID" || order.status === "COMPLETED" || order.status === "CANCELLED"))
    throw new DomainError("This order is already settled and can't be edited.");

  if (!order) {
    if (table && table.status !== "AVAILABLE" && table.status !== "RESERVED") throw new DomainError(`${table.name} already has an order.`);
    created = true;
    order = {
      id: uid("ord"), outletId: ctx.outletId, number: r.nextOrderNumber(dayKey(now)), type: input.type, tableId: table?.id, tableName: table?.name,
      customerId: customer?.id, customerName: customer?.name, status: "OPEN", paymentStatus: "UNPAID", items, ...totals, note: input.note?.trim() || undefined,
      payments: [], events: [], createdBy: ctx.userName, createdAt: now, updatedAt: now, clientRef: input.clientRef,
    };
    order.events.push({ at: now, actor: ctx.userName, action: "Order created", detail: describeType(order) });
    r.addOrder(order);
  } else {
    const before = new Map(order.items.map((i) => [`${i.menuItemId}|${i.variantName}|${i.modifiers.map((m) => m.name).join(",")}`, i.qty]));
    const added = items
      .map((i) => ({ i, d: i.qty - (before.get(`${i.menuItemId}|${i.variantName}|${i.modifiers.map((m) => m.name).join(",")}`) ?? 0) }))
      .filter((x) => x.d > 0);
    order.items = items;
    Object.assign(order, totals);
    order.note = input.note?.trim() || undefined;
    order.customerId = customer?.id ?? order.customerId;
    order.customerName = customer?.name ?? order.customerName;
    order.clientRef = input.clientRef;
    if (added.length) {
      order.events.push({ at: now, actor: ctx.userName, action: "Items added", detail: added.map((a) => `${a.d} × ${a.i.name}`).join(", ") });
      if (order.status === "READY") {
        order.status = "OPEN";
        order.servedAt = undefined;
        order.readyAt = undefined;
      }
    } else order.events.push({ at: now, actor: ctx.userName, action: "Order updated" });
  }

  if (discount > 0 && discount !== prevDiscount) order.events.push({ at: now, actor: ctx.userName, action: "Discount applied", detail: `${formatMoney(discount)} off` });
  order.events.push({ at: now + 1, actor: "Kitchi", action: "KOT sent to kitchen" });

  if (table && created) {
    table.status = "OCCUPIED";
    table.orderId = order.id;
    table.occupiedSince = now;
    table.reservedFor = undefined;
    table.reservedAt = undefined;
  }

  if (input.payment) takePayment(ctx, order, input.payment.lines);

  order.updatedAt = now;
  if (created && !restaurant.setup.firstOrder) restaurant.setup.firstOrder = true;
  return { order, created };
}

function describeType(o: Order) {
  return o.type === "DINE_IN" ? `Dine in${o.tableName ? ` · ${o.tableName}` : ""}` : o.type === "TAKEAWAY" ? "Takeaway" : "Delivery";
}

function takePayment(ctx: TenantContext, order: Order, lines: { method: Payment["method"]; amount: number; tendered?: number }[]) {
  const sum = lines.reduce((s, l) => s + l.amount, 0);
  if (sum !== order.total) throw new DomainError(`Payments (${formatMoney(sum)}) must equal the bill (${formatMoney(order.total)}).`);
  const now = Date.now();
  for (const l of lines) {
    order.payments.push({ id: uid("pay"), orderId: order.id, method: l.method, amount: l.amount, createdAt: now, reference: l.method === "UPI" ? `UPI${Math.floor(Math.random() * 1e10)}` : l.method === "CARD" ? `POS${Math.floor(Math.random() * 1e6)}` : undefined });
  }
  order.paymentStatus = "PAID";
  order.events.push({ at: now + 2, actor: ctx.userName, action: "Payment received", detail: lines.map((l) => `${l.method} ${formatMoney(l.amount)}`).join(" + ") });
  const table = order.tableId ? repos(ctx).table(order.tableId) : undefined;
  if (table && table.orderId === order.id && order.servedAt) table.status = "BILLING";
}

/** Settle an existing unpaid order (e.g. from a table). */
export function payOrder(ctx: TenantContext, orderId: string, lines: { method: Payment["method"]; amount: number; tendered?: number }[]): Order {
  assertCan(ctx, "pos.use");
  const order = repos(ctx).order(orderId);
  if (!order) throw new DomainError("Order not found.");
  if (order.paymentStatus === "PAID") throw new DomainError("Already paid.");
  if (order.status === "CANCELLED") throw new DomainError("Order was cancelled.");
  takePayment(ctx, order, lines);
  const table = order.tableId ? repos(ctx).table(order.tableId) : undefined;
  if (table && table.orderId === order.id && table.status === "OCCUPIED") table.status = "BILLING";
  order.updatedAt = Date.now();
  return order;
}

const NEXT: Partial<Record<OrderStatus, OrderStatus>> = { OPEN: "PREPARING", PREPARING: "READY" };

/** Kitchen transitions. */
export function advanceKitchen(ctx: TenantContext, orderId: string): Order {
  assertCan(ctx, "kitchen.manage");
  const order = repos(ctx).order(orderId);
  if (!order) throw new DomainError("Order not found.");
  const next = NEXT[order.status];
  if (!next) throw new DomainError("This ticket can't move forward.");
  const now = Date.now();
  order.status = next;
  if (next === "PREPARING") order.startedAt = now;
  if (next === "READY") order.readyAt = now;
  order.events.push({ at: now, actor: ctx.userName, action: next === "PREPARING" ? "Preparing" : "Marked ready" });
  order.updatedAt = now;
  return order;
}

/** Kitchen bump: food has left the pass. Paid orders complete; unpaid dine-in orders wait for billing. */
export function bumpServed(ctx: TenantContext, orderId: string): Order {
  assertCan(ctx, "kitchen.manage");
  const order = repos(ctx).order(orderId);
  if (!order) throw new DomainError("Order not found.");
  if (order.status !== "READY") throw new DomainError("Only ready tickets can be bumped.");
  const now = Date.now();
  order.servedAt = now;
  order.events.push({ at: now, actor: ctx.userName, action: order.type === "DINE_IN" ? "Served" : "Handed over" });
  if (order.paymentStatus === "PAID" && order.type !== "DINE_IN") finish(ctx, order, now);
  else {
    const table = order.tableId ? repos(ctx).table(order.tableId) : undefined;
    if (table && table.orderId === order.id) table.status = "BILLING";
  }
  order.updatedAt = now;
  return order;
}

function finish(ctx: TenantContext, order: Order, now: number) {
  order.status = "COMPLETED";
  order.events.push({ at: now + 1, actor: ctx.userName, action: "Order completed" });
  const table = order.tableId ? repos(ctx).table(order.tableId) : undefined;
  if (table && table.orderId === order.id) {
    table.status = "AVAILABLE";
    table.orderId = undefined;
    table.occupiedSince = undefined;
  }
}

export function completeOrder(ctx: TenantContext, orderId: string): Order {
  assertCan(ctx, "orders.manage");
  const order = repos(ctx).order(orderId);
  if (!order) throw new DomainError("Order not found.");
  if (order.paymentStatus !== "PAID") throw new DomainError("Collect payment before completing the order.");
  if (order.status === "COMPLETED" || order.status === "CANCELLED") return order;
  finish(ctx, order, Date.now());
  order.updatedAt = Date.now();
  return order;
}

export function cancelOrder(ctx: TenantContext, orderId: string, reason: string): Order {
  assertCan(ctx, "orders.manage");
  const order = repos(ctx).order(orderId);
  if (!order) throw new DomainError("Order not found.");
  if (order.status === "COMPLETED" || order.status === "CANCELLED") throw new DomainError("This order is already closed.");
  if (order.paymentStatus === "PAID") throw new DomainError("Paid orders can't be cancelled. Refunds are coming soon.");
  const now = Date.now();
  order.status = "CANCELLED";
  order.events.push({ at: now, actor: ctx.userName, action: "Order cancelled", detail: reason || undefined });
  const table = order.tableId ? repos(ctx).table(order.tableId) : undefined;
  if (table && table.orderId === order.id) Object.assign(table, { status: "AVAILABLE", orderId: undefined, occupiedSince: undefined });
  order.updatedAt = now;
  return order;
}

export function kdsOrders(ctx: TenantContext): Order[] {
  assertCan(ctx, "kitchen.view");
  return repos(ctx)
    .orders()
    .filter((o) => (o.status === "OPEN" || o.status === "PREPARING" || (o.status === "READY" && !o.servedAt)))
    .sort((a, b) => a.createdAt - b.createdAt);
}

export function formatOrderTime(o: Order) {
  return formatTime(o.createdAt);
}
