import { db } from "@/db";
import {
  issueAssignee as assignmentTable,
  issueActivity as activityTable,
  issueActivityTypeEnum as activityEnum,
} from "@/db/schema";
import { randomUUID } from "crypto";
import { InferSelectModel, eq, and } from "drizzle-orm";

// -----------------------------------------------------------------------------
// Types
// -----------------------------------------------------------------------------

export type Assignment = InferSelectModel<typeof assignmentTable>;

export interface CreateAssignmentParams {
  issueId: string;
  /** Nullable means create an unassigned placeholder row */
  assigneeId?: string | null;
  /** Initial workflow state id for this assignment */
  stateId: string;
  /** Actor performing the creation (stored in activity log) */
  actorId: string;
}

export async function createAssignment({
  issueId,
  assigneeId = null,
  stateId,
  actorId,
}: CreateAssignmentParams): Promise<{ id: string }> {
  const now = new Date();

  // ------------------------------------------------------------------
  //  Avoid creating duplicate (issueId, assigneeId) pairs
  // ------------------------------------------------------------------
  if (assigneeId) {
    const existing = await db
      .select({ id: assignmentTable.id })
      .from(assignmentTable)
      .where(
        and(
          eq(assignmentTable.issueId, issueId),
          eq(assignmentTable.assigneeId, assigneeId),
        ),
      )
      .limit(1);

    if (existing[0]) {
      return { id: existing[0].id } as const;
    }
  }

  const id = randomUUID();

  await db.transaction(async (tx) => {
    await tx.insert(assignmentTable).values({
      id,
      issueId,
      assigneeId,
      stateId,
      createdAt: now,
      updatedAt: now,
    });

    await tx.insert(activityTable).values({
      id: randomUUID(),
      issueId,
      actorId,
      type: activityEnum.enumValues[6]!, // "created" – mirrors issue creation
      payload: { assignmentId: id },
      createdAt: now,
    });
  });

  return { id } as const;
}

export async function changeAssignmentState(
  assignmentId: string,
  actorId: string,
  stateId: string,
): Promise<void> {
  const now = new Date();
  await db.transaction(async (tx) => {
    await tx
      .update(assignmentTable)
      .set({ stateId, updatedAt: now })
      .where(eq(assignmentTable.id, assignmentId));

    // Log activity at issue level
    const parent = await tx
      .select({ issueId: assignmentTable.issueId })
      .from(assignmentTable)
      .where(eq(assignmentTable.id, assignmentId))
      .limit(1);

    if (parent[0]) {
      await tx.insert(activityTable).values({
        id: randomUUID(),
        issueId: parent[0].issueId,
        actorId,
        type: "status_changed",
        payload: { assignmentId, stateId },
        createdAt: now,
      });
    }
  });
}

export async function updateAssignmentAssignee(
  assignmentId: string,
  actorId: string,
  assigneeId: string | null,
): Promise<void> {
  const now = new Date();
  await db.transaction(async (tx) => {
    await tx
      .update(assignmentTable)
      .set({ assigneeId, updatedAt: now })
      .where(eq(assignmentTable.id, assignmentId));

    // Emit activity
    const parent = await tx
      .select({ issueId: assignmentTable.issueId })
      .from(assignmentTable)
      .where(eq(assignmentTable.id, assignmentId))
      .limit(1);

    if (parent[0]) {
      await tx.insert(activityTable).values({
        id: randomUUID(),
        issueId: parent[0].issueId,
        actorId,
        type: "assignee_changed",
        payload: { assignmentId, assigneeId },
        createdAt: now,
      });
    }
  });
}

// Derive the transaction type from db.transaction callback parameter to keep strict typing
type DbTransaction = Parameters<Parameters<typeof db.transaction>[0]>[0];

export async function createAssignmentInTx(
  tx: DbTransaction,
  { issueId, assigneeId = null, stateId, actorId }: CreateAssignmentParams,
): Promise<{ id: string }> {
  const now = new Date();
  const id = randomUUID();

  await tx.insert(assignmentTable).values({
    id,
    issueId,
    assigneeId,
    stateId,
    createdAt: now,
    updatedAt: now,
  });

  await tx.insert(activityTable).values({
    id: randomUUID(),
    issueId,
    actorId,
    type: activityEnum.enumValues[6]!, // "created"
    payload: { assignmentId: id },
    createdAt: now,
  });

  return { id } as const;
}
