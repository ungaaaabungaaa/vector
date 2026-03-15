import { ConvexError } from 'convex/values';
import { internalMutation } from '../_generated/server';
import type { ActivityEventType } from '../_shared/activity';
import { PERMISSION_VALUES, type Permission } from '../_shared/permissions';
import {
  recordActivity,
  resolveIssueScope,
  snapshotForIssue,
} from '../activities/lib';
import { buildIssueSearchTextFromIssue } from '../issues/search';
import {
  createDefaultProjectRoles,
  createDefaultTeamRoles,
  syncOrganizationRoleAssignment,
  syncProjectRoleAssignment,
  syncTeamRoleAssignment,
} from '../roles';

const knownPermissions = new Set<string>(PERMISSION_VALUES);

function assertKnownPermission(
  permission: string,
): asserts permission is Permission {
  if (!knownPermissions.has(permission)) {
    throw new ConvexError(`UNKNOWN_PERMISSION:${permission}`);
  }
}

export const migrateUnifiedRoles = internalMutation({
  args: {},
  handler: async ctx => {
    const organizations = await ctx.db.query('organizations').collect();
    for (const organization of organizations) {
      const members = await ctx.db
        .query('members')
        .withIndex('by_organization', q =>
          q.eq('organizationId', organization._id),
        )
        .collect();

      for (const member of members) {
        await syncOrganizationRoleAssignment(
          ctx,
          organization._id,
          member.userId,
          member.role,
        );
      }
    }

    const teams = await ctx.db.query('teams').collect();
    for (const team of teams) {
      await createDefaultTeamRoles(ctx, team._id);

      const teamMembers = await ctx.db
        .query('teamMembers')
        .withIndex('by_team', q => q.eq('teamId', team._id))
        .collect();

      for (const member of teamMembers) {
        await syncTeamRoleAssignment(ctx, team._id, member.userId, member.role);
      }

      const legacyCustomRoles = await ctx.db
        .query('teamRoles')
        .withIndex('by_team', q => q.eq('teamId', team._id))
        .collect();

      for (const legacyRole of legacyCustomRoles.filter(role => !role.system)) {
        const key = `legacy:team:${legacyRole._id}`;
        const existingRole = await ctx.db
          .query('roles')
          .withIndex('by_org_key', q =>
            q.eq('organizationId', team.organizationId).eq('key', key),
          )
          .first();

        const roleId =
          existingRole?._id ??
          (await ctx.db.insert('roles', {
            organizationId: team.organizationId,
            scopeType: 'team',
            teamId: team._id,
            key,
            name: legacyRole.name,
            description: legacyRole.description,
            system: false,
          }));

        const existingPermissions = await ctx.db
          .query('rolePermissions')
          .withIndex('by_role', q => q.eq('roleId', roleId))
          .collect();

        if (existingPermissions.length === 0) {
          const legacyPermissions = await ctx.db
            .query('teamRolePermissions')
            .withIndex('by_role', q => q.eq('roleId', legacyRole._id))
            .collect();

          for (const permission of legacyPermissions) {
            assertKnownPermission(permission.permission);
            await ctx.db.insert('rolePermissions', {
              roleId,
              permission: permission.permission,
            });
          }
        }

        const assignments = await ctx.db
          .query('teamRoleAssignments')
          .withIndex('by_role', q => q.eq('roleId', legacyRole._id))
          .collect();

        for (const assignment of assignments) {
          const existingAssignment = await ctx.db
            .query('roleAssignments')
            .withIndex('by_role_user', q =>
              q.eq('roleId', roleId).eq('userId', assignment.userId),
            )
            .first();

          if (!existingAssignment) {
            await ctx.db.insert('roleAssignments', {
              roleId,
              userId: assignment.userId,
              organizationId: team.organizationId,
              teamId: team._id,
              assignedAt: assignment.assignedAt,
            });
          }
        }
      }
    }

    const projects = await ctx.db.query('projects').collect();
    for (const project of projects) {
      await createDefaultProjectRoles(ctx, project._id);

      const projectMembers = await ctx.db
        .query('projectMembers')
        .withIndex('by_project', q => q.eq('projectId', project._id))
        .collect();

      for (const member of projectMembers) {
        const role = member.role === 'lead' ? 'lead' : 'member';
        await syncProjectRoleAssignment(ctx, project._id, member.userId, role);
      }

      const legacyCustomRoles = await ctx.db
        .query('projectRoles')
        .withIndex('by_project', q => q.eq('projectId', project._id))
        .collect();

      for (const legacyRole of legacyCustomRoles.filter(role => !role.system)) {
        const key = `legacy:project:${legacyRole._id}`;
        const existingRole = await ctx.db
          .query('roles')
          .withIndex('by_org_key', q =>
            q.eq('organizationId', project.organizationId).eq('key', key),
          )
          .first();

        const roleId =
          existingRole?._id ??
          (await ctx.db.insert('roles', {
            organizationId: project.organizationId,
            scopeType: 'project',
            projectId: project._id,
            key,
            name: legacyRole.name,
            description: legacyRole.description,
            system: false,
          }));

        const existingPermissions = await ctx.db
          .query('rolePermissions')
          .withIndex('by_role', q => q.eq('roleId', roleId))
          .collect();

        if (existingPermissions.length === 0) {
          const legacyPermissions = await ctx.db
            .query('projectRolePermissions')
            .withIndex('by_role', q => q.eq('roleId', legacyRole._id))
            .collect();

          for (const permission of legacyPermissions) {
            assertKnownPermission(permission.permission);
            await ctx.db.insert('rolePermissions', {
              roleId,
              permission: permission.permission,
            });
          }
        }

        const assignments = await ctx.db
          .query('projectRoleAssignments')
          .withIndex('by_role', q => q.eq('roleId', legacyRole._id))
          .collect();

        for (const assignment of assignments) {
          const existingAssignment = await ctx.db
            .query('roleAssignments')
            .withIndex('by_role_user', q =>
              q.eq('roleId', roleId).eq('userId', assignment.userId),
            )
            .first();

          if (!existingAssignment) {
            await ctx.db.insert('roleAssignments', {
              roleId,
              userId: assignment.userId,
              organizationId: project.organizationId,
              projectId: project._id,
              assignedAt: assignment.assignedAt,
            });
          }
        }
      }
    }

    const orgs = await ctx.db.query('organizations').collect();
    for (const org of orgs) {
      const legacyCustomRoles = await ctx.db
        .query('orgRoles')
        .withIndex('by_organization', q => q.eq('organizationId', org._id))
        .collect();

      for (const legacyRole of legacyCustomRoles.filter(role => !role.system)) {
        const key = `legacy:org:${legacyRole._id}`;
        const existingRole = await ctx.db
          .query('roles')
          .withIndex('by_org_key', q =>
            q.eq('organizationId', org._id).eq('key', key),
          )
          .first();

        const roleId =
          existingRole?._id ??
          (await ctx.db.insert('roles', {
            organizationId: org._id,
            scopeType: 'organization',
            key,
            name: legacyRole.name,
            description: legacyRole.description,
            system: false,
          }));

        const existingPermissions = await ctx.db
          .query('rolePermissions')
          .withIndex('by_role', q => q.eq('roleId', roleId))
          .collect();

        if (existingPermissions.length === 0) {
          const legacyPermissions = await ctx.db
            .query('orgRolePermissions')
            .withIndex('by_role', q => q.eq('roleId', legacyRole._id))
            .collect();

          for (const permission of legacyPermissions) {
            assertKnownPermission(permission.permission);
            await ctx.db.insert('rolePermissions', {
              roleId,
              permission: permission.permission,
            });
          }
        }

        const assignments = await ctx.db
          .query('orgRoleAssignments')
          .withIndex('by_role', q => q.eq('roleId', legacyRole._id))
          .collect();

        for (const assignment of assignments) {
          const existingAssignment = await ctx.db
            .query('roleAssignments')
            .withIndex('by_role_user', q =>
              q.eq('roleId', roleId).eq('userId', assignment.userId),
            )
            .first();

          if (!existingAssignment) {
            await ctx.db.insert('roleAssignments', {
              roleId,
              userId: assignment.userId,
              organizationId: org._id,
              assignedAt: assignment.assignedAt,
            });
          }
        }
      }
    }

    return {
      success: true,
      message: 'Unified roles and assignments migrated successfully',
    };
  },
});

