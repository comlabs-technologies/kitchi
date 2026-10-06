"use client";
import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowRightLeft, CalendarClock, Merge, Plus, Receipt, ShoppingBag, Users, X } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogBody, DialogContent, DialogFooter } from "@/components/ui/dialog";
import { Field, Input, Select } from "@/components/ui/form";
import { EmptyState } from "@/components/ui/primitives";
import { Sheet, SheetBody, SheetContent, SheetFooter } from "@/components/ui/sheet";
import { useNow } from "@/lib/hooks";
import { formatMoney } from "@/lib/money";
import { formatElapsed, formatTime, startOfDayIST } from "@/lib/time";
import { cn } from "@/lib/utils";
import { addTableAction, assignTableAction, closeTableAction, mergeTablesAction, releaseReservationAction, reserveTableAction, transferTableAction } from "@/server/actions/ops";
import type { TableView } from "@/server/services/tables";
import type { Order, TableStatus } from "@/types/domain";

const STATUS: Record<TableStatus, { label: string; tone: "ok" | "warn" | "brand" | "neutral"; bar: string }> = {
  AVAILABLE: { label: "Available", tone: "neutral", bar: "bg-line-strong" },
  OCCUPIED: { label: "Occupied", tone: "brand", bar: "bg-brand" },
  BILLING: { label: "Billing", tone: "warn", bar: "bg-warn" },
  RESERVED: { label: "Reserved", tone: "ok", bar: "bg-[#6b8bb5]" },
};

export function TablesView({ tables, unassigned, canManage, canPos, serverNow }: { tables: TableView[]; unassigned: Pick<Order, "id" | "number" | "total" | "items">[]; canManage: boolean; canPos: boolean; serverNow: number }) {
  const now = useNow(serverNow, 15_000);
  const [filter, setFilter] = React.useState<TableStatus | "ALL">("ALL");
  const [selected, setSelected] = React.useState<string | null>(null);
  const [addOpen, setAddOpen] = React.useState(false);
  const counts = React.useMemo(() => {
    const c: Record<string, number> = { ALL: tables.length };
    for (const t of tables) c[t.status] = (c[t.status] ?? 0) + 1;
    return c;
  }, [tables]);
  const sections = React.useMemo(() => {
    const m = new Map<string, TableView[]>();
    for (const t of tables.filter((x) => filter === "ALL" || x.status === filter)) m.set(t.section, [...(m.get(t.section) ?? []), t]);
    return [...m.entries()];
  }, [tables, filter]);
  const sel = tables.find((t) => t.id === selected) ?? null;
  const live = tables.filter((t) => t.order && t.order.paymentStatus === "UNPAID").reduce((s, t) => s + t.order!.total, 0);

  return (
    <>
      <div className="mb-5 flex flex-wrap items-center gap-x-6 gap-y-3">
        <div className="scroll-none -mx-1 flex gap-1 overflow-x-auto px-1" role="group" aria-label="Filter by status">
          {(["ALL", "AVAILABLE", "OCCUPIED", "BILLING", "RESERVED"] as const).map((s) => (
            <button key={s} type="button" aria-pressed={filter === s} onClick={() => setFilter(s)} className={cn("flex h-8 shrink-0 items-center gap-1.5 rounded-md px-2.5 text-[13px] font-medium transition-colors", filter === s ? "bg-fg text-white" : "text-fg-muted hover:bg-muted")}>
              {s === "ALL" ? "All" : STATUS[s].label}<span className={cn("tnum text-xs", filter === s ? "text-white/70" : "text-fg-subtle")}>{counts[s] ?? 0}</span>
            </button>
          ))}
        </div>
        <p className="tnum ml-auto text-[13px] text-fg-muted">Open on tables <b className="ml-1 font-semibold text-fg">{formatMoney(live)}</b></p>
        {canManage && <Button size="sm" onClick={() => setAddOpen(true)}><Plus className="size-3.5" /> Add table</Button>}
      </div>

      {tables.length === 0 ? (
        <div className="rounded-xl border border-line bg-surface"><EmptyState icon={<Users />} title="No tables yet" description="Add tables to start seating guests and running dine-in orders." action={canManage ? <Button variant="primary" size="sm" onClick={() => setAddOpen(true)}>Add table</Button> : undefined} /></div>
      ) : sections.length === 0 ? (
        <p className="py-16 text-center text-[13px] text-fg-muted">No {filter.toLowerCase()} tables right now.</p>
      ) : (
        <div className="space-y-7">
          {sections.map(([name, list]) => (
            <section key={name}>
              <h2 className="mb-2.5 text-[13px] font-semibold">{name} <span className="tnum font-normal text-fg-subtle">· {list.length}</span></h2>
              <ul className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
                {list.map((t) => <li key={t.id}><TableTile t={t} now={now} onClick={() => setSelected(t.id)} /></li>)}
              </ul>
            </section>
          ))}
        </div>
      )}

      <TableSheet table={sel} tables={tables} unassigned={unassigned} canManage={canManage} canPos={canPos} now={now} onClose={() => setSelected(null)} />
      <AddTableDialog open={addOpen} onOpenChange={setAddOpen} />
    </>
  );
}

