import { TRPCError } from "@trpc/server";
import { db } from "@/db";
import {
  issue as issueTable,
  issueAssignee as assignmentTable,
  team as teamTable,
  project as projectTable,
} from "@/db/schema";
import { eq, and } from "drizzle-orm";
import type { ProtectedContext } from "@/trpc/init";
import { PERMISSIONS, type Permission } from "@/auth/permission-constants";
import { requirePermission } from "./permissions";

// Platform-level admin check
export function isPlatformAdmin(ctx: ProtectedContext): boolean {
  return ctx.session.user.role === "admin";
}

/**
 * Central policy engine for all authorization decisions.
 * Consolidates scattered permission logic into one place.
 */
export class PermissionPolicy {
  /**
   * Check if user can perform an action on a resource.
   * Returns true/false without throwing.
   */
  static async can(
    ctx: ProtectedContext,
    action: Permission,
    resource?: {
      type: "organization" | "project" | "team" | "issue" | "assignment";
      id: string;
      orgId?: string;
    },
  ): Promise<boolean> {
    try {
      await this.require(ctx, action, resource);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Require permission for an action on a resource.
   * Throws TRPCError if denied.
   */
  static async require(
    ctx: ProtectedContext,
    action: Permission,
    resource?: {
      type: "organization" | "project" | "team" | "issue" | "assignment";
      id: string;
      orgId?: string;
    },
  ): Promise<void> {
    const userId = ctx.session.user.id;

    // Platform admin shortcut
    if (isPlatformAdmin(ctx)) return;

    // If no specific resource, check org-level permission
    if (!resource) {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: "Resource context required for permission check",
      });
    }

    switch (resource.type) {
      case "organization":
        await requirePermission(userId, resource.id, action);
        break;

      case "project":
        await this.requireProjectPermission(ctx, action, resource.id);
        break;

      case "team":
        await this.requireTeamPermission(ctx, action, resource.id);
        break;

      case "issue":
        await this.requireIssuePermission(ctx, action, resource.id);
        break;

      case "assignment":
        await this.requireAssignmentPermission(ctx, action, resource.id);
        break;

      default:
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: `Unknown resource type: ${(resource as { type: string }).type}`,
        });
    }
  }

  private static async requireProjectPermission(
    ctx: ProtectedContext,
    action: Permission,
    projectId: string,
  ): Promise<void> {
    const userId = ctx.session.user.id;

    // Get project details
    const projectRows = await db
      .select({
        leadId: projectTable.leadId,
        organizationId: projectTable.organizationId,
      })
      .from(projectTable)
      .where(eq(projectTable.id, projectId))
      .limit(1);

    if (projectRows.length === 0) {
      throw new TRPCError({
        code: "NOT_FOUND",
        message: "Project not found",
      });
    }

    const { organizationId } = projectRows[0];

    // Project lead can do most actions
    if (
      projectRows.length > 0 &&
      projectRows[0].leadId === userId &&
      this.isLeadAction(action)
    ) {
      return;
    }

    // Fall back to org-level permission
    await requirePermission(userId, organizationId, action);
  }

  private static async requireTeamPermission(
    ctx: ProtectedContext,
    action: Permission,
    teamId: string,
  ): Promise<void> {
    const userId = ctx.session.user.id;

    // Get team details
    const teamRows = await db
      .select({
        leadId: teamTable.leadId,
        organizationId: teamTable.organizationId,
      })
      .from(teamTable)
      .where(eq(teamTable.id, teamId))
      .limit(1);

    if (teamRows.length === 0) {
      throw new TRPCError({
        code: "NOT_FOUND",
        message: "Team not found",
      });
    }

    const { organizationId } = teamRows[0];

    // Team lead can do most actions
    if (
      teamRows.length > 0 &&
      teamRows[0].leadId === userId &&
      this.isLeadAction(action)
    ) {
      return;
    }

    // Fall back to org-level permission
    await requirePermission(userId, organizationId, action);
  }

  private static async requireIssuePermission(
    ctx: ProtectedContext,
    action: Permission,
    issueId: string,
  ): Promise<void> {
    const userId = ctx.session.user.id;

    // Get issue details
    const issueRows = await db
      .select({
        reporterId: issueTable.reporterId,
        projectId: issueTable.projectId,
        teamId: issueTable.teamId,
        organizationId: issueTable.organizationId,
      })
      .from(issueTable)
      .where(eq(issueTable.id, issueId))
      .limit(1);

    if (issueRows.length === 0) {
      throw new TRPCError({
        code: "NOT_FOUND",
        message: "Issue not found",
      });
    }

    const { reporterId, projectId, teamId, organizationId } = issueRows[0];

    // Reporter can update their own issues
    if (reporterId === userId && this.isAuthorAction(action)) {
      return;
    }

    // Check if user is assigned to this issue
    if (this.isAssigneeAction(action)) {
      const assignmentRows = await db
        .select({ id: assignmentTable.id })
        .from(assignmentTable)
        .where(
          and(
            eq(assignmentTable.issueId, issueId),
            eq(assignmentTable.assigneeId, userId),
          ),
        )
        .limit(1);

      if (assignmentRows.length > 0) return;
    }

    // Check project lead permission
    if (projectId) {
      const projectRows = await db
        .select({ leadId: projectTable.leadId })
        .from(projectTable)
        .where(eq(projectTable.id, projectId))
        .limit(1);

      if (
        projectRows.length > 0 &&
        projectRows[0].leadId === userId &&
        this.isLeadAction(action)
      ) {
        return;
      }
    }

    // Check team lead permission
    if (teamId) {
      const teamRows = await db
        .select({ leadId: teamTable.leadId })
        .from(teamTable)
        .where(eq(teamTable.id, teamId))
        .limit(1);

      if (
        teamRows.length > 0 &&
        teamRows[0].leadId === userId &&
        this.isLeadAction(action)
      ) {
        return;
      }
    }

    // Fall back to org-level permission
    await requirePermission(userId, organizationId, action);
  }

  private static async requireAssignmentPermission(
    ctx: ProtectedContext,
    action: Permission,
    assignmentId: string,
  ): Promise<void> {
    const userId = ctx.session.user.id;

    // Get assignment details
    const assignmentRows = await db
      .select({
        issueId: assignmentTable.issueId,
        assigneeId: assignmentTable.assigneeId,
      })
      .from(assignmentTable)
      .where(eq(assignmentTable.id, assignmentId))
      .limit(1);

    if (assignmentRows.length === 0) {
      throw new TRPCError({
        code: "NOT_FOUND",
        message: "Assignment not found",
      });
    }

    const { issueId, assigneeId } = assignmentRows[0];

    // Users can manage their own assignments
    if (assigneeId === userId) return;

    // Get organization context
    const issueRows = await db
      .select({ organizationId: issueTable.organizationId })
      .from(issueTable)
      .where(eq(issueTable.id, issueId))
      .limit(1);

    if (issueRows.length === 0) {
      throw new TRPCError({
        code: "NOT_FOUND",
        message: "Issue not found",
      });
    }

    // Fall back to org-level assignment management permission
    await requirePermission(
      userId,
      issueRows[0].organizationId,
      PERMISSIONS.ASSIGNMENT_MANAGE,
    );
  }

  // Helper methods to categorize actions
  private static isLeadAction(action: Permission): boolean {
    const leadActions: Permission[] = [
      PERMISSIONS.PROJECT_UPDATE,
      PERMISSIONS.PROJECT_DELETE,
      PERMISSIONS.TEAM_UPDATE,
      PERMISSIONS.TEAM_DELETE,
      PERMISSIONS.ISSUE_UPDATE,
      PERMISSIONS.ISSUE_DELETE,
    ];
    return leadActions.includes(action);
  }

  private static isAuthorAction(action: Permission): boolean {
    const authorActions: Permission[] = [
      PERMISSIONS.ISSUE_UPDATE,
      PERMISSIONS.ISSUE_DELETE,
    ];
    return authorActions.includes(action);
  }

  private static isAssigneeAction(action: Permission): boolean {
    const assigneeActions: Permission[] = [PERMISSIONS.ISSUE_UPDATE];
    return assigneeActions.includes(action);
  }
}
