import { mutation } from '../_generated/server';
import { v, ConvexError } from 'convex/values';
import { getAuthUserId } from '../authUtils';
import { requirePermission, PERMISSIONS } from '../permissions/utils';
import {
  canViewIssue,
  canEditIssue,
  canDeleteIssue,
  canAssignIssue,
  canUpdateAssignmentState,
  canUpdateIssueRelations,
} from '../access';

export const create = mutation({
  args: {
    orgSlug: v.string(),
    data: v.object({
      title: v.string(),
      description: v.optional(v.string()),
      projectId: v.optional(v.id('projects')),
      stateId: v.optional(v.id('issueStates')),
      priorityId: v.optional(v.id('issuePriorities')),
      assigneeIds: v.optional(v.array(v.id('users'))),
      parentIssueId: v.optional(v.id('issues')),
      visibility: v.optional(
        v.union(
          v.literal('private'),
          v.literal('organization'),
          v.literal('public'),
        ),
      ),
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

    await requirePermission(ctx, org._id, PERMISSIONS.ISSUE_CREATE);

    let parentIssue = null;
    if (args.data.parentIssueId) {
      parentIssue = await ctx.db.get('issues', args.data.parentIssueId);
      if (!parentIssue) {
        throw new ConvexError('PARENT_ISSUE_NOT_FOUND');
      }
      if (parentIssue.organizationId !== org._id) {
        throw new ConvexError('PARENT_ISSUE_WRONG_ORG');
      }
      if (!(await canViewIssue(ctx, parentIssue))) {
        throw new ConvexError('FORBIDDEN');
      }
    }

    let project = null;
    let issueKey: string;
    let nextNumber: number;

    const projectId = args.data.projectId ?? parentIssue?.projectId;

    if (projectId) {
      project = await ctx.db.get('projects', projectId);
      if (!project || project.organizationId !== org._id) {
        throw new ConvexError('PROJECT_NOT_FOUND');
      }

      const existingIssues = await ctx.db
        .query('issues')
        .withIndex('by_project', q => q.eq('projectId', projectId))
        .collect();

      nextNumber = existingIssues.length + 1;
      issueKey = `${project.key}-${nextNumber}`;
    } else {
      const existingIssues = await ctx.db
        .query('issues')
        .withIndex('by_organization', q => q.eq('organizationId', org._id))
        .collect();

      nextNumber = existingIssues.length + 1;
      issueKey = `${org.slug.toUpperCase()}-${nextNumber}`;
    }

    if (!args.data.title.trim()) {
      throw new ConvexError('INVALID_INPUT');
    }
    if (args.data.title.length > 200) {
      throw new ConvexError('INVALID_INPUT');
    }
    if (args.data.description && args.data.description.length > 5000) {
      throw new ConvexError('INVALID_INPUT');
    }

    const issueId = await ctx.db.insert('issues', {
      organizationId: org._id,
      projectId: projectId,
      key: issueKey,
      sequenceNumber: nextNumber,
      title: args.data.title.trim(),
      description: args.data.description?.trim(),
      priorityId: args.data.priorityId,
      reporterId: userId,
      teamId: project?.teamId ?? parentIssue?.teamId,
      visibility:
        args.data.visibility ?? parentIssue?.visibility ?? 'organization',
      createdBy: userId,
      parentIssueId: args.data.parentIssueId,
    });

    if (args.data.parentIssueId) {
      await ctx.db.insert('issueActivities', {
        issueId: args.data.parentIssueId,
        actorId: userId,
        type: 'sub_issue_created',
        payload: {
          subIssueId: issueId,
          subIssueKey: issueKey,
        },
      });
    }

    const assigneeStateId =
      args.data.stateId ||
      (
        await ctx.db
          .query('issueStates')
          .withIndex('by_organization', q => q.eq('organizationId', org._id))
          .filter(q => q.eq(q.field('type'), 'todo'))
          .first()
      )?._id;

    if (assigneeStateId) {
      if (args.data.assigneeIds && args.data.assigneeIds.length > 0) {
        for (const assigneeId of args.data.assigneeIds) {
          const assigneeMembership = await ctx.db
            .query('members')
            .withIndex('by_org_user', q =>
              q.eq('organizationId', org._id).eq('userId', assigneeId),
            )
            .first();

          if (!assigneeMembership) {
            throw new ConvexError('INVALID_ASSIGNEE');
          }

          await ctx.db.insert('issueAssignees', {
            issueId,
            assigneeId,
            stateId: assigneeStateId,
          });
        }
      } else {
        await ctx.db.insert('issueAssignees', {
          issueId,
          assigneeId: undefined,
          stateId: assigneeStateId,
        });
      }
    }

    return { issueId, key: issueKey } as const;
  },
});

export const update = mutation({
  args: {
    issueId: v.id('issues'),
    data: v.object({
      title: v.optional(v.string()),
      description: v.optional(v.string()),
      priorityId: v.optional(v.id('issuePriorities')),
      parentIssueId: v.optional(v.id('issues')),
    }),
  },
  handler: async (ctx, args) => {
    const issue = await ctx.db.get('issues', args.issueId);
    if (!issue) {
      throw new ConvexError('ISSUE_NOT_FOUND');
    }

    if (!(await canEditIssue(ctx, issue))) {
      throw new ConvexError('FORBIDDEN');
    }

    if (args.data.parentIssueId) {
      if (!(await canUpdateIssueRelations(ctx, issue))) {
        throw new ConvexError('FORBIDDEN');
      }
      const parentIssue = await ctx.db.get('issues', args.data.parentIssueId);
      if (!parentIssue) {
        throw new ConvexError('PARENT_ISSUE_NOT_FOUND');
      }
      if (parentIssue.organizationId !== issue.organizationId) {
        throw new ConvexError('PARENT_ISSUE_WRONG_ORG');
      }
      if (parentIssue._id === issue._id) {
        throw new ConvexError('CYCLICAL_DEPENDENCY');
      }
    }

    await ctx.db.patch('issues', issue._id, { ...args.data });
    return { success: true } as const;
  },
});

export const addComment = mutation({
  args: {
    issueId: v.id('issues'),
    body: v.string(),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) {
      throw new ConvexError('UNAUTHORIZED');
    }

    const issue = await ctx.db.get('issues', args.issueId);
    if (!issue) {
      throw new ConvexError('ISSUE_NOT_FOUND');
    }

    if (!(await canViewIssue(ctx, issue))) {
      throw new ConvexError('FORBIDDEN');
    }

    const commentId = await ctx.db.insert('comments', {
      issueId: issue._id,
      authorId: userId,
      body: args.body,
      deleted: false,
    });

    return { commentId } as const;
  },
});

export const deleteIssue = mutation({
  args: {
    issueId: v.id('issues'),
  },
  handler: async (ctx, args) => {
    const issue = await ctx.db.get('issues', args.issueId);
    if (!issue) {
      throw new ConvexError('ISSUE_NOT_FOUND');
    }

    if (!(await canDeleteIssue(ctx, issue))) {
      throw new ConvexError('FORBIDDEN');
    }

    const children = await ctx.db
      .query('issues')
      .withIndex('by_parent', q => q.eq('parentIssueId', issue._id))
      .first();

    if (children) {
      throw new ConvexError('HAS_CHILD_ISSUES');
    }

    const assignees = await ctx.db
      .query('issueAssignees')
      .withIndex('by_issue', q => q.eq('issueId', issue._id))
      .collect();

    for (const assignee of assignees) {
      await ctx.db.delete('issueAssignees', assignee._id);
    }

    const comments = await ctx.db
      .query('comments')
      .withIndex('by_issue', q => q.eq('issueId', issue._id))
      .collect();

    for (const comment of comments) {
      await ctx.db.delete('comments', comment._id);
    }

    await ctx.db.delete('issues', issue._id);
    return { success: true } as const;
  },
});

export const addAssignee = mutation({
  args: {
    issueId: v.id('issues'),
    assigneeId: v.id('users'),
    stateId: v.optional(v.id('issueStates')),
  },
  handler: async (ctx, args) => {
    const issue = await ctx.db.get('issues', args.issueId);
    if (!issue) {
      throw new ConvexError('ISSUE_NOT_FOUND');
    }

    if (!(await canAssignIssue(ctx, issue))) {
      throw new ConvexError('FORBIDDEN');
    }

    const existingAssignment = await ctx.db
      .query('issueAssignees')
      .withIndex('by_issue_assignee', q =>
        q.eq('issueId', args.issueId).eq('assigneeId', args.assigneeId),
      )
      .first();

    if (existingAssignment) {
      throw new ConvexError('USER_ALREADY_ASSIGNED');
    }

    let stateId = args.stateId;
    if (!stateId) {
      const defaultState = await ctx.db
        .query('issueStates')
        .withIndex('by_organization', q =>
          q.eq('organizationId', issue.organizationId),
        )
        .order('asc')
        .first();

      if (!defaultState) {
        throw new ConvexError('NO_ISSUE_STATES_FOUND');
      }

      stateId = defaultState._id;
    }

    const assignmentId = await ctx.db.insert('issueAssignees', {
      issueId: args.issueId,
      assigneeId: args.assigneeId,
      stateId,
    });

    return { assignmentId } as const;
  },
});

export const changeAssignmentState = mutation({
  args: {
    assignmentId: v.id('issueAssignees'),
    stateId: v.id('issueStates'),
  },
  handler: async (ctx, args) => {
    const assignment = await ctx.db.get('issueAssignees', args.assignmentId);
    if (!assignment || !assignment.assigneeId) {
      throw new ConvexError('ASSIGNMENT_NOT_FOUND');
    }

    const issue = await ctx.db.get('issues', assignment.issueId);
    if (!issue) {
      throw new ConvexError('ISSUE_NOT_FOUND');
    }

    if (!(await canUpdateAssignmentState(ctx, issue, assignment.assigneeId))) {
      throw new ConvexError('FORBIDDEN');
    }

    await ctx.db.patch('issueAssignees', args.assignmentId, {
      stateId: args.stateId,
    });

    return { success: true } as const;
  },
});

export const updateAssignmentAssignee = mutation({
  args: {
    assignmentId: v.id('issueAssignees'),
    assigneeId: v.id('users'),
  },
  handler: async (ctx, args) => {
    const assignment = await ctx.db.get('issueAssignees', args.assignmentId);
    if (!assignment) {
      throw new ConvexError('ASSIGNMENT_NOT_FOUND');
    }

    const issue = await ctx.db.get('issues', assignment.issueId);
    if (!issue) {
      throw new ConvexError('ISSUE_NOT_FOUND');
    }

    if (!(await canAssignIssue(ctx, issue))) {
      throw new ConvexError('FORBIDDEN');
    }

    const existingAssignment = await ctx.db
      .query('issueAssignees')
      .withIndex('by_issue_assignee', q =>
        q.eq('issueId', assignment.issueId).eq('assigneeId', args.assigneeId),
      )
      .first();

    if (existingAssignment && existingAssignment._id !== args.assignmentId) {
      throw new ConvexError('USER_ALREADY_ASSIGNED');
    }

    await ctx.db.patch('issueAssignees', args.assignmentId, {
      assigneeId: args.assigneeId,
    });

    return { success: true } as const;
  },
});

export const deleteAssignment = mutation({
  args: {
    assignmentId: v.id('issueAssignees'),
  },
  handler: async (ctx, args) => {
    const assignment = await ctx.db.get('issueAssignees', args.assignmentId);
    if (!assignment) {
      throw new ConvexError('ASSIGNMENT_NOT_FOUND');
    }

    const issue = await ctx.db.get('issues', assignment.issueId);
    if (!issue) {
      throw new ConvexError('ISSUE_NOT_FOUND');
    }

    if (!(await canAssignIssue(ctx, issue))) {
      throw new ConvexError('FORBIDDEN');
    }

    await ctx.db.delete('issueAssignees', args.assignmentId);
    return { success: true } as const;
  },
});

export const changePriority = mutation({
  args: {
    issueId: v.id('issues'),
    priorityId: v.id('issuePriorities'),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) {
      throw new ConvexError('UNAUTHORIZED');
    }

    const issue = await ctx.db.get('issues', args.issueId);
    if (!issue) {
      throw new ConvexError('ISSUE_NOT_FOUND');
    }

    if (!(await canEditIssue(ctx, issue))) {
      throw new ConvexError('FORBIDDEN');
    }

    await ctx.db.patch('issues', args.issueId, { priorityId: args.priorityId });

    await ctx.db.insert('activities', {
      issueId: args.issueId,
      actorId: userId,
      type: 'priority_changed',
      payload: { priorityId: args.priorityId },
    });
  },
});