function TableTile({ t, now, onClick }: { t: TableView; now: number; onClick: () => void }) {
  const s = STATUS[t.status];
  const since = t.occupiedSince ?? t.order?.createdAt;
  return (
    <button type="button" onClick={onClick} aria-label={`${t.name}, ${s.label}`} className="group relative flex h-full min-h-[104px] w-full flex-col justify-between overflow-hidden rounded-xl border border-line bg-surface p-3 pl-4 text-left transition-[border-color,box-shadow] duration-150 hover:border-line-strong hover:shadow-[0_1px_2px_rgba(20,20,18,0.05)] active:scale-[0.99]">
      <span className={cn("absolute inset-y-0 left-0 w-1", s.bar)} />
      <div className="flex items-start justify-between">
        <span className="text-[17px] font-semibold tracking-tight">{t.name}</span>
        <span className="flex items-center gap-1 text-xs text-fg-subtle"><Users className="size-3" />{t.seats}</span>
      </div>
      <div>
        <Badge tone={s.tone} dot>{s.label}</Badge>
        {t.status === "AVAILABLE" && <p className="mt-1.5 text-xs text-fg-subtle">Ready to seat</p>}
        {t.status === "RESERVED" && <p className="mt-1.5 truncate text-xs text-fg-muted">{t.reservedFor}{t.reservedAt ? ` · ${formatTime(t.reservedAt)}` : ""}</p>}
        {(t.status === "OCCUPIED" || t.status === "BILLING") && (
          <p className="tnum mt-1.5 flex items-baseline justify-between text-xs text-fg-muted"><span>{since ? formatElapsed(now - since) : ""}</span><span className="text-[13px] font-semibold text-fg">{t.order ? formatMoney(t.order.total) : ""}</span></p>
        )}
      </div>
    </button>
  );
}

