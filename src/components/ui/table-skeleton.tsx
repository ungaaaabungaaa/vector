import { cn } from '@/lib/utils';
import { Skeleton } from './skeleton';

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
    <div className='w-full'>
      {/* Header skeleton */}
      {showHeader && (
        <div className='bg-muted/50 border-b px-4 py-3'>
          <div className='flex gap-4'>
            {Array.from({ length: columns }).map((_, i) => (
              <Skeleton key={i} className='bg-muted/70 h-4 flex-1' />
            ))}
          </div>
        </div>
      )}

      {/* Rows skeleton */}
      <div className='divide-border divide-y'>
        {Array.from({ length: rows }).map((_, i) => (
          <div key={i} className='px-4 py-3'>
            <div className='flex items-center gap-4'>
              {Array.from({ length: columns }).map((_, j) => (
                <Skeleton
                  key={j}
                  className={`bg-muted/60 h-5 ${j === 0 ? 'flex-2' : 'flex-1'}`}
                />
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// Fixed per-column card counts and title widths to look like a real board
const KANBAN_COLUMNS = [
  { cards: 3, responsive: '' }, // always visible
  { cards: 1, responsive: '' }, // always visible
  { cards: 4, responsive: 'hidden sm:block' }, // hidden on mobile
  { cards: 2, responsive: 'hidden lg:block' }, // hidden below lg
];
const KANBAN_TITLE_WIDTHS = ['w-4/5', 'w-full', 'w-3/5', 'w-5/6', 'w-2/3'];

export function KanbanSkeleton() {
  return (
    <div className='flex gap-3 overflow-x-auto p-3'>
      {KANBAN_COLUMNS.map((column, col) => (
        <div key={col} className={cn('w-72 flex-shrink-0', column.responsive)}>
          {/* Column header */}
          <div className='mb-2 flex items-center gap-2 px-1'>
            <Skeleton className='size-3.5 rounded-full' />
            <Skeleton className='h-4 w-20' />
            <Skeleton className='h-3 w-4' />
          </div>
          {/* Cards */}
          <div className='space-y-2'>
            {Array.from({ length: column.cards }).map((_, card) => (
              <div key={card} className='rounded-lg border p-3'>
                <div className='mb-1.5 flex items-center gap-2'>
                  <Skeleton className='size-3 rounded-full' />
                  <Skeleton className='h-3 w-14' />
                </div>
                <Skeleton
                  className={`mb-2 h-4 ${KANBAN_TITLE_WIDTHS[(col + card) % KANBAN_TITLE_WIDTHS.length]}`}
                />
                <div className='flex items-center justify-between'>
                  <div className='flex -space-x-1.5'>
                    <Skeleton className='size-5 rounded-full' />
                    {card % 3 === 0 && (
                      <Skeleton className='size-5 rounded-full' />
                    )}
                  </div>
                  <Skeleton className='h-3 w-12' />
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
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
    <div className='bg-background h-full'>
      {/* Header with tabs */}
      {showTabs && (
        <div className='border-b'>
          <div className='flex items-center justify-between p-1'>
            <div className='flex items-center gap-1'>
              {Array.from({ length: tabCount }).map((_, i) => (
                <Skeleton key={i} className='bg-muted/70 h-6 w-16' />
              ))}
            </div>
            {showCreateButton && <Skeleton className='bg-muted/70 h-6 w-20' />}
          </div>
        </div>
      )}

      {/* Table content */}
      <div className='flex-1'>
        <TableSkeleton
          rows={tableRows}
          columns={tableColumns}
          showHeader={true}
        />
      </div>

      {/* Pagination skeleton */}
      <div className='border-t p-2'>
        <div className='flex items-center justify-between'>
          <Skeleton className='bg-muted/60 h-4 w-24' />
          <div className='flex gap-2'>
            <Skeleton className='bg-muted/60 h-7 w-12' />
            <Skeleton className='bg-muted/60 h-7 w-12' />
          </div>
        </div>
      </div>
    </div>
  );
}
