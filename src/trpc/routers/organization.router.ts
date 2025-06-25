import { createTRPCRouter, protectedProcedure } from "@/trpc/init";
import { z } from "zod";
import { OrganizationService } from "@/entities/organizations/organization.service";
import { assertAuthenticated } from "@/trpc/permissions";

const roleEnum = z.enum(["admin", "member"]);

export const organizationRouter = createTRPCRouter({
  update: protectedProcedure
    .input(
      z.object({
        orgSlug: z.string().min(1), // slug of organization
        data: z.object({
          name: z.string().min(1).optional(),
          slug: z
            .string()
            .regex(/^[a-z0-9-]+$/)
            .min(1)
            .optional(),
        }),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      assertAuthenticated(ctx);
      const userId = ctx.session!.user.id;

      // Verify user is admin or owner of org
      const membership = await OrganizationService.verifyUserOrganizationAccess(
        userId,
        input.orgSlug,
      );
      if (
        !membership ||
        (membership.role !== "admin" && membership.role !== "owner")
      ) {
        throw new Error("FORBIDDEN");
      }

      const updated = await OrganizationService.updateOrganization(
        membership.organizationId,
        input.data,
      );
      return updated;
    }),

  listMembers: protectedProcedure
    .input(z.object({ orgSlug: z.string() }))
    .query(async ({ input, ctx }) => {
      assertAuthenticated(ctx);
      const membership = await OrganizationService.verifyUserOrganizationAccess(
        ctx.session!.user.id,
        input.orgSlug,
      );
      if (!membership) throw new Error("FORBIDDEN");
      return OrganizationService.listMembers(membership.organizationId);
    }),

  invite: protectedProcedure
    .input(
      z.object({
        orgSlug: z.string(),
        email: z.string().email(),
        role: roleEnum,
      }),
    )
    .mutation(async ({ input, ctx }) => {
      assertAuthenticated(ctx);
      const membership = await OrganizationService.verifyUserOrganizationAccess(
        ctx.session!.user.id,
        input.orgSlug,
      );
      if (
        !membership ||
        (membership.role !== "admin" && membership.role !== "owner")
      )
        throw new Error("FORBIDDEN");
      return OrganizationService.inviteMember(
        membership.organizationId,
        input.email,
        input.role,
        ctx.session!.user.id,
      );
    }),

  revokeInvite: protectedProcedure
    .input(z.object({ token: z.string() }))
    .mutation(async ({ input, ctx }) => {
      assertAuthenticated(ctx);
      return OrganizationService.revokeInvitation(input.token);
    }),

  listInvites: protectedProcedure
    .input(z.object({ orgSlug: z.string() }))
    .query(async ({ input, ctx }) => {
      assertAuthenticated(ctx);
      const membership = await OrganizationService.verifyUserOrganizationAccess(
        ctx.session!.user.id,
        input.orgSlug,
      );
      if (!membership) throw new Error("FORBIDDEN");
      return OrganizationService.listPendingInvites(membership.organizationId);
    }),

  updateRole: protectedProcedure
    .input(
      z.object({ orgSlug: z.string(), userId: z.string(), role: roleEnum }),
    )
    .mutation(async ({ input, ctx }) => {
      assertAuthenticated(ctx);
      const membership = await OrganizationService.verifyUserOrganizationAccess(
        ctx.session!.user.id,
        input.orgSlug,
      );
      if (!membership || membership.role === "member")
        throw new Error("FORBIDDEN");
      return OrganizationService.updateMemberRole(
        membership.organizationId,
        input.userId,
        input.role,
      );
    }),
});
