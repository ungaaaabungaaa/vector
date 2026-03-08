import { mutation, type MutationCtx } from '../_generated/server';
import { v, ConvexError } from 'convex/values';
import type { Doc, Id } from '../_generated/dataModel';
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
import {
  getCommentPreview,
  getUserDisplayName,
  getVisibilityLabel,
  recordActivity,
  resolveIssueScope,
  snapshotForIssue,
} from '../activities/lib';
import {
  createNotificationEvent,
  getIssueHref,
  resolveMentionedUsers,
} from '../notifications/lib';
import { buildIssueSearchText } from './search';

function priorityLabel(
  priority: Doc<'issuePriorities'> | null | undefined,
): string | undefined {
  return priority?.name;
}

function stateLabel(
  state: Doc<'issueStates'> | null | undefined,
): string | undefined {
  return state?.name;
}

function projectLabel(
  project: Doc<'projects'> | null | undefined,
): string | undefined {
  return project?.name;
}

function teamLabel(team: Doc<'teams'> | null | undefined): string | undefined {
  return team?.name;
}

async function getUserNames(ctx: MutationCtx, userIds: readonly Id<'users'>[]) {
  const users = await Promise.all(
    userIds.map(userId => ctx.db.get('users', userId)),
  );
  return users
    .map(user => getUserDisplayName(user, 'Unknown user'))
    .filter(Boolean);
}

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
    if (args.data.description && args.data.description.length > 10000) {
      throw new ConvexError('INVALID_INPUT');
    }

    const issueId = await ctx.db.insert('issues', {
      organizationId: org._id,
      projectId: projectId,
      key: issueKey,
      sequenceNumber: nextNumber,
      title: args.data.title.trim(),
      description: args.data.description?.trim(),
      searchText: buildIssueSearchText({
        key: issueKey,
        title: args.data.title.trim(),
        description: args.data.description?.trim(),
      }),
      priorityId: args.data.priorityId,
      reporterId: userId,
      teamId: project?.teamId ?? parentIssue?.teamId,
      visibility:
        args.data.visibility ?? parentIssue?.visibility ?? 'organization',
      createdBy: userId,
      parentIssueId: args.data.parentIssueId,
    });

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

    const createdIssue = await ctx.db.get('issues', issueId);
    if (createdIssue) {
      await recordActivity(ctx, {
        scope: resolveIssueScope(createdIssue),
        actorId: userId,
        entityType: 'issue',
        eventType: 'issue_created',
        snapshot: snapshotForIssue(createdIssue),
      });
    }

    if (parentIssue) {
      await recordActivity(ctx, {
        scope: resolveIssueScope(parentIssue),
        actorId: userId,
        entityType: 'issue',
        eventType: 'issue_sub_issue_created',
        details: {
          toId: String(issueId),
          toLabel: issueKey,
        },
        snapshot: {
          entityKey: issueKey,
          entityName: args.data.title.trim(),
        },
      });
    }

    if (
      createdIssue &&
      args.data.assigneeIds &&
      args.data.assigneeIds.length > 0
    ) {
      for (const assigneeId of args.data.assigneeIds) {
        await createNotificationEvent(ctx, {
          type: 'issue_assigned',
          actorId: userId,
          organizationId: createdIssue.organizationId,
          issueId: createdIssue._id,
          projectId: createdIssue.projectId,
          teamId: createdIssue.teamId,
          payload: {
            organizationName: org.name,
            issueKey: createdIssue.key,
            issueTitle: createdIssue.title,
            href: getIssueHref(org.slug, createdIssue.key),
          },
          recipients: [{ userId: assigneeId }],
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

    const previousPriority = issue.priorityId
      ? await ctx.db.get('issuePriorities', issue.priorityId)
      : null;
    const nextTitle = args.data.title ?? issue.title;
    const nextDescription = args.data.description ?? issue.description;
    await ctx.db.patch('issues', issue._id, {
      ...args.data,
      searchText: buildIssueSearchText({
        key: issue.key,
        title: nextTitle,
        description: nextDescription,
      }),
    });

    const snapshot = snapshotForIssue({
      ...issue,
      title: nextTitle,
    });

    if (args.data.title !== undefined && args.data.title !== issue.title) {
      await recordActivity(ctx, {
        scope: resolveIssueScope(issue),
        actorId: userId,
        entityType: 'issue',
        eventType: 'issue_title_changed',
        details: {
          field: 'title',
          fromLabel: issue.title,
          toLabel: args.data.title,
        },
        snapshot,
      });
    }

    if (
      args.data.description !== undefined &&
      args.data.description !== issue.description
    ) {
      await recordActivity(ctx, {
        scope: resolveIssueScope(issue),
        actorId: userId,
        entityType: 'issue',
        eventType: 'issue_description_changed',
        details: {
          field: 'description',
        },
        snapshot,
      });
    }

    if (
      args.data.priorityId !== undefined &&
      args.data.priorityId !== issue.priorityId
    ) {
      const nextPriority = args.data.priorityId
        ? await ctx.db.get('issuePriorities', args.data.priorityId)
        : null;
      await recordActivity(ctx, {
        scope: resolveIssueScope(issue),
        actorId: userId,
        entityType: 'issue',
        eventType: 'issue_priority_changed',
        details: {
          field: 'priority',
          fromId: issue.priorityId ? String(issue.priorityId) : undefined,
          fromLabel: priorityLabel(previousPriority),
          toId: args.data.priorityId ? String(args.data.priorityId) : undefined,
          toLabel: priorityLabel(nextPriority),
        },
        snapshot,
      });
    }

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

    await recordActivity(ctx, {
      scope: resolveIssueScope(issue),
      actorId: userId,
      entityType: 'issue',
      eventType: 'issue_comment_added',
      details: {
        commentId,
        commentPreview: getCommentPreview(args.body),
      },
      snapshot: snapshotForIssue(issue),
    });

    const org = await ctx.db.get('organizations', issue.organizationId);
    if (org) {
      const assignees = await ctx.db
        .query('issueAssignees')
        .withIndex('by_issue', q => q.eq('issueId', issue._id))
        .collect();
      const mentionedUsers = await resolveMentionedUsers(
        ctx,
        issue.organizationId,
        args.body,
      );
      const mentionedUserIds = new Set(mentionedUsers.map(user => user._id));
      const assigneeUserIds = Array.from(
        new Set(
          assignees
            .map(assignment => assignment.assigneeId)
            .filter((id): id is Id<'users'> => Boolean(id)),
        ),
      );
      const href = getIssueHref(org.slug, issue.key);
      const commentPreview = getCommentPreview(args.body);

      for (const mentionedUser of mentionedUsers) {
        await createNotificationEvent(ctx, {
          type: 'issue_mentioned',
          actorId: userId,
          organizationId: issue.organizationId,
          issueId: issue._id,
          projectId: issue.projectId,
          teamId: issue.teamId,
          payload: {
            organizationName: org.name,
            issueKey: issue.key,
            issueTitle: issue.title,
            commentPreview,
            href,
          },
          recipients: [{ userId: mentionedUser._id }],
        });
      }

      for (const assigneeUserId of assigneeUserIds) {
        if (mentionedUserIds.has(assigneeUserId)) {
          continue;
        }

        await createNotificationEvent(ctx, {
          type: 'issue_comment_on_assigned_issue',
          actorId: userId,
          organizationId: issue.organizationId,
          issueId: issue._id,
          projectId: issue.projectId,
          teamId: issue.teamId,
          payload: {
            organizationName: org.name,
            issueKey: issue.key,
            issueTitle: issue.title,
            commentPreview,
            href,
          },
          recipients: [{ userId: assigneeUserId }],
        });
      }
    }

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
    const userId = await getAuthUserId(ctx);
    if (userId === null) {
      throw new ConvexError('UNAUTHORIZED');
    }

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

    const assignee = await ctx.db.get('users', args.assigneeId);
    await recordActivity(ctx, {
      scope: resolveIssueScope(issue),
      actorId: userId,
      entityType: 'issue',
      eventType: 'issue_assignees_changed',
      subjectUserId: args.assigneeId,
      details: {
        addedUserNames: [getUserDisplayName(assignee, 'Unknown user')],
        removedUserNames: [],
      },
      snapshot: snapshotForIssue(issue),
    });

    const org = await ctx.db.get('organizations', issue.organizationId);
    if (assignee && org) {
      await createNotificationEvent(ctx, {
        type: 'issue_assigned',
        actorId: userId,
        organizationId: issue.organizationId,
        issueId: issue._id,
        projectId: issue.projectId,
        teamId: issue.teamId,
        payload: {
          organizationName: org.name,
          issueKey: issue.key,
          issueTitle: issue.title,
          href: getIssueHref(org.slug, issue.key),
        },
        recipients: [{ userId: assignee._id }],
      });
    }

    return { assignmentId } as const;
  },
});

export const changeAssignmentState = mutation({
  args: {
    assignmentId: v.id('issueAssignees'),
    stateId: v.id('issueStates'),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) {
      throw new ConvexError('UNAUTHORIZED');
    }

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

    const previousState = await ctx.db.get('issueStates', assignment.stateId);
    await ctx.db.patch('issueAssignees', args.assignmentId, {
      stateId: args.stateId,
    });

    if (args.stateId !== assignment.stateId) {
      const nextState = await ctx.db.get('issueStates', args.stateId);
      const assignee = await ctx.db.get('users', assignment.assigneeId);
      await recordActivity(ctx, {
        scope: resolveIssueScope(issue),
        actorId: userId,
        entityType: 'issue',
        eventType: 'issue_assignment_state_changed',
        subjectUserId: assignment.assigneeId,
        details: {
          field: 'assignment_state',
          fromId: assignment.stateId,
          fromLabel: stateLabel(previousState),
          toId: args.stateId,
          toLabel: stateLabel(nextState),
          subjectUserName: getUserDisplayName(assignee, 'Unknown user'),
        },
        snapshot: snapshotForIssue(issue),
      });
    }

    return { success: true } as const;
  },
});

