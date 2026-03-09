import { query, mutation, action, type MutationCtx } from './_generated/server';
import { v, ConvexError } from 'convex/values';
import { api, components, internal } from './_generated/api';
import type { Id } from './_generated/dataModel';
import { createAuth } from './auth';
import { isDefined } from './_shared/typeGuards';
import { getAuthUserId } from './authUtils';
import { PLATFORM_ADMIN_ROLE } from './platformAdmin/lib';

async function syncBetterAuthUser(
  ctx: MutationCtx,
  userId: Id<'users'>,
  update: {
    name?: string;
    image?: string | null;
  },
) {
  if (update.name === undefined && update.image === undefined) {
    return;
  }

  await ctx.runMutation(components.betterAuth.adapter.updateOne, {
    input: {
      model: 'user',
      update,
      where: [
        {
          field: 'userId',
          operator: 'eq',
          value: userId,
        },
      ],
    },
  });
}

/**
 * Get the current authenticated user
 */
export const currentUser = query({
  args: {},
  handler: async ctx => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) {
      return null;
    }

    const user = await ctx.db.get('users', userId);
    return user;
  },
});

/**
 * Get a user by ID (public fields only)
 */
export const getUser = query({
  args: { userId: v.id('users') },
  handler: async (ctx, args) => {
    const user = await ctx.db.get('users', args.userId);
    if (!user) return null;
    return {
      _id: user._id,
      name: user.name,
      email: user.email,
      image: user.image,
      username: user.username,
    };
  },
});

/**
 * Update current user profile
 */
export const updateProfile = mutation({
  args: {
    name: v.string(),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) {
      throw new ConvexError('UNAUTHORIZED');
    }

    await ctx.db.patch('users', userId, {
      name: args.name,
    });
    await syncBetterAuthUser(ctx, userId, {
      name: args.name,
    });

    return { success: true };
  },
});

export const generateProfileImageUploadUrl = mutation({
  args: {},
  handler: async ctx => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) {
      throw new ConvexError('UNAUTHORIZED');
    }

    return await ctx.storage.generateUploadUrl();
  },
});

export const updateProfileImage = mutation({
  args: {
    storageId: v.id('_storage'),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) {
      throw new ConvexError('UNAUTHORIZED');
    }

    const imageUrl = `/api/files/${args.storageId}`;

    await ctx.db.patch('users', userId, {
      image: imageUrl,
    });
    await syncBetterAuthUser(ctx, userId, {
      image: imageUrl,
    });

    return { imageUrl };
  },
});

export const removeProfileImage = mutation({
  args: {},
  handler: async ctx => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) {
      throw new ConvexError('UNAUTHORIZED');
    }

    await ctx.db.patch('users', userId, {
      image: '',
    });
    await syncBetterAuthUser(ctx, userId, {
      image: null,
    });

    return { success: true };
  },
});

/**
 * Check if any platform admin users exist in the system
 */
export const adminExists = query({
  args: {},
  handler: async ctx => {
    const existingAdmin = await ctx.db
      .query('users')
      .withIndex('by_role', q => q.eq('role', PLATFORM_ADMIN_ROLE))
      .first();

    return existingAdmin !== null;
  },
});

/**
 * Check if any users exist in the system (for first-run check)
 */
export const hasAnyUsers = query({
  args: {},
  handler: async ctx => {
    const anyUser = await ctx.db.query('users').first();
    return anyUser !== null;
  },
});

/**
 * Bootstrap the very first administrator user
 * Creates both user and credential account, throws if admin already exists
 */
export const bootstrapAdmin = action({
  args: {
    name: v.string(),
    email: v.string(),
    password: v.string(),
    username: v.optional(v.string()),
  },
  handler: async (ctx, args): Promise<{ id: Id<'users'> }> => {
    // Check if admin already exists
    const existingAdmin = await ctx.runQuery(api.users.adminExists, {});

    if (existingAdmin) {
      throw new ConvexError('ADMIN_ALREADY_EXISTS');
    }

    const result = await createAuth(ctx).api.signUpEmail({
      body: {
        email: args.email,
        password: args.password,
        name: args.name,
        ...(args.username ? { username: args.username } : {}),
      },
    });

    const authUserId = result.user?.id;
    if (!authUserId) {
      throw new ConvexError('BOOTSTRAP_ADMIN_CREATION_FAILED');
    }

    const userId = await ctx.runMutation(internal.auth.setBootstrapAdminRole, {
      authUserId,
    });

    return { id: userId };
  },
});

/**
 * Get user's active organization for post-login redirect
 */