export const updateAssignees = mutation({
  args: {
    issueId: v.id('issues'),
    assigneeIds: v.array(v.id('users')),
  },
  handler: async (ctx, args) => {
    const issue = await ctx.db.get('issues', args.issueId);
    if (!issue) {
      throw new ConvexError('ISSUE_NOT_FOUND');
    }

    if (!(await canAssignIssue(ctx, issue))) {
      throw new ConvexError('FORBIDDEN');
    }

    const existingAssignments = await ctx.db
      .query('issueAssignees')
      .withIndex('by_issue', q => q.eq('issueId', args.issueId))
      .collect();

    let stateId;
    if (existingAssignments.length > 0) {
      stateId = existingAssignments[0].stateId;
    } else {
      const defaultState = await ctx.db
        .query('issueStates')
        .withIndex('by_organization', q =>
          q.eq('organizationId', issue.organizationId),
        )
        .order('asc')
        .first();

      if (!defaultState) {
        throw new ConvexError('NO_ISSUE_STATES_FOUND');
      }

      stateId = defaultState._id;
    }

    for (const assignment of existingAssignments) {
      await ctx.db.delete('issueAssignees', assignment._id);
    }

    for (const assigneeId of args.assigneeIds) {
      await ctx.db.insert('issueAssignees', {
        issueId: args.issueId,
        assigneeId,
        stateId,
      });
    }
  },
});

