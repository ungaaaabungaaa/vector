import { createTRPCRouter, protectedProcedure, getUserId } from "@/trpc/init";
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
  findIssueByKey,
  deleteIssue,
  changeProject,
  changeTeam,
} from "@/entities/issues/issue.service";
import {
  createComment,
  updateComment,
  deleteComment,
} from "@/entities/issues/comment.service";
import { z } from "zod";
import { assertAssigneeOrLeadOrAdmin } from "@/trpc/permissions";

export const issueRouter = createTRPCRouter({
  getByKey: protectedProcedure
    .input(
      z.object({
        orgSlug: z.string(),
        issueKey: z.string(),
      }),
    )
    .query(async ({ input }) => {
      const issue = await findIssueByKey(input.orgSlug, input.issueKey);
      if (!issue) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Issue not found",
        });
      }
      return issue;
    }),

  create: protectedProcedure
    .input(
      z.object({
        orgSlug: z.string(),
        teamId: z.string().uuid().optional(),
        title: z.string().min(1),
        description: z.string().optional(),
        projectId: z.string().uuid().optional(),
        priorityId: z.string().uuid().optional(),
        stateId: z.string().uuid().optional(),
        assigneeId: z.string().optional(),
        issueKeyFormat: z.enum(["org", "project", "team"]).default("org"),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const userId = getUserId(ctx);

      // Enforce: if user is only a member (not admin/lead) and provides projectId, they must be part of that project.
      if (input.projectId) {
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

      // Override reporterId with current user ID
      const createParams = {
        ...input,
        reporterId: userId,
      };

      const { id } = await createIssue(createParams);
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

  changeProject: protectedProcedure
    .input(
      z.object({
        issueId: z.string().uuid(),
        actorId: z.string(),
        projectId: z.string().uuid().nullable(),
      }),
    )
    .use(({ ctx, next, input }) => {
      return assertAssigneeOrLeadOrAdmin(ctx, input.issueId).then(() => next());
    })
    .mutation(async ({ input }) => {
      await changeProject(input.issueId, input.actorId, input.projectId);
    }),

  changeTeam: protectedProcedure
    .input(
      z.object({
        issueId: z.string().uuid(),
        actorId: z.string(),
        teamId: z.string().uuid().nullable(),
      }),
    )
    .use(({ ctx, next, input }) => {
      return assertAssigneeOrLeadOrAdmin(ctx, input.issueId).then(() => next());
    })
    .mutation(async ({ input }) => {
      await changeTeam(input.issueId, input.actorId, input.teamId);
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

  delete: protectedProcedure
    .input(z.object({ issueId: z.string().uuid() }))
    .use(({ ctx, next, input }) => {
      return assertAssigneeOrLeadOrAdmin(ctx, input.issueId).then(() => next());
    })
    .mutation(async ({ input }) => {
      await deleteIssue(input.issueId);
    }),
});
