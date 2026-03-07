import { mutation } from '../_generated/server';
import { v, ConvexError } from 'convex/values';
import type { Id } from '../_generated/dataModel';
import { getAuthUserId } from '../authUtils';
import {
  ISSUE_PRIORITY_DEFAULTS,
  ISSUE_STATE_DEFAULTS,
  PROJECT_STATUS_DEFAULTS,
} from '../../src/lib/defaults';

export const revokeInvite = mutation({
  args: {
    inviteId: v.id('invitations'),
  },
  handler: async (ctx, args) => {
    const invite = await ctx.db.get('invitations', args.inviteId);

    if (!invite) {
      throw new ConvexError('INVITE_NOT_FOUND');
    }

    await ctx.db.patch('invitations', invite._id, { status: 'revoked' });
  },
});

export const acceptInvitation = mutation({
  args: {
    inviteId: v.id('invitations'),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) {
      throw new ConvexError('UNAUTHORIZED');
    }
    const user = await ctx.db.get('users', userId);
    if (!user) {
      throw new ConvexError('USER_NOT_FOUND');
    }

    const invite = await ctx.db.get('invitations', args.inviteId);

    if (!invite) {
      throw new ConvexError('INVITATION_NOT_FOUND');
    }
    if (invite.status !== 'pending') {
      throw new ConvexError('INVITATION_NOT_PENDING');
    }
    if (invite.email.toLowerCase() !== user.email?.toLowerCase()) {
      throw new ConvexError(
        `This invitation is for ${invite.email}, but you are logged in as ${user.email}.`,
      );
    }
    if (invite.expiresAt < Date.now()) {
      await ctx.db.patch('invitations', invite._id, { status: 'expired' });
      throw new ConvexError('INVITATION_EXPIRED');
    }

    await ctx.db.patch('invitations', invite._id, {
      status: 'accepted',
      acceptedAt: Date.now(),
    });

    const existingMembership = await ctx.db
      .query('members')
      .withIndex('by_org_user', q =>
        q.eq('organizationId', invite.organizationId).eq('userId', userId),
      )
      .first();

    if (!existingMembership) {
      await ctx.db.insert('members', {
        organizationId: invite.organizationId,
        userId,
        role: invite.role,
      });
    }

    return { success: true } as const;
  },
});

export const resendInvite = mutation({
  args: {
    token: v.id('invitations'),
  },
  handler: async (ctx, args) => {
    const invite = await ctx.db.get('invitations', args.token);

    if (!invite) {
      throw new ConvexError('INVITE_NOT_FOUND');
    }

    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7);

    await ctx.db.patch('invitations', invite._id, {
      expiresAt: expiresAt.getTime(),
    });
  },
});

export const removeMember = mutation({
  args: {
    orgSlug: v.string(),
    userId: v.id('users'),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) {
      throw new ConvexError('UNAUTHORIZED');
    }

    const org = await ctx.db
      .query('organizations')
      .withIndex('by_slug', q => q.eq('slug', args.orgSlug))
      .first();

    if (!org) {
      throw new ConvexError('ORGANIZATION_NOT_FOUND');
    }

    const membership = await ctx.db
      .query('members')
      .withIndex('by_org_user', q =>
        q.eq('organizationId', org._id).eq('userId', userId),
      )
      .first();

    if (!membership) {
      throw new ConvexError('FORBIDDEN');
    }

    const member = await ctx.db
      .query('members')
      .withIndex('by_org_user', q =>
        q.eq('organizationId', org._id).eq('userId', args.userId),
      )
      .first();

    if (!member) {
      throw new ConvexError('MEMBER_NOT_FOUND');
    }

    await ctx.db.delete('members', member._id);
  },
});

