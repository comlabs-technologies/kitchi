import { Skeleton } from "@/components/ui/primitives";

export default function Loading() {
  return (
    <div className="mx-auto max-w-[1400px] space-y-6 px-4 py-5 sm:px-6" aria-busy="true" aria-label="Loading">
      <div className="space-y-2"><Skeleton className="h-6 w-48" /><Skeleton className="h-4 w-72" /></div>
      <div className="grid grid-cols-2 gap-6 lg:grid-cols-4">{Array.from({ length: 4 }).map((_, i) => <div key={i} className="space-y-2"><Skeleton className="h-3 w-20" /><Skeleton className="h-8 w-28" /><Skeleton className="h-3 w-24" /></div>)}</div>
      <Skeleton className="h-64 w-full" />
      <div className="grid gap-6 lg:grid-cols-3">{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-40" />)}</div>
    </div>
  );
}
