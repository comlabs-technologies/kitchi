import * as React from "react";
import { cn } from "@/lib/utils";

export function Skeleton({ className, ...p }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("skeleton", className)} aria-hidden {...p} />;
}

export function Kbd({ children, className }: { children: React.ReactNode; className?: string }) {
  return <kbd className={cn("inline-flex h-[18px] min-w-[18px] items-center justify-center rounded border border-line-strong bg-surface px-1 font-sans text-[10.5px] font-medium text-fg-muted", className)}>{children}</kbd>;
}

export function EmptyState({ icon, title, description, action, className }: { icon?: React.ReactNode; title: string; description?: string; action?: React.ReactNode; className?: string }) {
  return (
    <div className={cn("flex flex-col items-center justify-center px-6 py-14 text-center", className)}>
      {icon && <div className="mb-3 grid size-9 place-items-center rounded-lg border border-line bg-surface text-fg-subtle [&_svg]:size-4.5">{icon}</div>}
      <p className="text-[13.5px] font-medium">{title}</p>
      {description && <p className="mt-1 max-w-sm text-[13px] text-fg-muted">{description}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

/** Indian food-safety style veg / non-veg marker. */
export function FoodMark({ type, className }: { type: "VEG" | "NON_VEG" | "EGG"; className?: string }) {
  const color = type === "VEG" ? "#2c7552" : type === "NON_VEG" ? "#b2432f" : "#a8741a";
  return (
    <span className={cn("inline-grid size-[13px] shrink-0 place-items-center rounded-[3px] border-[1.5px]", className)} style={{ borderColor: color }} role="img" aria-label={type === "VEG" ? "Vegetarian" : type === "NON_VEG" ? "Non-vegetarian" : "Contains egg"}>
      <span className="size-[5px] rounded-full" style={{ background: color }} />
    </span>
  );
}

export function PageHeader({ title, description, actions, children, sticky = true }: { title: React.ReactNode; description?: React.ReactNode; actions?: React.ReactNode; children?: React.ReactNode; sticky?: boolean }) {
  return (
    <header className={cn("z-10 border-b border-line bg-background/90 backdrop-blur supports-[backdrop-filter]:bg-background/80", sticky && "sticky top-0")}>
      <div className="mx-auto flex max-w-[1400px] flex-wrap items-center justify-between gap-x-4 gap-y-2 px-4 py-3 sm:px-6">
        <div className="min-w-0">
          <h1 className="truncate text-[17px] font-semibold tracking-tight">{title}</h1>
          {description && <p className="mt-0.5 text-[13px] text-fg-muted">{description}</p>}
        </div>
        {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
      </div>
      {children && <div className="mx-auto max-w-[1400px] px-4 pb-2.5 sm:px-6">{children}</div>}
    </header>
  );
}

export function PageBody({ children, className, wide }: { children: React.ReactNode; className?: string; wide?: boolean }) {
  return <div className={cn("mx-auto w-full px-4 py-5 sm:px-6", wide ? "max-w-none" : "max-w-[1400px]", className)}>{children}</div>;
}

export function Section({ title, action, children, className }: { title?: React.ReactNode; action?: React.ReactNode; children: React.ReactNode; className?: string }) {
  return (
    <section className={className}>
      {(title || action) && (
        <div className="mb-2.5 flex items-center justify-between gap-3">
          {title && <h2 className="text-[13px] font-semibold tracking-tight">{title}</h2>}
          {action}
        </div>
      )}
      {children}
    </section>
  );
}

/** Segmented control (filters / range pickers). */
export function Segmented<T extends string>({ value, onChange, options, size = "md", label }: { value: T; onChange: (v: T) => void; options: { value: T; label: React.ReactNode }[]; size?: "sm" | "md" | "lg"; label?: string }) {
  return (
    <div role="radiogroup" aria-label={label} className="inline-flex rounded-lg bg-muted p-0.5">
      {options.map((o) => {
        const on = o.value === value;
        return (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={on}
            onClick={() => onChange(o.value)}
            className={cn("rounded-md font-medium transition-colors", size === "sm" ? "px-2.5 py-1 text-xs" : size === "lg" ? "px-4 py-2 text-sm" : "px-3 py-1 text-[13px]", on ? "bg-surface text-fg shadow-[0_0_0_1px_var(--border),0_1px_2px_rgba(20,20,18,0.05)]" : "text-fg-muted hover:text-fg")}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

export function Stat({ label, value, sub, tone }: { label: string; value: React.ReactNode; sub?: React.ReactNode; tone?: "up" | "down" | "muted" }) {
  return (
    <div className="min-w-0">
      <p className="text-xs font-medium text-fg-muted">{label}</p>
      <p className="tnum mt-1 truncate text-[26px] font-semibold leading-none tracking-tight">{value}</p>
      {sub && <p className={cn("tnum mt-1.5 text-xs", tone === "up" ? "text-ok" : tone === "down" ? "text-danger" : "text-fg-muted")}>{sub}</p>}
    </div>
  );
}
