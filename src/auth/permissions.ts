import { TRPCError } from "@trpc/server";
import { db } from "@/db";
import {
  member,
  orgRole,
  orgRolePermission,
  orgRoleAssignment,
} from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { WILDCARD, type Permission } from "@/auth/permission-constants";
import { BUILTIN_ROLE_PERMISSIONS } from "./builtin-role-permissions";

// -----------------------------------------------------------------------------
// Built-in roles → static permission sets
// -----------------------------------------------------------------------------

// Fast check helper for wildcard permission sets
function hasWildcard(perms: Permission[]): boolean {
  return perms.includes(WILDCARD);
}

// Cache for permission lookups within a request
const permissionCache = new Map<string, boolean>();

/**
 * Clears the permission cache. Call this at the start of each request.
 */
export function clearPermissionCache(): void {
  permissionCache.clear();
}

// -----------------------------------------------------------------------------
//  Public API
// -----------------------------------------------------------------------------

/**
 * Resolves whether the user has the requested permission inside the given org.
 *
 * 1. First checks if user is actually a member of the organization
 * 2. Built-in role permissions (owner/admin/member)
 * 3. Custom roles assigned to the user (org_role_assignment)
 * 4. Wildcard ("*") grants everything
 */
export async function hasPermission(
  userId: string,
  organizationId: string,
  permission: Permission,
): Promise<boolean> {
  // Cache key for this specific permission check
  const cacheKey = `${userId}:${organizationId}:${permission}`;
  if (permissionCache.has(cacheKey)) {
    return permissionCache.get(cacheKey)!;
  }

  // --------------------------------------------------------------
  // 1) First verify membership - security critical
  // --------------------------------------------------------------
  const membershipRows = await db
    .select({ role: member.role })
    .from(member)
    .where(
      and(eq(member.userId, userId), eq(member.organizationId, organizationId)),
    )
    .limit(1);

  if (membershipRows.length === 0) {
    // User is not a member of this organization
    permissionCache.set(cacheKey, false);
    return false;
  }

  const memberRole = membershipRows[0].role;

  // --------------------------------------------------------------
  // 2) Built-in role from membership row
  // --------------------------------------------------------------
  const basePerms = BUILTIN_ROLE_PERMISSIONS[memberRole] ?? [];
  if (hasWildcard(basePerms) || basePerms.includes(permission)) {
    permissionCache.set(cacheKey, true);
    return true;
  }

  // --------------------------------------------------------------
  // 3) Custom roles → permissions via join tables (batch query)
  // --------------------------------------------------------------
  const customPermissions = await db
    .select({ permission: orgRolePermission.permission })
    .from(orgRole)
    .innerJoin(orgRoleAssignment, eq(orgRole.id, orgRoleAssignment.roleId))
    .innerJoin(orgRolePermission, eq(orgRole.id, orgRolePermission.roleId))
    .where(
      and(
        eq(orgRole.organizationId, organizationId),
        eq(orgRoleAssignment.userId, userId),
      ),
    );

  const permissions = customPermissions.map((p) => p.permission as Permission);
  const hasCustomPermission =
    hasWildcard(permissions) || permissions.includes(permission);

  permissionCache.set(cacheKey, hasCustomPermission);
  return hasCustomPermission;
}

/**
 * Batch permission check for multiple permissions at once.
 * More efficient than calling hasPermission multiple times.
 */
export async function hasPermissions(
  userId: string,
  organizationId: string,
  permissions: Permission[],
): Promise<Record<string, boolean>> {
  const results: Record<string, boolean> = {};

  // Check membership once
  const membershipRows = await db
    .select({ role: member.role })
    .from(member)
    .where(
      and(eq(member.userId, userId), eq(member.organizationId, organizationId)),
    )
    .limit(1);

  if (membershipRows.length === 0) {
    // User is not a member - deny all permissions
    for (const perm of permissions) {
      results[perm] = false;
    }
    return results;
  }

  const memberRole = membershipRows[0].role;
  const basePerms = BUILTIN_ROLE_PERMISSIONS[memberRole] ?? [];
  const hasWildcardBase = hasWildcard(basePerms);

  // Get all custom permissions at once
  const customPermissions = await db
    .select({ permission: orgRolePermission.permission })
    .from(orgRole)
    .innerJoin(orgRoleAssignment, eq(orgRole.id, orgRoleAssignment.roleId))
    .innerJoin(orgRolePermission, eq(orgRole.id, orgRolePermission.roleId))
    .where(
      and(
        eq(orgRole.organizationId, organizationId),
        eq(orgRoleAssignment.userId, userId),
      ),
    );

  const customPerms = customPermissions.map((p) => p.permission as Permission);
  const hasWildcardCustom = hasWildcard(customPerms);

  // Check each permission
  for (const permission of permissions) {
    const hasBuiltin = hasWildcardBase || basePerms.includes(permission);
    const hasCustom = hasWildcardCustom || customPerms.includes(permission);
    results[permission] = hasBuiltin || hasCustom;
  }

  return results;
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
    throw new TRPCError({
      code: "FORBIDDEN",
      message: `Missing required permission: ${permission}`,
    });
  }
}
