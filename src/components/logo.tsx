import Image from "next/image";
import { cn } from "@/lib/utils";

/** The K mark alone (collapsed sidebar, 404/error pages). */
export function LogoMark({ className }: { className?: string }) {
  return <Image src="/logo-mark.png" alt="Kitchi" width={312} height={308} priority className={cn("size-6 object-contain", className)} />;
}

/** Full Kitchi wordmark. Height is controlled with className (default h-5). */
export function Wordmark({ className, showText = true }: { className?: string; showText?: boolean }) {
  if (!showText) return <LogoMark className={className} />;
  return <Image src="/logo.png" alt="Kitchi" width={1319} height={324} priority style={{ width: "auto" }} className={cn("h-5 self-start", className)} />;
}
