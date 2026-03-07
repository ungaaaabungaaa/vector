import type { QueryCtx } from '../_generated/server';
import type { QueryInitializer, GenericTableInfo } from 'convex/server';
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
export async function applyPagination<T>(
  ctx: QueryCtx,
  query: QueryInitializer<GenericTableInfo>, // Convex query object
  limit: number = 25,
): Promise<PaginationResult<T>> {
  const result = await query.order('desc').paginate({
    numItems: limit,
  });

  return {
    items: result.page as T[],
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
