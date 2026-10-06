"use client";
import * as React from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Copy, EyeOff, MoreHorizontal, Pencil, Plus, Trash2, UtensilsCrossed } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogBody, DialogContent, DialogFooter } from "@/components/ui/dialog";
import { Dropdown, DropdownContent, DropdownItem, DropdownSeparator, DropdownTrigger } from "@/components/ui/dropdown";
import { Input } from "@/components/ui/form";
import { Badge } from "@/components/ui/badge";
import { EmptyState, FoodMark } from "@/components/ui/primitives";
import { Switch } from "@/components/ui/switch";
import { SearchInput, Table, TBody, Td, Th, THead, Tr, useSort } from "@/components/ui/table";
import { formatMoney } from "@/lib/money";
import { cn } from "@/lib/utils";
import { addCategoryAction, deleteMenuItemAction, duplicateMenuItemAction, setAvailabilityAction } from "@/server/actions/ops";
import type { Category, MenuItem, ModifierGroup } from "@/types/domain";
import { ItemFormSheet } from "./item-form";

export function MenuView({ categories, items, groups, canManage }: { categories: Category[]; items: MenuItem[]; groups: ModifierGroup[]; canManage: boolean }) {
  const router = useRouter();
  const sp = useSearchParams();
  const [cat, setCat] = React.useState<string>("all");
  const [q, setQ] = React.useState("");
  const [editing, setEditing] = React.useState<MenuItem | null>(null);
  const [formOpen, setFormOpen] = React.useState(sp.get("new") === "1" && canManage);
  const [deleting, setDeleting] = React.useState<MenuItem | null>(null);
  const [catOpen, setCatOpen] = React.useState(false);
  const [busy, setBusy] = React.useState(false);
  const [local, setLocal] = React.useState<Record<string, boolean>>({});

  React.useEffect(() => { if (sp.get("new") === "1") router.replace("/menu", { scroll: false }); }, [sp, router]);

  const catName = React.useMemo(() => new Map(categories.map((c) => [c.id, c.name])), [categories]);
  const filtered = React.useMemo(() => {
    const n = q.trim().toLowerCase();
    return items.filter((i) => (cat === "all" || i.categoryId === cat) && (!n || i.name.toLowerCase().includes(n) || i.sku.toLowerCase().includes(n)));
  }, [items, cat, q]);
  const { sorted, sort } = useSort(filtered, { name: (i) => i.name, category: (i) => catName.get(i.categoryId), price: (i) => i.price, available: (i) => (i.available ? 1 : 0), tax: (i) => i.taxRate }, { key: "name", dir: "asc" });

  const available = (i: MenuItem) => local[i.id] ?? i.available;
  const toggle = async (i: MenuItem, v: boolean) => {
    setLocal((l) => ({ ...l, [i.id]: v }));
    const r = await setAvailabilityAction(i.id, v);
    if (!r.ok) { setLocal((l) => { const n = { ...l }; delete n[i.id]; return n; }); return toast.error(r.error); }
    toast.success(`${i.name} ${v ? "is available" : "marked sold out"}`);
    router.refresh();
  };
  const run = async (fn: () => Promise<{ ok: boolean } & ({ error: string } | { data?: unknown })>, ok: string) => {
    const r = await fn();
    if (!r.ok) return toast.error((r as { error: string }).error);
    toast.success(ok);
    router.refresh();
  };
  const priceLabel = (i: MenuItem) => (i.variants.length > 1 ? `${formatMoney(Math.min(...i.variants.map((v) => v.price)))} – ${formatMoney(Math.max(...i.variants.map((v) => v.price)))}` : formatMoney(i.variants[0]?.price ?? i.price));
  const count = (id: string) => items.filter((i) => i.categoryId === id).length;

  return (
    <div className="grid gap-6 lg:grid-cols-[210px_minmax(0,1fr)]">
      <aside aria-label="Categories">
        <div className="scroll-none -mx-4 flex gap-1 overflow-x-auto px-4 lg:mx-0 lg:block lg:space-y-0.5 lg:overflow-visible lg:px-0">
          {[{ id: "all", name: "All items", n: items.length }, ...categories.map((c) => ({ id: c.id, name: c.name, n: count(c.id) }))].map((c) => (
            <button key={c.id} type="button" aria-pressed={cat === c.id} onClick={() => setCat(c.id)} className={cn("flex shrink-0 items-center justify-between gap-3 rounded-md px-2.5 py-1.5 text-[13px] font-medium transition-colors lg:w-full", cat === c.id ? "bg-muted-2/70 text-fg" : "text-fg-muted hover:bg-muted")}>
              {c.name}<span className="tnum text-xs text-fg-subtle">{c.n}</span>
            </button>
          ))}
          {canManage && <button type="button" onClick={() => setCatOpen(true)} className="flex shrink-0 items-center gap-1.5 rounded-md px-2.5 py-1.5 text-[13px] text-fg-subtle transition-colors hover:bg-muted hover:text-fg lg:w-full"><Plus className="size-3.5" /> Category</button>}
        </div>
      </aside>

      <div className="min-w-0">
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <SearchInput value={q} onChange={setQ} placeholder="Search name or SKU" className="w-full sm:w-64" />
          <span className="tnum text-xs text-fg-muted">{sorted.length} item{sorted.length === 1 ? "" : "s"}</span>
          {canManage && <Button variant="primary" size="sm" className="ml-auto" onClick={() => { setEditing(null); setFormOpen(true); }}><Plus className="size-3.5" /> Create item</Button>}
        </div>
        {items.length === 0 ? (
          <div className="rounded-xl border border-line bg-surface"><EmptyState icon={<UtensilsCrossed />} title="Your menu is empty" description="Add your first item and it will show up in POS instantly." action={canManage ? <Button variant="primary" size="sm" onClick={() => setFormOpen(true)}>Create item</Button> : undefined} /></div>
        ) : sorted.length === 0 ? (
          <div className="rounded-xl border border-line bg-surface"><EmptyState title="No items found" description="Try a different search or category." /></div>
        ) : (
          <Table>
            <THead><tr><Th sort={sort} sortKey="name">Item</Th><Th sort={sort} sortKey="category">Category</Th><Th sort={sort} sortKey="price" align="right">Price</Th><Th sort={sort} sortKey="available">Availability</Th><Th sort={sort} sortKey="tax" align="right">Tax</Th><Th align="right"><span className="sr-only">Actions</span></Th></tr></THead>
            <TBody>
              {sorted.map((i) => (
                <Tr key={i.id} onClick={canManage ? () => { setEditing(i); setFormOpen(true); } : undefined} className={cn(!available(i) && "text-fg-muted")}>
                  <Td>
                    <div className="flex items-center gap-2.5"><FoodMark type={i.foodType} /><div><p className="font-medium text-fg">{i.name}</p><p className="text-xs text-fg-subtle">{i.sku}{i.variants.length > 0 ? ` · ${i.variants.length} sizes` : ""}{i.modifierGroupIds.length > 0 ? ` · add-ons` : ""}</p></div></div>
                  </Td>
                  <Td className="text-fg-muted">{catName.get(i.categoryId)}</Td>
                  <Td align="right" className="tnum font-medium">{priceLabel(i)}</Td>
                  <Td onClick={(e) => e.stopPropagation()}>
                    <label className="flex items-center gap-2"><Switch checked={available(i)} disabled={!canManage} onCheckedChange={(v) => void toggle(i, v)} aria-label={`${i.name} available`} /><span className="text-xs text-fg-muted">{available(i) ? "Available" : <Badge tone="danger">Sold out</Badge>}</span></label>
                  </Td>
                  <Td align="right" className="tnum text-fg-muted">{i.taxRate}%</Td>
                  <Td align="right" onClick={(e) => e.stopPropagation()}>
                    {canManage && (
                      <Dropdown>
                        <DropdownTrigger className="grid size-7 place-items-center rounded-md text-fg-subtle hover:bg-muted data-[state=open]:bg-muted" aria-label={`Actions for ${i.name}`}><MoreHorizontal className="size-4" /></DropdownTrigger>
                        <DropdownContent>
                          <DropdownItem icon={<Pencil />} onSelect={() => { setEditing(i); setFormOpen(true); }}>Edit</DropdownItem>
                          <DropdownItem icon={<Copy />} onSelect={() => void run(() => duplicateMenuItemAction(i.id), `Duplicated ${i.name}`)}>Duplicate</DropdownItem>
                          <DropdownItem icon={<EyeOff />} onSelect={() => void toggle(i, !available(i))}>{available(i) ? "Disable" : "Enable"}</DropdownItem>
                          <DropdownSeparator />
                          <DropdownItem danger icon={<Trash2 />} onSelect={() => setDeleting(i)}>Delete</DropdownItem>
                        </DropdownContent>
                      </Dropdown>
                    )}
                  </Td>
                </Tr>
              ))}
            </TBody>
          </Table>
        )}
      </div>

      <ItemFormSheet open={formOpen} onOpenChange={setFormOpen} item={editing} categories={categories} groups={groups} defaultCategoryId={cat !== "all" ? cat : undefined} />

      <Dialog open={!!deleting} onOpenChange={(o) => !o && setDeleting(null)}>
        <DialogContent title={`Delete ${deleting?.name}?`} description="It will disappear from POS. Past orders keep their history." className="max-w-[400px]">
          <DialogFooter><Button onClick={() => setDeleting(null)}>Keep item</Button><Button variant="danger" loading={busy} onClick={async () => { setBusy(true); await run(() => deleteMenuItemAction(deleting!.id), "Item deleted"); setBusy(false); setDeleting(null); }}>Delete</Button></DialogFooter>
        </DialogContent>
      </Dialog>
      <CategoryDialog open={catOpen} onOpenChange={setCatOpen} />
    </div>
  );
}

function CategoryDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const router = useRouter();
  const [name, setName] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent title="New category" className="max-w-[360px]">
        <form onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true);
          const r = await addCategoryAction(name);
          setBusy(false);
          if (!r.ok) return toast.error(r.error);
          toast.success("Category added");
          setName("");
          onOpenChange(false);
          router.refresh();
        }}>
          <DialogBody><Input autoFocus value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Sandwiches" aria-label="Category name" /></DialogBody>
          <DialogFooter><Button type="button" onClick={() => onOpenChange(false)}>Cancel</Button><Button type="submit" variant="primary" loading={busy}>Add</Button></DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
