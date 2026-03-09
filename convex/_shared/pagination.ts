import type { QueryCtx } from '../_generated/server';
import type {
  DocumentByInfo,
  GenericTableInfo,
  QueryInitializer,
} from 'convex/server';
import { v } from 'convex/values';

/**
 * Standard pagination arguments for Convex functions
 */
export const paginationArgs = {
  cursor: v.optional(v.string()),
  limit: v.optional(v.number()),
};

/**
 * Standard pagination result type
 */
export interface PaginationResult<T> {
  items: T[];
  hasMore: boolean;
  cursor?: string;
}

/**
 * Apply pagination to a query
 */
export async function applyPagination<TableInfo extends GenericTableInfo>(
  ctx: QueryCtx,
  query: QueryInitializer<TableInfo>, // Convex query object
  limit: number = 25,
  cursor?: string,
): Promise<PaginationResult<DocumentByInfo<TableInfo>>> {
  const result = await query.order('desc').paginate({
    numItems: limit,
    cursor: cursor ?? null,
  });

  return {
    items: result.page,
    hasMore: !result.isDone,
    cursor: result.continueCursor,
  };
}

/**
 * Get pagination limit with defaults
 */
export function getPaginationLimit(limit?: number): number {
  return Math.min(limit ?? 25, 100); // Max 100 items per page
}
