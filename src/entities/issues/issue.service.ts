import { db } from "@/db";
import {
  issue as issueTable,
  issueActivity as activityTable,
  issueActivityTypeEnum as activityEnum,
  project as projectTable,
  issueState as stateTable,
  issuePriority as priorityTable,
} from "@/db/schema";
import { getNextIssueSequence } from "@/entities/teams/team.service";
import { eq, and, InferInsertModel, InferSelectModel } from "drizzle-orm";
import { randomUUID } from "crypto";

// -----------------------------------------------------------------------------
// Types
// -----------------------------------------------------------------------------

type IssueInsertModel = InferInsertModel<typeof issueTable>;
export type Issue = InferSelectModel<typeof issueTable>;

export type CreateIssueParams = {
  teamId: string;
  reporterId: string;
  title: string;
  description?: string;
  projectId?: string;
  priorityId?: string;
};

export async function createIssue(
  params: CreateIssueParams,
): Promise<{ id: string }> {
  const { teamId, reporterId, title, description, projectId, priorityId } =
    params;

  const seq = await getNextIssueSequence(teamId);
  const now = new Date();
  const id = randomUUID();

  await db.transaction(async (tx) => {
    await tx.insert(issueTable).values({
      id,
      sequenceNumber: seq,
      title,
      description,
      teamId,
      reporterId,
      projectId,
      priorityId,
      createdAt: now,
      updatedAt: now,
    });

    await tx.insert(activityTable).values({
      id: randomUUID(),
      issueId: id,
      actorId: reporterId,
      type: activityEnum.enumValues[6]!, // "created"
      createdAt: now,
    });
  });

  return { id } as const;
}

// ----------------------------------------------------------------------------
// Updates
// ----------------------------------------------------------------------------

export async function changeState(
  issueId: string,
  actorId: string,
  stateId: string,
): Promise<void> {
  const now = new Date();
  await db.transaction(async (tx) => {
    await tx
      .update(issueTable)
      .set({ stateId, updatedAt: now })
      .where(eq(issueTable.id, issueId));

    await tx.insert(activityTable).values({
      id: randomUUID(),
      issueId,
      actorId,
      type: "status_changed",
      payload: { stateId },
      createdAt: now,
    });
  });
}

export async function changePriority(
  issueId: string,
  actorId: string,
  priorityId: string,
): Promise<void> {
  const now = new Date();
  await db.transaction(async (tx) => {
    await tx
      .update(issueTable)
      .set({ priorityId, updatedAt: now })
      .where(eq(issueTable.id, issueId));

    await tx.insert(activityTable).values({
      id: randomUUID(),
      issueId,
      actorId,
      type: "priority_changed",
      payload: { priorityId },
      createdAt: now,
    });
  });
}

export async function assign(
  issueId: string,
  actorId: string,
  assigneeId: string | null,
): Promise<void> {
  const now = new Date();
  await db.transaction(async (tx) => {
    await tx
      .update(issueTable)
      .set({ assigneeId, updatedAt: now })
      .where(eq(issueTable.id, issueId));
    await tx.insert(activityTable).values({
      id: randomUUID(),
      issueId,
      actorId,
      type: "assignee_changed",
      payload: { assigneeId },
      createdAt: now,
    });
  });
}

export async function updateTitle(
  issueId: string,
  actorId: string,
  title: string,
): Promise<void> {
  const now = new Date();
  await db.transaction(async (tx) => {
    await tx
      .update(issueTable)
      .set({ title, updatedAt: now })
      .where(eq(issueTable.id, issueId));
    await tx.insert(activityTable).values({
      id: randomUUID(),
      issueId,
      actorId,
      type: "title_changed",
      payload: { title },
      createdAt: now,
    });
  });
}

export async function updateDescription(
  issueId: string,
  actorId: string,
  description: string | null,
): Promise<void> {
  const now = new Date();
  await db.transaction(async (tx) => {
    await tx
      .update(issueTable)
      .set({ description, updatedAt: now })
      .where(eq(issueTable.id, issueId));
    await tx.insert(activityTable).values({
      id: randomUUID(),
      issueId,
      actorId,
      type: "description_changed",
      createdAt: now,
    });
  });
}
