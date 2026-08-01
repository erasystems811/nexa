import { Skeleton } from "@/components/ui/skeleton";

/** Vendor-application skeleton — a heading and a stack of form fields. */
export default function Loading() {
  return (
    <div className="mx-auto max-w-2xl px-5 py-12">
      <Skeleton className="h-8 w-1/2" />
      <div className="mt-8 space-y-5">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="space-y-2">
            <Skeleton className="h-3 w-24" />
            <Skeleton className="h-11 w-full" />
          </div>
        ))}
      </div>
    </div>
  );
}
