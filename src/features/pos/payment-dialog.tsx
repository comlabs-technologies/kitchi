"use client";
import * as React from "react";
import { Banknote, Check, CircleCheck, CreditCard, MessageCircle, Plus, Printer, QrCode, Split, WifiOff, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogBody, DialogContent, DialogFooter } from "@/components/ui/dialog";
import { Input, Select } from "@/components/ui/form";
import { Kbd } from "@/components/ui/primitives";
import { formatMoney, toPaise } from "@/lib/money";
import { cn } from "@/lib/utils";
import type { Order, PaymentMethod } from "@/types/domain";
import type { SubmitOutcome } from "./gateway";
import { browserPrintService, type ReceiptMeta } from "./print-service";

type Tab = PaymentMethod | "SPLIT";
export interface PayLine { method: PaymentMethod; amount: number; tendered?: number }

const TABS: { id: Tab; label: string; icon: React.ReactNode; key: string }[] = [
  { id: "UPI", label: "UPI", icon: <QrCode />, key: "1" },
  { id: "CASH", label: "Cash", icon: <Banknote />, key: "2" },
  { id: "CARD", label: "Card", icon: <CreditCard />, key: "3" },
  { id: "SPLIT", label: "Split", icon: <Split />, key: "4" },
];

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  initialTab: Tab;
  total: number;
  accept: { upi: boolean; cash: boolean; card: boolean };
  upiId: string;
  customerPhone?: string;
  submit: (lines: PayLine[]) => Promise<SubmitOutcome>;
  provisional: () => Order;
  receiptMeta: ReceiptMeta;
  onNewOrder: () => void;
}

export function PaymentDialog(p: Props) {
  const [phase, setPhase] = React.useState<"pay" | "busy" | "done">("pay");
  const [result, setResult] = React.useState<SubmitOutcome | null>(null);
  const [paid, setPaid] = React.useState<{ lines: PayLine[]; order: Order; total: number } | null>(null);
  const total = React.useRef(p.total);
  if (p.open && phase === "pay") total.current = p.total;

  React.useEffect(() => {
    if (p.open) { setPhase("pay"); setResult(null); setPaid(null); }
  }, [p.open]);

  const complete = async (lines: PayLine[]) => {
    setPhase("busy");
    const snapshot = p.provisional();
    const res = await p.submit(lines);
    if (res.status === "error") {
      setPhase("pay");
      toast.error(res.error);
      return;
    }
    setResult(res);
    setPaid({ lines, order: res.status === "synced" ? res.order.order : snapshot, total: total.current });
    setPhase("done");
  };

  // Closing the success screen starts a fresh order so the cashier never double-charges.
  const onOpenChange = (o: boolean) => {
    if (!o && phase === "busy") return;
    if (!o && phase === "done") p.onNewOrder();
    p.onOpenChange(o);
  };

  return (
    <Dialog open={p.open} onOpenChange={onOpenChange}>
      <DialogContent title={phase === "done" ? "Payment complete" : "Take payment"} hideClose={phase === "busy"} className="max-w-[460px]" onInteractOutside={(e) => phase !== "pay" && e.preventDefault()}>
        {phase === "done" && paid && result ? (
          <Done {...p} paid={paid} result={result} />
        ) : (
          <PayForm {...p} total={total.current} busy={phase === "busy"} onComplete={complete} />
        )}
      </DialogContent>
    </Dialog>
  );
}

