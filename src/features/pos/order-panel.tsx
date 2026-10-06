"use client";
import * as React from "react";
import { Keyboard, Minus, NotebookPen, Percent, Plus, Receipt, Send, Split, Trash2, UserRound, X, Pause, Play } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dropdown, DropdownContent, DropdownItem, DropdownLabel, DropdownSeparator, DropdownTrigger } from "@/components/ui/dropdown";
import { Select } from "@/components/ui/form";
import { FoodMark, Kbd, Segmented } from "@/components/ui/primitives";
import { computeTotals, resolveDiscount } from "@/lib/billing";
import { formatMoney } from "@/lib/money";
import { formatTime } from "@/lib/time";
import { cn } from "@/lib/utils";
import type { OrderType } from "@/types/domain";
import { usePosStore } from "./store";

export interface TableOption {
  id: string;
  name: string;
  seats: number;
  status: string;
  orderId?: string;
}

interface Props {
  tables: TableOption[];
  gstEnabled: boolean;
  online: boolean;
  onCharge: (tab?: "SPLIT") => void;
  onKot: () => void;
  kotBusy: boolean;
  onDiscount: () => void;
  onNote: () => void;
  onCustomer: () => void;
  onClose?: () => void;
}

const TYPES: { value: OrderType; label: string }[] = [
  { value: "DINE_IN", label: "Dine in" },
  { value: "TAKEAWAY", label: "Takeaway" },
  { value: "DELIVERY", label: "Delivery" },
];