export const updateAssignmentAssignee = mutation({
  args: {
    assignmentId: v.id('issueAssignees'),
    assigneeId: v.id('users'),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) {
      throw new ConvexError('UNAUTHORIZED');
    }

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

    const previousAssignee = assignment.assigneeId
      ? await ctx.db.get('users', assignment.assigneeId)
      : null;
    await ctx.db.patch('issueAssignees', args.assignmentId, {
      assigneeId: args.assigneeId,
    });

    if (assignment.assigneeId !== args.assigneeId) {
      const nextAssignee = await ctx.db.get('users', args.assigneeId);
      await recordActivity(ctx, {
        scope: resolveIssueScope(issue),
        actorId: userId,
        entityType: 'issue',
        eventType: 'issue_assignees_changed',
        subjectUserId: args.assigneeId,
        details: {
          addedUserNames: [getUserDisplayName(nextAssignee, 'Unknown user')],
          removedUserNames: previousAssignee
            ? [getUserDisplayName(previousAssignee, 'Unknown user')]
            : [],
        },
        snapshot: snapshotForIssue(issue),
      });

      const org = await ctx.db.get('organizations', issue.organizationId);
      if (nextAssignee && org) {
        await createNotificationEvent(ctx, {
          type: 'issue_reassigned',
          actorId: userId,
          organizationId: issue.organizationId,
          issueId: issue._id,
          projectId: issue.projectId,
          teamId: issue.teamId,
          payload: {
            organizationName: org.name,
            issueKey: issue.key,
            issueTitle: issue.title,
            subjectUserName: getUserDisplayName(
              previousAssignee,
              'Unknown user',
            ),
            href: getIssueHref(org.slug, issue.key),
          },
          recipients: [{ userId: nextAssignee._id }],
        });
      }
    }

    return { success: true } as const;
  },
});

