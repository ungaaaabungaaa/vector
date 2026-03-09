import { ConvexError } from 'convex/values';
import type { Id } from './_generated/dataModel';
import type { MutationCtx, QueryCtx } from './_generated/server';
import { authComponent } from './auth';

export async function getAuthUserId(
  ctx: QueryCtx | MutationCtx,
): Promise<Id<'users'> | null> {
  const authUser = await authComponent.safeGetAuthUser(ctx);
  if (!authUser?.userId) {
    return null;
  }
  return ctx.db.normalizeId('users', authUser.userId);
}

export async function requireAuthUserId(
  ctx: QueryCtx | MutationCtx,
): Promise<Id<'users'>> {
  const userId = await getAuthUserId(ctx);
  if (userId === null) {
    throw new ConvexError('AUTH_REQUIRED');
  }
  return userId;
}
