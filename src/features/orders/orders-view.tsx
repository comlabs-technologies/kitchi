"use client";
import * as React from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ClipboardList } from "lucide-react";
import { Button } from "@/components/ui/button";
import { EmptyState, Segmented } from "@/components/ui/primitives";
import { SearchInput, Table, TBody, Td, Th, THead, Tr, useSort } from "@/components/ui/table";
import { formatMoney } from "@/lib/money";
import { formatTime } from "@/lib/time";
import { cn, plural } from "@/lib/utils";
import type { Order, OrderStatus, OrderType } from "@/types/domain";
import type { ReceiptMeta } from "@/features/pos/print-service";
import { OrderSheet } from "./order-sheet";
import { paymentLabel, StatusBadge, STATUS_LABEL, TYPE_LABEL } from "./status";

const PAGE = 100;

export function OrdersView({ orders, canManage, canPos, meta, rangeLabel }: { orders: Order[]; canManage: boolean; canPos: boolean; meta: ReceiptMeta; rangeLabel: string }) {
  const router = useRouter();
  const sp = useSearchParams();
  const [type, setType] = React.useState<OrderType | "ALL">("ALL");
  const [status, setStatus] = React.useState<OrderStatus | "ALL">("ALL");
  const [q, setQ] = React.useState("");
  const [limit, setLimit] = React.useState(PAGE);
  const [openId, setOpenId] = React.useState<string | null>(sp.get("open"));

  const byType = React.useMemo(() => orders.filter((o) => type === "ALL" || o.type === type), [orders, type]);
  const counts = React.useMemo(() => {
    const c: Record<string, number> = { ALL: byType.length };
    for (const o of byType) c[o.status] = (c[o.status] ?? 0) + 1;
    return c;
  }, [byType]);
  const filtered = React.useMemo(() => {
    const n = q.trim().toLowerCase().replace(/^#/, "");
    return byType.filter((o) => (status === "ALL" || o.status === status) && (!n || `${o.number} ${o.tableName ?? ""} ${o.customerName ?? ""}`.toLowerCase().includes(n)));
  }, [byType, status, q]);

  const { sorted, sort } = useSort(filtered, {
    number: (o) => o.createdAt, time: (o) => o.createdAt, who: (o) => o.tableName ?? o.customerName ?? "", type: (o) => o.type, items: (o) => o.items.reduce((s, i) => s + i.qty, 0), payment: (o) => paymentLabel(o), status: (o) => o.status, amount: (o) => o.total,
  }, { key: "time", dir: "desc" });

  const open = orders.find((o) => o.id === openId) ?? null;
  const close = () => { setOpenId(null); if (sp.get("open")) router.replace("/orders", { scroll: false }); };

  return (
    <>
      <div className="mb-4 flex flex-wrap items-center gap-x-4 gap-y-2.5">
        <Segmented label="Order type" value={type} onChange={(v) => { setType(v); setLimit(PAGE); }} options={[{ value: "ALL", label: "All" }, { value: "DINE_IN", label: "Dine in" }, { value: "TAKEAWAY", label: "Takeaway" }, { value: "DELIVERY", label: "Delivery" }]} />
        <div className="scroll-none -mx-1 flex gap-1 overflow-x-auto px-1" role="group" aria-label="Status">
          {(["ALL", "OPEN", "PREPARING", "READY", "COMPLETED", "CANCELLED"] as const).map((s) => (
            <button key={s} type="button" aria-pressed={status === s} onClick={() => { setStatus(s); setLimit(PAGE); }} className={cn("flex h-8 shrink-0 items-center gap-1.5 rounded-md px-2.5 text-[13px] font-medium transition-colors", status === s ? "bg-fg text-white" : "text-fg-muted hover:bg-muted")}>
              {s === "ALL" ? "All statuses" : STATUS_LABEL[s]}<span className={cn("tnum text-xs", status === s ? "text-white/70" : "text-fg-subtle")}>{counts[s] ?? 0}</span>
            </button>
          ))}
        </div>
        <SearchInput value={q} onChange={setQ} placeholder="Search order, table, customer" className="ml-auto w-full sm:w-64" />
      </div>

      {orders.length === 0 ? (
        <div className="rounded-xl border border-line bg-surface"><EmptyState icon={<ClipboardList />} title="No orders yet" description="Your first order will appear here once billing starts." /></div>
      ) : sorted.length === 0 ? (
        <div className="rounded-xl border border-line bg-surface"><EmptyState icon={<ClipboardList />} title="No orders match" description={`Nothing in ${rangeLabel.toLowerCase()} matches these filters.`} action={<Button size="sm" onClick={() => { setType("ALL"); setStatus("ALL"); setQ(""); }}>Clear filters</Button>} /></div>
      ) : (
        <>
          <Table>
            <THead>
              <tr>
                <Th sort={sort} sortKey="number">Order</Th><Th sort={sort} sortKey="time">Time</Th><Th sort={sort} sortKey="who">Customer / Table</Th><Th sort={sort} sortKey="type">Type</Th>
                <Th sort={sort} sortKey="items">Items</Th><Th sort={sort} sortKey="payment">Payment</Th><Th sort={sort} sortKey="status">Status</Th><Th align="right" sort={sort} sortKey="amount">Amount</Th>
              </tr>
            </THead>
            <TBody>
              {sorted.slice(0, limit).map((o) => (
                <Tr key={o.id} onClick={() => setOpenId(o.id)} aria-label={`Order ${o.number}`}>
                  <Td className="tnum font-medium">#{o.number}</Td>
                  <Td className="tnum text-fg-muted">{formatTime(o.createdAt)}</Td>
                  <Td>{o.tableName ?? o.customerName ?? <span className="text-fg-subtle">Walk-in</span>}{o.tableName && o.customerName ? <span className="ml-1.5 text-fg-subtle">· {o.customerName}</span> : null}</Td>
                  <Td className="text-fg-muted">{TYPE_LABEL[o.type]}</Td>
                  <Td className="tnum text-fg-muted">{plural(o.items.reduce((s, i) => s + i.qty, 0), "item")}</Td>
                  <Td className={o.paymentStatus === "UNPAID" && o.status !== "CANCELLED" ? "text-warn" : "text-fg-muted"}>{paymentLabel(o)}</Td>
                  <Td><StatusBadge status={o.status} /></Td>
                  <Td align="right" className="tnum font-medium">{formatMoney(o.total)}</Td>
                </Tr>
              ))}
            </TBody>
          </Table>
          <div className="mt-3 flex items-center justify-between text-xs text-fg-muted">
            <span className="tnum">Showing {Math.min(limit, sorted.length)} of {sorted.length} orders · {rangeLabel}</span>
            {sorted.length > limit && <Button size="sm" onClick={() => setLimit((l) => l + PAGE)}>Show more</Button>}
          </div>
        </>
      )}
      <OrderSheet order={open} onClose={close} canManage={canManage} canPos={canPos} meta={meta} />
    </>
  );
}
