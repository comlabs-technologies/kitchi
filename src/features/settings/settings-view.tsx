"use client";
import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Check, Minus, Printer } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Field, Input, Select, Textarea } from "@/components/ui/form";
import { Switch } from "@/components/ui/switch";
import { Table, TBody, Td, Th, THead } from "@/components/ui/table";
import { browserPrintService } from "@/features/pos/print-service";
import { cn } from "@/lib/utils";
import { updateOutletAction, updateRestaurantAction, updateSettingsAction } from "@/server/actions/ops";
import type { Order, Outlet, OutletSettings, Restaurant, Role } from "@/types/domain";

import { SETTINGS_TABS } from "./tabs";

interface Props {
  tab: string;
  canManage: boolean;
  restaurant: Restaurant;
  outlet: Outlet;
  settings: OutletSettings;
  roles: { role: Role; label: string; permissions: string[] }[];
  permissions: { id: string; label: string }[];
  members: { name: string; role: string; outlets: string }[];
}

export function SettingsView(p: Props) {
  return (
    <div className="grid gap-8 md:grid-cols-[180px_minmax(0,1fr)]">
      <nav aria-label="Settings" className="scroll-none -mx-4 flex gap-1 overflow-x-auto px-4 md:mx-0 md:block md:space-y-0.5 md:px-0">
        {SETTINGS_TABS.map((t) => (
          <Link key={t.id} href={`/settings?tab=${t.id}`} scroll={false} aria-current={p.tab === t.id ? "page" : undefined} className={cn("block shrink-0 rounded-md px-2.5 py-1.5 text-[13px] font-medium transition-colors", p.tab === t.id ? "bg-muted-2/70 text-fg" : "text-fg-muted hover:bg-muted hover:text-fg")}>{t.label}</Link>
        ))}
      </nav>
      <div className="min-w-0 max-w-2xl">
        {!p.canManage && p.tab !== "roles" && p.tab !== "billing" && <p className="mb-5 rounded-lg bg-warn-soft px-3.5 py-2.5 text-[13px] text-warn">Only owners can change these settings. You&apos;re viewing them read-only.</p>}
        {p.tab === "restaurant" && <RestaurantForm {...p} />}
        {p.tab === "outlet" && <OutletForm {...p} />}
        {p.tab === "taxes" && <TaxForm {...p} />}
        {p.tab === "payments" && <PaymentsForm {...p} />}
        {p.tab === "printers" && <PrintersForm {...p} />}
        {p.tab === "roles" && <Roles {...p} />}
        {p.tab === "billing" && <Billing />}
      </div>
    </div>
  );
}

function Section({ title, description, children, footer }: { title: string; description?: string; children: React.ReactNode; footer?: React.ReactNode }) {
  return (
    <section>
      <h2 className="text-[15px] font-semibold tracking-tight">{title}</h2>
      {description && <p className="mt-1 text-[13px] text-fg-muted">{description}</p>}
      <div className="mt-5 space-y-4">{children}</div>
      {footer && <div className="mt-6 border-t border-line pt-4">{footer}</div>}
    </section>
  );
}

function useSave(fn: () => Promise<{ ok: boolean } & ({ error: string } | { data?: unknown })>, ok = "Settings saved") {
  const router = useRouter();
  const [busy, setBusy] = React.useState(false);
  return {
    busy,
    save: async () => {
      setBusy(true);
      const r = await fn();
      setBusy(false);
      if (!r.ok) return toast.error((r as { error: string }).error);
      toast.success(ok);
      router.refresh();
    },
  };
}

function RestaurantForm({ restaurant, canManage }: Props) {
  const [name, setName] = React.useState(restaurant.name);
  const [legal, setLegal] = React.useState(restaurant.legalName ?? "");
  const { busy, save } = useSave(() => updateRestaurantAction({ name, legalName: legal }));
  return (
    <Section title="Restaurant" description="How your business appears on receipts and in Kitchi." footer={<Button variant="primary" onClick={save} loading={busy} disabled={!canManage}>Save changes</Button>}>
      <Field label="Restaurant name" htmlFor="rn"><Input id="rn" value={name} onChange={(e) => setName(e.target.value)} disabled={!canManage} /></Field>
      <Field label="Legal / billing name" htmlFor="rl" hint="Printed on invoices"><Input id="rl" value={legal} onChange={(e) => setLegal(e.target.value)} disabled={!canManage} /></Field>
      <div><span className="mb-1 block text-xs font-medium text-fg-muted">Type</span><Badge tone="neutral">{restaurant.type.replace("_", " ").toLowerCase().replace(/^\w/, (c) => c.toUpperCase())}</Badge></div>
    </Section>
  );
}

