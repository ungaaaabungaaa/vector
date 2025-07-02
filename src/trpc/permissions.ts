import { TRPCError } from "@trpc/server";
import type { Context, ProtectedContext } from "@/trpc/init";
import { PERMISSIONS, type Permission } from "@/auth/permission-constants";
import { PermissionPolicy, isPlatformAdmin } from "@/auth/policy-engine";

/**
 * Throws UNAUTHORIZED if the requester is not logged in.
 * @deprecated Use protectedProcedure instead which automatically ensures authentication
 */
export function assertAuthenticated(ctx: Context): asserts ctx is Context & {
  session: { user: { id: string; role: string } };
} {
  if (!ctx.session) throw new TRPCError({ code: "UNAUTHORIZED" });
}

/**
 * Check if user has platform-level admin role (not org admin)
 * @deprecated Use isPlatformAdmin from policy-engine instead
 */
export function assertAdmin(ctx: ProtectedContext) {
  if (!isPlatformAdmin(ctx)) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "Platform admin role required",
    });
  }
}

/**
 * @deprecated Use PermissionPolicy.require instead
 */
export async function assertProjectLeadOrAdmin(
  ctx: ProtectedContext,
  projectId: string,
) {
  await PermissionPolicy.require(ctx, PERMISSIONS.PROJECT_UPDATE, {
    type: "project",
    id: projectId,
  });
}

/**
 * @deprecated Use PermissionPolicy.require instead
 */
export async function assertAssigneeOrLeadOrAdmin(
  ctx: ProtectedContext,
  issueId: string,
) {
  await PermissionPolicy.require(ctx, PERMISSIONS.ISSUE_UPDATE, {
    type: "issue",
    id: issueId,
  });
}

/**
 * Ensures the requester can modify a specific assignment.
 * @deprecated Use PermissionPolicy.require instead
 */
export async function assertCanManageAssignment(
  ctx: ProtectedContext,
  assignmentId: string,
): Promise<void> {
  await PermissionPolicy.require(ctx, PERMISSIONS.ASSIGNMENT_MANAGE, {
    type: "assignment",
    id: assignmentId,
  });
}

/**
 * @deprecated Use PermissionPolicy.require instead
 */
export async function assertTeamLeadOrPermission(
  ctx: ProtectedContext,
  teamId: string,
  permission: Permission,
): Promise<void> {
  await PermissionPolicy.require(ctx, permission, {
    type: "team",
    id: teamId,
  });
}

/**
 * @deprecated Use PermissionPolicy.require instead
 */
export async function assertProjectLeadOrPermission(
  ctx: ProtectedContext,
  projectId: string,
  permission: Permission,
): Promise<void> {
  await PermissionPolicy.require(ctx, permission, {
    type: "project",
    id: projectId,
  });
}