export const deleteAssignment = mutation({
  args: {
    assignmentId: v.id('issueAssignees'),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) {
      throw new ConvexError('UNAUTHORIZED');
    }

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

    const removedAssignee = assignment.assigneeId
      ? await ctx.db.get('users', assignment.assigneeId)
      : null;
    await ctx.db.delete('issueAssignees', args.assignmentId);

    await recordActivity(ctx, {
      scope: resolveIssueScope(issue),
      actorId: userId,
      entityType: 'issue',
      eventType: 'issue_assignees_changed',
      subjectUserId: assignment.assigneeId ?? undefined,
      details: {
        addedUserNames: [],
        removedUserNames: removedAssignee
          ? [getUserDisplayName(removedAssignee, 'Unknown user')]
          : [],
      },
      snapshot: snapshotForIssue(issue),
    });

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

    const previousPriority = issue.priorityId
      ? await ctx.db.get('issuePriorities', issue.priorityId)
      : null;
    await ctx.db.patch('issues', args.issueId, { priorityId: args.priorityId });

    if (args.priorityId !== issue.priorityId) {
      const nextPriority = await ctx.db.get('issuePriorities', args.priorityId);
      await recordActivity(ctx, {
        scope: resolveIssueScope(issue),
        actorId: userId,
        entityType: 'issue',
        eventType: 'issue_priority_changed',
        details: {
          field: 'priority',
          fromId: issue.priorityId,
          fromLabel: priorityLabel(previousPriority),
          toId: args.priorityId,
          toLabel: priorityLabel(nextPriority),
        },
        snapshot: snapshotForIssue(issue),
      });
    }
  },
});