function PayForm({ total, accept, upiId, initialTab, busy, onComplete }: Props & { busy: boolean; onComplete: (l: PayLine[]) => void }) {
  const available = TABS.filter((t) => (t.id === "UPI" ? accept.upi : t.id === "CASH" ? accept.cash : t.id === "CARD" ? accept.card : true));
  const [tab, setTab] = React.useState<Tab>(available.some((t) => t.id === initialTab) ? initialTab : available[0]!.id);
  const [tendered, setTendered] = React.useState("");
  const [split, setSplit] = React.useState<{ method: PaymentMethod; amount: string }[]>([]);

  React.useEffect(() => {
    const half = Math.round(total / 2 / 100) * 100;
    setSplit([{ method: "UPI", amount: String(half / 100) }, { method: "CASH", amount: String((total - half) / 100) }]);
  }, [total]);

  const cash = tendered === "" ? total : toPaise(Number(tendered));
  const change = cash - total;
  const splitSum = split.reduce((s, r) => s + toPaise(Number(r.amount) || 0), 0);
  const remaining = total - splitSum;
  const quick = Array.from(new Set([total, Math.ceil(total / 10000) * 10000, Math.ceil(total / 50000) * 50000, Math.ceil((total + 1) / 100000) * 100000])).filter((v) => v >= total).slice(0, 4);

  const canComplete = !busy && (tab === "CASH" ? cash >= total : tab === "SPLIT" ? remaining === 0 && split.every((r) => toPaise(Number(r.amount) || 0) > 0) : true);

  const go = () => {
    if (!canComplete) return;
    if (tab === "SPLIT") onComplete(split.map((r) => ({ method: r.method, amount: toPaise(Number(r.amount)) })));
    else if (tab === "CASH") onComplete([{ method: "CASH", amount: total, tendered: cash }]);
    else onComplete([{ method: tab, amount: total }]);
  };

  return (
    <form onSubmit={(e) => { e.preventDefault(); go(); }} onKeyDown={(e) => {
      if (e.altKey || e.metaKey || e.ctrlKey) return;
      const t = available.find((x) => x.key === e.key && !(e.target instanceof HTMLInputElement));
      if (t) setTab(t.id);
    }}>
      <div className="border-b border-line px-5 py-4 text-center">
        <p className="text-xs font-medium text-fg-muted">Amount due</p>
        <p className="tnum mt-1 text-[38px] font-semibold leading-none tracking-[-0.035em]">{formatMoney(total)}</p>
      </div>
      <div className="px-5 pt-4">
        <div role="tablist" aria-label="Payment method" className="grid gap-1.5" style={{ gridTemplateColumns: `repeat(${available.length}, 1fr)` }}>
          {available.map((t) => (
            <button key={t.id} type="button" role="tab" aria-selected={tab === t.id} onClick={() => setTab(t.id)} className={cn("flex h-11 items-center justify-center gap-1.5 rounded-lg border text-[13px] font-medium transition-colors [&_svg]:size-4", tab === t.id ? "border-brand bg-brand-soft text-brand" : "border-line-strong text-fg-muted hover:bg-muted")}>
              {t.icon}{t.label}<Kbd className="ml-0.5 hidden sm:inline-flex">{t.key}</Kbd>
            </button>
          ))}
        </div>
      </div>
      <DialogBody className="min-h-[190px]">
        {tab === "UPI" && (
          <div className="py-2 text-center">
            <div className="mx-auto grid size-28 place-items-center rounded-xl border border-dashed border-line-strong text-fg-subtle"><QrCode className="size-10" strokeWidth={1.25} /></div>
            <p className="mt-3 text-[13px] text-fg-muted">Ask the customer to pay <b className="tnum text-fg">{formatMoney(total)}</b> to</p>
            <p className="text-[13.5px] font-medium">{upiId || "your UPI ID (set in Settings → Payments)"}</p>
            <p className="mt-1 text-xs text-fg-subtle">Dynamic QR and auto-reconciliation are coming soon. Confirm once you see the payment.</p>
          </div>
        )}
        {tab === "CASH" && (
          <div className="space-y-4">
            <div>
              <label htmlFor="tendered" className="mb-1 block text-xs font-medium text-fg-muted">Amount received</label>
              <div className="relative">
                <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-fg-subtle">₹</span>
                <Input id="tendered" autoFocus inputMode="decimal" type="number" min={0} step="1" value={tendered} placeholder={String(total / 100)} onChange={(e) => setTendered(e.target.value)} className="h-12 pl-7 text-lg font-medium tnum" />
              </div>
              <div className="mt-2 flex flex-wrap gap-1.5">{quick.map((q) => <Button key={q} size="sm" onClick={() => setTendered(String(q / 100))}>{q === total ? "Exact" : formatMoney(q)}</Button>)}</div>
            </div>
            <div className="flex items-center justify-between rounded-lg bg-muted px-4 py-3">
              <span className="text-[13px] text-fg-muted">Return</span>
              <span className={cn("tnum text-xl font-semibold", change < 0 && "text-danger")}>{change < 0 ? `Short ${formatMoney(-change)}` : formatMoney(change)}</span>
            </div>
          </div>
        )}
        {tab === "CARD" && (
          <div className="py-5 text-center">
            <div className="mx-auto grid size-14 place-items-center rounded-xl border border-line-strong text-fg-subtle"><CreditCard className="size-6" strokeWidth={1.5} /></div>
            <p className="mt-3 text-[13px] text-fg-muted">Charge <b className="tnum text-fg">{formatMoney(total)}</b> on your card machine, then confirm here.</p>
            <p className="mt-1 text-xs text-fg-subtle">Terminal integration is coming soon.</p>
          </div>
        )}
        {tab === "SPLIT" && (
          <div className="space-y-2.5">
            {split.map((r, i) => (
              <div key={i} className="flex items-center gap-2">
                <Select aria-label={`Method ${i + 1}`} value={r.method} onChange={(e) => setSplit((s) => s.map((x, j) => (j === i ? { ...x, method: e.target.value as PaymentMethod } : x)))} className="w-28">
                  {accept.upi && <option value="UPI">UPI</option>}{accept.cash && <option value="CASH">Cash</option>}{accept.card && <option value="CARD">Card</option>}
                </Select>
                <div className="relative flex-1">
                  <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-fg-subtle">₹</span>
                  <Input aria-label={`Amount ${i + 1}`} inputMode="decimal" type="number" min={0} value={r.amount} onChange={(e) => setSplit((s) => s.map((x, j) => (j === i ? { ...x, amount: e.target.value } : x)))} className="pl-7 tnum" />
                </div>
                {remaining !== 0 && <Button size="sm" variant="ghost" onClick={() => setSplit((s) => s.map((x, j) => (j === i ? { ...x, amount: String(Math.max(0, (toPaise(Number(x.amount) || 0) + remaining) / 100)) } : x)))}>Fill</Button>}
                {split.length > 2 && <button type="button" aria-label="Remove row" className="grid size-8 place-items-center rounded-md text-fg-subtle hover:bg-muted" onClick={() => setSplit((s) => s.filter((_, j) => j !== i))}><X className="size-3.5" /></button>}
              </div>
            ))}
            <Button size="sm" variant="ghost" onClick={() => setSplit((s) => [...s, { method: "CARD", amount: "0" }])} disabled={split.length >= 4}><Plus className="size-3.5" /> Add method</Button>
            <div className={cn("flex items-center justify-between rounded-lg px-4 py-2.5 text-[13px]", remaining === 0 ? "bg-ok-soft text-ok" : "bg-muted text-fg-muted")}>
              <span>{remaining === 0 ? "Fully allocated" : remaining > 0 ? "Remaining" : "Over by"}</span>
              <span className="tnum font-semibold">{remaining === 0 ? <Check className="size-4" /> : formatMoney(Math.abs(remaining))}</span>
            </div>
          </div>
        )}
      </DialogBody>
      <DialogFooter>
        <Button type="submit" variant="primary" size="xl" className="w-full" disabled={!canComplete} loading={busy}>
          {tab === "CASH" ? "Complete payment" : tab === "UPI" ? "Confirm UPI received" : tab === "CARD" ? "Confirm card payment" : "Complete payment"}
        </Button>
      </DialogFooter>
    </form>
  );
}

