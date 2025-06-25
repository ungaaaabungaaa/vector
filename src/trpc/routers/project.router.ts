import { createTRPCRouter, protectedProcedure } from "@/trpc/init";
import {
  createProject,
  updateProject,
  addMember as addProjectMember,
  removeMember as removeProjectMember,
} from "@/entities/projects/project.service";
import { z } from "zod";
import { assertAdmin, assertProjectLeadOrAdmin } from "@/trpc/permissions";
import { eq } from "drizzle-orm";
import {
  project as projectTable,
  projectMember as projectMemberTable,
} from "@/db/schema";

export const projectRouter = createTRPCRouter({
  create: protectedProcedure
    .input(
      z.object({
        organizationId: z.string().uuid(),
        teamId: z.string().uuid(),
        name: z.string().min(1),
        description: z.string().optional(),
        leadId: z.string().optional(),
        startDate: z.string().optional(), // ISO
        dueDate: z.string().optional(),
        statusId: z.string().uuid().optional(),
      }),
    )
    .use(({ ctx, next, input }) => {
      try {
        assertAdmin(ctx);
      } catch {
        /* not admin, continue */
      }
      return next();
    })
    .mutation(async ({ input }) => {
      const { id } = await createProject(input);
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
      return assertProjectLeadOrAdmin(ctx, input.id).then(() => next());
    })
    .mutation(async ({ input }) => {
      await updateProject({ id: input.id, data: input.data });
    }),

  addMember: protectedProcedure
    .input(
      z.object({
        projectId: z.string().uuid(),
        userId: z.string(),
        role: z.string().optional(),
      }),
    )
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
    .mutation(async ({ input }) => {
      await removeProjectMember(input.projectId, input.userId);
    }),

  listMine: protectedProcedure.query(async ({ ctx }) => {
    const userId = (ctx.session as any).user.id;
    const projects = await ctx.db
      .select({ id: projectTable.id, name: projectTable.name })
      .from(projectTable)
      .leftJoin(
        projectMemberTable,
        eq(projectMemberTable.projectId, projectTable.id),
      )
      .where(eq(projectMemberTable.userId, userId));
    return projects;
  }),
});
