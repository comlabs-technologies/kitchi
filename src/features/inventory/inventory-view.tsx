"use client";
import * as React from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { History, MinusCircle, Package, Plus, PlusCircle, SlidersHorizontal } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogBody, DialogContent, DialogFooter } from "@/components/ui/dialog";
import { Field, Input, Select, Textarea } from "@/components/ui/form";
import { EmptyState, Segmented } from "@/components/ui/primitives";
import { SearchInput, Table, TBody, Td, Th, THead, Tr, useSort } from "@/components/ui/table";
import { newInventoryItemSchema, stockAdjustSchema, type StockAdjustInput } from "@/lib/schemas";
import { formatDateTime, timeAgo } from "@/lib/time";
import { cn } from "@/lib/utils";
import { addInventoryItemAction, adjustStockAction } from "@/server/actions/ops";
import type { InventoryRow } from "@/server/services/inventory";
import type { StockMovement, StockReason, StockStatus } from "@/types/domain";
import { z } from "zod";

const STATUS: Record<StockStatus, { label: string; tone: "ok" | "warn" | "danger" }> = { HEALTHY: { label: "Healthy", tone: "ok" }, LOW: { label: "Low", tone: "warn" }, CRITICAL: { label: "Critical", tone: "danger" } };
const REASON: Record<string, string> = { PURCHASE: "Purchase", WASTAGE: "Wastage", CORRECTION: "Correction", INTERNAL: "Internal consumption", SALE: "Sale" };

