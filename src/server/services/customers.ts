import { uid } from "@/lib/utils";
import { assertCan, type TenantContext } from "@/server/auth/context";
import { repos } from "@/server/repositories";
import { store } from "@/server/data/store";
import type { Customer, Order } from "@/types/domain";
import { DomainError } from "./orders";

export interface CustomerRow extends Customer {
  orders: number;
  spend: number;
  aov: number;
  lastVisit?: number;
}

/** Orders are outlet-scoped; customers are restaurant-wide, so stats span the restaurant's accessible outlets. */
function customerOrders(ctx: TenantContext): Order[] {
  return store.orders.filter((o) => ctx.outletIds.includes(o.outletId) && o.paymentStatus === "PAID" && o.status !== "CANCELLED" && o.customerId);
}

export function listCustomers(ctx: TenantContext): CustomerRow[] {
  assertCan(ctx, "customers.view");
  const byCust = new Map<string, Order[]>();
  for (const o of customerOrders(ctx)) byCust.set(o.customerId!, [...(byCust.get(o.customerId!) ?? []), o]);
  return repos(ctx)
    .customers()
    .map((c) => rowFor(c, byCust.get(c.id) ?? []))
    .sort((a, b) => b.spend - a.spend);
}

function rowFor(c: Customer, os: Order[]): CustomerRow {
  const spend = os.reduce((s, o) => s + o.total, 0);
  return { ...c, orders: os.length, spend, aov: os.length ? Math.round(spend / os.length) : 0, lastVisit: os.reduce<number | undefined>((m, o) => (m == null || o.createdAt > m ? o.createdAt : m), undefined) };
}

export function getCustomer(ctx: TenantContext, id: string) {
  assertCan(ctx, "customers.view");
  const c = repos(ctx).customer(id);
  if (!c) return null;
  const os = customerOrders(ctx).filter((o) => o.customerId === id).sort((a, b) => b.createdAt - a.createdAt);
  return { customer: rowFor(c, os), recent: os.slice(0, 8) };
}

export function searchCustomers(ctx: TenantContext, q: string): Customer[] {
  assertCan(ctx, "pos.use");
  const s = q.trim().toLowerCase().replace(/\s/g, "");
  return repos(ctx)
    .customers()
    .filter((c) => !s || c.name.toLowerCase().includes(s) || c.phone.replace(/\s/g, "").includes(s))
    .slice(0, 12);
}

export function createCustomer(ctx: TenantContext, input: { name: string; phone: string }): Customer {
  if (!(ctx.role === "OWNER" || ctx.role === "MANAGER" || ctx.role === "CASHIER" || ctx.role === "WAITER")) assertCan(ctx, "customers.manage");
  const r = repos(ctx);
  const digits = input.phone.replace(/\D/g, "");
  const dup = r.customers().find((c) => c.phone.replace(/\D/g, "").endsWith(digits.slice(-10)));
  if (dup) throw new DomainError(`${dup.name} already has this number.`);
  const c: Customer = { id: uid("cus"), restaurantId: ctx.restaurantId, name: input.name.trim(), phone: input.phone.trim(), createdAt: Date.now() };
  r.addCustomer(c);
  return c;
}