export function OrderPanel(p: Props) {
  const s = usePosStore();
  const subtotal = s.lines.reduce((a, l) => a + l.unitPrice * l.qty, 0);
  const discount = resolveDiscount(subtotal, s.discount);
  const totals = computeTotals(s.lines, discount, p.gstEnabled);
  const count = s.lines.reduce((a, l) => a + l.qty, 0);
  const empty = s.lines.length === 0;
  const listRef = React.useRef<HTMLUListElement>(null);

  React.useEffect(() => {
    if (s.lastAddedKey) listRef.current?.querySelector(`[data-key="${CSS.escape(s.lastAddedKey)}"]`)?.scrollIntoView({ block: "nearest" });
  }, [s.lastAddedKey, s.lines.length]);

  return (
    <section className="flex h-full min-h-0 flex-col bg-surface" aria-label="Current order">
      <div className="space-y-3 border-b border-line px-4 pb-3 pt-3">
        <div className="flex items-center justify-between gap-2">
          <h2 className="flex items-center gap-2 text-[14px] font-semibold tracking-tight">
            {s.orderId ? `Order #${s.orderNumber}` : "Current order"}
            {s.orderId && <Badge tone="brand">Running</Badge>}
          </h2>
          <div className="flex items-center gap-1">
            <Dropdown>
              <DropdownTrigger className="flex h-7 items-center gap-1.5 rounded-md px-2 text-xs font-medium text-fg-muted transition-colors hover:bg-muted data-[state=open]:bg-muted" aria-label={`Held orders, ${s.held.length}`}>
                <Pause className="size-3" /> Held{s.held.length > 0 && <span className="tnum rounded-full bg-brand px-1.5 text-[10px] text-white">{s.held.length}</span>}
              </DropdownTrigger>
              <DropdownContent className="w-[280px]">
                <DropdownLabel>Held orders</DropdownLabel>
                {s.held.length === 0 ? <p className="px-2 py-4 text-center text-[13px] text-fg-muted">Nothing on hold.</p> : s.held.map((h) => {
                  const t = computeTotals(h.cart.lines, resolveDiscount(h.cart.lines.reduce((a, l) => a + l.unitPrice * l.qty, 0), h.cart.discount), p.gstEnabled);
                  return (
                    <DropdownItem key={h.id} icon={<Play />} onSelect={() => s.recall(h.id)}>
                      <span className="block">{h.cart.lines.reduce((a, l) => a + l.qty, 0)} items · {formatMoney(t.total)}</span>
                      <span className="block text-[11px] text-fg-subtle">{h.cart.customer?.name ?? "Walk-in"} · held {formatTime(h.heldAt)}</span>
                    </DropdownItem>
                  );
                })}
                {s.held.length > 0 && <><DropdownSeparator /><DropdownItem danger onSelect={() => s.held.forEach((h) => s.discardHeld(h.id))}>Discard all</DropdownItem></>}
              </DropdownContent>
            </Dropdown>
            {p.onClose && <button type="button" onClick={p.onClose} className="grid size-7 place-items-center rounded-md text-fg-muted hover:bg-muted lg:hidden" aria-label="Close order panel"><X className="size-4" /></button>}
          </div>
        </div>

        <Segmented value={s.type} onChange={(v) => !s.orderId && s.setType(v)} options={TYPES} size="sm" label="Order type" />
        {s.type === "DINE_IN" && (
          <Select aria-label="Table" value={s.tableId ?? ""} disabled={!!s.orderId} onChange={(e) => s.setTable(e.target.value || undefined)} className="h-8 text-[13px]">
            <option value="">No table yet</option>
            {p.tables.filter((t) => t.status === "AVAILABLE" || t.status === "RESERVED" || t.id === s.tableId).map((t) => <option key={t.id} value={t.id}>{t.name} · {t.seats} seats{t.status === "RESERVED" ? " · reserved" : ""}</option>)}
          </Select>
        )}
        {s.customer && (
          <button type="button" onClick={p.onCustomer} className="flex w-full items-center gap-2 rounded-md bg-muted px-2.5 py-1.5 text-left text-[13px]">
            <UserRound className="size-3.5 text-fg-subtle" /><span className="flex-1 truncate font-medium">{s.customer.name}</span><span className="tnum text-xs text-fg-muted">{s.customer.phone}</span>
          </button>
        )}
      </div>

      {empty ? (
        <div className="flex flex-1 flex-col items-center justify-center px-6 text-center">
          <div className="grid size-10 place-items-center rounded-lg border border-line text-fg-subtle"><Receipt className="size-4.5" /></div>
          <p className="mt-3 text-[13.5px] font-medium">No items yet</p>
          <p className="mt-1 text-[13px] text-fg-muted">Tap an item to add it. Press <Kbd>/</Kbd> to search.</p>
        </div>
      ) : (
        <ul ref={listRef} className="scroll-thin min-h-0 flex-1 divide-y divide-line overflow-y-auto">
          {s.lines.map((l) => (
            <li key={l.key} data-key={l.key} className={cn("px-4 py-2.5", l.key === s.lastAddedKey && "anim-flash")}>
              <div className="flex items-start gap-2.5">
                <FoodMark type={l.foodType} className="mt-[3px]" />
                <div className="min-w-0 flex-1">
                  <p className="text-[13.5px] font-medium leading-snug">{l.name}</p>
                  {(l.variantName || l.modifiers.length > 0) && <p className="text-xs text-fg-muted">{[l.variantName, ...l.modifiers.map((m) => m.name)].filter(Boolean).join(" · ")}</p>}
                  {l.note && <p className="text-xs italic text-fg-muted">“{l.note}”</p>}
                  <p className="tnum mt-0.5 text-xs text-fg-subtle">{formatMoney(l.unitPrice)} × {l.qty}</p>
                </div>
                <div className="flex flex-col items-end gap-1.5">
                  <span className="tnum text-[13.5px] font-medium">{formatMoney(l.unitPrice * l.qty)}</span>
                  <div className="flex items-center rounded-md border border-line-strong">
                    <button type="button" onClick={() => s.setQty(l.key, l.qty - 1)} className="grid size-7 place-items-center text-fg-muted transition-colors hover:bg-muted" aria-label={l.qty === 1 ? `Remove ${l.name}` : `Decrease ${l.name}`}>{l.qty === 1 ? <Trash2 className="size-3.5" /> : <Minus className="size-3.5" />}</button>
                    <span className="tnum w-6 text-center text-[13px] font-medium" aria-label={`Quantity ${l.qty}`}>{l.qty}</span>
                    <button type="button" onClick={() => s.setQty(l.key, l.qty + 1)} className="grid size-7 place-items-center text-fg-muted transition-colors hover:bg-muted" aria-label={`Increase ${l.name}`}><Plus className="size-3.5" /></button>
                  </div>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}

      <div className="border-t border-line">
        <div className="grid grid-cols-4 gap-px border-b border-line bg-line text-[11.5px] font-medium text-fg-muted [&>button]:flex [&>button]:flex-col [&>button]:items-center [&>button]:gap-1 [&>button]:bg-surface [&>button]:py-2 [&>button]:transition-colors [&>button:hover]:bg-muted [&>button:hover]:text-fg [&_svg]:size-4 [&>button:disabled]:opacity-40">
          <button type="button" onClick={() => s.hold()} disabled={empty} title="Hold order (Alt+H)"><Pause />Hold</button>
          <button type="button" onClick={p.onNote} title="Add note (Alt+N)" className={s.note ? "!text-brand" : ""}><NotebookPen />{s.note ? "Note ✓" : "Note"}</button>
          <button type="button" onClick={p.onDiscount} disabled={empty} title="Discount (Alt+D)" className={s.discount ? "!text-brand" : ""}><Percent />Discount</button>
          <button type="button" onClick={p.onCustomer} title="Customer (Alt+C)" className={s.customer ? "!text-brand" : ""}><UserRound />Customer</button>
        </div>

        <dl className="tnum space-y-1 px-4 pt-3 text-[13px]">
          <div className="flex justify-between text-fg-muted"><dt>Subtotal <span className="text-fg-subtle">· {count} {count === 1 ? "item" : "items"}</span></dt><dd>{formatMoney(totals.subtotal)}</dd></div>
          {totals.discount > 0 && <div className="flex justify-between text-ok"><dt>Discount</dt><dd>−{formatMoney(totals.discount)}</dd></div>}
          <div className="flex justify-between text-fg-muted"><dt>{p.gstEnabled ? "GST" : "Tax"}</dt><dd>{formatMoney(totals.tax)}</dd></div>
          {totals.roundOff !== 0 && <div className="flex justify-between text-fg-subtle"><dt>Round off</dt><dd>{totals.roundOff > 0 ? "+" : "−"}{formatMoney(Math.abs(totals.roundOff))}</dd></div>}
          <div className="flex justify-between pt-1 text-[15px] font-semibold"><dt>Total</dt><dd>{formatMoney(totals.total)}</dd></div>
        </dl>

        <div className="flex gap-2 p-4 pt-3">
          <Button size="xl" className="flex-none px-4" disabled={empty || p.kotBusy} loading={p.kotBusy} onClick={p.onKot} title="Send to kitchen without payment (Alt+K)" aria-label="Send KOT to kitchen">
            <Send className="size-4" /><span className="hidden xl:inline">KOT</span>
          </Button>
          <Button size="xl" variant="primary" className="min-w-0 flex-1 justify-between px-5" disabled={empty} onClick={() => p.onCharge()} title="Charge (Ctrl+Enter)">
            <span>Charge</span><span className="tnum">{formatMoney(totals.total)}</span>
          </Button>
        </div>
        <div className="flex items-center justify-between px-4 pb-3 text-xs text-fg-subtle">
          <button type="button" disabled={empty} onClick={() => p.onCharge("SPLIT")} className="inline-flex items-center gap-1 font-medium hover:text-fg disabled:opacity-40"><Split className="size-3" /> Split bill</button>
          <ShortcutsHint />
        </div>
      </div>
    </section>
  );
}

function ShortcutsHint() {
  const rows: [string, string][] = [["Search items", "/"], ["Charge", "Ctrl + Enter"], ["Send KOT", "Alt + K"], ["Hold order", "Alt + H"], ["Discount", "Alt + D"], ["Customer", "Alt + C"], ["Note", "Alt + N"], ["Dine in / Takeaway / Delivery", "Alt + 1 / 2 / 3"], ["Command palette", "Ctrl + K"]];
  return (
    <Dropdown>
      <DropdownTrigger className="inline-flex items-center gap-1 font-medium hover:text-fg" aria-label="Keyboard shortcuts"><Keyboard className="size-3" /> Shortcuts</DropdownTrigger>
      <DropdownContent align="end" side="top" className="w-[280px] p-2">
        <DropdownLabel className="px-1">Keyboard shortcuts</DropdownLabel>
        <dl className="space-y-1 px-1 pb-1">{rows.map(([a, b]) => <div key={a} className="flex items-center justify-between text-[12.5px]"><dt className="text-fg-muted">{a}</dt><dd><Kbd>{b}</Kbd></dd></div>)}</dl>
      </DropdownContent>
    </Dropdown>
  );
}