export const changeTeam = mutation({
  args: {
    issueId: v.id('issues'),
    teamId: v.union(v.id('teams'), v.null()),
  },
  handler: async (ctx, args) => {
    const issue = await ctx.db.get('issues', args.issueId);
    if (!issue) {
      throw new ConvexError('ISSUE_NOT_FOUND');
    }

    if (!(await canUpdateIssueRelations(ctx, issue))) {
      throw new ConvexError('FORBIDDEN');
    }

    await ctx.db.patch('issues', args.issueId, {
      teamId: args.teamId ?? undefined,
    });
  },
});

export const changeProject = mutation({
  args: {
    issueId: v.id('issues'),
    projectId: v.union(v.id('projects'), v.null()),
  },
  handler: async (ctx, args) => {
    const issue = await ctx.db.get('issues', args.issueId);
    if (!issue) {
      throw new ConvexError('ISSUE_NOT_FOUND');
    }

    if (!(await canUpdateIssueRelations(ctx, issue))) {
      throw new ConvexError('FORBIDDEN');
    }

    await ctx.db.patch('issues', args.issueId, {
      projectId: args.projectId ?? undefined,
    });
  },
});

export const updateTitle = mutation({
  args: {
    issueId: v.id('issues'),
    title: v.string(),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) {
      throw new ConvexError('UNAUTHORIZED');
    }

    const issue = await ctx.db.get('issues', args.issueId);
    if (!issue) {
      throw new ConvexError('ISSUE_NOT_FOUND');
    }

    if (!(await canEditIssue(ctx, issue))) {
      throw new ConvexError('FORBIDDEN');
    }

    await ctx.db.patch('issues', args.issueId, { title: args.title });

    await ctx.db.insert('activities', {
      issueId: args.issueId,
      actorId: userId,
      type: 'title_changed',
      payload: { title: args.title },
    });
  },
});

