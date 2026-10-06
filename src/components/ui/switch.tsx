"use client";
import * as S from "@radix-ui/react-switch";
import { cn } from "@/lib/utils";

export function Switch({ className, ...p }: React.ComponentPropsWithoutRef<typeof S.Root>) {
  return (
    <S.Root className={cn("relative h-5 w-9 shrink-0 rounded-full bg-line-strong transition-colors data-[state=checked]:bg-brand disabled:opacity-50", className)} {...p}>
      <S.Thumb className="block size-4 translate-x-0.5 rounded-full bg-white shadow-sm transition-transform duration-150 data-[state=checked]:translate-x-[18px]" />
    </S.Root>
  );
}
