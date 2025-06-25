import { TRPCError } from "@trpc/server";
import { db } from "@/db";
import {
  projectMember as projectMemberTable,
  issue as issueTable,
} from "@/db/schema";
import { eq, and } from "drizzle-orm";
import type { Context } from "@/trpc/init";

/**
 * Throws UNAUTHORIZED if the requester is not logged in.
 */
export function assertAuthenticated(
  ctx: Context,
): asserts ctx is Context & {
  session: { user: { id: string; role: string } };
} {
  if (!ctx.session) throw new TRPCError({ code: "UNAUTHORIZED" });
}

export function assertAdmin(ctx: Context) {
  assertAuthenticated(ctx);
  if (ctx.session.user.role !== "admin") {
    throw new TRPCError({ code: "FORBIDDEN", message: "Admin role required" });
  }
}

export async function assertProjectLeadOrAdmin(
  ctx: Context,
  projectId: string,
) {
  assertAuthenticated(ctx);
  if (ctx.session.user.role === "admin") return;

  const rows = await db
    .select({ role: projectMemberTable.role })
    .from(projectMemberTable)
    .where(
      and(
        eq(projectMemberTable.projectId, projectId),
        eq(projectMemberTable.userId, ctx.session.user.id),
      ),
    )
    .limit(1);

  if (rows.length === 0 || rows[0].role !== "lead") {
    throw new TRPCError({ code: "FORBIDDEN", message: "Lead role required" });
  }
}

export async function assertAssigneeOrLeadOrAdmin(
  ctx: Context,
  issueId: string,
) {
  assertAuthenticated(ctx);
  if (ctx.session.user.role === "admin") return;

  const rows = await db
    .select({
      assigneeId: issueTable.assigneeId,
      projectId: issueTable.projectId,
    })
    .from(issueTable)
    .where(eq(issueTable.id, issueId))
    .limit(1);
  if (rows.length === 0) throw new TRPCError({ code: "NOT_FOUND" });

  const issue = rows[0];
  if (issue.assigneeId === ctx.session.user.id) return; // assignee ok
  if (issue.projectId) {
    await assertProjectLeadOrAdmin(ctx, issue.projectId);
    return;
  }
  throw new TRPCError({ code: "FORBIDDEN" });
}
