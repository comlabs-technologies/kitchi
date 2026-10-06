"use client";
import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AnimatePresence, LayoutGroup, motion } from "framer-motion";
import { ArrowLeft, Check, ChefHat, Maximize2, Minimize2, Play } from "lucide-react";
import { toast } from "sonner";
import { LogoMark } from "@/components/logo";
import { Button } from "@/components/ui/button";
import { useNow, useOnline } from "@/lib/hooks";
import { formatClock, formatTime, MIN } from "@/lib/time";
import { cn } from "@/lib/utils";
import { advanceKitchenAction, bumpServedAction } from "@/server/actions/pos";
import type { Order, OrderStatus } from "@/types/domain";

type Col = "OPEN" | "PREPARING" | "READY";
const COLS: { id: Col; label: string; hint: string }[] = [
  { id: "OPEN", label: "New", hint: "Waiting to start" },
  { id: "PREPARING", label: "Preparing", hint: "On the line" },
  { id: "READY", label: "Ready", hint: "At the pass" },
];
const TYPE: Record<string, string> = { DINE_IN: "Dine in", TAKEAWAY: "Takeaway", DELIVERY: "Delivery" };

export function Kds({ orders, outletName, canManage, serverNow, backHref }: { orders: Order[]; outletName: string; canManage: boolean; serverNow: number; backHref?: string }) {
  const router = useRouter();
  const now = useNow(serverNow, 1000);
  const online = useOnline();
  const [local, setLocal] = React.useState(orders);
  const [full, setFull] = React.useState(false);
  React.useEffect(() => setLocal(orders), [orders]);
  React.useEffect(() => {
    const id = setInterval(() => { if (document.visibilityState === "visible") router.refresh(); }, 8000);
    return () => clearInterval(id);
  }, [router]);
  React.useEffect(() => {
    const f = () => setFull(!!document.fullscreenElement);
    document.addEventListener("fullscreenchange", f);
    return () => document.removeEventListener("fullscreenchange", f);
  }, []);

  const move = async (o: Order) => {
    const prev = local;
    const next: OrderStatus | "SERVED" = o.status === "OPEN" ? "PREPARING" : o.status === "PREPARING" ? "READY" : "SERVED";
    setLocal((l) => (next === "SERVED" ? l.filter((x) => x.id !== o.id) : l.map((x) => (x.id === o.id ? { ...x, status: next } : x))));
    const r = o.status === "READY" ? await bumpServedAction(o.id) : await advanceKitchenAction(o.id);
    if (!r.ok) {
      setLocal(prev);
      toast.error(r.error);
    } else router.refresh();
  };

  const byCol = (c: Col) => local.filter((o) => o.status === c).sort((a, b) => a.createdAt - b.createdAt);
  const todo = React.useMemo(() => {
    const m = new Map<string, number>();
    for (const o of local) if (o.status === "OPEN" || o.status === "PREPARING") for (const i of o.items) m.set(i.name, (m.get(i.name) ?? 0) + i.qty);
    return [...m.entries()].sort((a, b) => b[1] - a[1]);
  }, [local]);

  return (
    <div className="flex h-dvh flex-col bg-[#f4f3ef]">
      <header className="flex h-12 shrink-0 items-center gap-3 border-b border-line bg-surface px-4">
        {backHref && <Link href={backHref} className="grid size-8 place-items-center rounded-md text-fg-muted hover:bg-muted" aria-label="Back to Kitchi"><ArrowLeft className="size-4" /></Link>}
        <LogoMark className="size-5" />
        <h1 className="text-[14px] font-semibold tracking-tight">Kitchen <span className="font-normal text-fg-muted">· {outletName}</span></h1>
        <div className="ml-auto flex items-center gap-4 text-[13px] text-fg-muted">
          {!online && <span className="font-medium text-warn">Offline · showing last known tickets</span>}
          <span className="tnum hidden sm:inline">{local.filter((o) => o.status !== "READY").length} active</span>
          <span className="tnum font-medium text-fg">{formatTime(now)}</span>
          <Button size="icon" variant="ghost" aria-label={full ? "Exit full screen" : "Enter full screen"} onClick={() => (document.fullscreenElement ? void document.exitFullscreen() : void document.documentElement.requestFullscreen())}>{full ? <Minimize2 className="size-4" /> : <Maximize2 className="size-4" />}</Button>
        </div>
      </header>

      <LayoutGroup>
        <main id="main" className="scroll-thin flex min-h-0 flex-1 snap-x gap-3 overflow-x-auto p-3 md:grid md:grid-cols-3 md:overflow-hidden">
          {COLS.map((c) => {
            const list = byCol(c.id);
            return (
              <section key={c.id} aria-label={c.label} className="flex min-h-0 w-[88vw] shrink-0 snap-center flex-col rounded-xl bg-[#ebe9e3]/70 md:w-auto">
                <div className="flex items-baseline justify-between px-3.5 pb-2 pt-3">
                  <h2 className="text-[12px] font-semibold uppercase tracking-[0.08em] text-fg-muted">{c.label}</h2>
                  <span className="tnum rounded-full bg-surface px-2 py-0.5 text-xs font-semibold">{list.length}</span>
                </div>
                <ul className="scroll-thin min-h-0 flex-1 space-y-2.5 overflow-y-auto px-2.5 pb-3">
                  <AnimatePresence initial={false} mode="popLayout">
                    {list.map((o) => <Ticket key={o.id} o={o} now={now} col={c.id} canManage={canManage} onMove={() => void move(o)} />)}
                  </AnimatePresence>
                  {list.length === 0 && (
                    <li className="grid place-items-center py-14 text-center text-[13px] text-fg-subtle"><div><ChefHat className="mx-auto mb-2 size-5" strokeWidth={1.5} />{c.id === "OPEN" ? "No new orders" : c.hint}</div></li>
                  )}
                </ul>
              </section>
            );
          })}
        </main>
      </LayoutGroup>

      {todo.length > 0 && (
        <footer className="flex h-11 shrink-0 items-center gap-3 border-t border-line bg-surface px-4 text-[13px]">
          <span className="shrink-0 text-xs font-medium text-fg-muted">To make</span>
          <ul className="scroll-none flex min-w-0 gap-4 overflow-x-auto">{todo.map(([n, q]) => <li key={n} className="shrink-0"><b className="tnum">{q}×</b> {n}</li>)}</ul>
        </footer>
      )}
    </div>
  );
}

