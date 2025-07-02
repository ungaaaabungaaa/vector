import { createTRPCRouter, protectedProcedure, getUserId } from "@/trpc/init";
import {
  createTeam,
  updateTeam,
  addMember as addTeamMember,
  removeMember as removeTeamMember,
  findTeamByKey,
  deleteTeam,
  listTeamMembers,
} from "@/entities/teams/team.service";
import { OrganizationService } from "@/entities/organizations/organization.service";
import { z } from "zod";
import { PERMISSIONS } from "@/auth/permission-constants";
import { TRPCError } from "@trpc/server";
import { PermissionPolicy } from "@/auth/policy-engine";
import { requirePermission } from "@/auth/permissions";

export const teamRouter = createTRPCRouter({
  getByKey: protectedProcedure
    .input(
      z.object({
        orgSlug: z.string(),
        teamKey: z.string(),
      }),
    )
    .query(async ({ input, ctx }) => {
      const userId = getUserId(ctx);

      // Verify user has access to this organization and get team
      const membership = await OrganizationService.verifyUserOrganizationAccess(
        userId,
        input.orgSlug,
      );
      if (!membership) {
        throw new TRPCError({ code: "FORBIDDEN" });
      }

      const team = await findTeamByKey(input.orgSlug, input.teamKey);
      if (!team) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Team not found",
        });
      }

      // Check view permission
      await requirePermission(
        userId,
        membership.organizationId,
        PERMISSIONS.TEAM_VIEW,
      );

      return team;
    }),

  listMembers: protectedProcedure
    .input(
      z.object({
        teamId: z.string().uuid(),
      }),
    )
    .query(async ({ input, ctx }) => {
      // Check if user can view this team
      await PermissionPolicy.require(ctx, PERMISSIONS.TEAM_VIEW, {
        type: "team",
        id: input.teamId,
      });
      return await listTeamMembers(input.teamId);
    }),

  create: protectedProcedure
    .input(
      z.object({
        orgSlug: z.string(),
        key: z.string().min(2).max(10),
        name: z.string().min(1),
        description: z.string().optional(),
        leadId: z.string().optional(),
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

      // Check team creation permission
      await requirePermission(
        userId,
        membership.organizationId,
        PERMISSIONS.TEAM_CREATE,
      );

      const { id } = await createTeam({
        organizationId: membership.organizationId,
        key: input.key,
        name: input.name,
        description: input.description,
        leadId: input.leadId || userId,
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
          key: z.string().min(2).max(10).optional(),
          icon: z.string().optional().nullable(),
          color: z
            .string()
            .regex(/^#?[0-9A-Fa-f]{6}$/)
            .optional()
            .nullable(),
        }),
      }),
    )
    .use(({ ctx, next, input }) => {
      return PermissionPolicy.require(ctx, PERMISSIONS.TEAM_UPDATE, {
        type: "team",
        id: input.id,
      }).then(() => next());
    })
    .mutation(async ({ input }) => {
      await updateTeam({ id: input.id, data: input.data });
    }),

  delete: protectedProcedure
    .input(
      z.object({
        teamId: z.string().uuid(),
      }),
    )
    .use(({ ctx, next, input }) => {
      return PermissionPolicy.require(ctx, PERMISSIONS.TEAM_DELETE, {
        type: "team",
        id: input.teamId,
      }).then(() => next());
    })
    .mutation(async ({ input }) => {
      await deleteTeam(input.teamId);
    }),

  addMember: protectedProcedure
    .input(
      z.object({
        teamId: z.string().uuid(),
        userId: z.string(),
        role: z.string().optional(),
      }),
    )
    .use(({ ctx, next, input }) => {
      return PermissionPolicy.require(ctx, PERMISSIONS.TEAM_UPDATE, {
        type: "team",
        id: input.teamId,
      }).then(() => next());
    })
    .mutation(async ({ input }) => {
      await addTeamMember(input.teamId, input.userId, input.role);
    }),

  removeMember: protectedProcedure
    .input(
      z.object({
        teamId: z.string().uuid(),
        userId: z.string(),
      }),
    )
    .use(({ ctx, next, input }) => {
      return PermissionPolicy.require(ctx, PERMISSIONS.TEAM_UPDATE, {
        type: "team",
        id: input.teamId,
      }).then(() => next());
    })
    .mutation(async ({ input }) => {
      try {
        await removeTeamMember(input.teamId, input.userId);
      } catch (e: unknown) {
        const error = e as Error;
        throw new TRPCError({ code: "BAD_REQUEST", message: error.message });
      }
    }),
});
