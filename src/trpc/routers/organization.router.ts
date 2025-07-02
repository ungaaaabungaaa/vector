import { createTRPCRouter, protectedProcedure, getUserId } from "@/trpc/init";
import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { OrganizationService } from "@/entities/organizations/organization.service";

import { memberRoleEnum } from "@/db/schema/users-and-auth";
import { NonOwnerMemberRole } from "@/db/schema/users-and-auth";

// Workflow (states & statuses)
import { WorkflowService } from "@/entities/workflow/state.service";
import { issueStateTypeEnum } from "@/db/schema/issue-config";
import { projectStatusTypeEnum } from "@/db/schema/projects";

import { hasPermission, requirePermission } from "@/auth/permissions";
import { PERMISSIONS, type Permission } from "@/auth/permission-constants";

// Derive type-safe Zod enum based on DB enum values (excluding "owner" for invite/update)
const roleEnum = ((): ReturnType<typeof import("zod").z.enum> => {
  const values = memberRoleEnum.enumValues.filter((v) => v !== "owner") as [
    (typeof memberRoleEnum.enumValues)[number],
    ...string[],
  ];
  return z.enum(values);
})();

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
          logo: z.string().min(1).optional(),
        }),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      const userId = getUserId(ctx);

      // Verify user has org management permission
      const membership = await OrganizationService.verifyUserOrganizationAccess(
        userId,
        input.orgSlug,
      );
      if (!membership) {
        throw new Error("FORBIDDEN");
      }

      await requirePermission(
        userId,
        membership.organizationId,
        PERMISSIONS.ORG_MANAGE,
      );

      const updated = await OrganizationService.updateOrganization(
        membership.organizationId,
        input.data,
      );
      return updated;
    }),

  listMembers: protectedProcedure
    .input(z.object({ orgSlug: z.string() }))
    .query(async ({ input, ctx }) => {
      const membership = await OrganizationService.verifyUserOrganizationAccess(
        getUserId(ctx),
        input.orgSlug,
      );
      if (!membership) throw new Error("FORBIDDEN");
      return OrganizationService.listMembers(membership.organizationId);
    }),

  listMembersWithRoles: protectedProcedure
    .input(z.object({ orgSlug: z.string() }))
    .query(async ({ input, ctx }) => {
      const membership = await OrganizationService.verifyUserOrganizationAccess(
        getUserId(ctx),
        input.orgSlug,
      );
      if (!membership) throw new Error("FORBIDDEN");
      return OrganizationService.listMembersWithRoles(
        membership.organizationId,
      );
    }),

  searchMembers: protectedProcedure
    .input(
      z.object({
        orgSlug: z.string(),
        query: z.string().optional(),
        limit: z.number().int().min(1).max(50).default(10),
      }),
    )
    .query(async ({ input, ctx }) => {
      const membership = await OrganizationService.verifyUserOrganizationAccess(
        getUserId(ctx),
        input.orgSlug,
      );
      if (!membership) throw new Error("FORBIDDEN");
      return OrganizationService.searchMembers(
        membership.organizationId,
        input.query,
        input.limit,
      );
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
      const userId = getUserId(ctx);
      const membership = await OrganizationService.verifyUserOrganizationAccess(
        userId,
        input.orgSlug,
      );
      if (!membership) {
        throw new TRPCError({ code: "FORBIDDEN" });
      }

      // Check invite permission
      await requirePermission(
        userId,
        membership.organizationId,
        PERMISSIONS.ORG_INVITE,
      );

      return OrganizationService.inviteMember(
        membership.organizationId,
        input.email,
        input.role as NonOwnerMemberRole,
        userId,
      );
    }),

  revokeInvite: protectedProcedure
    .input(z.object({ token: z.string() }))
    .mutation(async ({ input }) => {
      return OrganizationService.revokeInvitation(input.token);
    }),

  resendInvite: protectedProcedure
    .input(z.object({ token: z.string(), orgSlug: z.string() }))
    .mutation(async ({ input, ctx }) => {
      const userId = getUserId(ctx);

      // Verify user is admin/owner of the organization
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

      return OrganizationService.resendInvitation(input.token, userId);
    }),

  listInvites: protectedProcedure
    .input(z.object({ orgSlug: z.string() }))
    .query(async ({ input, ctx }) => {
      const membership = await OrganizationService.verifyUserOrganizationAccess(
        getUserId(ctx),
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
      const membership = await OrganizationService.verifyUserOrganizationAccess(
        getUserId(ctx),
        input.orgSlug,
      );
      if (!membership || membership.role === "member")
        throw new Error("FORBIDDEN");
      return OrganizationService.updateMemberRole(
        membership.organizationId,
        input.userId,
        input.role as NonOwnerMemberRole,
      );
    }),

  // Remove member from organization
  removeMember: protectedProcedure
    .input(z.object({ orgSlug: z.string(), userId: z.string() }))
    .mutation(async ({ input, ctx }) => {
      const requesterId = getUserId(ctx);

      const membership = await OrganizationService.verifyUserOrganizationAccess(
        requesterId,
        input.orgSlug,
      );

      if (!membership || membership.role === "member")
        throw new Error("FORBIDDEN");

      // Prevent removing owner themselves if they are last member handled in service
      return OrganizationService.removeMember(
        membership.organizationId,
        input.userId,
      );
    }),

  listTeams: protectedProcedure
    .input(z.object({ orgSlug: z.string() }))
    .query(async ({ input, ctx }) => {
      const membership = await OrganizationService.verifyUserOrganizationAccess(
        getUserId(ctx),
        input.orgSlug,
      );
      if (!membership) throw new Error("FORBIDDEN");
      return OrganizationService.getUserTeams(input.orgSlug, getUserId(ctx));
    }),

  // New paginated teams endpoint -------------------------------------------------
  listTeamsPaged: protectedProcedure
    .input(
      z.object({
        orgSlug: z.string(),
        page: z.number().int().min(1).default(1),
        pageSize: z.number().int().min(1).max(100).default(25),
      }),
    )
    .query(async ({ input, ctx }) => {
      const membership = await OrganizationService.verifyUserOrganizationAccess(
        getUserId(ctx),
        input.orgSlug,
      );
      if (!membership) throw new Error("FORBIDDEN");
      return OrganizationService.getUserTeamsPaged(
        input.orgSlug,
        getUserId(ctx),
        input.page,
        input.pageSize,
      );
    }),

  listProjects: protectedProcedure
    .input(z.object({ orgSlug: z.string() }))
    .query(async ({ input, ctx }) => {
      const membership = await OrganizationService.verifyUserOrganizationAccess(
        getUserId(ctx),
        input.orgSlug,
      );
      if (!membership) throw new Error("FORBIDDEN");
      return OrganizationService.getRecentUserProjects(
        input.orgSlug,
        getUserId(ctx),
        100,
      );
    }),

  listProjectsPaged: protectedProcedure
    .input(
      z.object({
        orgSlug: z.string(),
        page: z.number().int().min(1).default(1),
        pageSize: z.number().int().min(1).max(100).default(25),
      }),
    )
    .query(async ({ input, ctx }) => {
      const membership = await OrganizationService.verifyUserOrganizationAccess(
        getUserId(ctx),
        input.orgSlug,
      );
      if (!membership) throw new Error("FORBIDDEN");
      return OrganizationService.getUserProjectsPaged(
        input.orgSlug,
        getUserId(ctx),
        input.page,
        input.pageSize,
      );
    }),

  listIssues: protectedProcedure
    .input(z.object({ orgSlug: z.string() }))
    .query(async ({ input, ctx }) => {
      const membership = await OrganizationService.verifyUserOrganizationAccess(
        getUserId(ctx),
        input.orgSlug,
      );
      if (!membership) throw new Error("FORBIDDEN");
      return OrganizationService.getRecentIssues(
        input.orgSlug,
        getUserId(ctx),
        100,
      ); // Get all issues
    }),

  listIssuesPaged: protectedProcedure
    .input(
      z.object({
        orgSlug: z.string(),
        page: z.number().int().min(1).default(1),
        pageSize: z.number().int().min(1).max(100).default(25),
        projectId: z.string().uuid().optional(),
        teamId: z.string().uuid().optional(),
      }),
    )
    .query(async ({ input, ctx }) => {
      const membership = await OrganizationService.verifyUserOrganizationAccess(
        getUserId(ctx),
        input.orgSlug,
      );
      if (!membership) throw new Error("FORBIDDEN");
      return OrganizationService.getIssuesPaged(
        input.orgSlug,
        getUserId(ctx),
        input.page,
        input.pageSize,
        {
          projectId: input.projectId,
          teamId: input.teamId,
        },
      );
    }),

  // -------------------------------------------------------------------------
  //  Issue States & Project Statuses
  // -------------------------------------------------------------------------

  listIssueStates: protectedProcedure
    .input(z.object({ orgSlug: z.string() }))
    .query(async ({ input, ctx }) => {
      const membership = await OrganizationService.verifyUserOrganizationAccess(
        getUserId(ctx),
        input.orgSlug,
      );
      if (!membership) throw new Error("FORBIDDEN");
      return WorkflowService.listIssueStates(input.orgSlug);
    }),

  listProjectStatuses: protectedProcedure
    .input(z.object({ orgSlug: z.string() }))
    .query(async ({ input, ctx }) => {
      const membership = await OrganizationService.verifyUserOrganizationAccess(
        getUserId(ctx),
        input.orgSlug,
      );
      if (!membership) throw new Error("FORBIDDEN");
      return WorkflowService.listProjectStatuses(input.orgSlug);
    }),

  createIssueState: protectedProcedure
    .input(
      z.object({
        orgSlug: z.string(),
        name: z.string().min(1),
        position: z.number().int(),
        color: z.string().min(1),
        icon: z.string().nullable().optional(),
        type: z.enum(
          issueStateTypeEnum.enumValues as [
            (typeof issueStateTypeEnum.enumValues)[number],
            ...string[],
          ],
        ),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      const membership = await OrganizationService.verifyUserOrganizationAccess(
        getUserId(ctx),
        input.orgSlug,
      );
      if (
        !membership ||
        (membership.role !== "admin" && membership.role !== "owner")
      ) {
        throw new Error("FORBIDDEN");
      }

      const { id } = await WorkflowService.createIssueState(input.orgSlug, {
        name: input.name,
        position: input.position,
        color: input.color,
        icon: input.icon,
        type: input.type,
      });
      return { id } as const;
    }),

  updateIssueState: protectedProcedure
    .input(
      z.object({
        orgSlug: z.string(),
        stateId: z.string().uuid(),
        name: z.string().min(1),
        position: z.number().int().optional(),
        color: z.string().min(1),
        icon: z.string().nullable().optional(),
        type: z.enum(
          issueStateTypeEnum.enumValues as [
            (typeof issueStateTypeEnum.enumValues)[number],
            ...string[],
          ],
        ),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      const membership = await OrganizationService.verifyUserOrganizationAccess(
        getUserId(ctx),
        input.orgSlug,
      );
      if (
        !membership ||
        (membership.role !== "admin" && membership.role !== "owner")
      ) {
        throw new Error("FORBIDDEN");
      }

      await WorkflowService.updateIssueState(
        input.stateId,
        membership.organizationId,
        {
          name: input.name,
          position: input.position,
          color: input.color,
          icon: input.icon,
          type: input.type,
        },
      );
    }),

  createProjectStatus: protectedProcedure
    .input(
      z.object({
        orgSlug: z.string(),
        name: z.string().min(1),
        position: z.number().int(),
        color: z.string().min(1),
        icon: z.string().nullable().optional(),
        type: z.enum(
          projectStatusTypeEnum.enumValues as [
            (typeof projectStatusTypeEnum.enumValues)[number],
            ...string[],
          ],
        ),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      const membership = await OrganizationService.verifyUserOrganizationAccess(
        getUserId(ctx),
        input.orgSlug,
      );
      if (
        !membership ||
        (membership.role !== "admin" && membership.role !== "owner")
      ) {
        throw new Error("FORBIDDEN");
      }

      const { id } = await WorkflowService.createProjectStatus(input.orgSlug, {
        name: input.name,
        position: input.position,
        color: input.color,
        icon: input.icon,
        type: input.type,
      });
      return { id } as const;
    }),

  updateProjectStatus: protectedProcedure
    .input(
      z.object({
        orgSlug: z.string(),
        statusId: z.string().uuid(),
        name: z.string().min(1),
        position: z.number().int().optional(),
        color: z.string().min(1),
        icon: z.string().nullable().optional(),
        type: z.enum(
          projectStatusTypeEnum.enumValues as [
            (typeof projectStatusTypeEnum.enumValues)[number],
            ...string[],
          ],
        ),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      const membership = await OrganizationService.verifyUserOrganizationAccess(
        getUserId(ctx),
        input.orgSlug,
      );
      if (
        !membership ||
        (membership.role !== "admin" && membership.role !== "owner")
      ) {
        throw new Error("FORBIDDEN");
      }

      await WorkflowService.updateProjectStatus(
        input.statusId,
        membership.organizationId,
        {
          name: input.name,
          position: input.position,
          color: input.color,
          icon: input.icon,
          type: input.type,
        },
      );
    }),

  // ------------------- Delete ------------------
  deleteIssueState: protectedProcedure
    .input(z.object({ orgSlug: z.string(), stateId: z.string().uuid() }))
    .mutation(async ({ input, ctx }) => {
      const membership = await OrganizationService.verifyUserOrganizationAccess(
        getUserId(ctx),
        input.orgSlug,
      );
      if (
        !membership ||
        (membership.role !== "admin" && membership.role !== "owner")
      )
        throw new Error("FORBIDDEN");

      await WorkflowService.deleteIssueState(
        input.stateId,
        membership.organizationId,
      );
    }),

  deleteProjectStatus: protectedProcedure
    .input(z.object({ orgSlug: z.string(), statusId: z.string().uuid() }))
    .mutation(async ({ input, ctx }) => {
      const membership = await OrganizationService.verifyUserOrganizationAccess(
        getUserId(ctx),
        input.orgSlug,
      );
      if (
        !membership ||
        (membership.role !== "admin" && membership.role !== "owner")
      )
        throw new Error("FORBIDDEN");

      await WorkflowService.deleteProjectStatus(
        input.statusId,
        membership.organizationId,
      );
    }),

  // ------------------- Reset defaults ------------------
  resetIssueStates: protectedProcedure
    .input(z.object({ orgSlug: z.string() }))
    .mutation(async ({ input, ctx }) => {
      const membership = await OrganizationService.verifyUserOrganizationAccess(
        getUserId(ctx),
        input.orgSlug,
      );
      if (
        !membership ||
        (membership.role !== "admin" && membership.role !== "owner")
      )
        throw new Error("FORBIDDEN");

      await WorkflowService.resetIssueStates(input.orgSlug);
    }),

  resetProjectStatuses: protectedProcedure
    .input(z.object({ orgSlug: z.string() }))
    .mutation(async ({ input, ctx }) => {
      const membership = await OrganizationService.verifyUserOrganizationAccess(
        getUserId(ctx),
        input.orgSlug,
      );
      if (
        !membership ||
        (membership.role !== "admin" && membership.role !== "owner")
      )
        throw new Error("FORBIDDEN");

      await WorkflowService.resetProjectStatuses(input.orgSlug);
    }),

  // -------------------------------------------------------------------------
  //  Issue Priorities
  // -------------------------------------------------------------------------

  listIssuePriorities: protectedProcedure
    .input(z.object({ orgSlug: z.string() }))
    .query(async ({ input, ctx }) => {
      const membership = await OrganizationService.verifyUserOrganizationAccess(
        getUserId(ctx),
        input.orgSlug,
      );
      if (!membership) throw new Error("FORBIDDEN");
      return WorkflowService.listIssuePriorities(input.orgSlug);
    }),

  createIssuePriority: protectedProcedure
    .input(
      z.object({
        orgSlug: z.string(),
        name: z.string().min(1),
        weight: z.number().int(),
        color: z.string().min(1),
        icon: z.string().nullable().optional(),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      const membership = await OrganizationService.verifyUserOrganizationAccess(
        getUserId(ctx),
        input.orgSlug,
      );
      if (
        !membership ||
        (membership.role !== "admin" && membership.role !== "owner")
      ) {
        throw new Error("FORBIDDEN");
      }

      const { id } = await WorkflowService.createIssuePriority(input.orgSlug, {
        name: input.name,
        weight: input.weight,
        color: input.color,
        icon: input.icon,
      });
      return { id } as const;
    }),

  updateIssuePriority: protectedProcedure
    .input(
      z.object({
        orgSlug: z.string(),
        priorityId: z.string().uuid(),
        name: z.string().min(1),
        weight: z.number().int().optional(),
        color: z.string().min(1),
        icon: z.string().nullable().optional(),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      const membership = await OrganizationService.verifyUserOrganizationAccess(
        getUserId(ctx),
        input.orgSlug,
      );
      if (
        !membership ||
        (membership.role !== "admin" && membership.role !== "owner")
      ) {
        throw new Error("FORBIDDEN");
      }

      await WorkflowService.updateIssuePriority(
        input.priorityId,
        membership.organizationId,
        {
          name: input.name,
          weight: input.weight,
          color: input.color,
          icon: input.icon,
        },
      );
    }),

  deleteIssuePriority: protectedProcedure
    .input(z.object({ orgSlug: z.string(), priorityId: z.string().uuid() }))
    .mutation(async ({ input, ctx }) => {
      const membership = await OrganizationService.verifyUserOrganizationAccess(
        getUserId(ctx),
        input.orgSlug,
      );
      if (
        !membership ||
        (membership.role !== "admin" && membership.role !== "owner")
      )
        throw new Error("FORBIDDEN");

      await WorkflowService.deleteIssuePriority(
        input.priorityId,
        membership.organizationId,
      );
    }),

  resetIssuePriorities: protectedProcedure
    .input(z.object({ orgSlug: z.string() }))
    .mutation(async ({ input, ctx }) => {
      const membership = await OrganizationService.verifyUserOrganizationAccess(
        getUserId(ctx),
        input.orgSlug,
      );
      if (
        !membership ||
        (membership.role !== "admin" && membership.role !== "owner")
      )
        throw new Error("FORBIDDEN");

      await WorkflowService.resetIssuePriorities(input.orgSlug);
    }),

  // -------------------------------------------------------------------------
  //  Permission checking
  // -------------------------------------------------------------------------

  hasPermission: protectedProcedure
    .input(z.object({ orgSlug: z.string(), permission: z.string() }))
    .query(async ({ input, ctx }) => {
      const membership = await OrganizationService.verifyUserOrganizationAccess(
        getUserId(ctx),
        input.orgSlug,
      );
      if (!membership) return false;
      return hasPermission(
        getUserId(ctx),
        membership.organizationId,
        input.permission as Permission,
      );
    }),

  hasPermissions: protectedProcedure
    .input(z.object({ orgSlug: z.string(), permissions: z.string().array() }))
    .query(async ({ input, ctx }) => {
      const membership = await OrganizationService.verifyUserOrganizationAccess(
        getUserId(ctx),
        input.orgSlug,
      );
      if (!membership) return {};

      const results: Record<string, boolean> = {};
      for (const permission of input.permissions) {
        results[permission] = await hasPermission(
          getUserId(ctx),
          membership.organizationId,
          permission as Permission,
        );
      }
      return results;
    }),
});