export const getUserActiveOrganization = query({
  args: {
    sessionActiveOrgId: v.optional(v.id('organizations')),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) {
      throw new ConvexError('UNAUTHORIZED');
    }

    // Try session active org first
    if (args.sessionActiveOrgId) {
      const sessionOrgId = args.sessionActiveOrgId;
      const membership = await ctx.db
        .query('members')
        .withIndex('by_org_user', q =>
          q.eq('organizationId', sessionOrgId).eq('userId', userId),
        )
        .first();

      if (membership) {
        const org = await ctx.db.get('organizations', sessionOrgId);
        return org?.slug ?? null;
      }
    }

    // Fallback: Get first organization membership
    const firstMembership = await ctx.db
      .query('members')
      .withIndex('by_user', q => q.eq('userId', userId))
      .first();

    if (firstMembership) {
      const org = await ctx.db.get(
        'organizations',
        firstMembership.organizationId,
      );
      return org?.slug ?? null;
    }

    return null;
  },
});

/**
 * Search users by name or email (for assignments, etc.)
 */
export const searchUsers = query({
  args: {
    query: v.string(),
    organizationId: v.optional(v.id('organizations')),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) {
      throw new ConvexError('UNAUTHORIZED');
    }

    const limit = args.limit ?? 10;
    const searchQuery = args.query.trim();

    if (searchQuery.length === 0) {
      return [];
    }

    // If organizationId provided, only search within that org
    if (args.organizationId) {
      const orgId = args.organizationId;
      // Get org members first
      const members = await ctx.db
        .query('members')
        .withIndex('by_organization', q => q.eq('organizationId', orgId))
        .collect();

      const memberUserIds = members.map(m => m.userId);

      // Search by name using search index
      const nameResults = await ctx.db
        .query('users')
        .withSearchIndex('by_name_email_username', q =>
          q.search('name', searchQuery),
        )
        .collect();

      // Search by exact email match
      const emailResults = await ctx.db
        .query('users')
        .withIndex('email', q => q.eq('email', searchQuery))
        .collect();

      // Search by exact username match
      const usernameResults = await ctx.db
        .query('users')
        .withIndex('by_username', q => q.eq('username', searchQuery))
        .collect();

      // Combine and filter to org members only
      const allResults = [...nameResults, ...emailResults, ...usernameResults];
      const orgMemberSet = new Set(memberUserIds);
      const filteredResults = allResults.filter(user =>
        orgMemberSet.has(user._id),
      );

      // Remove duplicates and limit results
      const uniqueResults = Array.from(
        new Map(filteredResults.map(user => [user._id, user])).values(),
      );

      return uniqueResults.slice(0, limit);
    }

    // Global search (for admin users)
    const [nameResults, emailResults, usernameResults] = await Promise.all([
      ctx.db
        .query('users')
        .withSearchIndex('by_name_email_username', q =>
          q.search('name', searchQuery),
        )
        .collect(),
      ctx.db
        .query('users')
        .withIndex('email', q => q.eq('email', searchQuery))
        .collect(),
      ctx.db
        .query('users')
        .withIndex('by_username', q => q.eq('username', searchQuery))
        .collect(),
    ]);

    // Combine and deduplicate results
    const allResults = [...nameResults, ...emailResults, ...usernameResults];
    const uniqueResults = Array.from(
      new Map(allResults.map(user => [user._id, user])).values(),
    );

    return uniqueResults.slice(0, limit);
  },
});

export const getCurrentUser = query({
  args: {},
  handler: async ctx => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      return null;
    }
    return await ctx.db.get('users', userId);
  },
});

export const getOrganizations = query({
  args: {},
  handler: async ctx => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      return [];
    }
    const memberships = await ctx.db
      .query('members')
      .withIndex('by_user', q => q.eq('userId', userId))
      .collect();

    const orgIds = memberships.map(m => m.organizationId);
    if (orgIds.length === 0) {
      return [];
    }
    const orgs = await Promise.all(
      orgIds.map(id => ctx.db.get('organizations', id)),
    );
    return orgs.filter(isDefined);
  },
});

export const getPendingInvitations = query({
  args: {},
  handler: async ctx => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      return [];
    }
    const user = await ctx.db.get('users', userId);
    if (!user) {
      return [];
    }

    if (!user.email) {
      return [];
    }

    const invites = await ctx.db
      .query('invitations')
      .withIndex('by_email', q => q.eq('email', user.email!))
      .filter(q => q.eq(q.field('status'), 'pending'))
      .collect();

    const invitesWithOrg = await Promise.all(
      invites.map(async invite => {
        const organization = await ctx.db.get(
          'organizations',
          invite.organizationId,
        );
        return { ...invite, organization };
      }),
    );
    return invitesWithOrg;
  },
});
