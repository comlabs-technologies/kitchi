"use client";
import * as React from "react";
import * as D from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

export const Dialog = D.Root;
export const DialogTrigger = D.Trigger;
export const DialogClose = D.Close;

export function DialogContent({
  className, children, title, description, hideClose, ...p
}: React.ComponentPropsWithoutRef<typeof D.Content> & { title: string; description?: string; hideClose?: boolean }) {
  return (
    <D.Portal>
      <D.Overlay className="anim-overlay fixed inset-0 z-50 bg-[rgba(20,20,18,0.38)]" />
      <D.Content
        className={cn("anim-pop fixed left-1/2 top-1/2 z-50 flex max-h-[min(88vh,720px)] w-[calc(100vw-24px)] max-w-md -translate-x-1/2 -translate-y-1/2 flex-col rounded-xl border border-line bg-surface shadow-pop focus:outline-none", className)}
        {...p}
      >
        <div className="flex items-start justify-between gap-3 border-b border-line px-5 py-3.5">
          <div className="min-w-0">
            <D.Title className="text-[15px] font-semibold tracking-tight">{title}</D.Title>
            {description ? <D.Description className="mt-0.5 text-[13px] text-fg-muted">{description}</D.Description> : <D.Description className="sr-only">{title}</D.Description>}
          </div>
          {!hideClose && (
            <D.Close className="-mr-1.5 grid size-7 shrink-0 place-items-center rounded-md text-fg-subtle transition-colors hover:bg-muted hover:text-fg" aria-label="Close">
              <X className="size-4" />
            </D.Close>
          )}
        </div>
        {children}
      </D.Content>
    </D.Portal>
  );
}

export const DialogBody = ({ className, ...p }: React.HTMLAttributes<HTMLDivElement>) => <div className={cn("scroll-thin min-h-0 flex-1 overflow-y-auto px-5 py-4", className)} {...p} />;
export const DialogFooter = ({ className, ...p }: React.HTMLAttributes<HTMLDivElement>) => <div className={cn("flex items-center justify-end gap-2 border-t border-line px-5 py-3", className)} {...p} />;
