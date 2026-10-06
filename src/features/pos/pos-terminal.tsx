"use client";
import * as React from "react";
import { useRouter } from "next/navigation";
import { ChevronUp, Search, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { FoodMark } from "@/components/ui/primitives";
import { computeTotals, resolveDiscount } from "@/lib/billing";
import { useOnline } from "@/lib/hooks";
import { formatMoney } from "@/lib/money";
import type { SubmitOrderInput } from "@/lib/schemas";
import { cn } from "@/lib/utils";
import type { Category, MenuItem, ModifierGroup, Order } from "@/types/domain";
import { CustomerDialog, DiscountDialog, NoteDialog } from "./aux-dialogs";
import { submitViaGateway } from "./gateway";
import { ItemDialog } from "./item-dialog";
import { OrderPanel, type TableOption } from "./order-panel";
import { PaymentDialog, type PayLine } from "./payment-dialog";
import { browserPrintService, type ReceiptMeta } from "./print-service";
import { usePosStore } from "./store";

export interface PosTerminalProps {
  categories: Category[];
  items: MenuItem[];
  groups: ModifierGroup[];
  tables: TableOption[];
  gstEnabled: boolean;
  accept: { upi: boolean; cash: boolean; card: boolean };
  upiId: string;
  receiptMeta: ReceiptMeta;
  existing?: Order;
  presetTableId?: string;
  autoPrintKot: boolean;
}

const POPULAR = "__popular";

export function PosTerminal(props: PosTerminalProps) {
  const { categories, items, groups, existing, presetTableId } = props;
  const router = useRouter();
  const online = useOnline();
  const store = usePosStore();
  const [cat, setCat] = React.useState<string>("all");
  const [q, setQ] = React.useState("");
  const [config, setConfig] = React.useState<MenuItem | null>(null);
  const [payOpen, setPayOpen] = React.useState(false);
  const [payTab, setPayTab] = React.useState<"UPI" | "SPLIT">("UPI");
  const [discountOpen, setDiscountOpen] = React.useState(false);
  const [noteOpen, setNoteOpen] = React.useState(false);
  const [custOpen, setCustOpen] = React.useState(false);
  const [panelOpen, setPanelOpen] = React.useState(false);
  const [kotBusy, setKotBusy] = React.useState(false);
  const [ready, setReady] = React.useState(false);
  const searchRef = React.useRef<HTMLInputElement>(null);

  // Hydrate persisted cart, then apply any server-provided context (running table order / preset table).
  React.useEffect(() => {
    void Promise.resolve(usePosStore.persist.rehydrate()).then(() => {
      const s = usePosStore.getState();
      if (existing) {
        s.loadExisting(existing, (menuItemId, variantName) => {
          const m = items.find((i) => i.id === menuItemId);
          if (!m) return null;
          const modifierIds: Record<string, string> = {};
          for (const g of groups.filter((g) => m.modifierGroupIds.includes(g.id))) for (const mod of g.modifiers) modifierIds[mod.name] = mod.id;
          return { variantId: m.variants.find((v) => v.name === variantName)?.id, modifierIds };
        });
      } else {
        if (s.orderId) s.reset(); // stale "editing" state from a previous visit
        if (presetTableId) {
          s.setType("DINE_IN");
          s.setTable(presetTableId);
        }
      }
      setReady(true);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [existing?.id, presetTableId]);

  const shown = React.useMemo(() => {
    const needle = q.trim().toLowerCase();
    return items.filter((i) => {
      if (needle) return i.name.toLowerCase().includes(needle) || i.sku.toLowerCase().includes(needle);
      if (cat === "all") return true;
      if (cat === POPULAR) return i.popular;
      return i.categoryId === cat;
    });
  }, [items, cat, q]);

  const addItem = (m: MenuItem) => {
    if (!m.available) return;
    if (m.variants.length > 0 || m.modifierGroupIds.length > 0) return setConfig(m);
    store.add({ menuItemId: m.id, name: m.name, foodType: m.foodType, modifiers: [], unitPrice: m.price, taxRate: m.taxRate });
  };

  const subtotal = store.lines.reduce((a, l) => a + l.unitPrice * l.qty, 0);
  const totals = computeTotals(store.lines, resolveDiscount(subtotal, store.discount), props.gstEnabled);
  const count = store.lines.reduce((a, l) => a + l.qty, 0);

  const buildPayload = React.useCallback((payment?: PayLine[]): SubmitOrderInput => {
    const s = usePosStore.getState();
    return {
      clientRef: s.clientRef,
      orderId: s.orderId,
      type: s.type,
      tableId: s.type === "DINE_IN" ? s.tableId : undefined,
      customerId: s.customer?.id,
      note: s.note || undefined,
      discount: s.discount,
      items: s.lines.map((l) => ({ menuItemId: l.menuItemId, variantId: l.variantId, modifierIds: l.modifiers.map((m) => m.id), qty: l.qty, note: l.note })),
      payment: payment ? { lines: payment } : undefined,
    };
  }, []);

  /** Local, unsaved snapshot used for receipts while offline. */
  const provisional = React.useCallback((): Order => {
    const s = usePosStore.getState();
    const sub = s.lines.reduce((a, l) => a + l.unitPrice * l.qty, 0);
    const t = computeTotals(s.lines, resolveDiscount(sub, s.discount), props.gstEnabled);
    const table = props.tables.find((x) => x.id === s.tableId);
    return {
      id: "local", outletId: "", number: s.orderNumber ?? 0, type: s.type, tableId: s.tableId, tableName: table?.name, customerName: s.customer?.name, status: "OPEN", paymentStatus: "UNPAID",
      items: s.lines.map((l) => ({ id: l.key, menuItemId: l.menuItemId, name: l.name, variantName: l.variantName, unitPrice: l.unitPrice, basePrice: l.unitPrice, qty: l.qty, taxRate: l.taxRate, foodType: l.foodType, modifiers: l.modifiers, note: l.note })),
      ...t, payments: [], events: [], createdBy: "", createdAt: Date.now(), updatedAt: Date.now(), note: s.note,
    };
  }, [props.gstEnabled, props.tables]);

  const sendKot = async () => {
    const s = usePosStore.getState();
    if (!s.lines.length) return;
    setKotBusy(true);
    const res = await submitViaGateway(buildPayload());
    setKotBusy(false);
    if (res.status === "error") return toast.error(res.error);
    if (res.status === "queued") {
      toast.warning("Offline — KOT saved and will sync", { description: "Keep the order slip handy for the kitchen." });
      if (props.autoPrintKot) void browserPrintService.printKOT(provisional(), props.receiptMeta);
      s.reset();
      return;
    }
    const o = res.order.order;
    toast.success(`KOT sent · #${o.number}${o.tableName ? ` · ${o.tableName}` : ""}`);
    if (props.autoPrintKot) void browserPrintService.printKOT(o, props.receiptMeta);
    s.reset();
    setPanelOpen(false);
    if (existing) router.replace("/pos");
    router.refresh();
  };

  const openCharge = (tab?: "SPLIT") => {
    if (!usePosStore.getState().lines.length) return;
    setPayTab(tab ?? "UPI");
    setPayOpen(true);
  };

  const newOrder = () => {
    usePosStore.getState().reset();
    setPanelOpen(false);
    if (existing || presetTableId) router.replace("/pos");
    router.refresh();
    searchRef.current?.focus();
  };

  // Keyboard shortcuts
  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement | null;
      const typing = !!el && (el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.tagName === "SELECT" || el.isContentEditable);
      const anyDialog = !!document.querySelector('[role="dialog"]');
      if (e.key === "/" && !typing && !anyDialog) { e.preventDefault(); searchRef.current?.focus(); return; }
      if (anyDialog) return;
      if ((e.ctrlKey || e.metaKey) && e.key === "Enter") { e.preventDefault(); openCharge(); return; }
      if (e.altKey && !e.ctrlKey && !e.metaKey) {
        const map: Record<string, () => void> = {
          KeyK: () => void sendKot(), KeyH: () => { if (usePosStore.getState().hold()) toast.success("Order held"); },
          KeyD: () => setDiscountOpen(true), KeyC: () => setCustOpen(true), KeyN: () => setNoteOpen(true),
          Digit1: () => usePosStore.getState().setType("DINE_IN"), Digit2: () => usePosStore.getState().setType("TAKEAWAY"), Digit3: () => usePosStore.getState().setType("DELIVERY"),
        };
        const fn = map[e.code];
        if (fn) { e.preventDefault(); fn(); }
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const tabs = [{ id: "all", label: "All" }, { id: POPULAR, label: "Popular" }, ...categories.map((c) => ({ id: c.id, label: c.name }))];

  return (
    <div className="flex h-full min-h-0 flex-col lg:flex-row">
      {/* Catalogue */}
      <div className="flex min-h-0 min-w-0 flex-1 flex-col">
        <div className="space-y-3 border-b border-line px-4 pb-3 pt-3 sm:px-5">
          <div className="flex items-center gap-3">
            <div className="relative max-w-sm flex-1">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-fg-subtle" />
              <input
                ref={searchRef} value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search items or SKU" aria-label="Search menu"
                onKeyDown={(e) => { if (e.key === "Escape") { setQ(""); searchRef.current?.blur(); } if (e.key === "Enter" && shown.length === 1) { addItem(shown[0]!); setQ(""); } }}
                className="h-10 w-full rounded-lg border border-line-strong bg-surface pl-8 pr-8 text-[13.5px] placeholder:text-fg-subtle focus:border-brand focus:outline-none focus:ring-2 focus:ring-[var(--ring)]"
              />
              {q ? <button type="button" onClick={() => setQ("")} className="absolute right-2 top-1/2 -translate-y-1/2 text-fg-subtle" aria-label="Clear search"><X className="size-3.5" /></button> : <kbd className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded border border-line-strong px-1.5 text-[10.5px] text-fg-subtle">/</kbd>}
            </div>
            {!online && <span className="hidden text-xs font-medium text-warn sm:inline">Offline · orders will queue</span>}
          </div>
          <div role="tablist" aria-label="Menu categories" className="scroll-none -mx-4 flex gap-1.5 overflow-x-auto px-4 sm:-mx-5 sm:px-5">
            {tabs.map((t) => (
              <button key={t.id} role="tab" type="button" aria-selected={cat === t.id && !q} onClick={() => { setCat(t.id); setQ(""); }} className={cn("h-9 shrink-0 rounded-lg px-3.5 text-[13px] font-medium transition-colors", cat === t.id && !q ? "bg-fg text-white" : "bg-muted text-fg-muted hover:bg-muted-2 hover:text-fg")}>
                {t.label}
              </button>
            ))}
          </div>
        </div>

        <div className="scroll-thin min-h-0 flex-1 overflow-y-auto p-4 pb-28 sm:p-5 lg:pb-5">
          {items.length === 0 ? (
            <div className="grid h-full place-items-center text-center"><div><p className="text-[13.5px] font-medium">Your menu is empty</p><p className="mt-1 text-[13px] text-fg-muted">Add items to start billing.</p><Button className="mt-3" variant="primary" onClick={() => router.push("/menu?new=1")}>Add menu item</Button></div></div>
          ) : shown.length === 0 ? (
            <p className="py-16 text-center text-[13px] text-fg-muted">No items match “{q}”.</p>
          ) : (
            <ul className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5">
              {shown.map((m) => {
                const inCart = store.lines.filter((l) => l.menuItemId === m.id).reduce((a, l) => a + l.qty, 0);
                const hasOptions = m.variants.length > 0 || m.modifierGroupIds.length > 0;
                const minPrice = m.variants.length ? Math.min(...m.variants.map((v) => v.price)) : m.price;
                return (
                  <li key={m.id}>
                    <button
                      type="button" disabled={!m.available} onClick={() => addItem(m)}
                      className={cn("group relative flex h-full min-h-[92px] w-full flex-col justify-between rounded-xl border bg-surface p-3 text-left transition-[border-color,background-color,transform] duration-100 active:scale-[0.985]", m.available ? "border-line hover:border-line-strong hover:bg-[#fdfdfc]" : "cursor-not-allowed border-dashed opacity-55", inCart > 0 && "border-brand/60 bg-brand-soft/40")}
                    >
                      <div className="flex items-start gap-1.5"><FoodMark type={m.foodType} className="mt-[3px]" /><span className="line-clamp-2 text-[13.5px] font-medium leading-snug">{m.name}</span></div>
                      <div className="mt-2 flex items-end justify-between gap-2">
                        <span className="tnum text-[13px] text-fg-muted">{m.variants.length > 1 ? "from " : ""}{formatMoney(minPrice)}</span>
                        {!m.available ? <span className="text-[11px] font-medium text-danger">Sold out</span> : hasOptions && inCart === 0 ? <span className="text-[11px] text-fg-subtle">Options</span> : null}
                      </div>
                      {inCart > 0 && <span className="tnum absolute right-2 top-2 grid h-5 min-w-5 place-items-center rounded-full bg-brand px-1 text-[11px] font-semibold text-white">{inCart}</span>}
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>

      {/* Order panel: docked on lg+, slide-up sheet on tablets/phones */}
      <aside className={cn("shrink-0 border-line lg:w-[380px] lg:border-l xl:w-[400px]", "fixed inset-x-0 bottom-0 top-[52px] z-30 transition-transform duration-200 lg:static lg:z-auto lg:translate-y-0", panelOpen ? "translate-y-0" : "translate-y-full")}>
        {ready && (
          <OrderPanel
            tables={props.tables} gstEnabled={props.gstEnabled} online={online} onCharge={openCharge} onKot={sendKot} kotBusy={kotBusy}
            onDiscount={() => setDiscountOpen(true)} onNote={() => setNoteOpen(true)} onCustomer={() => setCustOpen(true)} onClose={() => setPanelOpen(false)}
          />
        )}
      </aside>
      {!panelOpen && (
        <div className="fixed inset-x-0 bottom-0 z-20 border-t border-line bg-surface/95 p-3 backdrop-blur lg:hidden">
          <Button size="xl" variant="primary" className="w-full justify-between" onClick={() => setPanelOpen(true)}>
            <span className="flex items-center gap-2"><ChevronUp className="size-4" /> {count === 0 ? "View order" : `${count} item${count > 1 ? "s" : ""}`}</span>
            <span className="tnum">{count ? formatMoney(totals.total) : ""}</span>
          </Button>
        </div>
      )}

      <ItemDialog item={config} groups={groups} onClose={() => setConfig(null)} onAdd={(l) => { store.add(l); }} />
      <DiscountDialog open={discountOpen} onOpenChange={setDiscountOpen} value={store.discount} subtotal={subtotal} onApply={store.setDiscount} />
      <NoteDialog open={noteOpen} onOpenChange={setNoteOpen} value={store.note} onSave={store.setNote} />
      <CustomerDialog open={custOpen} onOpenChange={setCustOpen} value={store.customer} onPick={store.setCustomer} />
      <PaymentDialog
        open={payOpen} onOpenChange={setPayOpen} initialTab={payTab} total={totals.total} accept={props.accept} upiId={props.upiId} customerPhone={store.customer?.phone}
        submit={(lines) => submitViaGateway(buildPayload(lines))} provisional={provisional} receiptMeta={props.receiptMeta} onNewOrder={newOrder}
      />
      <span className="sr-only" aria-live="polite">{count} items in order, total {formatMoney(totals.total)}</span>
    </div>
  );
}
