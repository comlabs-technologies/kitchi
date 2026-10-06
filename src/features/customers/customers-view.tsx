"use client";
import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Phone, Plus, Users } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogBody, DialogContent, DialogFooter } from "@/components/ui/dialog";
import { Field, Input } from "@/components/ui/form";
import { EmptyState } from "@/components/ui/primitives";
import { Sheet, SheetBody, SheetContent } from "@/components/ui/sheet";
import { SearchInput, Table, TBody, Td, Th, THead, Tr, useSort } from "@/components/ui/table";
import { formatMoney } from "@/lib/money";
import { formatDate, formatDateYear, formatTime, timeAgo } from "@/lib/time";
import { initials } from "@/lib/utils";
import { addCustomerAction } from "@/server/actions/ops";
import type { CustomerRow } from "@/server/services/customers";
import type { Order } from "@/types/domain";
import { StatusBadge } from "@/features/orders/status";

export function CustomersView({ rows, recent, canManage, serverNow }: { rows: CustomerRow[]; recent: Record<string, Order[]>; canManage: boolean; serverNow: number }) {
  const [q, setQ] = React.useState("");
  const [openId, setOpenId] = React.useState<string | null>(null);
  const [addOpen, setAddOpen] = React.useState(false);
  const filtered = React.useMemo(() => {
    const n = q.trim().toLowerCase().replace(/\s/g, "");
    return rows.filter((c) => !n || c.name.toLowerCase().includes(n) || c.phone.replace(/\s/g, "").includes(n));
  }, [rows, q]);
  const { sorted, sort } = useSort(filtered, { name: (c) => c.name, orders: (c) => c.orders, spend: (c) => c.spend, last: (c) => c.lastVisit }, { key: "spend", dir: "desc" });
  const c = rows.find((x) => x.id === openId);

  return (
    <>
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <SearchInput value={q} onChange={setQ} placeholder="Search name or phone" className="w-full sm:w-64" />
        <span className="tnum text-xs text-fg-muted">{sorted.length} customers</span>
        {canManage && <Button size="sm" variant="primary" className="ml-auto" onClick={() => setAddOpen(true)}><Plus className="size-3.5" /> Add customer</Button>}
      </div>
      {rows.length === 0 ? (
        <div className="rounded-xl border border-line bg-surface"><EmptyState icon={<Users />} title="No customers yet" description="Attach a customer in POS and they'll show up here with their order history." /></div>
      ) : sorted.length === 0 ? (
        <div className="rounded-xl border border-line bg-surface"><EmptyState title="No customers found" description="Check the spelling or try a phone number." /></div>
      ) : (
        <Table>
          <THead><tr><Th sort={sort} sortKey="name">Customer</Th><Th>Phone</Th><Th sort={sort} sortKey="orders" align="right">Orders</Th><Th sort={sort} sortKey="spend" align="right">Total spend</Th><Th sort={sort} sortKey="last">Last visit</Th></tr></THead>
          <TBody>
            {sorted.map((x) => (
              <Tr key={x.id} onClick={() => setOpenId(x.id)}>
                <Td><div className="flex items-center gap-2.5"><span className="grid size-7 place-items-center rounded-full bg-muted-2 text-[10.5px] font-semibold text-fg-muted">{initials(x.name)}</span><span className="font-medium">{x.name}</span></div></Td>
                <Td className="tnum text-fg-muted">{x.phone}</Td>
                <Td align="right" className="tnum">{x.orders}</Td>
                <Td align="right" className="tnum font-medium">{formatMoney(x.spend)}</Td>
                <Td className="text-fg-muted">{x.lastVisit ? timeAgo(x.lastVisit, serverNow) : "—"}</Td>
              </Tr>
            ))}
          </TBody>
        </Table>
      )}

      <Sheet open={!!c} onOpenChange={(o) => !o && setOpenId(null)}>
        {c && (
          <SheetContent title={c.name} description={c.phone}>
            <SheetBody>
              <div className="flex items-center gap-3 border-b border-line px-5 py-4">
                <span className="grid size-11 place-items-center rounded-full bg-muted-2 text-sm font-semibold text-fg-muted">{initials(c.name)}</span>
                <div className="min-w-0"><p className="font-semibold">{c.name}</p><a href={`tel:${c.phone.replace(/\s/g, "")}`} className="inline-flex items-center gap-1.5 text-[13px] text-fg-muted hover:text-fg"><Phone className="size-3" /> {c.phone}</a></div>
              </div>
              <dl className="grid grid-cols-2 gap-x-6 gap-y-4 border-b border-line px-5 py-4">
                <Stat k="Total orders" v={String(c.orders)} /><Stat k="Lifetime spend" v={formatMoney(c.spend)} />
                <Stat k="Average order" v={c.orders ? formatMoney(c.aov) : "—"} /><Stat k="Last visit" v={c.lastVisit ? formatDateYear(c.lastVisit) : "—"} />
              </dl>
              <section className="px-5 py-4">
                <h3 className="mb-2 text-xs font-medium text-fg-muted">Recent orders</h3>
                {(recent[c.id] ?? []).length === 0 ? <p className="py-4 text-[13px] text-fg-muted">No orders yet.</p> : (
                  <ul className="divide-y divide-line border-y border-line">
                    {(recent[c.id] ?? []).map((o) => (
                      <li key={o.id}><Link href={`/orders?open=${o.id}`} className="flex items-center gap-3 py-2.5 text-[13px] hover:bg-muted/50">
                        <span className="tnum w-14 font-medium">#{o.number}</span><span className="flex-1 text-fg-muted">{formatDate(o.createdAt)}, {formatTime(o.createdAt)} · {o.items.reduce((s, i) => s + i.qty, 0)} items</span><StatusBadge status={o.status} /><span className="tnum w-16 text-right font-medium">{formatMoney(o.total)}</span>
                      </Link></li>
                    ))}
                  </ul>
                )}
              </section>
            </SheetBody>
          </SheetContent>
        )}
      </Sheet>
      <AddDialog open={addOpen} onOpenChange={setAddOpen} />
    </>
  );
}

const Stat = ({ k, v }: { k: string; v: string }) => <div><dt className="text-xs text-fg-muted">{k}</dt><dd className="tnum mt-0.5 text-[17px] font-semibold tracking-tight">{v}</dd></div>;

function AddDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const router = useRouter();
  const [name, setName] = React.useState("");
  const [phone, setPhone] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent title="Add customer" className="max-w-[380px]">
        <form onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true);
          const r = await addCustomerAction({ name, phone });
          setBusy(false);
          if (!r.ok) return toast.error(r.error);
          toast.success("Customer added");
          setName(""); setPhone("");
          onOpenChange(false);
          router.refresh();
        }}>
          <DialogBody className="space-y-3"><Field label="Name" htmlFor="cn"><Input id="cn" autoFocus value={name} onChange={(e) => setName(e.target.value)} /></Field><Field label="Phone" htmlFor="cp"><Input id="cp" inputMode="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+91 98XXX XXXXX" /></Field></DialogBody>
          <DialogFooter><Button type="button" onClick={() => onOpenChange(false)}>Cancel</Button><Button type="submit" variant="primary" loading={busy}>Add</Button></DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
