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
import { assertAdmin } from "@/trpc/permissions";
import { TRPCError } from "@trpc/server";

export const teamRouter = createTRPCRouter({
  getByKey: protectedProcedure
    .input(
      z.object({
        orgSlug: z.string(),
        teamKey: z.string(),
      }),
    )
    .query(async ({ input }) => {
      const team = await findTeamByKey(input.orgSlug, input.teamKey);
      if (!team) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Team not found",
        });
      }
      return team;
    }),

  listMembers: protectedProcedure
    .input(
      z.object({
        teamId: z.string().uuid(),
      }),
    )
    .query(async ({ input, ctx }) => {
      const userId = getUserId(ctx);
      // TODO: Verify user has access to this team
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
        throw new Error("FORBIDDEN");
      }

      // Only admins and owners can create teams
      if (membership.role !== "admin" && membership.role !== "owner") {
        throw new Error("FORBIDDEN");
      }

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
    .use(({ ctx, next }) => {
      assertAdmin(ctx);
      return next();
    })
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
    .mutation(async ({ input }) => {
      await updateTeam({ id: input.id, data: input.data });
    }),

  delete: protectedProcedure
    .input(
      z.object({
        teamId: z.string().uuid(),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      const userId = getUserId(ctx);

      // Note: We should verify user has permission to delete this team
      // For now, assuming they do if they're authenticated
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
    .mutation(async ({ input }) => {
      try {
        await removeTeamMember(input.teamId, input.userId);
      } catch (e: any) {
        throw new TRPCError({ code: "BAD_REQUEST", message: e.message });
      }
    }),
});
