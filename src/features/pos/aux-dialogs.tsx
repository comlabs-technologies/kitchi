"use client";
import * as React from "react";
import { Loader2, Search, UserPlus, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogBody, DialogContent, DialogFooter } from "@/components/ui/dialog";
import { Field, Input, Textarea } from "@/components/ui/form";
import { Segmented } from "@/components/ui/primitives";
import type { DiscountInput } from "@/lib/billing";
import { formatMoney, toPaise } from "@/lib/money";
import { createCustomerAction, searchCustomersAction } from "@/server/actions/pos";
import type { Customer } from "@/types/domain";
import type { CartCustomer } from "./store";

export function DiscountDialog({ open, onOpenChange, value, subtotal, onApply }: { open: boolean; onOpenChange: (o: boolean) => void; value: DiscountInput; subtotal: number; onApply: (d: DiscountInput) => void }) {
  const [kind, setKind] = React.useState<"PERCENT" | "FLAT">("PERCENT");
  const [v, setV] = React.useState("");
  React.useEffect(() => {
    if (open) {
      setKind(value?.kind ?? "PERCENT");
      setV(value ? String(value.kind === "FLAT" ? value.value / 100 : value.value) : "");
    }
  }, [open, value]);
  const num = Number(v);
  const preview = !num ? 0 : kind === "PERCENT" ? Math.round((subtotal * Math.min(num, 100)) / 100) : Math.min(toPaise(num), subtotal);
  const apply = () => {
    onApply(num > 0 ? { kind, value: kind === "FLAT" ? toPaise(num) : Math.min(num, 100) } : null);
    onOpenChange(false);
  };
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent title="Discount" description="Applied before GST." className="max-w-[380px]">
        <form onSubmit={(e) => { e.preventDefault(); apply(); }}>
          <DialogBody className="space-y-4">
            <Segmented value={kind} onChange={setKind} options={[{ value: "PERCENT", label: "Percent" }, { value: "FLAT", label: "Flat ₹" }]} />
            <Field label={kind === "PERCENT" ? "Percentage" : "Amount (₹)"} htmlFor="disc">
              <Input id="disc" autoFocus inputMode="decimal" type="number" min={0} max={kind === "PERCENT" ? 100 : undefined} value={v} onChange={(e) => setV(e.target.value)} placeholder={kind === "PERCENT" ? "10" : "50"} />
            </Field>
            {kind === "PERCENT" && (
              <div className="flex gap-1.5">{[5, 10, 15, 20].map((p) => <Button key={p} size="sm" onClick={() => setV(String(p))}>{p}%</Button>)}</div>
            )}
            <p className="tnum text-[13px] text-fg-muted">{preview ? `Takes ${formatMoney(preview)} off ${formatMoney(subtotal)}` : "No discount"}</p>
          </DialogBody>
          <DialogFooter>
            {value && <Button variant="danger-ghost" className="mr-auto" onClick={() => { onApply(null); onOpenChange(false); }}>Remove</Button>}
            <Button onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="submit" variant="primary">Apply</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function NoteDialog({ open, onOpenChange, value, onSave }: { open: boolean; onOpenChange: (o: boolean) => void; value: string; onSave: (n: string) => void }) {
  const [v, setV] = React.useState(value);
  React.useEffect(() => { if (open) setV(value); }, [open, value]);
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent title="Order note" description="Shown on the KOT and kitchen display." className="max-w-[400px]">
        <DialogBody><Textarea autoFocus value={v} onChange={(e) => setV(e.target.value)} maxLength={300} placeholder="e.g. Birthday table, bring candles" aria-label="Order note" /></DialogBody>
        <DialogFooter><Button onClick={() => onOpenChange(false)}>Cancel</Button><Button variant="primary" onClick={() => { onSave(v.trim()); onOpenChange(false); }}>Save note</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function CustomerDialog({ open, onOpenChange, value, onPick }: { open: boolean; onOpenChange: (o: boolean) => void; value?: CartCustomer; onPick: (c?: CartCustomer) => void }) {
  const [q, setQ] = React.useState("");
  const [results, setResults] = React.useState<Customer[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [adding, setAdding] = React.useState(false);
  const [name, setName] = React.useState("");
  const [phone, setPhone] = React.useState("");
  const [saving, setSaving] = React.useState(false);

  React.useEffect(() => {
    if (!open) return;
    setAdding(false);
    setQ("");
  }, [open]);
  React.useEffect(() => {
    if (!open) return;
    let live = true;
    setLoading(true);
    const t = setTimeout(async () => {
      try {
        const r = await searchCustomersAction(q);
        if (live) setResults(r);
      } catch {
        if (live) setResults([]);
      } finally {
        if (live) setLoading(false);
      }
    }, 150);
    return () => { live = false; clearTimeout(t); };
  }, [q, open]);

  const pick = (c: Customer) => { onPick({ id: c.id, name: c.name, phone: c.phone }); onOpenChange(false); };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent title="Customer" description="Attach a customer to this order." className="max-w-[420px]">
        {adding ? (
          <form onSubmit={async (e) => {
            e.preventDefault();
            setSaving(true);
            const r = await createCustomerAction({ name, phone });
            setSaving(false);
            if (!r.ok) return toast.error(r.error);
            toast.success("Customer added");
            pick(r.data);
          }}>
            <DialogBody className="space-y-3">
              <Field label="Name" htmlFor="c-name"><Input id="c-name" autoFocus value={name} onChange={(e) => setName(e.target.value)} /></Field>
              <Field label="Phone" htmlFor="c-phone"><Input id="c-phone" inputMode="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+91 98XXX XXXXX" /></Field>
            </DialogBody>
            <DialogFooter><Button onClick={() => setAdding(false)}>Back</Button><Button type="submit" variant="primary" loading={saving}>Add customer</Button></DialogFooter>
          </form>
        ) : (
          <>
            <div className="border-b border-line px-5 py-3">
              <div className="relative">
                <Search className="pointer-events-none absolute left-2.5 top-2.5 size-3.5 text-fg-subtle" />
                <Input autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search name or phone" className="pl-8" aria-label="Search customers" />
              </div>
            </div>
            <DialogBody className="px-2 py-2">
              {loading && !results.length ? <div className="grid place-items-center py-8 text-fg-subtle"><Loader2 className="size-4 animate-spin" /></div> : results.length === 0 ? <p className="py-8 text-center text-[13px] text-fg-muted">No customers match.</p> : (
                <ul>{results.map((c) => (
                  <li key={c.id}><button type="button" onClick={() => pick(c)} className="flex w-full items-center justify-between rounded-md px-3 py-2 text-left text-[13px] hover:bg-muted"><span className="font-medium">{c.name}</span><span className="tnum text-fg-muted">{c.phone}</span></button></li>
                ))}</ul>
              )}
            </DialogBody>
            <DialogFooter className="justify-between">
              <Button variant="ghost" onClick={() => { setName(""); setPhone(q.replace(/\D/g, "").length > 5 ? q : ""); setAdding(true); }}><UserPlus className="size-3.5" /> New customer</Button>
              {value && <Button variant="danger-ghost" onClick={() => { onPick(undefined); onOpenChange(false); }}><X className="size-3.5" /> Remove</Button>}
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
