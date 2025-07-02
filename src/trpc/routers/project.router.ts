import { createTRPCRouter, protectedProcedure, getUserId } from "@/trpc/init";
import {
  createProject,
  updateProject,
  addMember as addProjectMember,
  removeMember as removeProjectMember,
  addTeam as addProjectTeam,
  removeTeam as removeProjectTeam,
  listProjectTeams,
  findProjectByKey,
  listProjectMembers,
  deleteProject,
} from "@/entities/projects/project.service";
import { OrganizationService } from "@/entities/organizations/organization.service";
import { z } from "zod";
import { eq } from "drizzle-orm";
import {
  project as projectTable,
  projectMember as projectMemberTable,
} from "@/db/schema";
import { TRPCError } from "@trpc/server";
import { PERMISSIONS } from "@/auth/permission-constants";
import { PermissionPolicy } from "@/auth/policy-engine";
import { requirePermission } from "@/auth/permissions";

export const projectRouter = createTRPCRouter({
  getByKey: protectedProcedure
    .input(
      z.object({
        orgSlug: z.string(),
        projectKey: z.string(),
      }),
    )
    .query(async ({ input, ctx }) => {
      const project = await findProjectByKey(input.orgSlug, input.projectKey);
      if (!project) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Project not found",
        });
      }

      // Check view permission
      await PermissionPolicy.require(ctx, PERMISSIONS.PROJECT_VIEW, {
        type: "project",
        id: project.id,
      });

      return project;
    }),

  listMembers: protectedProcedure
    .input(
      z.object({
        projectId: z.string().uuid(),
      }),
    )
    .query(async ({ input, ctx }) => {
      // Check if user can view this project
      await PermissionPolicy.require(ctx, PERMISSIONS.PROJECT_VIEW, {
        type: "project",
        id: input.projectId,
      });
      return await listProjectMembers(input.projectId);
    }),

  listTeams: protectedProcedure
    .input(z.object({ projectId: z.string().uuid() }))
    .query(async ({ input, ctx }) => {
      // Check if user can view this project
      await PermissionPolicy.require(ctx, PERMISSIONS.PROJECT_VIEW, {
        type: "project",
        id: input.projectId,
      });
      return await listProjectTeams(input.projectId);
    }),

  addTeam: protectedProcedure
    .input(
      z.object({
        projectId: z.string().uuid(),
        teamId: z.string().uuid(),
      }),
    )
    .use(({ ctx, next, input }) => {
      return PermissionPolicy.require(ctx, PERMISSIONS.PROJECT_UPDATE, {
        type: "project",
        id: input.projectId,
      }).then(() => next());
    })
    .mutation(async ({ input }) => {
      await addProjectTeam(input.projectId, input.teamId);
    }),

  removeTeam: protectedProcedure
    .input(
      z.object({
        projectId: z.string().uuid(),
        teamId: z.string().uuid(),
      }),
    )
    .use(({ ctx, next, input }) => {
      return PermissionPolicy.require(ctx, PERMISSIONS.PROJECT_UPDATE, {
        type: "project",
        id: input.projectId,
      }).then(() => next());
    })
    .mutation(async ({ input }) => {
      await removeProjectTeam(input.projectId, input.teamId);
    }),

  delete: protectedProcedure
    .input(z.object({ projectId: z.string().uuid() }))
    .use(({ ctx, next, input }) => {
      return PermissionPolicy.require(ctx, PERMISSIONS.PROJECT_DELETE, {
        type: "project",
        id: input.projectId,
      }).then(() => next());
    })
    .mutation(async ({ input }) => {
      await deleteProject(input.projectId);
    }),

  create: protectedProcedure
    .input(
      z.object({
        orgSlug: z.string(),
        key: z.string().min(1).max(50),
        teamId: z.string().uuid().optional(),
        name: z.string().min(1),
        description: z.string().optional(),
        leadId: z.string().optional(),
        startDate: z.string().optional(), // ISO
        dueDate: z.string().optional(),
        statusId: z.string().uuid().optional(),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      const userId = getUserId(ctx);

      // Verify user access and get organization details
      const membership = await OrganizationService.verifyUserOrganizationAccess(
        userId,
        input.orgSlug,
      );
      if (!membership) {
        throw new TRPCError({ code: "FORBIDDEN" });
      }

      // Check project creation permission
      await requirePermission(
        userId,
        membership.organizationId,
        PERMISSIONS.PROJECT_CREATE,
      );

      const { id } = await createProject({
        organizationId: membership.organizationId,
        key: input.key,
        teamId: input.teamId || null,
        name: input.name,
        description: input.description,
        leadId: input.leadId || userId,
        startDate: input.startDate,
        dueDate: input.dueDate,
        statusId: input.statusId,
        createdBy: userId,
      });
      return { id } as const;
    }),

  update: protectedProcedure
    .input(
      z.object({
        id: z.string().uuid(),
        data: z.object({
          name: z.string().optional(),
          description: z.string().optional(),
          leadId: z.string().optional(),
          startDate: z.string().optional(),
          dueDate: z.string().optional(),
          statusId: z.string().uuid().optional(),
        }),
      }),
    )
    .use(({ ctx, next, input }) => {
      return PermissionPolicy.require(ctx, PERMISSIONS.PROJECT_UPDATE, {
        type: "project",
        id: input.id,
      }).then(() => next());
    })
    .mutation(async ({ input }) => {
      await updateProject({ id: input.id, data: input.data });
    }),

  // Individual field update mutations
  changeStatus: protectedProcedure
    .input(
      z.object({
        projectId: z.string().uuid(),
        statusId: z.string().uuid().nullable(),
        actorId: z.string(),
      }),
    )
    .use(({ ctx, next, input }) => {
      return PermissionPolicy.require(ctx, PERMISSIONS.PROJECT_UPDATE, {
        type: "project",
        id: input.projectId,
      }).then(() => next());
    })
    .mutation(async ({ input }) => {
      await updateProject({
        id: input.projectId,
        data: { statusId: input.statusId },
      });
    }),

  changeTeam: protectedProcedure
    .input(
      z.object({
        projectId: z.string().uuid(),
        teamId: z.string().uuid().nullable(),
        actorId: z.string(),
      }),
    )
    .use(({ ctx, next, input }) => {
      return PermissionPolicy.require(ctx, PERMISSIONS.PROJECT_UPDATE, {
        type: "project",
        id: input.projectId,
      }).then(() => next());
    })
    .mutation(async ({ input }) => {
      await updateProject({
        id: input.projectId,
        data: { teamId: input.teamId },
      });
    }),

  changeLead: protectedProcedure
    .input(
      z.object({
        projectId: z.string().uuid(),
        leadId: z.string().nullable(),
        actorId: z.string(),
      }),
    )
    .use(({ ctx, next, input }) => {
      return PermissionPolicy.require(ctx, PERMISSIONS.PROJECT_UPDATE, {
        type: "project",
        id: input.projectId,
      }).then(() => next());
    })
    .mutation(async ({ input }) => {
      await updateProject({
        id: input.projectId,
        data: { leadId: input.leadId },
      });
    }),

  addMember: protectedProcedure
    .input(
      z.object({
        projectId: z.string().uuid(),
        userId: z.string(),
        role: z.string().optional(),
      }),
    )
    .use(({ ctx, next, input }) => {
      return PermissionPolicy.require(ctx, PERMISSIONS.PROJECT_UPDATE, {
        type: "project",
        id: input.projectId,
      }).then(() => next());
    })
    .mutation(async ({ input }) => {
      await addProjectMember(input.projectId, input.userId, input.role);
    }),

  removeMember: protectedProcedure
    .input(
      z.object({
        projectId: z.string().uuid(),
        userId: z.string(),
      }),
    )
    .use(({ ctx, next, input }) => {
      return PermissionPolicy.require(ctx, PERMISSIONS.PROJECT_UPDATE, {
        type: "project",
        id: input.projectId,
      }).then(() => next());
    })
    .mutation(async ({ input }) => {
      try {
        await removeProjectMember(input.projectId, input.userId);
      } catch (e: unknown) {
        const message =
          e instanceof Error ? e.message : "Failed to remove project member";
        throw new TRPCError({ code: "BAD_REQUEST", message });
      }
    }),

  listMine: protectedProcedure.query(async ({ ctx }) => {
    const userId = getUserId(ctx);
    const projects = await ctx.db
      .select({ id: projectTable.id, name: projectTable.name })
      .from(projectTable)
      .leftJoin(
        projectMemberTable,
        eq(projectTable.id, projectMemberTable.projectId),
      )
      .where(eq(projectMemberTable.userId, userId));
    return projects;
  }),
});
