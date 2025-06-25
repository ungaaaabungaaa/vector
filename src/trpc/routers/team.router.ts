import { createTRPCRouter, protectedProcedure } from "@/trpc/init";
import {
  createTeam,
  updateTeam,
  addMember as addTeamMember,
  removeMember as removeTeamMember,
} from "@/entities/teams/team.service";
import { z } from "zod";
import { assertAdmin } from "@/trpc/permissions";

export const teamRouter = createTRPCRouter({
  create: protectedProcedure
    .use(({ ctx, next }) => {
      assertAdmin(ctx);
      return next();
    })
    .input(
      z.object({
        organizationId: z.string().uuid(),
        key: z.string().min(2).max(10),
        name: z.string().min(1),
        description: z.string().optional(),
        leadId: z.string().optional(),
      }),
    )
    .mutation(async ({ input }) => {
      const { id } = await createTeam(input);
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
        }),
      }),
    )
    .mutation(async ({ input }) => {
      await updateTeam({ id: input.id, data: input.data });
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
      await removeTeamMember(input.teamId, input.userId);
    }),
});
