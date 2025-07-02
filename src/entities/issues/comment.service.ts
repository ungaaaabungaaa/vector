import { db } from "@/db";
import {
  comment as commentTable,
  issueActivity as activityTable,
} from "@/db/schema";
import { randomUUID } from "crypto";
import { InferInsertModel, InferSelectModel, eq } from "drizzle-orm";

// -----------------------------------------------------------------------------
// Types
// -----------------------------------------------------------------------------

type CommentInsertModel = InferInsertModel<typeof commentTable>;
export type Comment = InferSelectModel<typeof commentTable>;

export type CreateCommentParams = Omit<
  CommentInsertModel,
  "id" | "createdAt" | "updatedAt" | "deleted"
>;

export async function createComment(
  params: CreateCommentParams,
): Promise<{ id: string }> {
  const { issueId, authorId, body } = params;
  const id = randomUUID();
  const now = new Date();

  await db.transaction(async (tx) => {
    await tx.insert(commentTable).values({
      id,
      issueId,
      authorId,
      body,
      createdAt: now,
      updatedAt: now,
    });

    await tx.insert(activityTable).values({
      id: randomUUID(),
      issueId,
      actorId: authorId,
      type: "comment_added",
      payload: { commentId: id },
      createdAt: now,
    });
  });

  return { id } as const;
}

// -----------------------------------------------------------------------------
// Updates
// -----------------------------------------------------------------------------

export async function updateComment(
  commentId: string,
  authorId: string,
  body: string,
): Promise<void> {
  const now = new Date();
  await db
    .update(commentTable)
    .set({ body, updatedAt: now })
    .where(eq(commentTable.id, commentId));

  // No activity row for edit to keep noise low – add later if needed.
}

/**
 * Soft‐deletes a comment by setting `deleted = true`.
 */
export async function deleteComment(
  commentId: string,
  actorId: string,
): Promise<void> {
  const now = new Date();
  // 1) Retrieve issueId for activity log
  const rows = await db
    .select({ issueId: commentTable.issueId, deleted: commentTable.deleted })
    .from(commentTable)
    .where(eq(commentTable.id, commentId))
    .limit(1);

  if (rows.length === 0) return; // nothing to do
  if (rows[0].deleted) return; // already deleted

  const issueId = rows[0].issueId!;

  await db.transaction(async (tx) => {
    await tx
      .update(commentTable)
      .set({ deleted: true, updatedAt: now })
      .where(eq(commentTable.id, commentId));

    await tx.insert(activityTable).values({
      id: randomUUID(),
      issueId,
      actorId,
      type: "comment_added", // keeping same type – consumers can inspect payload.deleted
      payload: { commentId, deleted: true },
      createdAt: now,
    });
  });
}
