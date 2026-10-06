import { formatMoney } from "@/lib/money";
import type { AIAnswer, AIProvider, AIRequest } from "./provider";

type Obj = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any
const rs = (inr: number) => formatMoney(Math.round(inr * 100));

/**
 * Offline stand-in for an LLM: keyword intents mapped to MCP tool calls. Same contract a real
 * provider implements, so swapping it in is a one-line change in ai/index.ts.
 */
export class DeterministicProvider implements AIProvider {
  readonly id = "deterministic";

  async answer({ question, callTool }: AIRequest): Promise<AIAnswer> {
    const q = question.toLowerCase();
    const used: string[] = [];
    const call = async <T = Obj>(name: string, args?: unknown) => {
      used.push(name);
      return (await callTool(name, args)) as T;
    };

    if (/compar|vs|versus|yesterday/.test(q)) {
      const [t, y] = await Promise.all([call<Obj>("restaurant.get_sales_summary", { range: "today" }), call<Obj>("restaurant.get_sales_summary", { range: "yesterday" })]);
      const d = t.changeVsPreviousPct as number | null;
      return {
        text: d == null ? "There's no comparable data from yesterday yet." : `Sales are ${d >= 0 ? "up" : "down"} ${Math.abs(d)}% against yesterday at this time of day.`,
        facts: [
          { label: "Today so far", value: rs(t.collectedInr), tone: d != null && d >= 0 ? "up" : "down" },
          { label: "Yesterday (full day)", value: rs(y.collectedInr) },
          { label: "Orders today", value: String(t.orders) },
          { label: "Avg order · today", value: rs(t.averageOrderValueInr) },
        ],
        toolsUsed: used,
      };
    }
    if (/low|running|stock|inventory|out of/.test(q)) {
      const low = await call<Obj[]>("inventory.get_low_stock");
      if (!low.length) return { text: "Nothing is running low. Everything looks healthy.", toolsUsed: used };
      return {
        text: `${low.length} item${low.length > 1 ? "s are" : " is"} at or below the minimum level.`,
        facts: low.slice(0, 6).map((i) => ({ label: i.name, value: `${i.stock} ${i.unit} · min ${i.minLevel}`, tone: i.status === "CRITICAL" ? "down" : "warn" })),
        toolsUsed: used,
        link: { label: "Open inventory", href: "/inventory" },
      };
    }
    if (/cash|upi|card|collect|payment/.test(q)) {
      const pay = await call<Obj[]>("restaurant.get_payment_breakdown", { range: "today" });
      const want = /cash/.test(q) ? "CASH" : /upi/.test(q) ? "UPI" : /card/.test(q) ? "CARD" : null;
      const hit = pay.find((p) => p.method === want);
      return {
        text: hit ? `You've collected ${rs(hit.amountInr)} in ${hit.method.toLowerCase()} today across ${hit.count} payments.` : "Here's how today's collections split by payment method.",
        facts: pay.map((p) => ({ label: p.method === "UPI" ? "UPI" : p.method === "CASH" ? "Cash" : "Card", value: `${rs(p.amountInr)} · ${p.sharePct}%` })),
        toolsUsed: used,
      };
    }
    if (/sold|top|best|popular|selling/.test(q)) {
      const top = await call<Obj[]>("restaurant.get_top_items", { range: "today", limit: 5 });
      if (!top.length) return { text: "Nothing has sold yet today.", toolsUsed: used };
      return {
        text: `${top[0]!.name} is leading today with ${top[0]!.quantity} sold.`,
        facts: top.map((t) => ({ label: t.name, value: `${t.quantity} sold · ${rs(t.revenueInr)}` })),
        toolsUsed: used,
        link: { label: "Item performance", href: "/reports?tab=items" },
      };
    }
    if (/order|open|pending|kitchen|preparing/.test(q)) {
      const [open, prep] = await Promise.all([call<Obj[]>("restaurant.get_orders", { status: "OPEN", limit: 50 }), call<Obj[]>("restaurant.get_orders", { status: "PREPARING", limit: 50 })]);
      return {
        text: `${open.length} new and ${prep.length} in preparation right now.`,
        facts: [...open, ...prep].slice(0, 5).map((o) => ({ label: `#${o.number} · ${o.table ?? o.type.replace("_", " ").toLowerCase()}`, value: `${o.itemCount} items · ${rs(o.totalInr)}` })),
        toolsUsed: used,
        link: { label: "Open kitchen", href: "/kitchen" },
      };
    }
    if (/how|today|doing|sales|revenue|summary/.test(q)) {
      const d = await call<Obj>("reports.get_daily_summary");
      return {
        text: d.changeVsYesterdayPct == null ? `${rs(d.salesInr)} in sales today across ${d.orders} orders.` : `Sales are ${d.changeVsYesterdayPct >= 0 ? "up" : "down"} ${Math.abs(d.changeVsYesterdayPct)}% on yesterday. ${rs(d.salesInr)} across ${d.orders} orders so far.`,
        facts: [
          { label: "Sales", value: rs(d.salesInr), tone: (d.changeVsYesterdayPct ?? 0) >= 0 ? "up" : "down" },
          { label: "Average order", value: rs(d.averageOrderValueInr) },
          { label: "Top item", value: d.topItem ? `${d.topItem.name} · ${d.topItem.qty}` : "—" },
          { label: "Low stock", value: d.lowStock.length ? d.lowStock.map((l: Obj) => l.name).join(", ") : "None" },
        ],
        toolsUsed: used,
        link: { label: "Daily summary", href: "/reports?tab=summary" },
      };
    }
    return {
      text: "I can answer questions about today's sales, top items, payments, orders and stock. Try one of the suggestions.",
      toolsUsed: used,
    };
  }
}
