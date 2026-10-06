"use client";
import Link from "next/link";
import { Check, X } from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils";
import type { SetupState } from "@/types/domain";

/** Subtle first-run checklist. Disappears once everything is done (or when dismissed for the session). */
export function SetupChecklist({ setup }: { setup: SetupState }) {
  const [hidden, setHidden] = useState(false);
  const items = [
    { label: "Add menu", done: setup.menu, href: "/menu" },
    { label: "Add tables", done: setup.tables, href: "/tables" },
    { label: "Configure tax", done: setup.tax, href: "/settings?tab=taxes" },
    { label: "Create first order", done: setup.firstOrder, href: "/pos" },
  ];
  if (hidden || items.every((i) => i.done)) return null;
  const done = items.filter((i) => i.done).length;
  return (
    <aside aria-label="Setup checklist" className="flex flex-wrap items-center gap-x-5 gap-y-2 rounded-lg border border-line bg-surface px-4 py-2.5">
      <p className="text-[13px] font-medium">Finish setup <span className="tnum font-normal text-fg-subtle">{done}/{items.length}</span></p>
      <ul className="flex flex-1 flex-wrap items-center gap-x-4 gap-y-1">
        {items.map((i) => (
          <li key={i.label}>
            <Link href={i.href} className={cn("group inline-flex items-center gap-1.5 text-[13px] transition-colors", i.done ? "text-fg-subtle" : "text-fg hover:text-brand")}>
              <span className={cn("grid size-4 place-items-center rounded-full border", i.done ? "border-brand bg-brand text-white" : "border-line-strong")}>{i.done && <Check className="size-2.5" strokeWidth={3} />}</span>
              <span className={cn(i.done && "line-through decoration-line-strong")}>{i.label}</span>
            </Link>
          </li>
        ))}
      </ul>
      <button type="button" onClick={() => setHidden(true)} aria-label="Dismiss checklist" className="grid size-6 place-items-center rounded text-fg-subtle hover:bg-muted"><X className="size-3.5" /></button>
    </aside>
  );
}
