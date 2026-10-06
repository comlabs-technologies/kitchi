import { z } from "zod";
import { assertCan, type TenantContext } from "@/server/auth/context";
import type { Permission } from "@/server/auth/rbac";
import { getLowStock, getMovements, getStock } from "@/server/services/inventory";
import { getMenuItem, listMenuItems, setAvailability } from "@/server/services/menu";
import { getOrder, listOrders } from "@/server/services/orders";
import { getDailySummary } from "@/server/services/overview";
import { paymentBreakdown, rangeFor, salesSummaryUnchecked, topItems } from "@/server/services/sales";
import { getTodayAttendance } from "@/server/services/staff";
import type { Order } from "@/types/domain";

/**
 * MCP tool layer.
 *   MCP tool → authorisation (tool permission) → domain service (re-checks) → repository
 * Tools never touch the store directly, and tenant identity always comes from the TenantContext
 * resolved by the transport (session for the in-app assistant, a scoped token for /api/mcp).
 */
export interface McpTool<S extends z.ZodType = z.ZodType> {
  name: string;
  description: string;
  permission: Permission;
  write?: boolean;
  input: S;
  handler: (ctx: TenantContext, args: z.output<S>) => unknown | Promise<unknown>;
}

const range = z.enum(["today", "yesterday", "7d", "30d"]).default("today");
const inr = (paise: number) => Math.round(paise) / 100;

const orderDto = (o: Order) => ({
  id: o.id, number: o.number, type: o.type, table: o.tableName ?? null, customer: o.customerName ?? null, status: o.status, paymentStatus: o.paymentStatus,
  itemCount: o.items.reduce((s, i) => s + i.qty, 0), totalInr: inr(o.total), createdAt: new Date(o.createdAt).toISOString(),
});

function tool<S extends z.ZodType>(t: McpTool<S>): McpTool {
  return t as unknown as McpTool;
}

const summaryDto = (ctx: TenantContext, key: "today" | "yesterday" | "7d" | "30d") => {
  const s = salesSummaryUnchecked(ctx, rangeFor(key));
  return { range: s.range, grossInr: inr(s.gross), discountsInr: inr(s.discounts), taxesInr: inr(s.taxes), netInr: inr(s.net), collectedInr: inr(s.collected), orders: s.orders, averageOrderValueInr: inr(s.aov), customers: s.customers, changeVsPreviousPct: s.deltaPct == null ? null : Math.round(s.deltaPct * 10) / 10 };
};

