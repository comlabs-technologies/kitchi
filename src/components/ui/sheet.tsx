"use client";
import * as React from "react";
import * as D from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

export const Sheet = D.Root;
export const SheetTrigger = D.Trigger;
export const SheetClose = D.Close;

/** Right-hand drawer on ≥ sm, full-width on phones. */
export function SheetContent({
  className, children, title, description, ...p
}: Omit<React.ComponentPropsWithoutRef<typeof D.Content>, "title"> & { title: React.ReactNode; description?: string }) {
  return (
    <D.Portal>
      <D.Overlay className="anim-overlay fixed inset-0 z-50 bg-[rgba(20,20,18,0.3)]" />
      <D.Content
        className={cn("anim-slide fixed inset-y-0 right-0 z-50 flex w-full max-w-[460px] flex-col border-l border-line bg-surface shadow-sheet focus:outline-none", className)}
        {...p}
      >
        <div className="flex items-start justify-between gap-3 border-b border-line px-5 py-3.5">
          <div className="min-w-0">
            <D.Title asChild><div className="text-[15px] font-semibold tracking-tight">{title}</div></D.Title>
            <D.Description className={description ? "mt-0.5 text-[13px] text-fg-muted" : "sr-only"}>{description ?? "Details"}</D.Description>
          </div>
          <D.Close className="-mr-1.5 grid size-7 shrink-0 place-items-center rounded-md text-fg-subtle transition-colors hover:bg-muted hover:text-fg" aria-label="Close">
            <X className="size-4" />
          </D.Close>
        </div>
        {children}
      </D.Content>
    </D.Portal>
  );
}
export const SheetBody = ({ className, ...p }: React.HTMLAttributes<HTMLDivElement>) => <div className={cn("scroll-thin min-h-0 flex-1 overflow-y-auto", className)} {...p} />;
export const SheetFooter = ({ className, ...p }: React.HTMLAttributes<HTMLDivElement>) => <div className={cn("flex items-center gap-2 border-t border-line px-5 py-3", className)} {...p} />;