export function InventoryView({ items, movements, canManage, serverNow }: { items: InventoryRow[]; movements: StockMovement[]; canManage: boolean; serverNow: number }) {
  const sp = useSearchParams();
  const [tab, setTab] = React.useState<"stock" | "history">("stock");
  const [filter, setFilter] = React.useState<"all" | "low" | "healthy">(sp.get("status") === "low" ? "low" : "all");
  const [q, setQ] = React.useState("");
  const [adjust, setAdjust] = React.useState<{ itemId?: string; reason: Exclude<StockReason, "SALE"> } | null>(null);
  const [addOpen, setAddOpen] = React.useState(false);

  const filtered = React.useMemo(() => items.filter((i) => (filter === "all" || (filter === "low" ? i.status !== "HEALTHY" : i.status === "HEALTHY")) && (!q || i.name.toLowerCase().includes(q.toLowerCase()))), [items, filter, q]);
  const { sorted, sort } = useSort(filtered, { name: (i) => i.name, stock: (i) => i.stock, min: (i) => i.minLevel, status: (i) => ({ CRITICAL: 0, LOW: 1, HEALTHY: 2 })[i.status], updated: (i) => i.updatedAt }, { key: "status", dir: "asc" });
  const lowCount = items.filter((i) => i.status !== "HEALTHY").length;

  return (
    <>
      <div className="mb-4 flex flex-wrap items-center gap-x-4 gap-y-2.5">
        <Segmented label="View" value={tab} onChange={setTab} options={[{ value: "stock", label: "Stock" }, { value: "history", label: "Movement history" }]} />
        {tab === "stock" && <Segmented label="Filter" value={filter} onChange={setFilter} options={[{ value: "all", label: `All ${items.length}` }, { value: "low", label: `Needs attention ${lowCount}` }, { value: "healthy", label: "Healthy" }]} />}
        {tab === "stock" && <SearchInput value={q} onChange={setQ} placeholder="Search stock" className="w-full sm:w-56" />}
        {canManage && (
          <div className="ml-auto flex flex-wrap gap-2">
            <Button size="sm" onClick={() => setAdjust({ reason: "WASTAGE" })}><MinusCircle className="size-3.5" /> Record wastage</Button>
            <Button size="sm" onClick={() => setAdjust({ reason: "CORRECTION" })}><SlidersHorizontal className="size-3.5" /> Adjust stock</Button>
            <Button size="sm" variant="primary" onClick={() => setAdjust({ reason: "PURCHASE" })}><PlusCircle className="size-3.5" /> Add stock</Button>
          </div>
        )}
      </div>

      {tab === "stock" ? (
        items.length === 0 ? (
          <div className="rounded-xl border border-line bg-surface"><EmptyState icon={<Package />} title="No inventory items yet" description="Track the ingredients you can't afford to run out of." action={canManage ? <Button variant="primary" size="sm" onClick={() => setAddOpen(true)}>Add item</Button> : undefined} /></div>
        ) : sorted.length === 0 ? (
          <div className="rounded-xl border border-line bg-surface"><EmptyState icon={<Package />} title={filter === "low" ? "No low-stock items" : "No items found"} description={filter === "low" ? "Everything looks healthy." : "Try a different search."} /></div>
        ) : (
          <Table>
            <THead><tr><Th sort={sort} sortKey="name">Item</Th><Th sort={sort} sortKey="stock" align="right">Current stock</Th><Th>Unit</Th><Th sort={sort} sortKey="min" align="right">Minimum level</Th><Th sort={sort} sortKey="status">Status</Th><Th sort={sort} sortKey="updated">Last updated</Th><Th align="right"><span className="sr-only">Actions</span></Th></tr></THead>
            <TBody>
              {sorted.map((i) => (
                <Tr key={i.id}>
                  <Td className="font-medium">{i.name}</Td>
                  <Td align="right" className={cn("tnum font-medium", i.status === "CRITICAL" && "text-danger", i.status === "LOW" && "text-warn")}>{i.stock}</Td>
                  <Td className="text-fg-muted">{i.unit}</Td>
                  <Td align="right" className="tnum text-fg-muted">{i.minLevel}</Td>
                  <Td><Badge tone={STATUS[i.status].tone} dot>{STATUS[i.status].label}</Badge></Td>
                  <Td className="text-fg-muted">{timeAgo(i.updatedAt, serverNow)}</Td>
                  <Td align="right">{canManage && <Button size="xs" variant="ghost" onClick={() => setAdjust({ itemId: i.id, reason: i.status === "HEALTHY" ? "CORRECTION" : "PURCHASE" })}>Adjust</Button>}</Td>
                </Tr>
              ))}
            </TBody>
          </Table>
        )
      ) : movements.length === 0 ? (
        <div className="rounded-xl border border-line bg-surface"><EmptyState icon={<History />} title="No stock movements yet" description="Purchases, wastage and corrections will be logged here." /></div>
      ) : (
        <Table>
          <THead><tr><Th>When</Th><Th>Item</Th><Th>Reason</Th><Th align="right">Change</Th><Th align="right">Balance</Th><Th>By</Th><Th>Note</Th></tr></THead>
          <TBody>
            {movements.slice(0, 120).map((m) => (
              <Tr key={m.id}>
                <Td className="text-fg-muted">{formatDateTime(m.createdAt)}</Td><Td className="font-medium">{m.itemName}</Td><Td>{REASON[m.reason]}</Td>
                <Td align="right" className={cn("tnum font-medium", m.delta > 0 ? "text-ok" : "text-danger")}>{m.delta > 0 ? "+" : ""}{m.delta} {m.unit}</Td>
                <Td align="right" className="tnum text-fg-muted">{Math.round(m.balanceAfter * 100) / 100} {m.unit}</Td><Td className="text-fg-muted">{m.createdBy}</Td><Td className="max-w-[220px] truncate text-fg-muted">{m.note ?? ""}</Td>
              </Tr>
            ))}
          </TBody>
        </Table>
      )}
      <AdjustDialog state={adjust} onClose={() => setAdjust(null)} items={items} onAddItem={() => { setAdjust(null); setAddOpen(true); }} />
      <AddItemDialog open={addOpen} onOpenChange={setAddOpen} />
    </>
  );
}

type AdjustForm = z.input<typeof stockAdjustSchema>;

