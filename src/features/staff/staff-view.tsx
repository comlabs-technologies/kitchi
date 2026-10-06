"use client";
import * as React from "react";
import { useRouter } from "next/navigation";
import { Plus, IdCard } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogBody, DialogContent, DialogFooter } from "@/components/ui/dialog";
import { Field, Input, Select } from "@/components/ui/form";
import { EmptyState } from "@/components/ui/primitives";
import { SearchInput, Table, TBody, Td, Th, THead, Tr, useSort } from "@/components/ui/table";
import { cn, initials } from "@/lib/utils";
import { addEmployeeAction } from "@/server/actions/ops";
import { ROLE_LABEL } from "@/server/auth/rbac";
import type { ShiftStatus, StaffRow } from "@/server/services/staff";
import type { Role } from "@/types/domain";

const STATUS: Record<ShiftStatus, { label: string; tone: "ok" | "neutral" | "warn" | "outline" }> = { ON_SHIFT: { label: "On shift", tone: "ok" }, UPCOMING: { label: "Starts later", tone: "neutral" }, DONE: { label: "Shift ended", tone: "outline" }, OFF: { label: "Off today", tone: "warn" } };
const fmt = (m: number) => { const h = Math.floor(m / 60), mm = String(m % 60).padStart(2, "0"); return `${h % 12 || 12}:${mm} ${h < 12 ? "AM" : "PM"}`; };

export function StaffView({ rows, canManage }: { rows: StaffRow[]; canManage: boolean }) {
  const [q, setQ] = React.useState("");
  const [open, setOpen] = React.useState(false);
  const filtered = rows.filter((r) => !q || `${r.name} ${ROLE_LABEL[r.role]}`.toLowerCase().includes(q.toLowerCase()));
  const { sorted, sort } = useSort(filtered, { name: (r) => r.name, role: (r) => ROLE_LABEL[r.role], outlet: (r) => r.outletName, status: (r) => ({ ON_SHIFT: 0, UPCOMING: 1, DONE: 2, OFF: 3 })[r.shiftStatus], shift: (r) => r.shiftStartMin }, { key: "status", dir: "asc" });
  const on = rows.filter((r) => r.shiftStatus === "ON_SHIFT").length;
  return (
    <>
      <div className="mb-3 flex flex-wrap items-center gap-3">
        <SearchInput value={q} onChange={setQ} placeholder="Search staff" className="w-full sm:w-60" />
        <p className="tnum text-[13px] text-fg-muted"><b className="font-semibold text-fg">{on}</b> on shift now · {rows.length} total</p>
        {canManage && <Button size="sm" variant="primary" className="ml-auto" onClick={() => setOpen(true)}><Plus className="size-3.5" /> Add employee</Button>}
      </div>
      {rows.length === 0 ? <div className="rounded-xl border border-line bg-surface"><EmptyState icon={<IdCard />} title="No staff yet" description="Add your team to see who is on shift." /></div> : (
        <Table>
          <THead><tr><Th sort={sort} sortKey="name">Employee</Th><Th sort={sort} sortKey="role">Role</Th><Th sort={sort} sortKey="outlet">Outlet</Th><Th sort={sort} sortKey="status">Status</Th><Th sort={sort} sortKey="shift">Today&apos;s shift</Th></tr></THead>
          <TBody>
            {sorted.map((r) => (
              <Tr key={r.id}>
                <Td><div className="flex items-center gap-2.5"><span className="grid size-7 place-items-center rounded-full bg-muted-2 text-[10.5px] font-semibold text-fg-muted">{initials(r.name)}</span><div><p className="font-medium">{r.name}</p><p className="tnum text-xs text-fg-subtle">{r.phone}</p></div></div></Td>
                <Td><Badge tone={r.role === "OWNER" ? "brand" : "neutral"}>{ROLE_LABEL[r.role]}</Badge></Td>
                <Td className="text-fg-muted">{r.outletName}</Td>
                <Td><Badge tone={STATUS[r.shiftStatus].tone} dot>{STATUS[r.shiftStatus].label}</Badge></Td>
                <Td className={cn("tnum", r.offToday ? "text-fg-subtle" : "text-fg-muted")}>{r.offToday ? "—" : `${fmt(r.shiftStartMin)} – ${fmt(r.shiftEndMin)}`}</Td>
              </Tr>
            ))}
          </TBody>
        </Table>
      )}
      <p className="mt-4 text-xs text-fg-subtle">Attendance, payroll and leave arrive with the Kitchi HRMS module. Roles here control what each person can access.</p>
      <AddDialog open={open} onOpenChange={setOpen} />
    </>
  );
}

function AddDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const router = useRouter();
  const [v, setV] = React.useState({ name: "", phone: "", role: "WAITER" as Role, shiftStart: "11:00", shiftEnd: "20:00" });
  const [busy, setBusy] = React.useState(false);
  const set = (k: keyof typeof v) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setV((s) => ({ ...s, [k]: e.target.value }));
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent title="Add employee" className="max-w-[420px]">
        <form onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true);
          const r = await addEmployeeAction(v);
          setBusy(false);
          if (!r.ok) return toast.error(r.error);
          toast.success(`${v.name} added`);
          setV({ name: "", phone: "", role: "WAITER", shiftStart: "11:00", shiftEnd: "20:00" });
          onOpenChange(false);
          router.refresh();
        }}>
          <DialogBody className="space-y-3">
            <Field label="Name" htmlFor="en"><Input id="en" autoFocus value={v.name} onChange={set("name")} /></Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Phone" htmlFor="ep"><Input id="ep" inputMode="tel" value={v.phone} onChange={set("phone")} /></Field>
              <Field label="Role" htmlFor="er"><Select id="er" value={v.role} onChange={set("role")}>{(Object.keys(ROLE_LABEL) as Role[]).map((r) => <option key={r} value={r}>{ROLE_LABEL[r]}</option>)}</Select></Field>
              <Field label="Shift starts" htmlFor="es"><Input id="es" type="time" value={v.shiftStart} onChange={set("shiftStart")} /></Field>
              <Field label="Shift ends" htmlFor="ee"><Input id="ee" type="time" value={v.shiftEnd} onChange={set("shiftEnd")} /></Field>
            </div>
            <p className="text-xs text-fg-subtle">Login invitations are coming soon. For now this adds them to the roster.</p>
          </DialogBody>
          <DialogFooter><Button type="button" onClick={() => onOpenChange(false)}>Cancel</Button><Button type="submit" variant="primary" loading={busy}>Add employee</Button></DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
