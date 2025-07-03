import {
  pgTable,
  uuid,
  text,
  timestamp,
  integer,
  jsonb,
  date,
  index,
  boolean,
  pgEnum,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { user } from "./users-and-auth";
import { team } from "./teams";
import { project } from "./projects";
import { issuePriority } from "./issue-config";
import { issueState } from "./issue-config";
import { organization } from "./users-and-auth";

export const issue = pgTable(
  "issue",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    /** The full issue key, e.g. "JOH-123" (derived from user's name + sequence) */
    key: text("key").notNull().unique(),
    /** Monotonically increasing number per team, e.g. 123 in ENG-123 */
    sequenceNumber: integer("sequence_number").notNull(),
    title: text("title").notNull(),
    description: text("description"),
    priorityId: uuid("priority_id").references(() => issuePriority.id, {
      onDelete: "set null",
    }),
    teamId: uuid("team_id").references(() => team.id, {
      onDelete: "set null",
    }),
    projectId: uuid("project_id").references(() => project.id, {
      onDelete: "set null",
    }),
    reporterId: text("reporter_id").references(() => user.id, {
      onDelete: "set null",
    }),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
    /** Planned start date for the issue */
    startDate: date("start_date"),
    /** Mapping of workflow state ID -> estimated hours to reach that state */
    estimatedTimes: jsonb("estimated_times"),
    dueDate: date("due_date"),
    closedAt: timestamp("closed_at"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => ({
    // Enforce unique key like (team_id, sequence_number)
    teamSeqIdx: index("issue_team_seq_idx").on(
      table.teamId,
      table.sequenceNumber,
    ),
  }),
);

export const issueActivityTypeEnum = pgEnum("issue_activity_type", [
  "status_changed",
  "priority_changed",
  "assignee_changed",
  "comment_added",
  "title_changed",
  "description_changed",
  "created",
]);

export const issueActivity = pgTable("issue_activity", {
  id: uuid("id").defaultRandom().primaryKey(),
  issueId: uuid("issue_id")
    .notNull()
    .references(() => issue.id, { onDelete: "cascade" }),
  actorId: text("actor_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  type: issueActivityTypeEnum("type").notNull(),
  // JSON payload storing change details
  payload: jsonb("payload"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const comment = pgTable("comment", {
  id: uuid("id").defaultRandom().primaryKey(),
  issueId: uuid("issue_id")
    .notNull()
    .references(() => issue.id, { onDelete: "cascade" }),
  authorId: text("author_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  body: text("body").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
  deleted: boolean("deleted").default(false).notNull(),
});

// -----------------------------------------------------------------------------
// Issue Assignees – supports multiple assignees each with independent status
// -----------------------------------------------------------------------------

export const issueAssignee = pgTable(
  "issue_assignee",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    issueId: uuid("issue_id")
      .notNull()
      .references(() => issue.id, { onDelete: "cascade" }),
    /** Nullable so an assignment can be created without a user yet ("unassigned") */
    assigneeId: text("assignee_id").references(() => user.id, {
      onDelete: "set null",
    }),
    /** Workflow state for this particular assignee */
    stateId: uuid("state_id")
      .notNull()
      .references(() => issueState.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => ({
    uniqueAssignee: uniqueIndex("issue_assignee_issue_idx").on(
      table.issueId,
      table.assigneeId,
    ),
  }),
);