export const updateMemberRole = mutation({
  args: {
    orgSlug: v.string(),
    userId: v.id('users'),
    role: v.union(v.literal('member'), v.literal('admin')),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) {
      throw new ConvexError('UNAUTHORIZED');
    }

    const org = await ctx.db
      .query('organizations')
      .withIndex('by_slug', q => q.eq('slug', args.orgSlug))
      .first();

    if (!org) {
      throw new ConvexError('ORGANIZATION_NOT_FOUND');
    }

    const membership = await ctx.db
      .query('members')
      .withIndex('by_org_user', q =>
        q.eq('organizationId', org._id).eq('userId', userId),
      )
      .first();

    if (
      !membership ||
      (membership.role !== 'owner' && membership.role !== 'admin')
    ) {
      throw new ConvexError('INSUFFICIENT_PERMISSIONS_UPDATE_MEMBER_ROLE');
    }

    const member = await ctx.db
      .query('members')
      .withIndex('by_org_user', q =>
        q.eq('organizationId', org._id).eq('userId', args.userId),
      )
      .first();

    if (!member) {
      throw new ConvexError('MEMBER_NOT_FOUND');
    }

    if (member.role === 'owner') {
      throw new ConvexError('CANNOT_CHANGE_OWNER_ROLE');
    }

    await ctx.db.patch('members', member._id, { role: args.role });
    return { success: true } as const;
  },
});

export const create = mutation({
  args: {
    data: v.object({
      name: v.string(),
      slug: v.string(),
      logo: v.optional(v.id('_storage')),
    }),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) {
      throw new ConvexError('UNAUTHORIZED');
    }

    if (!args.data.name.trim()) {
      throw new ConvexError('ORGANIZATION_NAME_REQUIRED');
    }
    if (!args.data.slug.trim()) {
      throw new ConvexError('ORGANIZATION_SLUG_REQUIRED');
    }
    if (args.data.name.length > 100) {
      throw new ConvexError('ORGANIZATION_NAME_TOO_LONG');
    }
    if (args.data.slug.length > 50) {
      throw new ConvexError('ORGANIZATION_SLUG_TOO_LONG');
    }

    const existingOrg = await ctx.db
      .query('organizations')
      .withIndex('by_slug', q => q.eq('slug', args.data.slug))
      .first();

    if (existingOrg) {
      throw new ConvexError('ORGANIZATION_SLUG_UNIQUE');
    }

    const orgId = await ctx.db.insert('organizations', {
      name: args.data.name.trim(),
      slug: args.data.slug.trim(),
      logo: args.data.logo,
    });

    await ctx.db.insert('members', {
      organizationId: orgId,
      userId,
      role: 'owner',
    });

    for (const state of ISSUE_STATE_DEFAULTS) {
      await ctx.db.insert('issueStates', {
        organizationId: orgId,
        name: state.name,
        position: state.position,
        color: state.color,
        icon: state.icon,
        type: state.type,
      });
    }

    for (const priority of ISSUE_PRIORITY_DEFAULTS) {
      await ctx.db.insert('issuePriorities', {
        organizationId: orgId,
        name: priority.name,
        weight: priority.weight,
        color: priority.color,
        icon: priority.icon,
      });
    }

    for (const status of PROJECT_STATUS_DEFAULTS) {
      await ctx.db.insert('projectStatuses', {
        organizationId: orgId,
        name: status.name,
        position: status.position,
        color: status.color,
        icon: status.icon,
        type: status.type,
      });
    }

    return { orgId } as const;
  },
});

