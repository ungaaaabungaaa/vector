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
} from "drizzle-orm/pg-core";
import { user } from "./users-and-auth";
import { team } from "./teams";
import { project } from "./projects";
import { issuePriority } from "./issue-config";
import { issueState } from "./issue-config";

export const issue = pgTable(
  "issue",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    /** Monotonically increasing number per team, e.g. 123 in ENG-123 */
    sequenceNumber: integer("sequence_number").notNull(),
    title: text("title").notNull(),
    description: text("description"),
    stateId: uuid("state_id").references(() => issueState.id, {
      onDelete: "set null",
    }),
    priorityId: uuid("priority_id").references(() => issuePriority.id, {
      onDelete: "set null",
    }),
    teamId: uuid("team_id")
      .notNull()
      .references(() => team.id, { onDelete: "cascade" }),
    projectId: uuid("project_id").references(() => project.id, {
      onDelete: "set null",
    }),
    assigneeId: text("assignee_id").references(() => user.id, {
      onDelete: "set null",
    }),
    reporterId: text("reporter_id").references(() => user.id, {
      onDelete: "set null",
    }),
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
