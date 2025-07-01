import { Skeleton } from "./skeleton";

interface TableSkeletonProps {
  rows?: number;
  columns?: number;
  showHeader?: boolean;
}

export function TableSkeleton({
  rows = 5,
  columns = 5,
  showHeader = true,
}: TableSkeletonProps) {
  return (
    <div className="w-full">
      {/* Header skeleton */}
      {showHeader && (
        <div className="bg-muted/50 border-b px-4 py-3">
          <div className="flex gap-4">
            {Array.from({ length: columns }).map((_, i) => (
              <Skeleton key={i} className="bg-muted/70 h-4 flex-1" />
            ))}
          </div>
        </div>
      )}

      {/* Rows skeleton */}
      <div className="divide-border divide-y">
        {Array.from({ length: rows }).map((_, i) => (
          <div key={i} className="px-4 py-3">
            <div className="flex items-center gap-4">
              {Array.from({ length: columns }).map((_, j) => (
                <Skeleton
                  key={j}
                  className={`bg-muted/60 h-5 ${j === 0 ? "flex-2" : "flex-1"}`}
                />
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

interface PageSkeletonProps {
  showTabs?: boolean;
  tabCount?: number;
  showCreateButton?: boolean;
  tableRows?: number;
  tableColumns?: number;
}

export function PageSkeleton({
  showTabs = true,
  tabCount = 4,
  showCreateButton = true,
  tableRows = 8,
  tableColumns = 5,
}: PageSkeletonProps) {
  return (
    <div className="bg-background h-full">
      {/* Header with tabs */}
      {showTabs && (
        <div className="border-b">
          <div className="flex items-center justify-between p-1">
            <div className="flex items-center gap-1">
              {Array.from({ length: tabCount }).map((_, i) => (
                <Skeleton key={i} className="bg-muted/70 h-6 w-16" />
              ))}
            </div>
            {showCreateButton && <Skeleton className="bg-muted/70 h-6 w-20" />}
          </div>
        </div>
      )}

      {/* Table content */}
      <div className="flex-1">
        <TableSkeleton
          rows={tableRows}
          columns={tableColumns}
          showHeader={true}
        />
      </div>

      {/* Pagination skeleton */}
      <div className="border-t p-2">
        <div className="flex items-center justify-between">
          <Skeleton className="bg-muted/60 h-4 w-24" />
          <div className="flex gap-2">
            <Skeleton className="bg-muted/60 h-7 w-12" />
            <Skeleton className="bg-muted/60 h-7 w-12" />
          </div>
        </div>
      </div>
    </div>
  );
}
