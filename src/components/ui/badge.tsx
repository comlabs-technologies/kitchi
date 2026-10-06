import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const badge = cva("inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2 py-0.5 text-[11px] font-medium leading-4", {
  variants: {
    tone: {
      neutral: "bg-muted text-fg-muted",
      brand: "bg-brand-soft text-brand",
      ok: "bg-ok-soft text-ok",
      warn: "bg-warn-soft text-warn",
      danger: "bg-danger-soft text-danger",
      outline: "border border-line-strong text-fg-muted",
    },
  },
  defaultVariants: { tone: "neutral" },
});

export function Badge({ className, tone, dot, children, ...p }: React.HTMLAttributes<HTMLSpanElement> & VariantProps<typeof badge> & { dot?: boolean }) {
  return (
    <span className={cn(badge({ tone }), className)} {...p}>
      {dot && <span className="size-1.5 rounded-full bg-current opacity-80" aria-hidden />}
      {children}
    </span>
  );
}
