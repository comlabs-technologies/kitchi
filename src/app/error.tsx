"use client";
import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { LogoMark } from "@/components/logo";

export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => console.error(error), [error]);
  return (
    <main id="main" className="grid min-h-dvh place-items-center px-6">
      <div className="text-center">
        <LogoMark className="mx-auto mb-5 size-8" />
        <h1 className="text-xl font-semibold tracking-tight">Something went wrong</h1>
        <p className="mx-auto mt-1.5 max-w-sm text-[13px] text-fg-muted">We hit an unexpected problem. Your orders are safe. Try again, and if it keeps happening let us know{error.digest ? ` (ref ${error.digest})` : ""}.</p>
        <div className="mt-5 flex justify-center gap-2">
          <Button variant="primary" onClick={reset}>Try again</Button>
          <Button onClick={() => (window.location.href = "/overview")}>Go to Overview</Button>
        </div>
      </div>
    </main>
  );
}