function OutletForm({ outlet, canManage }: Props) {
  const [v, setV] = React.useState({ name: outlet.name, city: outlet.city, address: outlet.address, phone: outlet.phone, fssai: outlet.fssai ?? "" });
  const set = (k: keyof typeof v) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setV((s) => ({ ...s, [k]: e.target.value }));
  const { busy, save } = useSave(() => updateOutletAction(v));
  return (
    <Section title="Outlet" description="Details for the outlet you're currently working in." footer={<Button variant="primary" onClick={save} loading={busy} disabled={!canManage}>Save changes</Button>}>
      <div className="grid gap-4 sm:grid-cols-2"><Field label="Outlet name" htmlFor="on"><Input id="on" value={v.name} onChange={set("name")} disabled={!canManage} /></Field><Field label="City" htmlFor="oc"><Input id="oc" value={v.city} onChange={set("city")} disabled={!canManage} /></Field></div>
      <Field label="Address" htmlFor="oa"><Textarea id="oa" value={v.address} onChange={set("address")} disabled={!canManage} /></Field>
      <div className="grid gap-4 sm:grid-cols-2"><Field label="Phone" htmlFor="op"><Input id="op" value={v.phone} onChange={set("phone")} disabled={!canManage} /></Field><Field label="FSSAI licence" htmlFor="of"><Input id="of" value={v.fssai} onChange={set("fssai")} disabled={!canManage} /></Field></div>
    </Section>
  );
}

function TaxForm({ restaurant, canManage }: Props) {
  const [gst, setGst] = React.useState(restaurant.gstEnabled);
  const [gstin, setGstin] = React.useState(restaurant.gstin ?? "");
  const [rate, setRate] = React.useState(String(restaurant.defaultTaxRate));
  const { busy, save } = useSave(() => updateRestaurantAction({ gstEnabled: gst, gstin, defaultTaxRate: Number(rate) }));
  const bad = gst && gstin !== "" && !/^\d{2}[A-Z]{5}\d{4}[A-Z][A-Z\d]Z[A-Z\d]$/.test(gstin.toUpperCase());
  return (
    <Section title="Taxes" description="GST is added on top of item prices at billing." footer={<Button variant="primary" onClick={save} loading={busy} disabled={!canManage || bad}>Save changes</Button>}>
      <label className="flex items-center justify-between rounded-lg border border-line px-4 py-3"><span><span className="block text-[13.5px] font-medium">Charge GST</span><span className="block text-xs text-fg-muted">Turn off if you&apos;re not registered.</span></span><Switch checked={gst} onCheckedChange={setGst} disabled={!canManage} aria-label="Charge GST" /></label>
      {gst && (<>
        <Field label="GSTIN" htmlFor="gs" error={bad ? "That doesn't look like a valid GSTIN" : undefined} hint="15 characters, e.g. 27AAKFK1234F1Z5"><Input id="gs" value={gstin} onChange={(e) => setGstin(e.target.value.toUpperCase())} maxLength={15} disabled={!canManage} aria-invalid={bad} className="uppercase" /></Field>
        <Field label="Default GST rate for new items" htmlFor="gr"><Select id="gr" value={rate} onChange={(e) => setRate(e.target.value)} disabled={!canManage}>{[0, 5, 12, 18].map((r) => <option key={r} value={r}>{r}%</option>)}</Select></Field>
        <p className="text-xs text-fg-subtle">Each menu item has its own rate. Restaurants typically bill 5% on food and 18% on packaged drinks.</p>
      </>)}
    </Section>
  );
}

function PaymentsForm({ settings, canManage }: Props) {
  const [s, setS] = React.useState({ acceptUpi: settings.acceptUpi, acceptCash: settings.acceptCash, acceptCard: settings.acceptCard, upiId: settings.upiId });
  const { busy, save } = useSave(() => updateSettingsAction(s));
  const none = !s.acceptUpi && !s.acceptCash && !s.acceptCard;
  const rows: [keyof typeof s, string, string][] = [["acceptUpi", "UPI", "Show your UPI ID when charging."], ["acceptCash", "Cash", "With change calculation."], ["acceptCard", "Card", "Confirm after your card machine approves."]];
  return (
    <Section title="Payments" description="Choose what the POS offers at checkout." footer={<Button variant="primary" onClick={save} loading={busy} disabled={!canManage || none}>Save changes</Button>}>
      <div className="divide-y divide-line rounded-lg border border-line">
        {rows.map(([k, l, d]) => <label key={k} className="flex items-center justify-between px-4 py-3"><span><span className="block text-[13.5px] font-medium">{l}</span><span className="block text-xs text-fg-muted">{d}</span></span><Switch checked={s[k] as boolean} onCheckedChange={(v) => setS((x) => ({ ...x, [k]: v }))} disabled={!canManage} aria-label={l} /></label>)}
      </div>
      {none && <p className="text-xs text-danger">Enable at least one payment method.</p>}
      <Field label="UPI ID" htmlFor="up" hint="Dynamic QR codes and gateway reconciliation are coming soon."><Input id="up" value={s.upiId} onChange={(e) => setS((x) => ({ ...x, upiId: e.target.value }))} placeholder="business@bank" disabled={!canManage} /></Field>
    </Section>
  );
}