export const updateAssignees = mutation({
  args: {
    issueId: v.id('issues'),
    assigneeIds: v.array(v.id('users')),
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

    const previousAssigneeIds = existingAssignments
      .map(assignment => assignment.assigneeId)
      .filter((id): id is Id<'users'> => Boolean(id));

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

    const addedUserIds = args.assigneeIds.filter(
      id => !previousAssigneeIds.includes(id),
    );
    const removedUserIds = previousAssigneeIds.filter(
      id => !args.assigneeIds.includes(id),
    );

    if (addedUserIds.length > 0 || removedUserIds.length > 0) {
      await recordActivity(ctx, {
        scope: resolveIssueScope(issue),
        actorId: userId,
        entityType: 'issue',
        eventType: 'issue_assignees_changed',
        details: {
          field: 'assignees',
          addedUserNames: await getUserNames(ctx, addedUserIds),
          removedUserNames: await getUserNames(ctx, removedUserIds),
        },
        snapshot: snapshotForIssue(issue),
      });

      const org = await ctx.db.get('organizations', issue.organizationId);
      if (org) {
        for (const assigneeId of addedUserIds) {
          await createNotificationEvent(ctx, {
            type: 'issue_assigned',
            actorId: userId,
            organizationId: issue.organizationId,
            issueId: issue._id,
            projectId: issue.projectId,
            teamId: issue.teamId,
            payload: {
              organizationName: org.name,
              issueKey: issue.key,
              issueTitle: issue.title,
              href: getIssueHref(org.slug, issue.key),
            },
            recipients: [{ userId: assigneeId }],
          });
        }
      }
    }
  },
});

export const changeTeam = mutation({
  args: {
    issueId: v.id('issues'),
    teamId: v.union(v.id('teams'), v.null()),
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

    if (!(await canUpdateIssueRelations(ctx, issue))) {
      throw new ConvexError('FORBIDDEN');
    }

    const previousTeam = issue.teamId
      ? await ctx.db.get('teams', issue.teamId)
      : null;
    await ctx.db.patch('issues', args.issueId, {
      teamId: args.teamId ?? undefined,
    });

    if (args.teamId !== issue.teamId) {
      const nextTeam = args.teamId
        ? await ctx.db.get('teams', args.teamId)
        : null;
      const snapshot = snapshotForIssue(issue);

      await recordActivity(ctx, {
        scope: {
          organizationId: issue.organizationId,
          teamId: args.teamId ?? undefined,
          projectId: issue.projectId ?? undefined,
          issueId: issue._id,
        },
        actorId: userId,
        entityType: 'issue',
        eventType: 'issue_team_changed',
        details: {
          field: 'team',
          fromId: issue.teamId,
          fromLabel: teamLabel(previousTeam),
          toId: args.teamId,
          toLabel: teamLabel(nextTeam),
        },
        snapshot,
      });

      if (issue.teamId) {
        await recordActivity(ctx, {
          scope: {
            organizationId: issue.organizationId,
            teamId: issue.teamId,
            projectId: issue.projectId ?? undefined,
            issueId: issue._id,
          },
          actorId: userId,
          entityType: 'issue',
          eventType: 'issue_team_removed',
          details: {
            field: 'team',
            fromId: issue.teamId,
            fromLabel: teamLabel(previousTeam),
            toId: args.teamId,
            toLabel: teamLabel(nextTeam),
          },
          snapshot,
        });
      }

      if (args.teamId) {
        await recordActivity(ctx, {
          scope: {
            organizationId: issue.organizationId,
            teamId: args.teamId,
            projectId: issue.projectId ?? undefined,
            issueId: issue._id,
          },
          actorId: userId,
          entityType: 'issue',
          eventType: 'issue_team_added',
          details: {
            field: 'team',
            fromId: issue.teamId,
            fromLabel: teamLabel(previousTeam),
            toId: args.teamId,
            toLabel: teamLabel(nextTeam),
          },
          snapshot,
        });
      }
    }
  },
});

