import { Skeleton } from "@/components/ui/skeleton";

/**
 * Shown while a section's server component awaits Supabase. Without it the
 * router holds the previous page and navigation reads as a freeze.
 */
export function PageSkeleton({ rows = 6 }: { rows?: number }) {
  return (
    <div className="animate-in fade-in duration-200 motion-reduce:animate-none">
      <Skeleton className="h-9 w-56" />
      <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-28 rounded-3xl" />
        ))}
      </div>
      <div className="mt-4 space-y-2">
        {Array.from({ length: rows }).map((_, i) => (
          <Skeleton key={i} className="h-14 rounded-2xl" />
        ))}
      </div>
    </div>
  );
}
