import type { GenericCtx } from '@convex-dev/better-auth';
import { ConvexError } from 'convex/values';
import type { Id } from './_generated/dataModel';
import type { DataModel } from './_generated/dataModel';
import { authComponent } from './auth';

export async function getAuthUserId(
  ctx: GenericCtx<DataModel>,
): Promise<Id<'users'> | null> {
  const authUser = await authComponent.safeGetAuthUser(ctx);
  return authUser?.userId ? (authUser.userId as Id<'users'>) : null;
}

export async function requireAuthUserId(
  ctx: GenericCtx<DataModel>,
): Promise<Id<'users'>> {
  const userId = await getAuthUserId(ctx);
  if (userId === null) {
    throw new ConvexError('AUTH_REQUIRED');
  }
  return userId;
}
