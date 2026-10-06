"use client";
import { useEffect } from "react";
import { TriangleAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/primitives";

export default function SectionError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => console.error(error), [error]);
  return (
    <EmptyState className="min-h-[60vh]" icon={<TriangleAlert />} title="We couldn't load this page" description="This is on us. Nothing was lost — try again." action={<Button variant="secondary" onClick={reset}>Try again</Button>} />
  );
}