export const update = mutation({
  args: {
    orgSlug: v.string(),
    data: v.object({
      name: v.optional(v.string()),
      slug: v.optional(v.string()),
      logo: v.optional(v.id('_storage')),
    }),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) {
      throw new ConvexError('UNAUTHORIZED');
    }

    const org = await ctx.db
      .query('organizations')
      .withIndex('by_slug', q => q.eq('slug', args.orgSlug))
      .first();

    if (!org) {
      throw new ConvexError('ORGANIZATION_NOT_FOUND');
    }

    const membership = await ctx.db
      .query('members')
      .withIndex('by_org_user', q =>
        q.eq('organizationId', org._id).eq('userId', userId),
      )
      .first();

    if (
      !membership ||
      (membership.role !== 'owner' && membership.role !== 'admin')
    ) {
      throw new ConvexError('INSUFFICIENT_PERMISSIONS_UPDATE_ORGANIZATION');
    }

    if (args.data.name && !args.data.name.trim()) {
      throw new ConvexError('ORGANIZATION_NAME_EMPTY');
    }
    if (args.data.name && args.data.name.length > 100) {
      throw new ConvexError('ORGANIZATION_NAME_TOO_LONG');
    }
    if (args.data.slug && !args.data.slug.trim()) {
      throw new ConvexError('ORGANIZATION_SLUG_EMPTY');
    }
    if (args.data.slug && args.data.slug.length > 50) {
      throw new ConvexError('ORGANIZATION_SLUG_TOO_LONG');
    }

    if (args.data?.slug && args.data.slug.trim() !== org.slug) {
      const existingOrg = await ctx.db
        .query('organizations')
        .withIndex('by_slug', q => q.eq('slug', args.data.slug!.trim()))
        .first();

      if (existingOrg) {
        throw new ConvexError('ORGANIZATION_SLUG_UNIQUE');
      }
    }

    const updateData: Partial<{
      name: string;
      slug: string;
      logo: Id<'_storage'>;
    }> = {};

    if (args.data.name !== undefined) {
      updateData.name = args.data.name.trim();
    }
    if (args.data.slug !== undefined) {
      updateData.slug = args.data.slug.trim();
    }
    if (args.data.logo !== undefined) {
      updateData.logo = args.data.logo;
    }

    if (Object.keys(updateData).length > 0) {
      await ctx.db.patch('organizations', org._id, updateData);
    }

    return { success: true } as const;
  },
});

export const createIssuePriority = mutation({
  args: {
    orgSlug: v.string(),
    name: v.string(),
    weight: v.number(),
    color: v.string(),
    icon: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) {
      throw new ConvexError('UNAUTHORIZED');
    }

    const org = await ctx.db
      .query('organizations')
      .withIndex('by_slug', q => q.eq('slug', args.orgSlug))
      .first();

    if (!org) {
      throw new ConvexError('ORGANIZATION_NOT_FOUND');
    }

    const membership = await ctx.db
      .query('members')
      .withIndex('by_org_user', q =>
        q.eq('organizationId', org._id).eq('userId', userId),
      )
      .first();

    if (
      !membership ||
      (membership.role !== 'owner' && membership.role !== 'admin')
    ) {
      throw new ConvexError('INSUFFICIENT_PERMISSIONS_CREATE_PRIORITY');
    }

    const id = await ctx.db.insert('issuePriorities', {
      organizationId: org._id,
      name: args.name,
      weight: args.weight,
      color: args.color,
      icon: args.icon,
    });

    return { id } as const;
  },
});

export const updateIssuePriority = mutation({
  args: {
    orgSlug: v.string(),
    priorityId: v.id('issuePriorities'),
    name: v.string(),
    weight: v.optional(v.number()),
    color: v.string(),
    icon: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) {
      throw new ConvexError('UNAUTHORIZED');
    }

    const org = await ctx.db
      .query('organizations')
      .withIndex('by_slug', q => q.eq('slug', args.orgSlug))
      .first();

    if (!org) {
      throw new ConvexError('ORGANIZATION_NOT_FOUND');
    }

    const membership = await ctx.db
      .query('members')
      .withIndex('by_org_user', q =>
        q.eq('organizationId', org._id).eq('userId', userId),
      )
      .first();

    if (
      !membership ||
      (membership.role !== 'owner' && membership.role !== 'admin')
    ) {
      throw new ConvexError('INSUFFICIENT_PERMISSIONS_UPDATE_PRIORITY');
    }

    await ctx.db.patch('issuePriorities', args.priorityId, {
      name: args.name,
      weight: args.weight,
      color: args.color,
      icon: args.icon,
    });
  },
});

