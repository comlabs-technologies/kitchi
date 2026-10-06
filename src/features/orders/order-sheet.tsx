"use client";
import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { CircleCheck, Pencil, Printer, ReceiptText, Ban } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogBody, DialogContent, DialogFooter } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/form";
import { Sheet, SheetBody, SheetContent, SheetFooter } from "@/components/ui/sheet";
import { FoodMark } from "@/components/ui/primitives";
import { formatMoney, formatMoneyPrecise } from "@/lib/money";
import { formatDateTime, formatTime } from "@/lib/time";
import { cancelOrderAction, completeOrderAction } from "@/server/actions/pos";
import type { Order } from "@/types/domain";
import { browserPrintService, type ReceiptMeta } from "@/features/pos/print-service";
import { paymentLabel, StatusBadge, TYPE_LABEL } from "./status";

export function OrderSheet({ order, onClose, canManage, canPos, meta }: { order: Order | null; onClose: () => void; canManage: boolean; canPos: boolean; meta: ReceiptMeta }) {
  const router = useRouter();
  const [busy, setBusy] = React.useState(false);
  const [cancelOpen, setCancelOpen] = React.useState(false);
  const [reason, setReason] = React.useState("");

  const run = async (fn: () => Promise<{ ok: boolean } & ({ error: string } | { data?: unknown })>, ok: string) => {
    setBusy(true);
    const r = await fn();
    setBusy(false);
    if (!r.ok) return toast.error((r as { error: string }).error);
    toast.success(ok);
    router.refresh();
  };

  return (
    <Sheet open={!!order} onOpenChange={(o) => !o && onClose()}>
      {order && (
        <SheetContent
          title={<span className="flex items-center gap-2">Order #{order.number} <StatusBadge status={order.status} /></span>}
          description={`${TYPE_LABEL[order.type]}${order.tableName ? ` · ${order.tableName}` : ""} · ${formatDateTime(order.createdAt)}`}
        >
          <SheetBody>
            <div className="grid grid-cols-2 gap-x-6 gap-y-3 border-b border-line px-5 py-4 text-[13px]">
              <Meta label="Customer" value={order.customerName ?? "Walk-in"} />
              <Meta label="Payment" value={paymentLabel(order)} />
              <Meta label="Taken by" value={order.createdBy} />
              <Meta label="Total" value={formatMoney(order.total)} />
            </div>
            {order.note && <p className="border-b border-line bg-warn-soft/60 px-5 py-2.5 text-[13px]"><span className="font-medium">Note:</span> {order.note}</p>}

            <section className="border-b border-line px-5 py-4">
              <h3 className="mb-2 text-xs font-medium text-fg-muted">Items</h3>
              <ul className="space-y-2.5">
                {order.items.map((i) => (
                  <li key={i.id} className="flex items-start gap-2.5 text-[13px]">
                    <FoodMark type={i.foodType} className="mt-[3px]" />
                    <div className="min-w-0 flex-1">
                      <p className="font-medium">{i.qty} × {i.name}{i.variantName ? <span className="font-normal text-fg-muted"> · {i.variantName}</span> : null}</p>
                      {i.modifiers.length > 0 && <p className="text-xs text-fg-muted">{i.modifiers.map((m) => `+ ${m.name}`).join(", ")}</p>}
                      {i.note && <p className="text-xs italic text-fg-muted">“{i.note}”</p>}
                    </div>
                    <span className="tnum">{formatMoney(i.unitPrice * i.qty)}</span>
                  </li>
                ))}
              </ul>
              <dl className="tnum mt-3 space-y-1 border-t border-line pt-3 text-[13px]">
                <Row k="Subtotal" v={formatMoneyPrecise(order.subtotal)} />
                {order.discount > 0 && <Row k="Discount" v={`−${formatMoneyPrecise(order.discount)}`} tone="ok" />}
                <Row k="GST" v={formatMoneyPrecise(order.tax)} />
                {order.roundOff !== 0 && <Row k="Round off" v={formatMoneyPrecise(order.roundOff)} />}
                <div className="flex justify-between pt-1 text-[14px] font-semibold"><dt>Total</dt><dd>{formatMoneyPrecise(order.total)}</dd></div>
              </dl>
            </section>

            {order.payments.length > 0 && (
              <section className="border-b border-line px-5 py-4">
                <h3 className="mb-2 text-xs font-medium text-fg-muted">Payments</h3>
                <ul className="space-y-1.5 text-[13px]">
                  {order.payments.map((p) => <li key={p.id} className="flex justify-between"><span>{p.method === "UPI" ? "UPI" : p.method === "CASH" ? "Cash" : "Card"}{p.reference ? <span className="ml-2 text-xs text-fg-subtle">{p.reference}</span> : null}</span><span className="tnum">{formatMoneyPrecise(p.amount)}</span></li>)}
                </ul>
              </section>
            )}

            <section className="px-5 py-4">
              <h3 className="mb-3 text-xs font-medium text-fg-muted">Audit trail</h3>
              <ol className="relative space-y-3.5 border-l border-line pl-4">
                {order.events.map((e, i) => (
                  <li key={i} className="relative text-[13px]">
                    <span className="absolute -left-[21px] top-1.5 size-2 rounded-full border-2 border-surface bg-fg-subtle" />
                    <p className="font-medium">{e.action}{e.detail ? <span className="font-normal text-fg-muted"> — {e.detail}</span> : null}</p>
                    <p className="text-xs text-fg-subtle">{formatTime(e.at)} · {e.actor}</p>
                  </li>
                ))}
              </ol>
            </section>
          </SheetBody>
          <SheetFooter className="flex-wrap">
            <Button size="sm" onClick={() => void browserPrintService.printReceipt(order, meta)}><Printer className="size-3.5" /> Receipt</Button>
            <Button size="sm" onClick={() => void browserPrintService.printKOT(order, meta)}><ReceiptText className="size-3.5" /> KOT</Button>
            {canPos && order.paymentStatus === "UNPAID" && order.status !== "CANCELLED" && order.status !== "COMPLETED" && <Button size="sm" asChild><Link href={`/pos?order=${order.id}`}><Pencil className="size-3.5" /> Edit in POS</Link></Button>}
            <span className="flex-1" />
            {canManage && order.status !== "COMPLETED" && order.status !== "CANCELLED" && order.paymentStatus === "UNPAID" && <Button size="sm" variant="danger-ghost" onClick={() => setCancelOpen(true)}><Ban className="size-3.5" /> Cancel</Button>}
            {canManage && order.status !== "COMPLETED" && order.status !== "CANCELLED" && order.paymentStatus === "PAID" && <Button size="sm" variant="primary" loading={busy} onClick={() => void run(() => completeOrderAction(order.id), "Order completed")}><CircleCheck className="size-3.5" /> Mark completed</Button>}
          </SheetFooter>

          <Dialog open={cancelOpen} onOpenChange={setCancelOpen}>
            <DialogContent title={`Cancel order #${order.number}?`} description="The kitchen will be notified and the table freed." className="max-w-[400px]">
              <DialogBody><Textarea autoFocus value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Reason (optional)" aria-label="Cancellation reason" /></DialogBody>
              <DialogFooter><Button onClick={() => setCancelOpen(false)}>Keep order</Button><Button variant="danger" loading={busy} onClick={async () => { await run(() => cancelOrderAction(order.id, reason), "Order cancelled"); setCancelOpen(false); }}>Cancel order</Button></DialogFooter>
            </DialogContent>
          </Dialog>
        </SheetContent>
      )}
    </Sheet>
  );
}

const Meta = ({ label, value }: { label: string; value: string }) => <div><p className="text-xs text-fg-muted">{label}</p><p className="mt-0.5 font-medium">{value}</p></div>;
const Row = ({ k, v, tone }: { k: string; v: string; tone?: "ok" }) => <div className={`flex justify-between ${tone === "ok" ? "text-ok" : "text-fg-muted"}`}><dt>{k}</dt><dd>{v}</dd></div>;
