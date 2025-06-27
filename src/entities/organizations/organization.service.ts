import { db } from "@/db";
import {
  member,
  organization,
  project,
  issue,
  team,
  invitation,
  user,
  type MemberRole,
  type NonOwnerMemberRole,
} from "@/db/schema";
import { eq, and, count, desc } from "drizzle-orm";
import { randomUUID } from "crypto";
import { env } from "@/env";
import { notify } from "@/notifications/core";

export class OrganizationService {
  /**
   * Verify user has access to organization and get organization details
   */
  static async verifyUserOrganizationAccess(userId: string, orgSlug: string) {
    // Fetch the membership row (if any)
    const orgMembership = await db
      .select({
        organizationId: member.organizationId,
        role: member.role,
        organizationName: organization.name,
        organizationSlug: organization.slug,
      })
      .from(member)
      .innerJoin(organization, eq(member.organizationId, organization.id))
      .where(and(eq(member.userId, userId), eq(organization.slug, orgSlug)))
      .limit(1);

    if (orgMembership.length === 0) {
      return null;
    }

    const membership = orgMembership[0];

    // Auto-promote the very first member to OWNER if no owner exists yet.
    if (membership.role !== "owner") {
      // Check if the organisation already has an owner.
      const ownerCountRes = await db
        .select({ count: count() })
        .from(member)
        .where(
          and(
            eq(member.organizationId, membership.organizationId),
            eq(member.role, "owner"),
          ),
        );

      const ownerCount = ownerCountRes[0]?.count ?? 0;

      if (ownerCount === 0) {
        // Promote current user to owner.
        await db
          .update(member)
          .set({ role: "owner" })
          .where(
            and(
              eq(member.organizationId, membership.organizationId),
              eq(member.userId, userId),
            ),
          );

        // Reflect change locally
        membership.role = "owner";
      }
    }

    return membership;
  }

  /**
   * Get organization dashboard stats
   */
  static async getOrganizationStats(orgSlug: string) {
    // Resolve slug to organization id first
    const orgRow = await db
      .select({ id: organization.id })
      .from(organization)
      .where(eq(organization.slug, orgSlug))
      .limit(1);

    const orgId = orgRow[0]?.id;
    if (!orgId) {
      return { projectCount: 0, issueCount: 0, memberCount: 0 } as const;
    }

    const [projectStats, issueStats, memberStats] = await Promise.all([
      // Project count
      db
        .select({ count: count() })
        .from(project)
        .where(eq(project.organizationId, orgId)),

      // Issue stats
      db
        .select({
          total: count(),
        })
        .from(issue)
        .innerJoin(project, eq(issue.projectId, project.id))
        .where(eq(project.organizationId, orgId)),

      // Member count
      db
        .select({ count: count() })
        .from(member)
        .where(eq(member.organizationId, orgId)),
    ]);

    return {
      projectCount: projectStats[0]?.count || 0,
      issueCount: issueStats[0]?.total || 0,
      memberCount: memberStats[0]?.count || 0,
    };
  }

  /**
   * Get recent projects for organization
   */
  static async getRecentProjects(orgSlug: string, limit = 5) {
    const orgRow = await db
      .select({ id: organization.id })
      .from(organization)
      .where(eq(organization.slug, orgSlug))
      .limit(1);

    const orgId = orgRow[0]?.id;
    if (!orgId) return [];

    return await db
      .select({
        id: project.id,
        name: project.name,
        description: project.description,
        updatedAt: project.updatedAt,
      })
      .from(project)
      .where(eq(project.organizationId, orgId))
      .orderBy(desc(project.updatedAt))
      .limit(limit);
  }

  /**
   * Get recent issues for organization
   */
  static async getRecentIssues(orgSlug: string, limit = 5) {
    const orgRow = await db
      .select({ id: organization.id })
      .from(organization)
      .where(eq(organization.slug, orgSlug))
      .limit(1);

    const orgId = orgRow[0]?.id;
    if (!orgId) return [];

    return await db
      .select({
        id: issue.id,
        title: issue.title,
        stateId: issue.stateId,
        priorityId: issue.priorityId,
        projectName: project.name,
        updatedAt: issue.updatedAt,
      })
      .from(issue)
      .innerJoin(project, eq(issue.projectId, project.id))
      .where(eq(project.organizationId, orgId))
      .orderBy(desc(issue.updatedAt))
      .limit(limit);
  }

  /**
   * Get all teams in organization
   */
  static async getOrganizationTeams(orgSlug: string) {
    const orgRow = await db
      .select({ id: organization.id })
      .from(organization)
      .where(eq(organization.slug, orgSlug))
      .limit(1);

    const orgId = orgRow[0]?.id;
    if (!orgId) return [];

    return await db
      .select({
        id: team.id,
        name: team.name,
        description: team.description,
      })
      .from(team)
      .where(eq(team.organizationId, orgId));
  }