export const resetIssuePriorities = mutation({
  args: {
    orgSlug: v.string(),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) {
      throw new ConvexError('UNAUTHORIZED');
    }

    const org = await ctx.db
      .query('organizations')
      .withIndex('by_slug', q => q.eq('slug', args.orgSlug))
      .first();

    if (!org) {
      throw new ConvexError('ORGANIZATION_NOT_FOUND');
    }

    const membership = await ctx.db
      .query('members')
      .withIndex('by_org_user', q =>
        q.eq('organizationId', org._id).eq('userId', userId),
      )
      .first();

    if (
      !membership ||
      (membership.role !== 'owner' && membership.role !== 'admin')
    ) {
      throw new ConvexError('INSUFFICIENT_PERMISSIONS_RESET_PRIORITY');
    }

    const priorities = await ctx.db
      .query('issuePriorities')
      .withIndex('by_organization', q => q.eq('organizationId', org._id))
      .collect();

    for (const p of priorities) {
      await ctx.db.delete('issuePriorities', p._id);
    }

    for (const priority of ISSUE_PRIORITY_DEFAULTS) {
      await ctx.db.insert('issuePriorities', {
        organizationId: org._id,
        name: priority.name,
        weight: priority.weight,
        color: priority.color,
        icon: priority.icon,
      });
    }
  },
});

export const deleteIssuePriority = mutation({
  args: {
    orgSlug: v.string(),
    priorityId: v.id('issuePriorities'),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) {
      throw new ConvexError('UNAUTHORIZED');
    }

    const org = await ctx.db
      .query('organizations')
      .withIndex('by_slug', q => q.eq('slug', args.orgSlug))
      .first();

    if (!org) {
      throw new ConvexError('ORGANIZATION_NOT_FOUND');
    }

    const membership = await ctx.db
      .query('members')
      .withIndex('by_org_user', q =>
        q.eq('organizationId', org._id).eq('userId', userId),
      )
      .first();

    if (
      !membership ||
      (membership.role !== 'owner' && membership.role !== 'admin')
    ) {
      throw new ConvexError('INSUFFICIENT_PERMISSIONS_DELETE_PRIORITY');
    }

    await ctx.db.delete('issuePriorities', args.priorityId);
  },
});

export const createIssueState = mutation({
  args: {
    orgSlug: v.string(),
    name: v.string(),
    position: v.number(),
    color: v.string(),
    icon: v.optional(v.string()),
    type: v.union(
      v.literal('backlog'),
      v.literal('todo'),
      v.literal('in_progress'),
      v.literal('done'),
      v.literal('canceled'),
    ),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) {
      throw new ConvexError('UNAUTHORIZED');
    }

    const org = await ctx.db
      .query('organizations')
      .withIndex('by_slug', q => q.eq('slug', args.orgSlug))
      .first();

    if (!org) {
      throw new ConvexError('ORGANIZATION_NOT_FOUND');
    }

    const membership = await ctx.db
      .query('members')
      .withIndex('by_org_user', q =>
        q.eq('organizationId', org._id).eq('userId', userId),
      )
      .first();

    if (
      !membership ||
      (membership.role !== 'owner' && membership.role !== 'admin')
    ) {
      throw new ConvexError('INSUFFICIENT_PERMISSIONS_CREATE_STATE');
    }

    const id = await ctx.db.insert('issueStates', {
      organizationId: org._id,
      name: args.name,
      position: args.position,
      color: args.color,
      icon: args.icon,
      type: args.type,
    });

    return { id } as const;
  },
});