function Ticket({ o, now, col, canManage, onMove }: { o: Order; now: number; col: Col; canManage: boolean; onMove: () => void }) {
  const elapsed = Math.max(0, now - o.createdAt);
  const mins = elapsed / MIN;
  // Urgency is conveyed by a thin edge and the timer tone only; no flashing.
  const level = col === "READY" ? 0 : mins >= 20 ? 3 : mins >= 12 ? 2 : mins >= 7 ? 1 : 0;
  const edge = ["border-line", "border-line", "border-[#e2c58a]", "border-[#d38b7a]"][level];
  const bar = ["bg-transparent", "bg-[#e9e4d0]", "bg-[#e2c58a]", "bg-[#c8604a]"][level];
  const timer = level === 3 ? "text-danger" : level === 2 ? "text-warn" : "text-fg-muted";
  return (
    <motion.li layout="position" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, scale: 0.97 }} transition={{ duration: 0.18, ease: "easeOut" }}
      className={cn("relative overflow-hidden rounded-lg border bg-surface shadow-[0_1px_1px_rgba(20,20,18,0.03)]", edge)}>
      <div className={cn("absolute inset-x-0 top-0 h-[3px]", bar)} />
      <div className="flex items-start justify-between gap-3 px-3.5 pb-2 pt-3.5">
        <div>
          <p className="tnum text-[20px] font-semibold leading-none tracking-tight">#{o.number}</p>
          <p className="mt-1.5 text-[13px] text-fg-muted">{TYPE[o.type]}{o.tableName ? <> · <b className="font-semibold text-fg">{o.tableName}</b></> : null}{o.customerName && o.type !== "DINE_IN" ? ` · ${o.customerName}` : ""}</p>
        </div>
        <p className={cn("tnum text-[17px] font-semibold", timer)} aria-label={`${Math.floor(mins)} minutes elapsed`}>{formatClock(elapsed)}</p>
      </div>
      <ul className="space-y-2 border-t border-line px-3.5 py-2.5">
        {o.items.map((i) => (
          <li key={i.id} className="text-[15px] leading-snug">
            <span className="tnum font-semibold">{i.qty} ×</span> {i.name}{i.variantName ? <span className="text-fg-muted"> ({i.variantName})</span> : null}
            {i.modifiers.length > 0 && <p className="pl-6 text-[13px] text-fg-muted">{i.modifiers.map((m) => `+ ${m.name}`).join(" · ")}</p>}
            {i.note && <p className="pl-6 text-[13px] font-medium text-warn">{i.note}</p>}
          </li>
        ))}
        {o.note && <li className="rounded-md bg-warn-soft px-2.5 py-1.5 text-[13px] font-medium text-warn">Note: {o.note}</li>}
      </ul>
      {canManage && (
        <div className="border-t border-line p-2">
          <Button size="lg" variant={col === "OPEN" ? "primary" : col === "PREPARING" ? "soft" : "secondary"} className="w-full" onClick={onMove}>
            {col === "OPEN" ? <><Play className="size-3.5" /> Start preparing</> : col === "PREPARING" ? <><Check className="size-3.5" /> Mark ready</> : <><Check className="size-3.5" /> {o.type === "DINE_IN" ? "Served" : "Handed over"}</>}
          </Button>
        </div>
      )}
    </motion.li>
  );
}
