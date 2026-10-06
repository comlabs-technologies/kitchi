import { cn } from "@/lib/utils";

export function LogoMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={cn("size-6", className)} aria-hidden>
      <rect width="24" height="24" rx="6.5" fill="var(--brand)" />
      <path d="M8 6.5v11M8 12l6.2-5.5M10.6 10 15.5 17.5" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" fill="none" />
    </svg>
  );
}

export function Wordmark({ className, showText = true }: { className?: string; showText?: boolean }) {
  return (
    <span className={cn("inline-flex items-center gap-2", className)}>
      <LogoMark />
      {showText && <span className="text-[15px] font-semibold tracking-[-0.03em]">Kitchi</span>}
    </span>
  );
}