export const updateIssueState = mutation({
  args: {
    orgSlug: v.string(),
    stateId: v.id('issueStates'),
    name: v.string(),
    position: v.number(),
    color: v.string(),
    icon: v.optional(v.string()),
    type: v.union(
      v.literal('backlog'),
      v.literal('todo'),
      v.literal('in_progress'),
      v.literal('done'),
      v.literal('canceled'),
    ),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) {
      throw new ConvexError('UNAUTHORIZED');
    }

    const org = await ctx.db
      .query('organizations')
      .withIndex('by_slug', q => q.eq('slug', args.orgSlug))
      .first();

    if (!org) {
      throw new ConvexError('ORGANIZATION_NOT_FOUND');
    }

    const membership = await ctx.db
      .query('members')
      .withIndex('by_org_user', q =>
        q.eq('organizationId', org._id).eq('userId', userId),
      )
      .first();

    if (
      !membership ||
      (membership.role !== 'owner' && membership.role !== 'admin')
    ) {
      throw new ConvexError('INSUFFICIENT_PERMISSIONS_UPDATE_STATE');
    }

    await ctx.db.patch('issueStates', args.stateId, {
      name: args.name,
      position: args.position,
      color: args.color,
      icon: args.icon,
      type: args.type,
    });
  },
});

export const createProjectStatus = mutation({
  args: {
    orgSlug: v.string(),
    name: v.string(),
    position: v.number(),
    color: v.string(),
    icon: v.optional(v.string()),
    type: v.union(
      v.literal('backlog'),
      v.literal('planned'),
      v.literal('in_progress'),
      v.literal('completed'),
      v.literal('canceled'),
    ),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) {
      throw new ConvexError('UNAUTHORIZED');
    }

    const org = await ctx.db
      .query('organizations')
      .withIndex('by_slug', q => q.eq('slug', args.orgSlug))
      .first();

    if (!org) {
      throw new ConvexError('ORGANIZATION_NOT_FOUND');
    }

    const membership = await ctx.db
      .query('members')
      .withIndex('by_org_user', q =>
        q.eq('organizationId', org._id).eq('userId', userId),
      )
      .first();

    if (
      !membership ||
      (membership.role !== 'owner' && membership.role !== 'admin')
    ) {
      throw new ConvexError('INSUFFICIENT_PERMISSIONS_CREATE_STATUS');
    }

    const id = await ctx.db.insert('projectStatuses', {
      organizationId: org._id,
      name: args.name,
      position: args.position,
      color: args.color,
      icon: args.icon,
      type: args.type,
    });

    return { id } as const;
  },
});

export const updateProjectStatus = mutation({
  args: {
    orgSlug: v.string(),
    statusId: v.id('projectStatuses'),
    name: v.string(),
    position: v.number(),
    color: v.string(),
    icon: v.optional(v.string()),
    type: v.union(
      v.literal('backlog'),
      v.literal('planned'),
      v.literal('in_progress'),
      v.literal('completed'),
      v.literal('canceled'),
    ),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) {
      throw new ConvexError('UNAUTHORIZED');
    }

    const org = await ctx.db
      .query('organizations')
      .withIndex('by_slug', q => q.eq('slug', args.orgSlug))
      .first();

    if (!org) {
      throw new ConvexError('ORGANIZATION_NOT_FOUND');
    }

    const membership = await ctx.db
      .query('members')
      .withIndex('by_org_user', q =>
        q.eq('organizationId', org._id).eq('userId', userId),
      )
      .first();

    if (
      !membership ||
      (membership.role !== 'owner' && membership.role !== 'admin')
    ) {
      throw new ConvexError('INSUFFICIENT_PERMISSIONS_UPDATE_STATUS');
    }

    await ctx.db.patch('projectStatuses', args.statusId, {
      name: args.name,
      position: args.position,
      color: args.color,
      icon: args.icon,
      type: args.type,
    });
  },
});

