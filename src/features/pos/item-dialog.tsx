"use client";
import * as React from "react";
import { Minus, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogBody, DialogContent, DialogFooter } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/form";
import { FoodMark } from "@/components/ui/primitives";
import { formatMoney } from "@/lib/money";
import { cn } from "@/lib/utils";
import type { MenuItem, ModifierGroup } from "@/types/domain";
import type { CartLine } from "./store";

export function ItemDialog({ item, groups, onClose, onAdd }: { item: MenuItem | null; groups: ModifierGroup[]; onClose: () => void; onAdd: (l: Omit<CartLine, "key" | "qty"> & { qty: number }) => void }) {
  return (
    <Dialog open={!!item} onOpenChange={(o) => !o && onClose()}>
      {item && <Body key={item.id} item={item} groups={groups} onClose={onClose} onAdd={onAdd} />}
    </Dialog>
  );
}

function Body({ item, groups, onClose, onAdd }: { item: MenuItem; groups: ModifierGroup[]; onClose: () => void; onAdd: (l: Omit<CartLine, "key" | "qty"> & { qty: number }) => void }) {
  const [variantId, setVariantId] = React.useState(item.variants[0]?.id);
  const [mods, setMods] = React.useState<Set<string>>(new Set());
  const [qty, setQty] = React.useState(1);
  const [note, setNote] = React.useState("");
  const itemGroups = groups.filter((g) => item.modifierGroupIds.includes(g.id));
  const variant = item.variants.find((v) => v.id === variantId);
  const chosen = itemGroups.flatMap((g) => g.modifiers).filter((m) => mods.has(m.id));
  const unit = (variant?.price ?? item.price) + chosen.reduce((s, m) => s + m.price, 0);

  const toggle = (g: ModifierGroup, id: string) =>
    setMods((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else {
        const inGroup = g.modifiers.filter((m) => next.has(m.id));
        if (g.maxSelect === 1 && inGroup[0]) next.delete(inGroup[0].id);
        else if (inGroup.length >= g.maxSelect) return prev;
        next.add(id);
      }
      return next;
    });

  const submit = () => {
    onAdd({
      menuItemId: item.id, name: item.name, foodType: item.foodType, variantId: variant?.id, variantName: variant?.name,
      modifiers: chosen.map((m) => ({ id: m.id, name: m.name, price: m.price })), unitPrice: unit, qty, taxRate: item.taxRate, note: note.trim() || undefined,
    });
    onClose();
  };

  return (
    <DialogContent title={item.name} description={item.description} className="max-w-[440px]" onKeyDown={(e) => { if (e.key === "Enter" && !(e.target instanceof HTMLTextAreaElement)) { e.preventDefault(); submit(); } }}>
      <DialogBody className="space-y-5">
        {item.variants.length > 0 && (
          <fieldset>
            <legend className="mb-2 text-xs font-medium text-fg-muted">Size</legend>
            <div className="grid grid-cols-2 gap-2">
              {item.variants.map((v) => (
                <button key={v.id} type="button" role="radio" aria-checked={v.id === variantId} onClick={() => setVariantId(v.id)} className={cn("flex items-center justify-between rounded-lg border px-3 py-2.5 text-left text-[13.5px] transition-colors", v.id === variantId ? "border-brand bg-brand-soft" : "border-line-strong hover:bg-muted")}>
                  <span className="font-medium">{v.name}</span><span className="tnum text-fg-muted">{formatMoney(v.price)}</span>
                </button>
              ))}
            </div>
          </fieldset>
        )}
        {itemGroups.map((g) => (
          <fieldset key={g.id}>
            <legend className="mb-2 text-xs font-medium text-fg-muted">{g.name} <span className="font-normal text-fg-subtle">· up to {g.maxSelect}</span></legend>
            <div className="grid grid-cols-2 gap-2">
              {g.modifiers.map((m) => {
                const on = mods.has(m.id);
                return (
                  <button key={m.id} type="button" role="checkbox" aria-checked={on} onClick={() => toggle(g, m.id)} className={cn("flex items-center justify-between rounded-lg border px-3 py-2.5 text-left text-[13.5px] transition-colors", on ? "border-brand bg-brand-soft" : "border-line-strong hover:bg-muted")}>
                    <span className="font-medium">{m.name}</span><span className="tnum text-fg-muted">+{formatMoney(m.price)}</span>
                  </button>
                );
              })}
            </div>
          </fieldset>
        ))}
        <div>
          <label htmlFor="item-note" className="mb-1 block text-xs font-medium text-fg-muted">Note for kitchen</label>
          <Textarea id="item-note" value={note} onChange={(e) => setNote(e.target.value)} placeholder="e.g. No onion, less spicy" maxLength={120} className="min-h-[56px]" />
        </div>
      </DialogBody>
      <DialogFooter className="justify-between">
        <div className="flex items-center rounded-lg border border-line-strong">
          <button type="button" className="grid size-9 place-items-center text-fg-muted hover:bg-muted" onClick={() => setQty((q) => Math.max(1, q - 1))} aria-label="Decrease quantity"><Minus className="size-4" /></button>
          <span className="tnum w-8 text-center text-sm font-medium" aria-live="polite">{qty}</span>
          <button type="button" className="grid size-9 place-items-center text-fg-muted hover:bg-muted" onClick={() => setQty((q) => Math.min(99, q + 1))} aria-label="Increase quantity"><Plus className="size-4" /></button>
        </div>
        <Button variant="primary" size="lg" onClick={submit} className="min-w-[160px]">
          <FoodMark type={item.foodType} className="border-white/80 [&>span]:!bg-white" /> Add · {formatMoney(unit * qty)}
        </Button>
      </DialogFooter>
    </DialogContent>
  );
}