function PrintersForm({ settings, canManage, restaurant, outlet }: Props) {
  const [s, setS] = React.useState({ autoPrintKot: settings.autoPrintKot, receiptFooter: settings.receiptFooter });
  const { busy, save } = useSave(() => updateSettingsAction(s));
  const sample = (): Order => ({
    id: "t", outletId: "", number: 1001, type: "DINE_IN", tableName: "T4", status: "OPEN", paymentStatus: "PAID", createdBy: "Test", createdAt: Date.now(), updatedAt: Date.now(), events: [],
    items: [{ id: "1", menuItemId: "x", name: "Chicken Biryani", unitPrice: 27000, basePrice: 27000, qty: 2, taxRate: 5, foodType: "NON_VEG", modifiers: [] }, { id: "2", menuItemId: "y", name: "Cold Coffee", variantName: "Large", unitPrice: 23000, basePrice: 19000, qty: 1, taxRate: 5, foodType: "VEG", modifiers: [{ name: "Extra Shot", price: 4000 }] }],
    subtotal: 77000, discount: 0, tax: 3850, roundOff: 150, total: 81000, payments: [{ id: "p", orderId: "t", method: "UPI", amount: 81000, createdAt: Date.now() }],
  });
  const meta = { restaurant: restaurant.name, outlet: outlet.name, address: outlet.address, gstin: restaurant.gstin, footer: s.receiptFooter };
  return (
    <Section title="Printers" description="Receipts and KOTs print through your browser's print dialog for now." footer={<Button variant="primary" onClick={save} loading={busy} disabled={!canManage}>Save changes</Button>}>
      <label className="flex items-center justify-between rounded-lg border border-line px-4 py-3"><span><span className="block text-[13.5px] font-medium">Auto-print KOT</span><span className="block text-xs text-fg-muted">Open the print dialog whenever a KOT is sent.</span></span><Switch checked={s.autoPrintKot} onCheckedChange={(v) => setS((x) => ({ ...x, autoPrintKot: v }))} disabled={!canManage} aria-label="Auto-print KOT" /></label>
      <Field label="Receipt footer" htmlFor="rf"><Input id="rf" value={s.receiptFooter} onChange={(e) => setS((x) => ({ ...x, receiptFooter: e.target.value }))} disabled={!canManage} maxLength={120} /></Field>
      <div className="flex flex-wrap gap-2">
        <Button size="sm" onClick={() => void browserPrintService.printReceipt(sample(), meta)}><Printer className="size-3.5" /> Print test receipt</Button>
        <Button size="sm" onClick={() => void browserPrintService.printKOT(sample(), meta)}><Printer className="size-3.5" /> Print test KOT</Button>
      </div>
      <p className="text-xs text-fg-subtle">Network and USB thermal printers (ESC/POS) are coming soon.</p>
    </Section>
  );
}

function Roles({ roles, permissions, members }: Props) {
  return (
    <Section title="Users & roles" description="What each role can do. Permissions are enforced on the server for every page and action.">
      <Table>
        <THead><tr><Th>Permission</Th>{roles.map((r) => <Th key={r.role} align="center">{r.label}</Th>)}</tr></THead>
        <TBody>
          {permissions.map((perm) => (
            <tr key={perm.id}><Td className="text-fg-muted">{perm.label}</Td>{roles.map((r) => <Td key={r.role} align="center">{r.permissions.includes(perm.id) ? <Check className="mx-auto size-3.5 text-brand" aria-label="Allowed" /> : <Minus className="mx-auto size-3.5 text-line-strong" aria-label="Not allowed" />}</Td>)}</tr>
          ))}
        </TBody>
      </Table>
      <div>
        <h3 className="mb-2 mt-2 text-[13px] font-semibold">Team</h3>
        <ul className="divide-y divide-line rounded-lg border border-line text-[13px]">{members.map((m) => <li key={m.name} className="flex items-center justify-between px-4 py-2.5"><span className="font-medium">{m.name}</span><span className="text-fg-muted">{m.role} · {m.outlets}</span></li>)}</ul>
        <p className="mt-2 text-xs text-fg-subtle">Invite users and custom roles — coming soon.</p>
      </div>
    </Section>
  );
}

function Billing() {
  return (
    <Section title="Billing" description="Your Kitchi subscription.">
      <div className="rounded-lg border border-line p-4">
        <div className="flex items-center justify-between"><div><p className="text-[13.5px] font-semibold">Growth plan</p><p className="text-xs text-fg-muted">2 outlets · unlimited orders</p></div><Badge tone="brand">Demo</Badge></div>
        <dl className="mt-4 grid grid-cols-3 gap-4 text-[13px]"><div><dt className="text-xs text-fg-muted">Outlets</dt><dd className="tnum mt-0.5 font-medium">2 of 3</dd></div><div><dt className="text-xs text-fg-muted">Seats</dt><dd className="tnum mt-0.5 font-medium">4 of 10</dd></div><div><dt className="text-xs text-fg-muted">Renews</dt><dd className="mt-0.5 font-medium">—</dd></div></dl>
      </div>
      <div className="flex gap-2"><Button disabled>Manage plan · Coming soon</Button><Button disabled>Invoices · Coming soon</Button></div>
      <p className="text-xs text-fg-subtle">Billing is a placeholder in this MVP. No payment details are collected.</p>
    </Section>
  );
}