export const changeProject = mutation({
  args: {
    issueId: v.id('issues'),
    projectId: v.union(v.id('projects'), v.null()),
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

    if (!(await canUpdateIssueRelations(ctx, issue))) {
      throw new ConvexError('FORBIDDEN');
    }

    const previousProject = issue.projectId
      ? await ctx.db.get('projects', issue.projectId)
      : null;
    await ctx.db.patch('issues', args.issueId, {
      projectId: args.projectId ?? undefined,
    });

    if (args.projectId !== issue.projectId) {
      const nextProject = args.projectId
        ? await ctx.db.get('projects', args.projectId)
        : null;
      const snapshot = snapshotForIssue(issue);

      await recordActivity(ctx, {
        scope: {
          organizationId: issue.organizationId,
          teamId: issue.teamId ?? undefined,
          projectId: args.projectId ?? undefined,
          issueId: issue._id,
        },
        actorId: userId,
        entityType: 'issue',
        eventType: 'issue_project_changed',
        details: {
          field: 'project',
          fromId: issue.projectId,
          fromLabel: projectLabel(previousProject),
          toId: args.projectId,
          toLabel: projectLabel(nextProject),
        },
        snapshot,
      });

      if (issue.projectId) {
        await recordActivity(ctx, {
          scope: {
            organizationId: issue.organizationId,
            teamId: issue.teamId ?? undefined,
            projectId: issue.projectId,
            issueId: issue._id,
          },
          actorId: userId,
          entityType: 'issue',
          eventType: 'issue_project_removed',
          details: {
            field: 'project',
            fromId: issue.projectId,
            fromLabel: projectLabel(previousProject),
            toId: args.projectId,
            toLabel: projectLabel(nextProject),
          },
          snapshot,
        });
      }

      if (args.projectId) {
        await recordActivity(ctx, {
          scope: {
            organizationId: issue.organizationId,
            teamId: issue.teamId ?? undefined,
            projectId: args.projectId,
            issueId: issue._id,
          },
          actorId: userId,
          entityType: 'issue',
          eventType: 'issue_project_added',
          details: {
            field: 'project',
            fromId: issue.projectId,
            fromLabel: projectLabel(previousProject),
            toId: args.projectId,
            toLabel: projectLabel(nextProject),
          },
          snapshot,
        });
      }
    }
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

    await ctx.db.patch('issues', args.issueId, {
      title: args.title,
      searchText: buildIssueSearchText({
        key: issue.key,
        title: args.title,
        description: issue.description,
      }),
    });

    if (args.title !== issue.title) {
      await recordActivity(ctx, {
        scope: resolveIssueScope(issue),
        actorId: userId,
        entityType: 'issue',
        eventType: 'issue_title_changed',
        details: {
          field: 'title',
          fromLabel: issue.title,
          toLabel: args.title,
        },
        snapshot: snapshotForIssue({
          ...issue,
          title: args.title,
        }),
      });
    }
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
      searchText: buildIssueSearchText({
        key: issue.key,
        title: issue.title,
        description: args.description,
      }),
    });

    if (args.description !== issue.description) {
      await recordActivity(ctx, {
        scope: resolveIssueScope(issue),
        actorId: userId,
        entityType: 'issue',
        eventType: 'issue_description_changed',
        details: {
          field: 'description',
        },
        snapshot: snapshotForIssue(issue),
      });
    }
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
    const userId = await getAuthUserId(ctx);
    if (userId === null) {
      throw new ConvexError('UNAUTHORIZED');
    }

    const issue = await ctx.db.get('issues', args.issueId);
    if (!issue) throw new ConvexError('ISSUE_NOT_FOUND');

    if (!(await canEditIssue(ctx, issue))) {
      throw new ConvexError('FORBIDDEN');
    }

    await ctx.db.patch('issues', args.issueId, {
      visibility: args.visibility,
    });

    if (args.visibility !== issue.visibility) {
      await recordActivity(ctx, {
        scope: resolveIssueScope(issue),
        actorId: userId,
        entityType: 'issue',
        eventType: 'issue_visibility_changed',
        details: {
          field: 'visibility',
          fromLabel: getVisibilityLabel(issue.visibility),
          toLabel: getVisibilityLabel(args.visibility),
        },
        snapshot: snapshotForIssue(issue),
      });
    }

    return { success: true } as const;
  },
});