  /**
   * Update organization name and/or slug.
   * Pass in the organization id (UUID) directly for fast lookup.
   * Returns updated row.
   */
  static async updateOrganization(
    orgId: string,
    data: { name?: string; slug?: string },
  ) {
    if (!data.name && !data.slug) return;

    // If slug is being changed → ensure uniqueness
    if (data.slug) {
      const existingSlug = await db
        .select({ id: organization.id })
        .from(organization)
        .where(eq(organization.slug, data.slug))
        .limit(1);

      if (existingSlug.length > 0 && existingSlug[0].id !== orgId) {
        throw new Error("Slug already in use");
      }
    }

    await db
      .update(organization)
      .set({
        ...(data.name ? { name: data.name } : {}),
        ...(data.slug ? { slug: data.slug } : {}),
      })
      .where(eq(organization.id, orgId));

    const updated = await db
      .select({
        id: organization.id,
        name: organization.name,
        slug: organization.slug,
      })
      .from(organization)
      .where(eq(organization.id, orgId))
      .limit(1);
    return updated[0];
  }

  static async getUserOrganizations(userId: string) {
    return await db
      .select({
        id: organization.id,
        name: organization.name,
        slug: organization.slug,
      })
      .from(member)
      .innerJoin(organization, eq(member.organizationId, organization.id))
      .where(eq(member.userId, userId));
  }

  // ------------------------------------------------------------------
  // Members & Invitations
  // ------------------------------------------------------------------

  /** List all members of organization */
  static async listMembers(orgId: string) {
    return await db
      .select({
        userId: member.userId,
        name: user.name,
        email: user.email,
        role: member.role,
        joinedAt: member.createdAt,
      })
      .from(member)
      .innerJoin(user, eq(member.userId, user.id))
      .where(eq(member.organizationId, orgId))
      .orderBy(member.createdAt);
  }

  /** Invite a member (owner/admin only) */
  static async inviteMember(
    orgId: string,
    email: string,
    role: NonOwnerMemberRole,
    inviterId: string,
  ) {
    const token = randomUUID();
    const now = new Date();
    const expiresAt = new Date(now.getTime() + 1000 * 60 * 60 * 24 * 7); // 7 days

    await db.insert(invitation).values({
      id: token,
      organizationId: orgId,
      email,
      role,
      status: "pending",
      inviterId,
      expiresAt,
      createdAt: now,
    });

    // Dispatch notification (email by default).
    const inviterName =
      (
        await db
          .select({ name: user.name })
          .from(user)
          .where(eq(user.id, inviterId))
      )[0]?.name ?? "Someone";

    await notify(
      "organization.invite",
      {
        inviterName,
        inviteLink: `${env.APP_URL}/invite/${token}`,
      },
      {
        email: { to: email },
      },
    );

    return { token } as const;
  }

  /** Accept an invitation given token and userId */
  static async acceptInvitation(token: string, userId: string) {
    const rows = await db
      .select()
      .from(invitation)
      .where(eq(invitation.id, token))
      .limit(1);
    if (rows.length === 0) throw new Error("Invalid invitation token");
    const invite = rows[0];
    if (invite.status !== "pending") throw new Error("Invitation already used");
    if (invite.expiresAt && new Date(invite.expiresAt) < new Date()) {
      throw new Error("Invitation expired");
    }

    // Add membership
    await db.transaction(async (tx) => {
      await tx.insert(member).values({
        id: randomUUID(),
        organizationId: invite.organizationId,
        userId,
        role: invite.role ?? "member",
        createdAt: new Date(),
      });

      await tx
        .update(invitation)
        .set({
          status: "accepted",
          acceptedAt: new Date(),
        })
        .where(eq(invitation.id, token));
    });
  }

  static async revokeInvitation(token: string) {
    await db
      .update(invitation)
      .set({ status: "revoked", revokedAt: new Date() })
      .where(eq(invitation.id, token));
  }

  static async listPendingInvites(orgId: string) {
    return await db
      .select()
      .from(invitation)
      .where(
        and(
          eq(invitation.organizationId, orgId),
          eq(invitation.status, "pending"),
        ),
      );
  }

  static async updateMemberRole(
    orgId: string,
    userId: string,
    role: NonOwnerMemberRole,
  ) {
    await db
      .update(member)
      .set({ role })
      .where(and(eq(member.organizationId, orgId), eq(member.userId, userId)));
  }
}