export const deleteIssueState = mutation({
  args: {
    orgSlug: v.string(),
    stateId: v.id('issueStates'),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) {
      throw new ConvexError('UNAUTHORIZED');
    }

    const org = await ctx.db
      .query('organizations')
      .withIndex('by_slug', q => q.eq('slug', args.orgSlug))
      .first();

    if (!org) {
      throw new ConvexError('ORGANIZATION_NOT_FOUND');
    }

    const membership = await ctx.db
      .query('members')
      .withIndex('by_org_user', q =>
        q.eq('organizationId', org._id).eq('userId', userId),
      )
      .first();

    if (
      !membership ||
      (membership.role !== 'owner' && membership.role !== 'admin')
    ) {
      throw new ConvexError('INSUFFICIENT_PERMISSIONS_DELETE_STATE');
    }

    await ctx.db.delete('issueStates', args.stateId);
  },
});

export const deleteProjectStatus = mutation({
  args: {
    orgSlug: v.string(),
    statusId: v.id('projectStatuses'),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) {
      throw new ConvexError('UNAUTHORIZED');
    }

    const org = await ctx.db
      .query('organizations')
      .withIndex('by_slug', q => q.eq('slug', args.orgSlug))
      .first();

    if (!org) {
      throw new ConvexError('ORGANIZATION_NOT_FOUND');
    }

    const membership = await ctx.db
      .query('members')
      .withIndex('by_org_user', q =>
        q.eq('organizationId', org._id).eq('userId', userId),
      )
      .first();

    if (
      !membership ||
      (membership.role !== 'owner' && membership.role !== 'admin')
    ) {
      throw new ConvexError('INSUFFICIENT_PERMISSIONS_DELETE_STATUS');
    }

    await ctx.db.delete('projectStatuses', args.statusId);
  },
});

export const resetIssueStates = mutation({
  args: {
    orgSlug: v.string(),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) {
      throw new ConvexError('UNAUTHORIZED');
    }

    const org = await ctx.db
      .query('organizations')
      .withIndex('by_slug', q => q.eq('slug', args.orgSlug))
      .first();

    if (!org) {
      throw new ConvexError('ORGANIZATION_NOT_FOUND');
    }

    const membership = await ctx.db
      .query('members')
      .withIndex('by_org_user', q =>
        q.eq('organizationId', org._id).eq('userId', userId),
      )
      .first();

    if (
      !membership ||
      (membership.role !== 'owner' && membership.role !== 'admin')
    ) {
      throw new ConvexError('INSUFFICIENT_PERMISSIONS_RESET_STATES');
    }

    const states = await ctx.db
      .query('issueStates')
      .withIndex('by_organization', q => q.eq('organizationId', org._id))
      .collect();

    for (const s of states) {
      await ctx.db.delete('issueStates', s._id);
    }

    for (const state of ISSUE_STATE_DEFAULTS) {
      await ctx.db.insert('issueStates', {
        organizationId: org._id,
        name: state.name,
        position: state.position,
        color: state.color,
        icon: state.icon,
        type: state.type,
      });
    }
  },
});

export const resetProjectStatuses = mutation({
  args: {
    orgSlug: v.string(),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) {
      throw new ConvexError('UNAUTHORIZED');
    }

    const org = await ctx.db
      .query('organizations')
      .withIndex('by_slug', q => q.eq('slug', args.orgSlug))
      .first();

    if (!org) {
      throw new ConvexError('ORGANIZATION_NOT_FOUND');
    }

    const membership = await ctx.db
      .query('members')
      .withIndex('by_org_user', q =>
        q.eq('organizationId', org._id).eq('userId', userId),
      )
      .first();

    if (
      !membership ||
      (membership.role !== 'owner' && membership.role !== 'admin')
    ) {
      throw new ConvexError('INSUFFICIENT_PERMISSIONS_RESET_STATUSES');
    }

    const statuses = await ctx.db
      .query('projectStatuses')
      .withIndex('by_organization', q => q.eq('organizationId', org._id))
      .collect();

    for (const s of statuses) {
      await ctx.db.delete('projectStatuses', s._id);
    }

    for (const status of PROJECT_STATUS_DEFAULTS) {
      await ctx.db.insert('projectStatuses', {
        organizationId: org._id,
        name: status.name,
        position: status.position,
        color: status.color,
        icon: status.icon,
        type: status.type,
      });
    }
  },
});

