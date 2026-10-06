import Link from "next/link";
import { Button } from "@/components/ui/button";
import { LogoMark } from "@/components/logo";

export default function NotFound() {
  return (
    <main id="main" className="grid min-h-dvh place-items-center px-6">
      <div className="text-center">
        <LogoMark className="mx-auto mb-5 size-8" />
        <p className="tnum text-xs font-medium text-fg-subtle">404</p>
        <h1 className="mt-1 text-xl font-semibold tracking-tight">This page doesn&apos;t exist</h1>
        <p className="mx-auto mt-1.5 max-w-xs text-[13px] text-fg-muted">The link may be old, or the page may have moved.</p>
        <Button asChild variant="primary" className="mt-5"><Link href="/overview">Back to Overview</Link></Button>
      </div>
    </main>
  );
}
