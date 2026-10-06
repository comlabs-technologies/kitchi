import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

export const buttonVariants = cva(
  "inline-flex shrink-0 select-none items-center justify-center gap-1.5 whitespace-nowrap rounded-md text-[13px] font-medium transition-[background-color,border-color,color,transform] duration-150 active:translate-y-px disabled:pointer-events-none disabled:opacity-50",
  {
    variants: {
      variant: {
        primary: "bg-brand text-brand-fg hover:bg-brand-hover shadow-[0_1px_0_rgba(255,255,255,0.12)_inset]",
        secondary: "border border-line-strong bg-surface text-fg hover:bg-muted",
        ghost: "text-fg-muted hover:bg-muted hover:text-fg",
        danger: "bg-danger text-white hover:opacity-90",
        "danger-ghost": "text-danger hover:bg-danger-soft",
        soft: "bg-brand-soft text-brand hover:bg-[#d3e5dc]",
      },
      size: {
        xs: "h-6 px-2 text-xs",
        sm: "h-8 px-2.5",
        md: "h-9 px-3.5",
        lg: "h-11 px-5 text-sm",
        xl: "h-14 px-6 text-base",
        icon: "size-8",
        "icon-lg": "size-10",
      },
    },
    defaultVariants: { variant: "secondary", size: "md" },
  },
);

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement>, VariantProps<typeof buttonVariants> {
  asChild?: boolean;
  loading?: boolean;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { className, variant, size, asChild, loading, children, disabled, type = "button", ...props },
  ref,
) {
  const Comp = asChild ? Slot : "button";
  return (
    <Comp ref={ref} type={asChild ? undefined : type} disabled={disabled || loading} className={cn(buttonVariants({ variant, size }), className)} {...props}>
      {asChild ? children : (<>{loading && <Loader2 className="size-3.5 animate-spin" aria-hidden />}{children}</>)}
    </Comp>
  );
});
