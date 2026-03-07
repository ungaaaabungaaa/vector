import { defineSchema, defineTable } from 'convex/server';
import { v } from 'convex/values';

export default defineSchema({
  users: defineTable({
    name: v.optional(v.string()),
    image: v.optional(v.string()),
    email: v.optional(v.string()),
    emailVerificationTime: v.optional(v.number()),
    phone: v.optional(v.string()),
    phoneVerificationTime: v.optional(v.number()),
    isAnonymous: v.optional(v.boolean()),
    // Our custom fields
    username: v.optional(v.string()),
    role: v.optional(v.string()),
  })
    .index('email', ['email'])
    .index('phone', ['phone'])
    .index('by_username', ['username'])
    .searchIndex('by_name_email_username', {
      searchField: 'name',
    }),

  // Organizations (equivalent to Drizzle 'organization' table)
  organizations: defineTable({
    name: v.string(),
    slug: v.string(),
    logo: v.optional(v.id('_storage')),
    metadata: v.optional(v.string()),
  }).index('by_slug', ['slug']),

  // Organization members (equivalent to Drizzle 'member' table)
  members: defineTable({
    organizationId: v.id('organizations'),
    userId: v.id('users'),
    role: v.union(v.literal('owner'), v.literal('admin'), v.literal('member')),
  })
    .index('by_organization', ['organizationId'])
    .index('by_user', ['userId'])
    .index('by_org_user', ['organizationId', 'userId']),

  // Organization invitations (equivalent to Drizzle 'invitation' table)
  invitations: defineTable({
    organizationId: v.id('organizations'),
    email: v.string(),
    role: v.union(v.literal('owner'), v.literal('admin'), v.literal('member')),
    status: v.union(
      v.literal('pending'),
      v.literal('accepted'),
      v.literal('expired'),
      v.literal('revoked'),
    ),
    acceptedAt: v.optional(v.number()),
    revokedAt: v.optional(v.number()),
    expiresAt: v.number(),
    inviterId: v.id('users'),
  })
    .index('by_organization', ['organizationId'])
    .index('by_email', ['email'])
    .index('by_status', ['status']),

  // Custom organization roles (equivalent to Drizzle 'orgRole' table)
  orgRoles: defineTable({
    organizationId: v.id('organizations'),
    name: v.string(),
    description: v.optional(v.string()),
    system: v.boolean(),
  })
    .index('by_organization', ['organizationId'])
    .index('by_org_name', ['organizationId', 'name']),

  // Role permissions (equivalent to Drizzle 'orgRolePermission' table)
  orgRolePermissions: defineTable({
    roleId: v.id('orgRoles'),
    permission: v.string(),
  })
    .index('by_role', ['roleId'])
    .index('by_role_permission', ['roleId', 'permission']),

  // Role assignments (equivalent to Drizzle 'orgRoleAssignment' table)
  orgRoleAssignments: defineTable({
    roleId: v.id('orgRoles'),
    userId: v.id('users'),
    organizationId: v.id('organizations'), // redundant for fast lookups
    assignedAt: v.number(),
  })
    .index('by_role', ['roleId'])
    .index('by_user', ['userId'])
    .index('by_organization', ['organizationId'])
    .index('by_role_user', ['roleId', 'userId']),

  // Team-scoped roles
  teamRoles: defineTable({
    teamId: v.id('teams'),
    name: v.string(),
    description: v.optional(v.string()),
    system: v.boolean(), // true for built-in roles like "Lead", "Member"
  })
    .index('by_team', ['teamId'])
    .index('by_team_name', ['teamId', 'name']),

  // Team role permissions
  teamRolePermissions: defineTable({
    roleId: v.id('teamRoles'),
    permission: v.string(),
  })
    .index('by_role', ['roleId'])
    .index('by_role_permission', ['roleId', 'permission']),

  // Team role assignments
  teamRoleAssignments: defineTable({
    roleId: v.id('teamRoles'),
    userId: v.id('users'),
    teamId: v.id('teams'), // redundant for fast lookups
    assignedAt: v.number(),
  })
    .index('by_role', ['roleId'])
    .index('by_user', ['userId'])
    .index('by_team', ['teamId'])
    .index('by_role_user', ['roleId', 'userId']),

  // Project-scoped roles
  projectRoles: defineTable({
    projectId: v.id('projects'),
    name: v.string(),
    description: v.optional(v.string()),
    system: v.boolean(), // true for built-in roles like "Lead", "Member"
  })
    .index('by_project', ['projectId'])
    .index('by_project_name', ['projectId', 'name']),

  // Project role permissions
  projectRolePermissions: defineTable({
    roleId: v.id('projectRoles'),
    permission: v.string(),
  })
    .index('by_role', ['roleId'])
    .index('by_role_permission', ['roleId', 'permission']),

  // Project role assignments
  projectRoleAssignments: defineTable({
    roleId: v.id('projectRoles'),
    userId: v.id('users'),
    projectId: v.id('projects'), // redundant for fast lookups
    assignedAt: v.number(),
  })
    .index('by_role', ['roleId'])
    .index('by_user', ['userId'])
    .index('by_project', ['projectId'])
    .index('by_role_user', ['roleId', 'userId']),

  // Teams (equivalent to Drizzle 'team' table)
  teams: defineTable({
    organizationId: v.id('organizations'),
    key: v.string(), // short, uppercase key like ENG, MKT
    name: v.string(),
    description: v.optional(v.string()),
    icon: v.optional(v.string()),
    color: v.optional(v.string()),
    leadId: v.optional(v.id('users')),
    visibility: v.optional(
      v.union(
        v.literal('private'), // only creator/members can view
        v.literal('organization'), // full org can see it
        v.literal('public'), // publicly accessible (view-only)
      ),
    ),
    createdBy: v.optional(v.id('users')), // Made optional for backwards compatibility with existing data
  })
    .index('by_organization', ['organizationId'])
    .index('by_key', ['key'])
    .index('by_org_key', ['organizationId', 'key'])
    .index('by_lead', ['leadId'])
    .index('by_visibility', ['visibility'])
    .index('by_org_visibility', ['organizationId', 'visibility']),

  // Team members (equivalent to Drizzle 'teamMember' table)
  teamMembers: defineTable({
    teamId: v.id('teams'),
    userId: v.id('users'),
    role: v.union(v.literal('lead'), v.literal('member')),
    joinedAt: v.number(),
  })
    .index('by_team', ['teamId'])
    .index('by_user', ['userId'])
    .index('by_team_user', ['teamId', 'userId']),

  // Project statuses (equivalent to Drizzle 'projectStatus' table)
  projectStatuses: defineTable({
    organizationId: v.id('organizations'),
    name: v.string(),
    position: v.number(),
    color: v.optional(v.string()),
    icon: v.optional(v.string()),
    type: v.union(
      v.literal('backlog'),
      v.literal('planned'),
      v.literal('in_progress'),
      v.literal('completed'),
      v.literal('canceled'),
    ),
  })
    .index('by_organization', ['organizationId'])
    .index('by_org_type', ['organizationId', 'type'])
    .index('by_org_position', ['organizationId', 'position']),

  // Projects (equivalent to Drizzle 'project' table)
  projects: defineTable({
    organizationId: v.id('organizations'),
    key: v.string(), // URL-friendly key
    name: v.string(),
    description: v.optional(v.string()),
    icon: v.optional(v.string()),
    color: v.optional(v.string()),
    teamId: v.optional(v.id('teams')),
    leadId: v.optional(v.id('users')),
    createdBy: v.optional(v.id('users')), // Made optional for backwards compatibility with existing data
    startDate: v.optional(v.string()), // ISO date string
    dueDate: v.optional(v.string()), // ISO date string
    statusId: v.optional(v.id('projectStatuses')),
    visibility: v.optional(
      v.union(
        v.literal('private'), // only creator/members can view
        v.literal('organization'), // full org can see it
        v.literal('public'), // publicly accessible (view-only)
      ),
    ),
  })
    .index('by_organization', ['organizationId'])
    .index('by_team', ['teamId'])
    .index('by_lead', ['leadId'])
    .index('by_created_by', ['createdBy'])
    .index('by_org_key', ['organizationId', 'key'])
    .index('by_status', ['statusId'])
    .index('by_visibility', ['visibility'])
    .index('by_org_visibility', ['organizationId', 'visibility']),

  // Project members (equivalent to Drizzle 'projectMember' table)
  projectMembers: defineTable({
    projectId: v.id('projects'),
    userId: v.id('users'),
    role: v.optional(v.string()),
    joinedAt: v.number(),
  })
    .index('by_project', ['projectId'])
    .index('by_user', ['userId'])
    .index('by_project_user', ['projectId', 'userId']),

  // Project teams (equivalent to Drizzle 'projectTeam' table)
  projectTeams: defineTable({
    projectId: v.id('projects'),
    teamId: v.id('teams'),
  })
    .index('by_project', ['projectId'])
    .index('by_team', ['teamId'])
    .index('by_project_team', ['projectId', 'teamId']),

  // Issue priorities (equivalent to Drizzle 'issuePriority' table)
  issuePriorities: defineTable({
    organizationId: v.id('organizations'),
    name: v.string(),
    weight: v.number(), // smaller = lower priority, larger = higher priority
    color: v.optional(v.string()),
    icon: v.optional(v.string()),
  })
    .index('by_organization', ['organizationId'])
    .index('by_org_weight', ['organizationId', 'weight'])
    .index('by_weight', ['weight']),

  // Issue states (equivalent to Drizzle 'issueState' table)
  issueStates: defineTable({
    organizationId: v.id('organizations'),
    name: v.string(),
    position: v.number(), // ordering left->right in board
    color: v.optional(v.string()),
    icon: v.optional(v.string()),
    type: v.union(
      v.literal('backlog'),
      v.literal('todo'),
      v.literal('in_progress'),
      v.literal('done'),
      v.literal('canceled'),
    ),
  })
    .index('by_organization', ['organizationId'])
    .index('by_org_type', ['organizationId', 'type'])
    .index('by_org_position', ['organizationId', 'position']),

  // Issue labels (equivalent to Drizzle 'issueLabel' table)
  issueLabels: defineTable({
    organizationId: v.id('organizations'),
    name: v.string(),
    color: v.optional(v.string()),
  })
    .index('by_organization', ['organizationId'])
    .index('by_org_name', ['organizationId', 'name']),

  // Issues (equivalent to Drizzle 'issue' table)
  issues: defineTable({
    organizationId: v.id('organizations'),
    key: v.string(), // full issue key like JOH-123
    sequenceNumber: v.number(), // monotonic per team
    title: v.string(),
    description: v.optional(v.string()),
    priorityId: v.optional(v.id('issuePriorities')),
    teamId: v.optional(v.id('teams')),
    projectId: v.optional(v.id('projects')),
    reporterId: v.optional(v.id('users')),
    startDate: v.optional(v.string()), // ISO date string
    estimatedTimes: v.optional(v.record(v.string(), v.number())), // state ID -> hours
    dueDate: v.optional(v.string()), // ISO date string
    closedAt: v.optional(v.number()),
    visibility: v.optional(
      v.union(
        v.literal('private'), // only creator/assignees can view
        v.literal('organization'), // full org can see it
        v.literal('public'), // publicly accessible (view-only)
      ),
    ),
    createdBy: v.optional(v.id('users')), // Made optional for backwards compatibility with existing data
    parentIssueId: v.optional(v.id('issues')),
  })
    .index('by_organization', ['organizationId'])
    .index('by_key', ['key'])
    .index('by_org_key', ['organizationId', 'key'])
    .index('by_team', ['teamId'])
    .index('by_project', ['projectId'])
    .index('by_priority', ['priorityId'])
    .index('by_reporter', ['reporterId'])
    .index('by_team_sequence', ['teamId', 'sequenceNumber'])
    .index('by_org_team', ['organizationId', 'teamId'])
    .index('by_closed', ['closedAt'])
    .index('by_visibility', ['visibility'])
    .index('by_org_visibility', ['organizationId', 'visibility'])
    .index('by_created_by', ['createdBy'])
    .index('by_parent', ['parentIssueId']),

  // Issue assignees (equivalent to Drizzle 'issueAssignee' table)
  issueAssignees: defineTable({
    issueId: v.id('issues'),
    assigneeId: v.optional(v.id('users')), // nullable for "unassigned"
    stateId: v.id('issueStates'),
  })
    .index('by_issue', ['issueId'])
    .index('by_assignee', ['assigneeId'])
    .index('by_state', ['stateId'])
    .index('by_issue_assignee', ['issueId', 'assigneeId']),

  // Issue activity (equivalent to Drizzle 'issueActivity' table)
  issueActivities: defineTable({
    issueId: v.id('issues'),
    actorId: v.id('users'),
    type: v.union(
      v.literal('status_changed'),
      v.literal('priority_changed'),
      v.literal('assignee_changed'),
      v.literal('comment_added'),
      v.literal('title_changed'),
      v.literal('description_changed'),
      v.literal('created'),
      v.literal('sub_issue_created'),
    ),
    payload: v.optional(v.record(v.string(), v.any())), // JSON payload
  })
    .index('by_issue', ['issueId'])
    .index('by_actor', ['actorId'])
    .index('by_type', ['type'])
    .index('by_issue_type', ['issueId', 'type']),

  // Comments (equivalent to Drizzle 'comment' table)
  comments: defineTable({
    issueId: v.id('issues'),
    authorId: v.id('users'),
    body: v.string(),
    deleted: v.boolean(),
  })
    .index('by_issue', ['issueId'])
    .index('by_author', ['authorId'])
    .index('by_issue_deleted', ['issueId', 'deleted']),

  // Issue label assignments (equivalent to Drizzle 'issueLabelAssignment' table)
  issueLabelAssignments: defineTable({
    issueId: v.id('issues'),
    labelId: v.id('issueLabels'),
  })
    .index('by_issue', ['issueId'])
    .index('by_label', ['labelId'])
    .index('by_issue_label', ['issueId', 'labelId']),

  activities: defineTable({
    issueId: v.id('issues'),
    actorId: v.id('users'),
    type: v.string(),
    payload: v.optional(v.any()),
  }).index('by_issue', ['issueId']),
});
