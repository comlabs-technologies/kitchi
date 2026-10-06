"use client";
import * as T from "@radix-ui/react-tooltip";

export function Tooltip({ label, children, side = "right", shortcut }: { label: string; children: React.ReactNode; side?: "top" | "right" | "bottom" | "left"; shortcut?: string }) {
  return (
    <T.Provider delayDuration={250}>
      <T.Root>
        <T.Trigger asChild>{children}</T.Trigger>
        <T.Portal>
          <T.Content side={side} sideOffset={8} className="anim-pop z-[60] flex items-center gap-2 rounded-md bg-fg px-2 py-1 text-xs text-white shadow-pop">
            {label}
            {shortcut && <span className="rounded bg-white/15 px-1 text-[10px]">{shortcut}</span>}
          </T.Content>
        </T.Portal>
      </T.Root>
    </T.Provider>
  );
}
