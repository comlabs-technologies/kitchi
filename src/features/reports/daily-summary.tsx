"use client";
import * as React from "react";
import { MessageCircle, Send } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/form";
import { formatMoney } from "@/lib/money";
import { formatLongDate, formatTime } from "@/lib/time";
import { cn, pct } from "@/lib/utils";
import { sendDailySummaryAction } from "@/server/actions/ops";
import type { DailySummary } from "@/server/services/overview";

export function DailySummaryCard({ s, defaultPhone }: { s: DailySummary; defaultPhone: string }) {
  const [phone, setPhone] = React.useState(defaultPhone);
  const [busy, setBusy] = React.useState(false);
  const send = async () => {
    setBusy(true);
    const r = await sendDailySummaryAction(phone);
    setBusy(false);
    if (!r.ok) return toast.error(r.error);
    toast.success(`Summary sent to ${phone}`, { description: "WhatsApp delivery is simulated in this MVP." });
  };
  const rows: [string, number][] = [["UPI", s.payments.UPI], ["Cash", s.payments.CASH], ["Card", s.payments.CARD]];
  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
      <article className="rounded-xl border border-line bg-surface">
        <header className="flex items-center justify-between border-b border-line px-6 py-3.5">
          <p className="text-[11px] font-semibold uppercase tracking-[0.1em] text-fg-muted">Today</p>
          <p className="text-xs text-fg-subtle">{s.outletName} · {formatLongDate(s.generatedAt)} · as of {formatTime(s.generatedAt)}</p>
        </header>
        <div className="grid gap-px bg-line sm:grid-cols-[1.3fr_1fr]">
          <div className="bg-surface px-6 py-6">
            <p className="text-xs font-medium text-fg-muted">Total sales</p>
            <p className="tnum mt-1.5 text-[44px] font-semibold leading-none tracking-[-0.04em]">{formatMoney(s.sales)}</p>
            <p className="tnum mt-3 text-[13px] text-fg-muted">{s.orders} orders · {formatMoney(s.aov)} average order</p>
            {s.deltaPct != null && <p className={cn("tnum mt-1.5 text-[13px] font-medium", s.deltaPct >= 0 ? "text-ok" : "text-danger")}>{pct(s.deltaPct)} sales compared with yesterday</p>}
          </div>
          <dl className="bg-surface px-6 py-6">
            <p className="mb-2 text-xs font-medium text-fg-muted">Collections</p>
            {rows.map(([k, v]) => <div key={k} className="flex items-baseline justify-between border-b border-line py-2 text-[13.5px] last:border-b-0"><dt className="text-fg-muted">{k}</dt><dd className="tnum font-semibold">{formatMoney(v)}</dd></div>)}
          </dl>
        </div>
        <div className="grid gap-px border-t border-line bg-line sm:grid-cols-2">
          <div className="bg-surface px-6 py-4"><p className="text-xs font-medium text-fg-muted">Top item</p>{s.topItem ? <p className="mt-1 text-[14px] font-semibold">{s.topItem.name} <span className="tnum font-normal text-fg-muted">· {s.topItem.qty} sold</span></p> : <p className="mt-1 text-[13px] text-fg-muted">Nothing sold yet</p>}</div>
          <div className="bg-surface px-6 py-4"><p className="text-xs font-medium text-fg-muted">Low stock</p>{s.lowStock.length ? <p className="mt-1 text-[14px] font-semibold">{s.lowStock.map((l) => l.name).join(", ")}</p> : <p className="mt-1 text-[13px] text-fg-muted">Everything looks healthy</p>}</div>
        </div>
      </article>

      <aside className="space-y-4">
        <div className="rounded-xl border border-line bg-surface p-4">
          <h3 className="flex items-center gap-2 text-[13px] font-semibold"><MessageCircle className="size-4 text-[#25a05a]" /> Send to WhatsApp</h3>
          <p className="mt-1 text-xs text-fg-muted">Get this digest on your phone. Delivery is mocked in the MVP.</p>
          <div className="mt-3 flex gap-2">
            <Input value={phone} onChange={(e) => setPhone(e.target.value)} inputMode="tel" aria-label="WhatsApp number" placeholder="+91 98XXX XXXXX" />
            <Button variant="primary" loading={busy} onClick={send} disabled={phone.replace(/\D/g, "").length < 10}><Send className="size-3.5" /> Send</Button>
          </div>
        </div>
        <div>
          <p className="mb-1.5 text-xs font-medium text-fg-muted">Message preview</p>
          <pre className="whitespace-pre-wrap rounded-xl rounded-tl-sm bg-[#e8f1ea] p-3.5 font-sans text-[12.5px] leading-relaxed text-fg">{s.whatsappText.replace(/\*/g, "")}</pre>
        </div>
      </aside>
    </div>
  );
}