export const migrateDefaultRoles = migrateUnifiedRoles;
export const migrateTeamMembers = migrateUnifiedRoles;
export const migrateProjectMembers = migrateUnifiedRoles;

function mapLegacyIssueActivityType(type: string): ActivityEventType | null {
  switch (type) {
    case 'status_changed':
      return 'issue_assignment_state_changed';
    case 'priority_changed':
      return 'issue_priority_changed';
    case 'assignee_changed':
      return 'issue_assignees_changed';
    case 'comment_added':
      return 'issue_comment_added';
    case 'title_changed':
      return 'issue_title_changed';
    case 'description_changed':
      return 'issue_description_changed';
    case 'created':
      return 'issue_created';
    case 'sub_issue_created':
      return 'issue_sub_issue_created';
    default:
      return null;
  }
}

export const backfillActivityEvents = internalMutation({
  args: {},
  handler: async ctx => {
    const existingEvents = await ctx.db.query('activityEvents').first();
    if (existingEvents) {
      return {
        success: true,
        inserted: 0,
      };
    }

    const legacyIssueActivities = await ctx.db
      .query('issueActivities')
      .collect();
    let inserted = 0;

    for (const activity of legacyIssueActivities) {
      const eventType = mapLegacyIssueActivityType(activity.type);
      if (!eventType) {
        continue;
      }

      const issue = await ctx.db.get('issues', activity.issueId);
      if (!issue) {
        continue;
      }

      await recordActivity(ctx, {
        scope: resolveIssueScope(issue),
        actorId: activity.actorId,
        entityType: 'issue',
        eventType,
        details:
          activity.type === 'sub_issue_created'
            ? {
                toId:
                  typeof activity.payload?.subIssueId === 'string'
                    ? activity.payload.subIssueId
                    : undefined,
                toLabel:
                  typeof activity.payload?.subIssueKey === 'string'
                    ? activity.payload.subIssueKey
                    : undefined,
              }
            : undefined,
        snapshot: snapshotForIssue(issue),
      });
      inserted += 1;
    }

    const legacyActivities = await ctx.db.query('activities').collect();
    for (const activity of legacyActivities) {
      const eventType = mapLegacyIssueActivityType(activity.type);
      if (!eventType || eventType === 'issue_sub_issue_created') {
        continue;
      }

      const issue = await ctx.db.get('issues', activity.issueId);
      if (!issue) {
        continue;
      }

      await recordActivity(ctx, {
        scope: resolveIssueScope(issue),
        actorId: activity.actorId,
        entityType: 'issue',
        eventType,
        details:
          eventType === 'issue_title_changed' &&
          typeof activity.payload?.title === 'string'
            ? {
                field: 'title',
                toLabel: activity.payload.title,
              }
            : eventType === 'issue_priority_changed' &&
                typeof activity.payload?.priorityId === 'string'
              ? {
                  field: 'priority',
                  toId: activity.payload.priorityId,
                }
              : undefined,
        snapshot: snapshotForIssue(issue),
      });
      inserted += 1;
    }

    return {
      success: true,
      inserted,
    };
  },
});

