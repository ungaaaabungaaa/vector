import { createTRPCRouter, protectedProcedure, getUserId } from "@/trpc/init";
import { z } from "zod";
import { OrgRoleService } from "@/entities/organizations/role.service";
import { OrganizationService } from "@/entities/organizations/organization.service";
import { requirePermission } from "@/auth/permissions";
import { PERMISSIONS } from "@/auth/permission-constants";

export const roleRouter = createTRPCRouter({
  list: protectedProcedure
    .input(z.object({ orgSlug: z.string() }))
    .query(async ({ input, ctx }) => {
      const { organizationId } =
        (await OrganizationService.verifyUserOrganizationAccess(
          getUserId(ctx),
          input.orgSlug,
        )) ?? {};
      if (!organizationId) throw new Error("FORBIDDEN");
      await requirePermission(
        getUserId(ctx),
        organizationId,
        PERMISSIONS.ROLE_CREATE,
      );
      return OrgRoleService.listRoles(organizationId);
    }),

  create: protectedProcedure
    .input(
      z.object({
        orgSlug: z.string(),
        name: z.string().min(1),
        description: z.string().optional(),
        permissions: z.string().array().optional(),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      const uid = getUserId(ctx);
      const membership = await OrganizationService.verifyUserOrganizationAccess(
        uid,
        input.orgSlug,
      );
      if (!membership) throw new Error("FORBIDDEN");
      await requirePermission(
        uid,
        membership.organizationId,
        PERMISSIONS.ROLE_CREATE,
      );
      return OrgRoleService.createRole(
        membership.organizationId,
        input.name,
        input.description,
        input.permissions,
      );
    }),

  update: protectedProcedure
    .input(
      z.object({
        orgSlug: z.string(),
        roleId: z.string().uuid(),
        name: z.string().min(1).optional(),
        description: z.string().optional(),
        permissions: z.string().array().optional(),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      const uid = getUserId(ctx);
      const membership = await OrganizationService.verifyUserOrganizationAccess(
        uid,
        input.orgSlug,
      );
      if (!membership) throw new Error("FORBIDDEN");
      await requirePermission(
        uid,
        membership.organizationId,
        PERMISSIONS.ROLE_UPDATE,
      );
      await OrgRoleService.updateRole(input.roleId, membership.organizationId, {
        name: input.name,
        description: input.description,
        permissions: input.permissions,
      });
    }),

  delete: protectedProcedure
    .input(z.object({ orgSlug: z.string(), roleId: z.string().uuid() }))
    .mutation(async ({ input, ctx }) => {
      const uid = getUserId(ctx);
      const membership = await OrganizationService.verifyUserOrganizationAccess(
        uid,
        input.orgSlug,
      );
      if (!membership) throw new Error("FORBIDDEN");
      await requirePermission(
        uid,
        membership.organizationId,
        PERMISSIONS.ROLE_DELETE,
      );
      await OrgRoleService.deleteRole(input.roleId, membership.organizationId);
    }),

  assign: protectedProcedure
    .input(
      z.object({
        orgSlug: z.string(),
        roleId: z.string().uuid(),
        userId: z.string(),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      const uid = getUserId(ctx);
      const membership = await OrganizationService.verifyUserOrganizationAccess(
        uid,
        input.orgSlug,
      );
      if (!membership) throw new Error("FORBIDDEN");
      await requirePermission(
        uid,
        membership.organizationId,
        PERMISSIONS.ROLE_ASSIGN,
      );
      await OrgRoleService.assignRole(
        input.roleId,
        input.userId,
        membership.organizationId,
      );
    }),

  removeAssignment: protectedProcedure
    .input(
      z.object({
        orgSlug: z.string(),
        roleId: z.string().uuid(),
        userId: z.string(),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      const uid = getUserId(ctx);
      const membership = await OrganizationService.verifyUserOrganizationAccess(
        uid,
        input.orgSlug,
      );
      if (!membership) throw new Error("FORBIDDEN");
      await requirePermission(
        uid,
        membership.organizationId,
        PERMISSIONS.ROLE_ASSIGN,
      );
      await OrgRoleService.removeRole(input.roleId, input.userId);
    }),

  get: protectedProcedure
    .input(z.object({ orgSlug: z.string(), roleId: z.string().uuid() }))
    .query(async ({ input, ctx }) => {
      const uid = getUserId(ctx);
      const membership = await OrganizationService.verifyUserOrganizationAccess(
        uid,
        input.orgSlug,
      );
      if (!membership) throw new Error("FORBIDDEN");
      await requirePermission(
        uid,
        membership.organizationId,
        PERMISSIONS.ROLE_UPDATE,
      );
      return OrgRoleService.getRole(input.roleId, membership.organizationId);
    }),
});
