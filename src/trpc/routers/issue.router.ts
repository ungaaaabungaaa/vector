import { createTRPCRouter, protectedProcedure, getUserId } from "@/trpc/init";
import { TRPCError } from "@trpc/server";
import { eq, and } from "drizzle-orm";
import {
  projectMember as projectMemberTable,
  teamMember as teamMemberTable,
  issueAssignee as assignmentTable,
  project as projectTable,
} from "@/db/schema";
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
import {
  createAssignment,
  changeAssignmentState,
  updateAssignmentAssignee,
} from "@/entities/issues/assignment.service";
import { z } from "zod";
import { assertAssigneeOrLeadOrAdmin } from "@/trpc/permissions";
import { OrganizationService } from "@/entities/organizations/organization.service";

export const issueRouter = createTRPCRouter({
  getByKey: protectedProcedure
    .input(
      z.object({
        orgSlug: z.string(),
        issueKey: z.string(),
      }),
    )
    .query(async ({ input, ctx }) => {
      const issueRecord = await findIssueByKey(input.orgSlug, input.issueKey);

      if (!issueRecord) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Issue not found" });
      }

      const userId = getUserId(ctx);

      // Short-circuit for admins → can access everything.
      if (ctx.session.user.role === "admin") {
        return issueRecord;
      }

      // 1) Reporter can access their own issues
      if (issueRecord.reporterId === userId) {
        return issueRecord;
      }

      // 2) Check if user is assigned to the issue
      const assignmentRow = await ctx.db
        .select({ id: assignmentTable.id })
        .from(assignmentTable)
        .where(
          and(
            eq(assignmentTable.issueId, issueRecord.id),
            eq(assignmentTable.assigneeId, userId),
          ),
        )
        .limit(1);

      if (assignmentRow.length > 0) {
        return issueRecord;
      }

      // 3) Check team membership relation
      if (issueRecord.teamId) {
        const teamMembership = await ctx.db
          .select({ userId: teamMemberTable.userId })
          .from(teamMemberTable)
          .where(
            and(
              eq(teamMemberTable.teamId, issueRecord.teamId),
              eq(teamMemberTable.userId, userId),
            ),
          )
          .limit(1);

        if (teamMembership.length > 0) {
          return issueRecord;
        }
      }

      // 4) Check if user is project lead (project they created)
      if (issueRecord.projectId) {
        const proj = await ctx.db
          .select({ leadId: projectTable.leadId })
          .from(projectTable)
          .where(eq(projectTable.id, issueRecord.projectId))
          .limit(1);

        if (proj[0]?.leadId === userId) {
          return issueRecord;
        }
      }

      // If none of the conditions matched → deny access
      throw new TRPCError({ code: "FORBIDDEN" });
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
        stateId: z.string().uuid(),
        assigneeId: z.string().optional(),
        issueKeyFormat: z.enum(["org", "project", "team"]).default("org"),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const userId = getUserId(ctx);

      // ------------------------------------------------------------------
      // 🏷️  Ensure a default priority is assigned (weight === 0)
      // ------------------------------------------------------------------
      let effectivePriorityId = input.priorityId;

      if (!effectivePriorityId) {
        // Lazily import to avoid circular deps at module load time
        const { WorkflowService } = await import(
          "@/entities/workflow/state.service"
        );

        const orgPriorities = await WorkflowService.listIssuePriorities(
          input.orgSlug,
        );

        const defaultPriority =
          orgPriorities.find((p) => p.weight === 0) || orgPriorities[0];

        effectivePriorityId = defaultPriority?.id;
      }

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
        priorityId: effectivePriorityId ?? undefined,
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

  // -------------------------------------------------------------------------
  //  Assignment operations for multi-assignee support
  // -------------------------------------------------------------------------

  addAssignee: protectedProcedure
    .input(
      z.object({
        issueId: z.string().uuid(),
        assigneeId: z.string().optional(),
        stateId: z.string().uuid(),
      }),
    )
    .use(({ ctx, next, input }) => {
      return assertAssigneeOrLeadOrAdmin(ctx, input.issueId).then(() => next());
    })
    .mutation(async ({ ctx, input }) => {
      const userId = getUserId(ctx);
      const { id } = await createAssignment({
        issueId: input.issueId,
        assigneeId: input.assigneeId ?? null,
        stateId: input.stateId,
        actorId: userId,
      });
      return { id } as const;
    }),

  changeAssignmentState: protectedProcedure
    .input(
      z.object({
        assignmentId: z.string().uuid(),
        stateId: z.string().uuid(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const userId = getUserId(ctx);
      await changeAssignmentState(input.assignmentId, userId, input.stateId);
    }),

  updateAssignmentAssignee: protectedProcedure
    .input(
      z.object({
        assignmentId: z.string().uuid(),
        assigneeId: z.string().nullable(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const userId = getUserId(ctx);
      await updateAssignmentAssignee(
        input.assignmentId,
        userId,
        input.assigneeId,
      );
    }),

  getAssignments: protectedProcedure
    .input(z.object({ issueId: z.string().uuid() }))
    .query(async ({ input }) => {
      return OrganizationService.getIssueAssignments(input.issueId);
    }),
});