export const tools: McpTool[] = [
  tool({
    name: "restaurant.get_daily_sales", description: "Sales, orders and average order value for today at the active outlet, with change vs yesterday.",
    permission: "reports.view", input: z.object({}), handler: (ctx) => summaryDto(ctx, "today"),
  }),
  tool({
    name: "restaurant.get_sales_summary", description: "Sales summary (gross, discounts, taxes, net, orders, AOV) for a period.",
    permission: "reports.view", input: z.object({ range }), handler: (ctx, a) => summaryDto(ctx, a.range),
  }),
  tool({
    name: "restaurant.get_orders", description: "List orders at the active outlet. Filter by status and type; newest first.",
    permission: "orders.view",
    input: z.object({ status: z.enum(["OPEN", "PREPARING", "READY", "COMPLETED", "CANCELLED"]).optional(), type: z.enum(["DINE_IN", "TAKEAWAY", "DELIVERY"]).optional(), range: range.optional(), limit: z.number().int().min(1).max(100).default(20) }),
    handler: (ctx, a) => {
      const r = a.range ? rangeFor(a.range) : undefined;
      return listOrders(ctx, { status: a.status, type: a.type, from: r?.from, to: r?.to }).slice(0, a.limit).map(orderDto);
    },
  }),
  tool({
    name: "restaurant.get_order", description: "Full detail of one order including items, payments and audit trail.",
    permission: "orders.view", input: z.object({ orderId: z.string() }),
    handler: (ctx, a) => {
      const o = getOrder(ctx, a.orderId);
      return o ? { ...orderDto(o), items: o.items.map((i) => ({ name: i.name, variant: i.variantName, qty: i.qty, unitPriceInr: inr(i.unitPrice), modifiers: i.modifiers.map((m) => m.name), note: i.note })), payments: o.payments.map((p) => ({ method: p.method, amountInr: inr(p.amount) })), events: o.events.map((e) => ({ at: new Date(e.at).toISOString(), actor: e.actor, action: e.action, detail: e.detail })) } : null;
    },
  }),
  tool({
    name: "restaurant.get_top_items", description: "Best-selling menu items by quantity.", permission: "reports.view",
    input: z.object({ range, limit: z.number().int().min(1).max(20).default(5) }),
    handler: (ctx, a) => topItems(ctx, rangeFor(a.range), a.limit).map((i) => ({ name: i.name, quantity: i.qty, revenueInr: inr(i.revenue) })),
  }),
  tool({
    name: "restaurant.get_payment_breakdown", description: "Collections split by UPI, cash and card.", permission: "reports.view", input: z.object({ range }),
    handler: (ctx, a) => paymentBreakdown(ctx, rangeFor(a.range)).map((p) => ({ method: p.method, amountInr: inr(p.amount), count: p.count, sharePct: Math.round(p.sharePct * 10) / 10 })),
  }),
  tool({
    name: "menu.get_items", description: "List menu items, optionally by category.", permission: "menu.view", input: z.object({ categoryId: z.string().optional(), availableOnly: z.boolean().optional() }),
    handler: (ctx, a) => listMenuItems(ctx, a).map((m) => ({ id: m.id, name: m.name, priceInr: inr(m.price), foodType: m.foodType, available: m.available, categoryId: m.categoryId })),
  }),
  tool({
    name: "menu.get_item", description: "One menu item with variants.", permission: "menu.view", input: z.object({ itemId: z.string() }),
    handler: (ctx, a) => { const m = getMenuItem(ctx, a.itemId); return m ? { ...m, priceInr: inr(m.price), variants: m.variants.map((v) => ({ name: v.name, priceInr: inr(v.price) })) } : null; },
  }),
  tool({
    name: "menu.update_availability", description: "Mark a menu item available or sold out.", permission: "menu.manage", write: true, input: z.object({ itemId: z.string(), available: z.boolean() }),
    handler: (ctx, a) => { const m = setAvailability(ctx, a.itemId, a.available); return { id: m.id, name: m.name, available: m.available }; },
  }),
  tool({
    name: "inventory.get_stock", description: "Current stock levels with status.", permission: "inventory.view", input: z.object({}),
    handler: (ctx) => getStock(ctx).map((i) => ({ id: i.id, name: i.name, stock: i.stock, unit: i.unit, minLevel: i.minLevel, status: i.status })),
  }),
  tool({
    name: "inventory.get_low_stock", description: "Items at or below their minimum level, most urgent first.", permission: "inventory.view", input: z.object({}),
    handler: (ctx) => getLowStock(ctx).map((i) => ({ name: i.name, stock: i.stock, unit: i.unit, minLevel: i.minLevel, status: i.status })),
  }),
  tool({
    name: "inventory.get_stock_movements", description: "Recent stock movements (purchases, wastage, corrections).", permission: "inventory.view", input: z.object({ itemId: z.string().optional(), limit: z.number().int().min(1).max(100).default(20) }),
    handler: (ctx, a) => getMovements(ctx, a.limit, a.itemId).map((m) => ({ item: m.itemName, reason: m.reason, delta: m.delta, unit: m.unit, balanceAfter: m.balanceAfter, by: m.createdBy, at: new Date(m.createdAt).toISOString() })),
  }),
  tool({
    name: "staff.get_today_attendance", description: "Today's shifts at the active outlet.", permission: "staff.view", input: z.object({}),
    handler: (ctx) => getTodayAttendance(ctx).map((e) => ({ name: e.name, role: e.role, shiftStatus: e.shiftStatus, shiftStartMinutes: e.shiftStartMin, shiftEndMinutes: e.shiftEndMin })),
  }),
  tool({
    name: "reports.get_daily_summary", description: "Owner's daily summary: sales, payments, top item, low stock.", permission: "reports.view", input: z.object({}),
    handler: (ctx) => { const d = getDailySummary(ctx); return { outlet: d.outletName, salesInr: inr(d.sales), orders: d.orders, averageOrderValueInr: inr(d.aov), changeVsYesterdayPct: d.deltaPct, paymentsInr: { UPI: inr(d.payments.UPI), CASH: inr(d.payments.CASH), CARD: inr(d.payments.CARD) }, topItem: d.topItem ?? null, lowStock: d.lowStock }; },
  }),
];

export function listTools(ctx?: TenantContext) {
  return tools
    .filter((t) => !ctx || true)
    .map((t) => ({ name: t.name, description: t.description, inputSchema: z.toJSONSchema(t.input, { io: "input" }) }));
}

export class McpError extends Error {
  constructor(public code: number, message: string) {
    super(message);
  }
}

/** The single entry point every transport uses. */
export async function callTool(ctx: TenantContext, name: string, rawArgs: unknown) {
  const t = tools.find((x) => x.name === name);
  if (!t) throw new McpError(-32602, `Unknown tool: ${name}`);
  assertCan(ctx, t.permission);
  const parsed = t.input.safeParse(rawArgs ?? {});
  if (!parsed.success) throw new McpError(-32602, `Invalid arguments: ${parsed.error.issues.map((i) => i.message).join("; ")}`);
  return t.handler(ctx, parsed.data);
}

// Named convenience wrappers (the MVP surface called out in the brief)
export const getDailySales = (ctx: TenantContext) => callTool(ctx, "restaurant.get_daily_sales", {});
export const getOrders = (ctx: TenantContext, args: { status?: string; limit?: number } = {}) => callTool(ctx, "restaurant.get_orders", args);
export const getTopSellingItems = (ctx: TenantContext, args: { range?: string; limit?: number } = {}) => callTool(ctx, "restaurant.get_top_items", args);
export const getLowStockItems = (ctx: TenantContext) => callTool(ctx, "inventory.get_low_stock", {});
export const getDailySummaryTool = (ctx: TenantContext) => callTool(ctx, "reports.get_daily_summary", {});
