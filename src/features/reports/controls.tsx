"use client";
import * as React from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Download } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/form";
import { RangeTabs } from "@/features/overview/range-tabs";
import { cn } from "@/lib/utils";

export function ReportTabs({ tabs, value }: { tabs: { value: string; label: string }[]; value: string }) {
  const sp = useSearchParams();
  return (
    <nav aria-label="Reports" className="scroll-none -mx-1 flex gap-1 overflow-x-auto px-1">
      {tabs.map((t) => {
        const p = new URLSearchParams(sp.toString());
        p.set("tab", t.value);
        const on = t.value === value;
        return (
          <Link key={t.value} href={`/reports?${p.toString()}`} scroll={false} aria-current={on ? "page" : undefined} className={cn("relative shrink-0 px-3 py-2 text-[13px] font-medium transition-colors", on ? "text-fg" : "text-fg-muted hover:text-fg")}>
            {t.label}
            {on && <span className="absolute inset-x-3 -bottom-px h-0.5 rounded-full bg-brand" />}
          </Link>
        );
      })}
    </nav>
  );
}

const RANGES = [{ value: "today", label: "Today" }, { value: "yesterday", label: "Yesterday" }, { value: "7d", label: "7 days" }, { value: "30d", label: "30 days" }, { value: "custom", label: "Custom" }];

export function ReportRange({ value, from, to }: { value: string; from?: string; to?: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();
  const [f, setF] = React.useState(from ?? "");
  const [t, setT] = React.useState(to ?? "");
  const apply = (nf: string, nt: string) => {
    if (!nf || !nt) return;
    const p = new URLSearchParams(sp.toString());
    p.set("range", "custom"); p.set("from", nf); p.set("to", nt);
    router.replace(`${pathname}?${p.toString()}`, { scroll: false });
  };
  return (
    <div className="flex flex-wrap items-center gap-2">
      <RangeTabs value={value} options={RANGES} size="sm" />
      {value === "custom" && (
        <div className="flex items-center gap-1.5">
          <Input type="date" aria-label="From date" className="h-8 w-[140px]" value={f} max={t || undefined} onChange={(e) => { setF(e.target.value); apply(e.target.value, t); }} />
          <span className="text-fg-subtle">–</span>
          <Input type="date" aria-label="To date" className="h-8 w-[140px]" value={t} min={f || undefined} onChange={(e) => { setT(e.target.value); apply(f, e.target.value); }} />
        </div>
      )}
    </div>
  );
}

export function ExportCsv({ filename, rows }: { filename: string; rows: (string | number)[][] }) {
  return (
    <Button
      size="sm"
      onClick={() => {
        const esc = (v: string | number) => `"${String(v).replace(/"/g, '""')}"`;
        const blob = new Blob([rows.map((r) => r.map(esc).join(",")).join("\n")], { type: "text/csv;charset=utf-8" });
        const a = document.createElement("a");
        a.href = URL.createObjectURL(blob);
        a.download = `${filename}.csv`;
        a.click();
        URL.revokeObjectURL(a.href);
        toast.success("Report exported");
      }}
    >
      <Download className="size-3.5" /> Export CSV
    </Button>
  );
}