function AdjustDialog({ state, onClose, items, onAddItem }: { state: { itemId?: string; reason: Exclude<StockReason, "SALE"> } | null; onClose: () => void; items: InventoryRow[]; onAddItem: () => void }) {
  const router = useRouter();
  const form = useForm<AdjustForm, unknown, StockAdjustInput>({ resolver: zodResolver(stockAdjustSchema), defaultValues: { itemId: "", quantity: 0, reason: "PURCHASE", note: "" } });
  const { register, control, watch, handleSubmit, reset, formState: { errors, isSubmitting } } = form;
  React.useEffect(() => { if (state) reset({ itemId: state.itemId ?? "", quantity: undefined as unknown as number, reason: state.reason, note: "" }); }, [state, reset]);
  const itemId = watch("itemId"), reason = watch("reason"), qty = Number(watch("quantity")) || 0;
  const item = items.find((i) => i.id === itemId);
  const next = !item ? null : reason === "CORRECTION" ? qty : item.stock + (reason === "PURCHASE" ? qty : -qty);

  const submit = handleSubmit(async (v) => {
    const r = await adjustStockAction(v);
    if (!r.ok) return toast.error(r.error);
    toast.success("Stock updated", { description: item ? `${item.name} is now ${Math.round((next ?? 0) * 100) / 100} ${item.unit}` : undefined });
    onClose();
    router.refresh();
  });

  return (
    <Dialog open={!!state} onOpenChange={(o) => !o && onClose()}>
      <DialogContent title="Stock adjustment" description="Every change is logged in movement history." className="max-w-[420px]">
        <form onSubmit={submit} noValidate>
          <DialogBody className="space-y-3.5">
            <Field label="Item" htmlFor="si" error={errors.itemId?.message}>
              <Select id="si" {...register("itemId")} aria-invalid={!!errors.itemId}><option value="">Choose an item</option>{items.map((i) => <option key={i.id} value={i.id}>{i.name} · {i.stock} {i.unit}</option>)}</Select>
            </Field>
            <Field label="Reason" htmlFor="sr">
              <Controller control={control} name="reason" render={({ field }) => (
                <Select id="sr" value={field.value} onChange={field.onChange}>{["PURCHASE", "WASTAGE", "CORRECTION", "INTERNAL"].map((r) => <option key={r} value={r}>{REASON[r]}</option>)}</Select>
              )} />
            </Field>
            <Field label={reason === "CORRECTION" ? `Counted quantity${item ? ` (${item.unit})` : ""}` : `Quantity${item ? ` (${item.unit})` : ""}`} htmlFor="sq" error={errors.quantity?.message} hint={reason === "CORRECTION" ? "Enter what you physically counted." : undefined}>
              <Input id="sq" inputMode="decimal" type="number" step="any" min={0} autoFocus aria-invalid={!!errors.quantity} {...register("quantity")} />
            </Field>
            <Field label="Note" htmlFor="sn"><Textarea id="sn" className="min-h-[52px]" placeholder="Optional — vendor, spoilage cause…" {...register("note")} /></Field>
            {item && next != null && qty > 0 || (item && reason === "CORRECTION" && watch("quantity") !== undefined) ? (
              <p className="tnum rounded-lg bg-muted px-3 py-2 text-[13px] text-fg-muted">{item!.stock} → <b className={cn("text-fg", (next ?? 0) < 0 && "text-danger")}>{Math.round((next ?? 0) * 100) / 100} {item!.unit}</b></p>
            ) : null}
          </DialogBody>
          <DialogFooter className="justify-between">
            <Button type="button" variant="ghost" onClick={onAddItem}><Plus className="size-3.5" /> New item</Button>
            <div className="flex gap-2"><Button type="button" onClick={onClose}>Cancel</Button><Button type="submit" variant="primary" loading={isSubmitting}>Save</Button></div>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

type NewForm = z.input<typeof newInventoryItemSchema>;
function AddItemDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const router = useRouter();
  const { register, handleSubmit, reset, formState: { errors, isSubmitting } } = useForm<NewForm, unknown, z.output<typeof newInventoryItemSchema>>({ resolver: zodResolver(newInventoryItemSchema), defaultValues: { name: "", unit: "kg", stock: 0, minLevel: 0 } });
  React.useEffect(() => { if (open) reset({ name: "", unit: "kg", stock: 0, minLevel: 0 }); }, [open, reset]);
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent title="New inventory item" className="max-w-[400px]">
        <form noValidate onSubmit={handleSubmit(async (v) => {
          const r = await addInventoryItemAction(v);
          if (!r.ok) return toast.error(r.error);
          toast.success(`${v.name} added`);
          onOpenChange(false);
          router.refresh();
        })}>
          <DialogBody className="space-y-3.5">
            <Field label="Name" htmlFor="ni-n" error={errors.name?.message}><Input id="ni-n" autoFocus {...register("name")} placeholder="e.g. Mozzarella" /></Field>
            <div className="grid grid-cols-3 gap-3">
              <Field label="Unit" htmlFor="ni-u" error={errors.unit?.message}><Select id="ni-u" {...register("unit")}>{["kg", "g", "L", "ml", "pcs"].map((u) => <option key={u}>{u}</option>)}</Select></Field>
              <Field label="Opening stock" htmlFor="ni-s"><Input id="ni-s" type="number" step="any" min={0} {...register("stock")} /></Field>
              <Field label="Minimum" htmlFor="ni-m"><Input id="ni-m" type="number" step="any" min={0} {...register("minLevel")} /></Field>
            </div>
          </DialogBody>
          <DialogFooter><Button type="button" onClick={() => onOpenChange(false)}>Cancel</Button><Button type="submit" variant="primary" loading={isSubmitting}>Add item</Button></DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
