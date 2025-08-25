import { Skeleton } from "@/components/ui/skeleton";
import { Card } from "@/components/ui/card";

export function ReceiveStockFormSkeleton() {
  return (
    <Card className="p-4 md:p-6 space-y-8">
      {/* Header Section Skeleton */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="space-y-2">
          <Skeleton className="h-4 w-20" />
          <Skeleton className="h-10 w-full" />
        </div>
        <div className="space-y-2">
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-10 w-full" />
        </div>
      </div>

      {/* Items Section Skeleton */}
      <div>
        <Skeleton className="h-6 w-32 mb-2" />
        <div className="space-y-4">
          <div className="grid grid-cols-12 gap-2 items-start border p-4 rounded-md">
            <div className="col-span-12 md:col-span-5 space-y-2">
              <Skeleton className="h-4 w-20" />
              <Skeleton className="h-10 w-full" />
            </div>
            <div className="col-span-6 md:col-span-3 space-y-2">
              <Skeleton className="h-4 w-16" />
              <Skeleton className="h-10 w-full" />
            </div>
            <div className="col-span-6 md:col-span-3 space-y-2">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-10 w-full" />
            </div>
            <div className="col-span-12 md:col-span-1 flex items-end">
              <Skeleton className="h-10 w-10" />
            </div>
          </div>
        </div>
        <Skeleton className="h-9 w-28 mt-4" />
      </div>

      {/* Finalization Section Skeleton */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 border-t pt-6">
        <div className="space-y-2">
          <Skeleton className="h-4 w-40" />
          <Skeleton className="h-10 w-full" />
        </div>
        <div className="space-y-3">
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-10 w-40" />
        </div>
      </div>
      <Skeleton className="h-12 w-40" />
    </Card>
  );
}
