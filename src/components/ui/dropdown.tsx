"use client";
import * as React from "react";
import * as M from "@radix-ui/react-dropdown-menu";
import { cn } from "@/lib/utils";

export const Dropdown = M.Root;
export const DropdownTrigger = M.Trigger;
export const DropdownLabel = ({ className, ...p }: React.ComponentPropsWithoutRef<typeof M.Label>) => <M.Label className={cn("px-2 py-1.5 text-[11px] font-medium uppercase tracking-wide text-fg-subtle", className)} {...p} />;
export const DropdownSeparator = () => <M.Separator className="-mx-1 my-1 h-px bg-line" />;

export function DropdownContent({ className, align = "end", sideOffset = 6, ...p }: React.ComponentPropsWithoutRef<typeof M.Content>) {
  return (
    <M.Portal>
      <M.Content align={align} sideOffset={sideOffset} className={cn("anim-pop z-50 min-w-[190px] rounded-lg border border-line bg-surface p-1 shadow-pop", className)} {...p} />
    </M.Portal>
  );
}

export function DropdownItem({ className, danger, icon, shortcut, children, ...p }: React.ComponentPropsWithoutRef<typeof M.Item> & { danger?: boolean; icon?: React.ReactNode; shortcut?: string }) {
  return (
    <M.Item
      className={cn("flex cursor-pointer select-none items-center gap-2 rounded-md px-2 py-1.5 text-[13px] outline-none transition-colors data-[disabled]:pointer-events-none data-[disabled]:opacity-40 data-[highlighted]:bg-muted", danger ? "text-danger data-[highlighted]:bg-danger-soft" : "text-fg", className)}
      {...p}
    >
      {icon && <span className="grid size-4 place-items-center text-fg-subtle [&_svg]:size-4">{icon}</span>}
      <span className="flex-1">{children}</span>
      {shortcut && <span className="text-[11px] text-fg-subtle">{shortcut}</span>}
    </M.Item>
  );
}
