"use client";
import * as React from "react";
import { ArrowDown, ArrowUp, ChevronsUpDown } from "lucide-react";
import { cn } from "@/lib/utils";

export function Table({ className, ...p }: React.HTMLAttributes<HTMLTableElement>) {
  return (
    <div className="overflow-x-auto rounded-xl border border-line bg-surface scroll-thin">
      <table className={cn("w-full min-w-max border-collapse text-[13px]", className)} {...p} />
    </div>
  );
}
export const THead = (p: React.HTMLAttributes<HTMLTableSectionElement>) => <thead className="border-b border-line bg-muted/50" {...p} />;
export const TBody = (p: React.HTMLAttributes<HTMLTableSectionElement>) => <tbody className="divide-y divide-line" {...p} />;

export function Tr({ className, onClick, ...p }: React.HTMLAttributes<HTMLTableRowElement> & { onClick?: () => void }) {
  return (
    <tr
      onClick={onClick}
      onKeyDown={onClick ? (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onClick(); } } : undefined}
      tabIndex={onClick ? 0 : undefined}
      className={cn("transition-colors", onClick && "cursor-pointer hover:bg-muted/60 focus-visible:bg-muted/60 focus-visible:outline-none", className)}
      {...p}
    />
  );
}

export function Th({ className, align = "left", children, sort, sortKey, ...p }: React.ThHTMLAttributes<HTMLTableCellElement> & { align?: "left" | "right" | "center"; sort?: SortState; sortKey?: string }) {
  const active = sort && sortKey && sort.key === sortKey;
  return (
    <th
      scope="col"
      aria-sort={active ? (sort.dir === "asc" ? "ascending" : "descending") : undefined}
      className={cn("whitespace-nowrap px-3.5 py-2 text-xs font-medium text-fg-muted", align === "right" && "text-right", align === "center" && "text-center", className)}
      {...p}
    >
      {sort && sortKey ? (
        <button type="button" onClick={() => sort.toggle(sortKey)} className={cn("inline-flex items-center gap-1 rounded transition-colors hover:text-fg", align === "right" && "flex-row-reverse", active && "text-fg")}>
          {children}
          {active ? (sort.dir === "asc" ? <ArrowUp className="size-3" /> : <ArrowDown className="size-3" />) : <ChevronsUpDown className="size-3 opacity-40" />}
        </button>
      ) : children}
    </th>
  );
}
export const Td = ({ className, align = "left", ...p }: React.TdHTMLAttributes<HTMLTableCellElement> & { align?: "left" | "right" | "center" }) => (
  <td className={cn("whitespace-nowrap px-3.5 py-2.5", align === "right" && "text-right", align === "center" && "text-center", className)} {...p} />
);

export interface SortState {
  key: string;
  dir: "asc" | "desc";
  toggle: (k: string) => void;
}

export function useSort<T>(rows: T[], accessors: Record<string, (r: T) => string | number | undefined>, initial: { key: string; dir: "asc" | "desc" }) {
  const [state, setState] = React.useState(initial);
  const sorted = React.useMemo(() => {
    const get = accessors[state.key];
    if (!get) return rows;
    const m = state.dir === "asc" ? 1 : -1;
    return [...rows].sort((a, b) => {
      const x = get(a), y = get(b);
      if (x == null && y == null) return 0;
      if (x == null) return 1;
      if (y == null) return -1;
      return (typeof x === "number" && typeof y === "number" ? x - y : String(x).localeCompare(String(y), undefined, { numeric: true })) * m;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows, state]);
  const sort: SortState = { ...state, toggle: (k) => setState((s) => (s.key === k ? { key: k, dir: s.dir === "asc" ? "desc" : "asc" } : { key: k, dir: "desc" })) };
  return { sorted, sort };
}

export function SearchInput({ value, onChange, placeholder = "Search", className }: { value: string; onChange: (v: string) => void; placeholder?: string; className?: string }) {
  return (
    <div className={cn("relative", className)}>
      <svg className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-fg-subtle" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></svg>
      <input value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} aria-label={placeholder} className="h-8 w-full rounded-md border border-line-strong bg-surface pl-8 pr-2.5 text-[13px] placeholder:text-fg-subtle hover:border-[#c3c0b6] focus:border-brand focus:outline-none focus:ring-2 focus:ring-[var(--ring)]" />
    </div>
  );
}
