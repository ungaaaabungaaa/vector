import { getAuthUserId } from '../authUtils';
import type { Doc, Id } from '../_generated/dataModel';
import type { QueryCtx, MutationCtx } from '../_generated/server';

/**
 * Require authentication and return user ID
 */
export async function requireAuth(
  ctx: QueryCtx | MutationCtx,
): Promise<Id<'users'>> {
  const userId = await getAuthUserId(ctx);
  if (!userId) {
    throw new Error('Not authenticated');
  }
  return userId;
}

/**
 * Require organization access and return user, org, and membership
 */
export async function requireOrgAccess(
  ctx: QueryCtx | MutationCtx,
  orgSlug: string,
): Promise<{
  userId: Id<'users'>;
  org: Doc<'organizations'>;
  membership: Doc<'members'>;
}> {
  const userId = await requireAuth(ctx);

  // Find organization
  const org = await ctx.db
    .query('organizations')
    .withIndex('by_slug', q => q.eq('slug', orgSlug))
    .first();

  if (!org) {
    throw new Error('Organization not found');
  }

  // Verify user is a member
  const membership = await ctx.db
    .query('members')
    .withIndex('by_org_user', q =>
      q.eq('organizationId', org._id).eq('userId', userId),
    )
    .first();

  if (!membership) {
    throw new Error('Access denied - not a member of this organization');
  }

  return { userId, org, membership };
}

/**
 * Check if user has specific permission in organization
 */
export async function requirePermission(
  ctx: QueryCtx | MutationCtx,
  orgSlug: string,
  _permission: string,
): Promise<{
  userId: Id<'users'>;
  org: Doc<'organizations'>;
  membership: Doc<'members'>;
}> {
  const { userId, org, membership } = await requireOrgAccess(ctx, orgSlug);

  // TODO: Implement permission checking logic
  // For now, just check if user is admin or has custom role with permission

  return { userId, org, membership };
}
