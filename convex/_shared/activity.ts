import { v } from 'convex/values';

export const ACTIVITY_ENTITY_TYPES = [
  'team',
  'project',
  'issue',
  'document',
] as const;
export type ActivityEntityType = (typeof ACTIVITY_ENTITY_TYPES)[number];

export const ACTIVITY_EVENT_TYPES = [
  'team_created',
  'team_name_changed',
  'team_description_changed',
  'team_lead_changed',
  'team_visibility_changed',
  'team_member_added',
  'team_member_removed',
  'team_role_assigned',
  'team_role_removed',
  'project_created',
  'project_name_changed',
  'project_description_changed',
  'project_status_changed',
  'project_team_changed',
  'project_team_added',
  'project_team_removed',
  'project_lead_changed',
  'project_visibility_changed',
  'project_member_added',
  'project_member_removed',
  'project_role_assigned',
  'project_role_removed',
  'issue_created',
  'issue_title_changed',
  'issue_description_changed',
  'issue_priority_changed',
  'issue_workflow_state_changed',
  'issue_assignment_state_changed',
  'issue_assignees_changed',
  'issue_project_changed',
  'issue_project_added',
  'issue_project_removed',
  'issue_team_changed',
  'issue_team_added',
  'issue_team_removed',
  'issue_visibility_changed',
  'issue_comment_added',
  'issue_sub_issue_created',
  'issue_github_artifact_linked',
  'issue_github_artifact_unlinked',
  'issue_github_artifact_suppressed',
  'issue_github_artifact_status_changed',
  'document_created',
  'document_title_changed',
  'document_content_changed',
  'document_icon_changed',
  'document_color_changed',
  'document_team_changed',
  'document_project_changed',
  'document_visibility_changed',
  'document_deleted',
] as const;

export type ActivityEventType = (typeof ACTIVITY_EVENT_TYPES)[number];

export const ACTIVITY_FIELDS = [
  'name',
  'title',
  'description',
  'status',
  'workflow_state',
  'team',
  'lead',
  'visibility',
  'priority',
  'assignment_state',
  'assignees',
  'project',
  'role',
  'content',
] as const;

export type ActivityField = (typeof ACTIVITY_FIELDS)[number];

export const activityEntityTypeValidator = v.union(
  ...ACTIVITY_ENTITY_TYPES.map(entityType => v.literal(entityType)),
);

export const activityEventTypeValidator = v.union(
  ...ACTIVITY_EVENT_TYPES.map(eventType => v.literal(eventType)),
);

export const activityFieldValidator = v.union(
  ...ACTIVITY_FIELDS.map(field => v.literal(field)),
);

const activityReferenceIdValidator = v.union(
  v.null(),
  v.string(),
  v.id('users'),
  v.id('teams'),
  v.id('projects'),
  v.id('issues'),
  v.id('projectStatuses'),
  v.id('issueStates'),
  v.id('issuePriorities'),
  v.id('documents'),
);

export const activityDetailsValidator = v.object({
  field: v.optional(activityFieldValidator),
  fromId: v.optional(activityReferenceIdValidator),
  fromLabel: v.optional(v.string()),
  toId: v.optional(activityReferenceIdValidator),
  toLabel: v.optional(v.string()),
  subjectUserName: v.optional(v.string()),
  roleName: v.optional(v.string()),
  roleKey: v.optional(v.string()),
  commentId: v.optional(v.id('comments')),
  commentPreview: v.optional(v.string()),
  addedUserNames: v.optional(v.array(v.string())),
  removedUserNames: v.optional(v.array(v.string())),
});

export const activitySnapshotValidator = v.object({
  entityKey: v.optional(v.string()),
  entityName: v.optional(v.string()),
});