function Done({ paid, result, customerPhone, receiptMeta, onNewOrder, onOpenChange }: Props & { paid: { lines: PayLine[]; order: Order; total: number }; result: SubmitOutcome }) {
  const [wa, setWa] = React.useState(customerPhone ?? "");
  const [askWa, setAskWa] = React.useState(false);
  const queued = result.status === "queued";
  const cashLine = paid.lines.length === 1 && paid.lines[0]!.method === "CASH" ? paid.lines[0]! : null;
  const change = cashLine?.tendered ? cashLine.tendered - paid.total : 0;
  const printRef = React.useRef<HTMLButtonElement>(null);
  React.useEffect(() => printRef.current?.focus(), []);

  const sendWa = () => {
    if (wa.replace(/\D/g, "").length < 10) return setAskWa(true);
    toast.success(`Receipt sent to ${wa}`, { description: "WhatsApp delivery is simulated in this MVP." });
    setAskWa(false);
  };
  const newOrder = () => { onNewOrder(); onOpenChange(false); };

  return (
    <>
      <DialogBody className="py-8 text-center">
        <div className={cn("mx-auto grid size-12 place-items-center rounded-full", queued ? "bg-warn-soft text-warn" : "bg-ok-soft text-ok")}>{queued ? <WifiOff className="size-6" /> : <CircleCheck className="size-6" />}</div>
        <h3 className="mt-4 text-[15px] font-semibold">{queued ? "Saved offline" : "Payment successful"}</h3>
        <p className="tnum mt-1 text-[36px] font-semibold leading-none tracking-[-0.035em]">{formatMoney(paid.total)}</p>
        <p className="mt-2 text-[13px] text-fg-muted">
          {queued ? "Kitchi will sync this order as soon as you're back online." : <>Order #{paid.order.number}{paid.order.tableName ? ` · ${paid.order.tableName}` : ""} · {paid.lines.map((l) => l.method.toLowerCase()).join(" + ")}</>}
        </p>
        {change > 0 && <p className="tnum mt-3 inline-block rounded-lg bg-muted px-3 py-1.5 text-[13px]">Return <b>{formatMoney(change)}</b></p>}
        {askWa && (
          <div className="mx-auto mt-4 flex max-w-xs gap-2">
            <Input autoFocus value={wa} onChange={(e) => setWa(e.target.value)} placeholder="+91 98XXX XXXXX" inputMode="tel" aria-label="WhatsApp number" />
            <Button variant="primary" onClick={sendWa}>Send</Button>
          </div>
        )}
      </DialogBody>
      <DialogFooter className="flex-col items-stretch gap-2 sm:flex-row sm:justify-between">
        <div className="flex gap-2">
          <Button ref={printRef} onClick={() => void browserPrintService.printReceipt(paid.order, receiptMeta)}><Printer className="size-3.5" /> Print receipt</Button>
          <Button onClick={sendWa} disabled={queued}><MessageCircle className="size-3.5" /> WhatsApp</Button>
        </div>
        <Button variant="primary" onClick={newOrder}>New order</Button>
      </DialogFooter>
    </>
  );
}
