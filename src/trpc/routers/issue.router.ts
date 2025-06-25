import { createTRPCRouter, protectedProcedure } from "@/trpc/init";
import { TRPCError } from "@trpc/server";
import { eq, and } from "drizzle-orm";
import { projectMember as projectMemberTable } from "@/db/schema";
import {
  createIssue,
  changeState,
  changePriority,
  assign,
  updateTitle,
  updateDescription,
} from "@/entities/issues/issue.service";
import {
  createComment,
  updateComment,
  deleteComment,
} from "@/entities/issues/comment.service";
import { z } from "zod";
import { assertAssigneeOrLeadOrAdmin } from "@/trpc/permissions";

export const issueRouter = createTRPCRouter({
  create: protectedProcedure
    .input(
      z.object({
        teamId: z.string().uuid(),
        reporterId: z.string(),
        title: z.string().min(1),
        description: z.string().optional(),
        projectId: z.string().uuid().optional(),
        priorityId: z.string().uuid().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      // Enforce: if user is only a member (not admin/lead) and provides projectId, they must be part of that project.
      if (input.projectId) {
        const userId = (ctx.session as any).user.id; // Better-Auth typing TBD
        const rows = await ctx.db
          .select({ projectId: projectMemberTable.projectId })
          .from(projectMemberTable)
          .where(
            and(
              eq(projectMemberTable.projectId, input.projectId),
              eq(projectMemberTable.userId, userId),
            ),
          )
          .limit(1);
        if (rows.length === 0) {
          throw new TRPCError({
            code: "FORBIDDEN",
            message: "Not a member of project",
          });
        }
      }

      const { id } = await createIssue(input);
      return { id } as const;
    }),

  changeState: protectedProcedure
    .input(
      z.object({
        issueId: z.string().uuid(),
        actorId: z.string(),
        stateId: z.string().uuid(),
      }),
    )
    .use(({ ctx, next, input }) => {
      return assertAssigneeOrLeadOrAdmin(ctx, input.issueId).then(() => next());
    })
    .mutation(async ({ input }) => {
      await changeState(input.issueId, input.actorId, input.stateId);
    }),

  changePriority: protectedProcedure
    .input(
      z.object({
        issueId: z.string().uuid(),
        actorId: z.string(),
        priorityId: z.string().uuid(),
      }),
    )
    .use(({ ctx, next, input }) => {
      return assertAssigneeOrLeadOrAdmin(ctx, input.issueId).then(() => next());
    })
    .mutation(async ({ input }) => {
      await changePriority(input.issueId, input.actorId, input.priorityId);
    }),

  assign: protectedProcedure
    .input(
      z.object({
        issueId: z.string().uuid(),
        actorId: z.string(),
        assigneeId: z.string().nullable(),
      }),
    )
    .use(({ ctx, next, input }) => {
      return assertAssigneeOrLeadOrAdmin(ctx, input.issueId).then(() => next());
    })
    .mutation(async ({ input }) => {
      await assign(input.issueId, input.actorId, input.assigneeId);
    }),

  updateTitle: protectedProcedure
    .input(
      z.object({
        issueId: z.string().uuid(),
        actorId: z.string(),
        title: z.string().min(1),
      }),
    )
    .mutation(async ({ input }) => {
      await updateTitle(input.issueId, input.actorId, input.title);
    }),

  updateDescription: protectedProcedure
    .input(
      z.object({
        issueId: z.string().uuid(),
        actorId: z.string(),
        description: z.string().nullable(),
      }),
    )
    .mutation(async ({ input }) => {
      await updateDescription(input.issueId, input.actorId, input.description);
    }),

  addComment: protectedProcedure
    .input(
      z.object({
        issueId: z.string().uuid(),
        authorId: z.string(),
        body: z.string().min(1),
      }),
    )
    .mutation(async ({ input }) => {
      const { id } = await createComment({
        issueId: input.issueId,
        authorId: input.authorId,
        body: input.body,
      });
      return { id } as const;
    }),

  updateComment: protectedProcedure
    .input(
      z.object({
        commentId: z.string().uuid(),
        authorId: z.string(),
        body: z.string().min(1),
      }),
    )
    .mutation(async ({ input }) => {
      await updateComment(input.commentId, input.authorId, input.body);
    }),

  deleteComment: protectedProcedure
    .input(z.object({ commentId: z.string().uuid(), actorId: z.string() }))
    .mutation(async ({ input }) => {
      await deleteComment(input.commentId, input.actorId);
    }),
});