export const invite = mutation({
  args: {
    orgSlug: v.string(),
    email: v.string(),
    role: v.union(v.literal('member'), v.literal('admin')),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) {
      throw new ConvexError('UNAUTHORIZED');
    }

    const org = await ctx.db
      .query('organizations')
      .withIndex('by_slug', q => q.eq('slug', args.orgSlug))
      .first();

    if (!org) {
      throw new ConvexError('ORGANIZATION_NOT_FOUND');
    }

    const membership = await ctx.db
      .query('members')
      .withIndex('by_org_user', q =>
        q.eq('organizationId', org._id).eq('userId', userId),
      )
      .first();

    if (
      !membership ||
      (membership.role !== 'owner' && membership.role !== 'admin')
    ) {
      throw new ConvexError('INSUFFICIENT_PERMISSIONS_INVITE_USERS');
    }

    const existingUser = await ctx.db
      .query('users')
      .withIndex('email', q => q.eq('email', args.email))
      .first();

    if (existingUser) {
      const existingMembership = await ctx.db
        .query('members')
        .withIndex('by_org_user', q =>
          q.eq('organizationId', org._id).eq('userId', existingUser._id),
        )
        .first();

      if (existingMembership) {
        throw new ConvexError('USER_ALREADY_MEMBER');
      }
    }

    const inviteId = await ctx.db.insert('invitations', {
      organizationId: org._id,
      email: args.email.toLowerCase(),
      role: args.role,
      status: 'pending',
      expiresAt: Date.now() + 7 * 24 * 60 * 60 * 1000,
      inviterId: userId,
    });

    return { inviteId } as const;
  },
});

export const generateLogoUploadUrl = mutation({
  args: {
    orgSlug: v.string(),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) {
      throw new ConvexError('UNAUTHORIZED');
    }

    const org = await ctx.db
      .query('organizations')
      .withIndex('by_slug', q => q.eq('slug', args.orgSlug))
      .first();

    if (!org) {
      throw new ConvexError('ORGANIZATION_NOT_FOUND');
    }

    const membership = await ctx.db
      .query('members')
      .withIndex('by_org_user', q =>
        q.eq('organizationId', org._id).eq('userId', userId),
      )
      .first();

    if (
      !membership ||
      (membership.role !== 'owner' && membership.role !== 'admin')
    ) {
      throw new ConvexError('INSUFFICIENT_PERMISSIONS_UPLOAD_LOGO');
    }

    return await ctx.storage.generateUploadUrl();
  },
});

export const updateLogoWithStorageId = mutation({
  args: {
    orgSlug: v.string(),
    storageId: v.id('_storage'),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) {
      throw new ConvexError('UNAUTHORIZED');
    }

    const org = await ctx.db
      .query('organizations')
      .withIndex('by_slug', q => q.eq('slug', args.orgSlug))
      .first();

    if (!org) {
      throw new ConvexError('ORGANIZATION_NOT_FOUND');
    }

    const membership = await ctx.db
      .query('members')
      .withIndex('by_org_user', q =>
        q.eq('organizationId', org._id).eq('userId', userId),
      )
      .first();

    if (
      !membership ||
      (membership.role !== 'owner' && membership.role !== 'admin')
    ) {
      throw new ConvexError('INSUFFICIENT_PERMISSIONS_UPDATE_LOGO');
    }

    await ctx.db.patch('organizations', org._id, {
      logo: args.storageId,
    });

    return { success: true } as const;
  },
});
