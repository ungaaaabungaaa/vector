import { db } from "@/db";
import {
  member,
  orgRole,
  orgRolePermission,
  orgRoleAssignment,
  type MemberRole,
} from "@/db/schema";
import { eq, inArray, and } from "drizzle-orm";
import { PERMISSIONS, type Permission } from "@/auth/permission-constants";
import { BUILTIN_ROLE_PERMISSIONS } from "./builtin-role-permissions";

// -----------------------------------------------------------------------------
// Built-in roles → static permission sets
// -----------------------------------------------------------------------------

// Fast check helper for wildcard permission sets
function hasWildcard(perms: Permission[]): boolean {
  return perms.includes("*");
}

// -----------------------------------------------------------------------------
//  Public API
// -----------------------------------------------------------------------------

/**
 * Resolves whether the user has the requested permission inside the given org.
 *
 * 1. Built-in role permissions (owner/admin/member)
 * 2. Custom roles assigned to the user (org_role_assignment)
 * 3. Wildcard ("*") grants everything
 */
export async function hasPermission(
  userId: string,
  organizationId: string,
  permission: Permission,
): Promise<boolean> {
  // --------------------------------------------------------------
  // 1) Built-in role from membership row
  // --------------------------------------------------------------
  const membershipRows = await db
    .select({ role: member.role })
    .from(member)
    .where(
      and(eq(member.userId, userId), eq(member.organizationId, organizationId)),
    )
    .limit(1);

  if (membershipRows.length > 0) {
    const role = membershipRows[0].role;
    const basePerms = BUILTIN_ROLE_PERMISSIONS[role] ?? [];
    if (hasWildcard(basePerms) || basePerms.includes(permission)) return true;
  }

  // --------------------------------------------------------------
  // 2) Custom roles → permissions via join tables
  // --------------------------------------------------------------
  const roleRows = await db
    .select({ roleId: orgRole.id })
    .from(orgRole)
    .innerJoin(orgRoleAssignment, eq(orgRole.id, orgRoleAssignment.roleId))
    .where(
      and(
        eq(orgRole.organizationId, organizationId),
        eq(orgRoleAssignment.userId, userId),
      ),
    );

  if (roleRows.length === 0) return false;

  const roleIds = roleRows.map((r) => r.roleId);

  const permRows = await db
    .select({ permission: orgRolePermission.permission })
    .from(orgRolePermission)
    .where(inArray(orgRolePermission.roleId, roleIds));

  const permissions = permRows.map((p) => p.permission as Permission);
  return hasWildcard(permissions) || permissions.includes(permission);
}

/**
 * Throws a 403 error if the user lacks the requested permission.
 */
export async function requirePermission(
  userId: string,
  organizationId: string,
  permission: Permission,
): Promise<void> {
  const allowed = await hasPermission(userId, organizationId, permission);
  if (!allowed) {
    const { TRPCError } = await import("@trpc/server");
    throw new TRPCError({ code: "FORBIDDEN" });
  }
}
