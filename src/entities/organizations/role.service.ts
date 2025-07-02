import { db } from "@/db";
import {
  orgRole,
  orgRolePermission,
  orgRoleAssignment,
  member,
} from "@/db/schema";
import { eq, and, desc } from "drizzle-orm";
import { randomUUID } from "crypto";
import type { Permission } from "@/auth/permission-constants";

export class OrgRoleService {
  // ---------------------------------------------------------------------------
  // Roles
  // ---------------------------------------------------------------------------

  static async listRoles(orgId: string) {
    return await db
      .select({
        id: orgRole.id,
        name: orgRole.name,
        description: orgRole.description,
        system: orgRole.system,
        createdAt: orgRole.createdAt,
      })
      .from(orgRole)
      .where(eq(orgRole.organizationId, orgId))
      .orderBy(desc(orgRole.createdAt));
  }

  static async createRole(
    orgId: string,
    name: string,
    description?: string,
    permissions: Permission[] = [],
  ) {
    const id = randomUUID();
    const now = new Date();

    await db.transaction(async (tx) => {
      await tx.insert(orgRole).values({
        id,
        organizationId: orgId,
        name,
        description,
        system: false,
        createdAt: now,
        updatedAt: now,
      });

      if (permissions.length > 0) {
        await tx
          .insert(orgRolePermission)
          .values(
            permissions.map((perm) => ({ roleId: id, permission: perm })),
          );
      }
    });

    return { id } as const;
  }

  static async updateRole(
    roleId: string,
    orgId: string,
    data: { name?: string; description?: string; permissions?: Permission[] },
  ) {
    const current = await db
      .select({ system: orgRole.system })
      .from(orgRole)
      .where(and(eq(orgRole.id, roleId), eq(orgRole.organizationId, orgId)))
      .limit(1);
    if (current.length === 0) throw new Error("Role not found");
    if (current[0].system) throw new Error("Cannot update system role");

    await db.transaction(async (tx) => {
      if (data.name || data.description) {
        await tx
          .update(orgRole)
          .set({
            ...(data.name ? { name: data.name } : {}),
            ...(data.description ? { description: data.description } : {}),
            updatedAt: new Date(),
          })
          .where(eq(orgRole.id, roleId));
      }

      if (data.permissions) {
        // Replace existing permissions – simple approach
        await tx
          .delete(orgRolePermission)
          .where(eq(orgRolePermission.roleId, roleId));
        if (data.permissions.length > 0) {
          await tx
            .insert(orgRolePermission)
            .values(data.permissions.map((p) => ({ roleId, permission: p })));
        }
      }
    });
  }

  static async deleteRole(roleId: string, orgId: string) {
    const rows = await db
      .select({ system: orgRole.system })
      .from(orgRole)
      .where(and(eq(orgRole.id, roleId), eq(orgRole.organizationId, orgId)))
      .limit(1);
    if (rows.length === 0) return;
    if (rows[0].system) throw new Error("Cannot delete system role");

    await db.delete(orgRole).where(eq(orgRole.id, roleId));
  }

  static async getRole(roleId: string, orgId: string) {
    // Fetch main role record
    const rows = await db
      .select({
        id: orgRole.id,
        name: orgRole.name,
        description: orgRole.description,
        system: orgRole.system,
        createdAt: orgRole.createdAt,
      })
      .from(orgRole)
      .where(and(eq(orgRole.id, roleId), eq(orgRole.organizationId, orgId)))
      .limit(1);

    if (rows.length === 0) throw new Error("Role not found");

    // Fetch permissions bound to this role
    const perms = await db
      .select({ permission: orgRolePermission.permission })
      .from(orgRolePermission)
      .where(eq(orgRolePermission.roleId, roleId));

    return {
      ...rows[0],
      permissions: perms.map((p) => p.permission as Permission),
    } as const;
  }

  // ---------------------------------------------------------------------------
  // Assignments
  // ---------------------------------------------------------------------------

  static async assignRole(roleId: string, userId: string, orgId: string) {
    // First verify the user is actually a member of this organization
    const membershipRows = await db
      .select({ id: member.id })
      .from(member)
      .where(and(eq(member.userId, userId), eq(member.organizationId, orgId)))
      .limit(1);

    if (membershipRows.length === 0) {
      throw new Error("User is not a member of this organization");
    }

    // Verify the role exists and belongs to this organization
    const roleRows = await db
      .select({ id: orgRole.id })
      .from(orgRole)
      .where(and(eq(orgRole.id, roleId), eq(orgRole.organizationId, orgId)))
      .limit(1);

    if (roleRows.length === 0) {
      throw new Error("Role not found in this organization");
    }

    // Avoid duplicate assignments – ignore unique-violation errors
    try {
      await db.insert(orgRoleAssignment).values({
        roleId,
        userId,
        organizationId: orgId,
        assignedAt: new Date(),
      });
    } catch (err: unknown) {
      // Postgres unique_violation error code
      const code =
        typeof err === "object" && err !== null && "code" in err
          ? (err as { code?: string }).code
          : undefined;
      if (code === "23505") {
        // Role already assigned – silently ignore
        return;
      }
      throw err;
    }
  }

  static async removeRole(roleId: string, userId: string) {
    await db
      .delete(orgRoleAssignment)
      .where(
        and(
          eq(orgRoleAssignment.roleId, roleId),
          eq(orgRoleAssignment.userId, userId),
        ),
      );
  }

  static async listUserRoles(userId: string, orgId: string) {
    return await db
      .select({
        roleId: orgRole.id,
        name: orgRole.name,
        description: orgRole.description,
      })
      .from(orgRoleAssignment)
      .innerJoin(orgRole, eq(orgRole.id, orgRoleAssignment.roleId))
      .where(
        and(
          eq(orgRoleAssignment.userId, userId),
          eq(orgRoleAssignment.organizationId, orgId),
        ),
      );
  }
}