function TableSheet({ table, tables, unassigned, canManage, canPos, now, onClose }: { table: TableView | null; tables: TableView[]; unassigned: Pick<Order, "id" | "number" | "total" | "items">[]; canManage: boolean; canPos: boolean; now: number; onClose: () => void }) {
  const router = useRouter();
  const [mode, setMode] = React.useState<null | "transfer" | "merge" | "assign" | "reserve">(null);
  const [target, setTarget] = React.useState("");
  const [picked, setPicked] = React.useState<string[]>([]);
  const [guest, setGuest] = React.useState("");
  const [time, setTime] = React.useState("20:00");
  const [busy, setBusy] = React.useState(false);
  React.useEffect(() => { setMode(null); setTarget(""); setPicked([]); setGuest(""); }, [table?.id, table?.status]);

  const act = async (fn: () => Promise<{ ok: boolean } & ({ error: string } | { data?: unknown })>, ok: string) => {
    setBusy(true);
    const r = await fn();
    setBusy(false);
    if (!r.ok) return toast.error((r as { error: string }).error);
    toast.success(ok);
    setMode(null);
    router.refresh();
  };

  const free = tables.filter((t) => t.id !== table?.id && (t.status === "AVAILABLE" || t.status === "RESERVED"));
  const mergeable = tables.filter((t) => t.id !== table?.id && t.order && t.order.paymentStatus === "UNPAID");
  const o = table?.order;

  return (
    <Sheet open={!!table} onOpenChange={(v) => !v && onClose()}>
      {table && (
        <SheetContent title={<span className="flex items-center gap-2">{table.name} <Badge tone={STATUS[table.status].tone} dot>{STATUS[table.status].label}</Badge></span>} description={`${table.section} · ${table.seats} seats`}>
          <SheetBody className="px-5 py-4">
            {(table.status === "OCCUPIED" || table.status === "BILLING") && o ? (
              <div className="space-y-4">
                <div className="grid grid-cols-3 gap-4 rounded-lg bg-muted px-4 py-3 text-[13px]">
                  <div><p className="text-xs text-fg-muted">Order</p><p className="tnum font-semibold">#{o.number}</p></div>
                  <div><p className="text-xs text-fg-muted">Seated</p><p className="tnum font-semibold">{formatElapsed(now - (table.occupiedSince ?? o.createdAt))}</p></div>
                  <div><p className="text-xs text-fg-muted">Bill</p><p className="tnum font-semibold">{formatMoney(o.total)}</p></div>
                </div>
                <p className="text-[13px] text-fg-muted">{o.itemCount} items · {o.paymentStatus === "PAID" ? <span className="font-medium text-ok">Paid</span> : <span className="font-medium text-warn">Unpaid</span>} · Kitchen: {o.status.toLowerCase()}</p>
              </div>
            ) : table.status === "RESERVED" ? (
              <p className="text-[13px]">Reserved for <b>{table.reservedFor}</b>{table.reservedAt ? <> at <b className="tnum">{formatTime(table.reservedAt)}</b></> : null}.</p>
            ) : (
              <p className="text-[13px] text-fg-muted">This table is free. Start an order or seat a walk-in.</p>
            )}

            {mode === "transfer" && (
              <div className="mt-5 space-y-3 border-t border-line pt-4">
                <Field label="Move order to" htmlFor="tt"><Select id="tt" value={target} onChange={(e) => setTarget(e.target.value)}><option value="">Choose a free table</option>{free.map((t) => <option key={t.id} value={t.id}>{t.name} · {t.seats} seats</option>)}</Select></Field>
                <div className="flex gap-2"><Button size="sm" variant="primary" disabled={!target} loading={busy} onClick={() => void act(() => transferTableAction(table.id, target), `Moved to ${tables.find((t) => t.id === target)?.name}`)}>Transfer</Button><Button size="sm" onClick={() => setMode(null)}>Cancel</Button></div>
              </div>
            )}
            {mode === "merge" && (
              <div className="mt-5 space-y-3 border-t border-line pt-4">
                <p className="text-xs font-medium text-fg-muted">Merge these tables into {table.name}</p>
                {mergeable.length === 0 ? <p className="text-[13px] text-fg-muted">No other running tables to merge.</p> : (
                  <ul className="space-y-1.5">{mergeable.map((t) => (
                    <li key={t.id}><label className="flex cursor-pointer items-center gap-2.5 rounded-md border border-line px-3 py-2 text-[13px] has-[:checked]:border-brand has-[:checked]:bg-brand-soft/50">
                      <input type="checkbox" className="size-3.5 accent-[var(--brand)]" checked={picked.includes(t.id)} onChange={(e) => setPicked((p) => (e.target.checked ? [...p, t.id] : p.filter((x) => x !== t.id)))} />
                      <span className="flex-1 font-medium">{t.name}</span><span className="tnum text-fg-muted">{formatMoney(t.order!.total)}</span>
                    </label></li>
                  ))}</ul>
                )}
                <div className="flex gap-2"><Button size="sm" variant="primary" disabled={!picked.length} loading={busy} onClick={() => void act(() => mergeTablesAction(table.id, picked), "Tables merged")}>Merge {picked.length || ""}</Button><Button size="sm" onClick={() => setMode(null)}>Cancel</Button></div>
              </div>
            )}
            {mode === "assign" && (
              <div className="mt-5 space-y-3 border-t border-line pt-4">
                <Field label="Open order without a table" htmlFor="ta"><Select id="ta" value={target} onChange={(e) => setTarget(e.target.value)}><option value="">Choose an order</option>{unassigned.map((u) => <option key={u.id} value={u.id}>#{u.number} · {u.items.reduce((s, i) => s + i.qty, 0)} items · {formatMoney(u.total)}</option>)}</Select></Field>
                <div className="flex gap-2"><Button size="sm" variant="primary" disabled={!target} loading={busy} onClick={() => void act(() => assignTableAction(table.id, target), `Assigned to ${table.name}`)}>Assign</Button><Button size="sm" onClick={() => setMode(null)}>Cancel</Button></div>
              </div>
            )}
            {mode === "reserve" && (
              <form className="mt-5 space-y-3 border-t border-line pt-4" onSubmit={(e) => {
                e.preventDefault();
                const [h, m] = time.split(":").map(Number);
                void act(() => reserveTableAction(table.id, guest, startOfDayIST(now) + (h! * 60 + m!) * 60_000), `${table.name} reserved`);
              }}>
                <Field label="Guest name & party" htmlFor="rg"><Input id="rg" value={guest} onChange={(e) => setGuest(e.target.value)} placeholder="e.g. Mehta · 4 guests" autoFocus /></Field>
                <Field label="Time today" htmlFor="rt"><Input id="rt" type="time" value={time} onChange={(e) => setTime(e.target.value)} /></Field>
                <div className="flex gap-2"><Button size="sm" type="submit" variant="primary" loading={busy}>Reserve</Button><Button size="sm" type="button" onClick={() => setMode(null)}>Cancel</Button></div>
              </form>
            )}
          </SheetBody>

          {!mode && (
            <SheetFooter className="flex-wrap">
              {table.status === "AVAILABLE" && (<>
                {canPos && <Button variant="primary" asChild><Link href={`/pos?table=${table.id}`}><ShoppingBag className="size-3.5" /> Start order</Link></Button>}
                {canManage && unassigned.length > 0 && <Button onClick={() => setMode("assign")}>Assign order</Button>}
                {canManage && <Button onClick={() => setMode("reserve")}><CalendarClock className="size-3.5" /> Reserve</Button>}
              </>)}
              {table.status === "RESERVED" && (<>
                {canPos && <Button variant="primary" asChild><Link href={`/pos?table=${table.id}`}>Seat guests</Link></Button>}
                {canManage && <Button onClick={() => void act(() => releaseReservationAction(table.id), "Reservation released")}><X className="size-3.5" /> Release</Button>}
              </>)}
              {(table.status === "OCCUPIED" || table.status === "BILLING") && o && (<>
                {canPos && <Button variant="primary" asChild><Link href={`/pos?table=${table.id}`}><Receipt className="size-3.5" /> {o.paymentStatus === "PAID" ? "View order" : "Open order"}</Link></Button>}
                {canManage && o.paymentStatus === "UNPAID" && <Button onClick={() => setMode("transfer")}><ArrowRightLeft className="size-3.5" /> Transfer</Button>}
                {canManage && o.paymentStatus === "UNPAID" && <Button onClick={() => setMode("merge")}><Merge className="size-3.5" /> Merge</Button>}
                {canManage && <Button disabled={o.paymentStatus !== "PAID"} title={o.paymentStatus !== "PAID" ? "Collect payment first" : undefined} onClick={() => void act(() => closeTableAction(table.id), `${table.name} closed`)}>Close table</Button>}
              </>)}
            </SheetFooter>
          )}
        </SheetContent>
      )}
    </Sheet>
  );
}

function AddTableDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const router = useRouter();
  const [name, setName] = React.useState("");
  const [seats, setSeats] = React.useState("4");
  const [section, setSection] = React.useState("Main hall");
  const [busy, setBusy] = React.useState(false);
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent title="Add table" className="max-w-[380px]">
        <form onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true);
          const r = await addTableAction(name, Number(seats), section);
          setBusy(false);
          if (!r.ok) return toast.error(r.error);
          toast.success(`${name} added`);
          setName("");
          onOpenChange(false);
          router.refresh();
        }}>
          <DialogBody className="space-y-3">
            <Field label="Name" htmlFor="tn"><Input id="tn" autoFocus value={name} onChange={(e) => setName(e.target.value)} placeholder="T13" /></Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Seats" htmlFor="ts"><Input id="ts" type="number" min={1} max={30} value={seats} onChange={(e) => setSeats(e.target.value)} /></Field>
              <Field label="Section" htmlFor="tsec"><Input id="tsec" value={section} onChange={(e) => setSection(e.target.value)} /></Field>
            </div>
          </DialogBody>
          <DialogFooter><Button type="button" onClick={() => onOpenChange(false)}>Cancel</Button><Button type="submit" variant="primary" loading={busy}>Add table</Button></DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