export const updateDescription = mutation({
  args: {
    issueId: v.id('issues'),
    description: v.union(v.string(), v.null()),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) {
      throw new ConvexError('UNAUTHORIZED');
    }

    const issue = await ctx.db.get('issues', args.issueId);
    if (!issue) {
      throw new ConvexError('ISSUE_NOT_FOUND');
    }

    if (!(await canEditIssue(ctx, issue))) {
      throw new ConvexError('FORBIDDEN');
    }

    await ctx.db.patch('issues', args.issueId, {
      description: args.description ?? undefined,
    });

    await ctx.db.insert('activities', {
      issueId: args.issueId,
      actorId: userId,
      type: 'description_changed',
    });
  },
});

export const updateEstimatedTimes = mutation({
  args: {
    issueId: v.id('issues'),
    estimatedTimes: v.optional(v.record(v.string(), v.number())),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) {
      throw new ConvexError('UNAUTHORIZED');
    }

    const issue = await ctx.db.get('issues', args.issueId);
    if (!issue) {
      throw new ConvexError('ISSUE_NOT_FOUND');
    }

    if (!(await canEditIssue(ctx, issue))) {
      throw new ConvexError('FORBIDDEN');
    }

    await ctx.db.patch('issues', args.issueId, {
      estimatedTimes: args.estimatedTimes ?? undefined,
    });

    await ctx.db.insert('activities', {
      issueId: args.issueId,
      actorId: userId,
      type: 'estimated_times_changed',
      payload: { estimatedTimes: args.estimatedTimes },
    });
  },
});

export const changeVisibility = mutation({
  args: {
    issueId: v.id('issues'),
    visibility: v.union(
      v.literal('private'),
      v.literal('organization'),
      v.literal('public'),
    ),
  },
  handler: async (ctx, args) => {
    const issue = await ctx.db.get('issues', args.issueId);
    if (!issue) throw new ConvexError('ISSUE_NOT_FOUND');

    if (!(await canEditIssue(ctx, issue))) {
      throw new ConvexError('FORBIDDEN');
    }

    await ctx.db.patch('issues', args.issueId, {
      visibility: args.visibility,
    });

    return { success: true } as const;
  },
});