export const backfillIssueSearchText = internalMutation({
  args: {},
  handler: async ctx => {
    const issues = await ctx.db.query('issues').collect();
    let updated = 0;

    for (const issue of issues) {
      const searchText = buildIssueSearchTextFromIssue(issue);
      if (issue.searchText === searchText) {
        continue;
      }

      await ctx.db.patch('issues', issue._id, { searchText });
      updated += 1;
    }

    return {
      success: true,
      scanned: issues.length,
      updated,
    };
  },
});

export const backfillIssueWorkflowState = internalMutation({
  args: {},
  handler: async ctx => {
    const issues = await ctx.db.query('issues').collect();
    let updated = 0;

    for (const issue of issues) {
      if (issue.workflowStateId) {
        continue;
      }

      const firstAssignment = await ctx.db
        .query('issueAssignees')
        .withIndex('by_issue', q => q.eq('issueId', issue._id))
        .first();

      const fallbackState =
        firstAssignment?.stateId ??
        (await ctx.db
          .query('issueStates')
          .withIndex('by_org_type', q =>
            q.eq('organizationId', issue.organizationId).eq('type', 'todo'),
          )
          .first()
          .then(state => state?._id)) ??
        (await ctx.db
          .query('issueStates')
          .withIndex('by_organization', q =>
            q.eq('organizationId', issue.organizationId),
          )
          .order('asc')
          .first()
          .then(state => state?._id));

      if (!fallbackState) {
        continue;
      }

      await ctx.db.patch('issues', issue._id, {
        workflowStateId: fallbackState,
      });
      updated += 1;
    }

    return {
      success: true,
      scanned: issues.length,
      updated,
    };
  },
});
