"use client";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useTransition } from "react";
import { Segmented } from "@/components/ui/primitives";

export function RangeTabs({ value, options, param = "range", size = "md" }: { value: string; options: { value: string; label: string }[]; param?: string; size?: "sm" | "md" }) {
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();
  const [pending, start] = useTransition();
  return (
    <div className={pending ? "opacity-70 transition-opacity" : "transition-opacity"}>
      <Segmented
        label="Date range"
        size={size}
        value={value}
        options={options}
        onChange={(v) => {
          const next = new URLSearchParams(sp.toString());
          next.set(param, v);
          if (v !== "custom") { next.delete("from"); next.delete("to"); }
          start(() => router.replace(`${pathname}?${next.toString()}`, { scroll: false }));
        }}
      />
    </div>
  );
}
