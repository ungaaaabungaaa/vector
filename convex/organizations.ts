import { query, mutation } from "./_generated/server";
import { v, ConvexError } from "convex/values";
import type { Id, Doc } from "./_generated/dataModel";
import { getAuthUserId } from "@convex-dev/auth/server";
import { canViewIssue, canViewTeam, canViewProject } from "./access";
import {
  ISSUE_PRIORITY_DEFAULTS,
  ISSUE_STATE_DEFAULTS,
  PROJECT_STATUS_DEFAULTS,
} from "../src/lib/defaults";

/**
 * Get organization by slug
 */
export const getBySlug = query({
  args: {
    orgSlug: v.string(),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) {
      throw new ConvexError("UNAUTHORIZED");
    }

    // Find organization
    const org = await ctx.db
      .query("organizations")
      .withIndex("by_slug", (q) => q.eq("slug", args.orgSlug))
      .first();

    if (!org) {
      throw new ConvexError("ORGANIZATION_NOT_FOUND");
    }

    // Verify user is a member
    const membership = await ctx.db
      .query("members")
      .withIndex("by_org_user", (q) =>
        q.eq("organizationId", org._id).eq("userId", userId),
      )
      .first();

    if (!membership) {
      throw new ConvexError("FORBIDDEN");
    }

    return org;
  },
});

/**
 * List organization members with roles
 */
export const listMembersWithRoles = query({
  args: {
    orgSlug: v.string(),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) {
      throw new ConvexError("UNAUTHORIZED");
    }

    // Find organization
    const org = await ctx.db
      .query("organizations")
      .withIndex("by_slug", (q) => q.eq("slug", args.orgSlug))
      .first();

    if (!org) {
      throw new ConvexError("ORGANIZATION_NOT_FOUND");
    }

    // Verify user is a member
    const membership = await ctx.db
      .query("members")
      .withIndex("by_org_user", (q) =>
        q.eq("organizationId", org._id).eq("userId", userId),
      )
      .first();

    if (!membership) {
      throw new ConvexError("FORBIDDEN");
    }

    const members = await ctx.db
      .query("members")
      .withIndex("by_organization", (q) => q.eq("organizationId", org._id))
      .collect();

    const users = await Promise.all(members.map((m) => ctx.db.get(m.userId)));

    const roles = await ctx.db
      .query("orgRoleAssignments")
      .withIndex("by_organization", (q) => q.eq("organizationId", org._id))
      .collect();

    const roleDefs = await Promise.all(roles.map((r) => ctx.db.get(r.roleId)));

    return members.map((m, i) => {
      const user = users[i];
      const userRoles = roles.filter((r) => r.userId === m.userId);
      const customRoles = userRoles
        .map((ur) => roleDefs.find((rd) => rd?._id === ur.roleId))
        .filter((r): r is NonNullable<typeof r> => !!r);
      return {
        ...m,
        name: user?.name,
        email: user?.email,
        image: user?.image,
        roleId: userRoles[0]?.roleId ?? null,
        roleName:
          roleDefs.find((rd) => rd?._id === userRoles[0]?.roleId)?.name ?? null,
        customRoles,
      };
    });
  },
});

export const listInvites = query({
  args: {
    orgSlug: v.string(),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) {
      throw new ConvexError("UNAUTHORIZED");
    }

    // Find organization
    const org = await ctx.db
      .query("organizations")
      .withIndex("by_slug", (q) => q.eq("slug", args.orgSlug))
      .first();

    if (!org) {
      throw new ConvexError("ORGANIZATION_NOT_FOUND");
    }

    // Verify user is a member
    const membership = await ctx.db
      .query("members")
      .withIndex("by_org_user", (q) =>
        q.eq("organizationId", org._id).eq("userId", userId),
      )
      .first();

    if (!membership) {
      throw new ConvexError("FORBIDDEN");
    }

    return await ctx.db
      .query("invitations")
      .withIndex("by_organization", (q) => q.eq("organizationId", org._id))
      .filter((q) => q.eq(q.field("status"), "pending"))
      .collect();
  },
});

export const revokeInvite = mutation({
  args: {
    inviteId: v.id("invitations"),
  },
  handler: async (ctx, args) => {
    const invite = await ctx.db.get(args.inviteId);

    if (!invite) {
      throw new ConvexError("INVITE_NOT_FOUND");
    }

    await ctx.db.patch(invite._id, { status: "revoked" });
  },
});

export const acceptInvitation = mutation({
  args: {
    inviteId: v.id("invitations"),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) {
      throw new ConvexError("UNAUTHORIZED");
    }
    const user = await ctx.db.get(userId);
    if (!user) {
      throw new ConvexError("USER_NOT_FOUND");
    }

    const invite = await ctx.db.get(args.inviteId);

    if (!invite) {
      throw new ConvexError("INVITATION_NOT_FOUND");
    }
    if (invite.status !== "pending") {
      throw new ConvexError("INVITATION_NOT_PENDING");
    }
    if (invite.email.toLowerCase() !== user.email?.toLowerCase()) {
      throw new ConvexError(
        `This invitation is for ${invite.email}, but you are logged in as ${user.email}.`,
      );
    }
    if (invite.expiresAt < Date.now()) {
      await ctx.db.patch(invite._id, { status: "expired" });
      throw new ConvexError("INVITATION_EXPIRED");
    }

    await ctx.db.patch(invite._id, {
      status: "accepted",
      acceptedAt: Date.now(),
    });

    const existingMembership = await ctx.db
      .query("members")
      .withIndex("by_org_user", (q) =>
        q.eq("organizationId", invite.organizationId).eq("userId", userId),
      )
      .first();

    if (!existingMembership) {
      await ctx.db.insert("members", {
        organizationId: invite.organizationId,
        userId,
        role: invite.role,
      });
    }

    return { success: true };
  },
});

export const resendInvite = mutation({
  args: {
    token: v.id("invitations"),
  },
  handler: async (ctx, args) => {
    // This is a simplified implementation. The legacy code sends an email.
    // For now, we will just update the expiry date.
    const invite = await ctx.db.get(args.token);

    if (!invite) {
      throw new ConvexError("INVITE_NOT_FOUND");
    }

    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7);

    await ctx.db.patch(invite._id, { expiresAt: expiresAt.getTime() });
  },
});

export const removeMember = mutation({
  args: {
    orgSlug: v.string(),
    userId: v.id("users"),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) {
      throw new ConvexError("UNAUTHORIZED");
    }

    // Find organization
    const org = await ctx.db
      .query("organizations")
      .withIndex("by_slug", (q) => q.eq("slug", args.orgSlug))
      .first();

    if (!org) {
      throw new ConvexError("ORGANIZATION_NOT_FOUND");
    }

    // Verify user is a member
    const membership = await ctx.db
      .query("members")
      .withIndex("by_org_user", (q) =>
        q.eq("organizationId", org._id).eq("userId", userId),
      )
      .first();

    if (!membership) {
      throw new ConvexError("FORBIDDEN");
    }

    const member = await ctx.db
      .query("members")
      .withIndex("by_org_user", (q) =>
        q.eq("organizationId", org._id).eq("userId", args.userId),
      )
      .first();

    if (!member) {
      throw new ConvexError("MEMBER_NOT_FOUND");
    }

    await ctx.db.delete(member._id);
  },
});

/**
 * Update member role
 */
export const updateMemberRole = mutation({
  args: {
    orgSlug: v.string(),
    userId: v.id("users"),
    role: v.union(v.literal("member"), v.literal("admin")),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) {
      throw new ConvexError("UNAUTHORIZED");
    }

    // Find organization
    const org = await ctx.db
      .query("organizations")
      .withIndex("by_slug", (q) => q.eq("slug", args.orgSlug))
      .first();

    if (!org) {
      throw new ConvexError("ORGANIZATION_NOT_FOUND");
    }

    // Verify user is owner or admin
    const membership = await ctx.db
      .query("members")
      .withIndex("by_org_user", (q) =>
        q.eq("organizationId", org._id).eq("userId", userId),
      )
      .first();

    if (
      !membership ||
      (membership.role !== "owner" && membership.role !== "admin")
    ) {
      throw new ConvexError("INSUFFICIENT_PERMISSIONS_UPDATE_MEMBER_ROLE");
    }

    // Find the member to update
    const member = await ctx.db
      .query("members")
      .withIndex("by_org_user", (q) =>
        q.eq("organizationId", org._id).eq("userId", args.userId),
      )
      .first();

    if (!member) {
      throw new ConvexError("MEMBER_NOT_FOUND");
    }

    // Don't allow changing owner role
    if (member.role === "owner") {
      throw new ConvexError("CANNOT_CHANGE_OWNER_ROLE");
    }

    // Update the member's role
    await ctx.db.patch(member._id, { role: args.role });

    return { success: true };
  },
});

/**
 * Get organization statistics
 */
export const getOrganizationStats = query({
  args: {
    orgSlug: v.string(),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) {
      throw new ConvexError("UNAUTHORIZED");
    }

    // Find organization
    const org = await ctx.db
      .query("organizations")
      .withIndex("by_slug", (q) => q.eq("slug", args.orgSlug))
      .first();

    if (!org) {
      throw new ConvexError("ORGANIZATION_NOT_FOUND");
    }

    // Verify user is a member
    const membership = await ctx.db
      .query("members")
      .withIndex("by_org_user", (q) =>
        q.eq("organizationId", org._id).eq("userId", userId),
      )
      .first();

    if (!membership) {
      throw new ConvexError("FORBIDDEN");
    }

    // Get counts
    const memberCount = await ctx.db
      .query("members")
      .withIndex("by_organization", (q) => q.eq("organizationId", org._id))
      .collect()
      .then((members) => members.length);

    const projectCount = await ctx.db
      .query("projects")
      .withIndex("by_organization", (q) => q.eq("organizationId", org._id))
      .collect()
      .then((projects) => projects.length);

    const teamCount = await ctx.db
      .query("teams")
      .withIndex("by_organization", (q) => q.eq("organizationId", org._id))
      .collect()
      .then((teams) => teams.length);

    const issueCount = await ctx.db
      .query("issues")
      .withIndex("by_organization", (q) => q.eq("organizationId", org._id))
      .collect()
      .then((issues) => issues.length);

    return {
      memberCount,
      projectCount,
      teamCount,
      issueCount,
    };
  },
});

/**
 * List recent projects
 */
export const getRecentProjects = query({
  args: {
    orgSlug: v.string(),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) {
      throw new ConvexError("UNAUTHORIZED");
    }

    // Find organization
    const org = await ctx.db
      .query("organizations")
      .withIndex("by_slug", (q) => q.eq("slug", args.orgSlug))
      .first();

    if (!org) {
      throw new ConvexError("ORGANIZATION_NOT_FOUND");
    }

    // Verify user is a member
    const membership = await ctx.db
      .query("members")
      .withIndex("by_org_user", (q) =>
        q.eq("organizationId", org._id).eq("userId", userId),
      )
      .first();

    if (!membership) {
      throw new ConvexError("FORBIDDEN");
    }

    // Get recent projects
    const projects = await ctx.db
      .query("projects")
      .withIndex("by_organization", (q) => q.eq("organizationId", org._id))
      .collect();

    // Sort by creation time (newest first) and limit
    const sortedProjects = projects
      .sort((a, b) => b._creationTime - a._creationTime)
      .slice(0, args.limit ?? 5);

    return sortedProjects;
  },
});

/**
 * List recent issues
 */
export const getRecentIssues = query({
  args: {
    orgSlug: v.string(),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) {
      throw new ConvexError("UNAUTHORIZED");
    }

    // Find organization
    const org = await ctx.db
      .query("organizations")
      .withIndex("by_slug", (q) => q.eq("slug", args.orgSlug))
      .first();

    if (!org) {
      throw new ConvexError("ORGANIZATION_NOT_FOUND");
    }

    // Verify user is a member
    const membership = await ctx.db
      .query("members")
      .withIndex("by_org_user", (q) =>
        q.eq("organizationId", org._id).eq("userId", userId),
      )
      .first();

    if (!membership) {
      throw new ConvexError("FORBIDDEN");
    }

    // Get recent issues
    const issues = await ctx.db
      .query("issues")
      .withIndex("by_organization", (q) => q.eq("organizationId", org._id))
      .collect();

    // Filter issues based on visibility permissions
    const issuePromises = issues.map(async (issue) => {
      const canView = await canViewIssue(ctx, issue);
      return canView ? issue : null;
    });
    const visibleIssues = (await Promise.all(issuePromises)).filter(
      (issue): issue is Doc<"issues"> => issue !== null,
    );

    // Sort by creation time (newest first) and limit
    const sortedIssues = visibleIssues
      .sort((a, b) => b._creationTime - a._creationTime)
      .slice(0, args.limit ?? 10);

    return sortedIssues;
  },
});

/**
 * Create organization
 */
export const create = mutation({
  args: {
    data: v.object({
      name: v.string(),
      slug: v.string(),
      logo: v.optional(v.id("_storage")),
    }),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) {
      throw new ConvexError("UNAUTHORIZED");
    }

    // Validate input
    if (!args.data.name.trim()) {
      throw new ConvexError("ORGANIZATION_NAME_REQUIRED");
    }
    if (!args.data.slug.trim()) {
      throw new ConvexError("ORGANIZATION_SLUG_REQUIRED");
    }
    if (args.data.name.length > 100) {
      throw new ConvexError("ORGANIZATION_NAME_TOO_LONG");
    }
    if (args.data.slug.length > 50) {
      throw new ConvexError("ORGANIZATION_SLUG_TOO_LONG");
    }

    // Check if slug is unique
    const existingOrg = await ctx.db
      .query("organizations")
      .withIndex("by_slug", (q) => q.eq("slug", args.data.slug))
      .first();

    if (existingOrg) {
      throw new ConvexError("ORGANIZATION_SLUG_UNIQUE");
    }

    // Create organization
    const orgId = await ctx.db.insert("organizations", {
      name: args.data.name.trim(),
      slug: args.data.slug.trim(),
      logo: args.data.logo,
    });

    // Add creator as owner
    await ctx.db.insert("members", {
      organizationId: orgId,
      userId,
      role: "owner",
    });

    // Create default issue states
    for (const state of ISSUE_STATE_DEFAULTS) {
      await ctx.db.insert("issueStates", {
        organizationId: orgId,
        name: state.name,
        position: state.position,
        color: state.color,
        icon: state.icon,
        type: state.type,
      });
    }

    // Create default issue priorities
    for (const priority of ISSUE_PRIORITY_DEFAULTS) {
      await ctx.db.insert("issuePriorities", {
        organizationId: orgId,
        name: priority.name,
        weight: priority.weight,
        color: priority.color,
        icon: priority.icon,
      });
    }

    // Create default project statuses
    for (const status of PROJECT_STATUS_DEFAULTS) {
      await ctx.db.insert("projectStatuses", {
        organizationId: orgId,
        name: status.name,
        position: status.position,
        color: status.color,
        icon: status.icon,
        type: status.type,
      });
    }

    return { orgId };
  },
});

/**
 * Update organization
 */
export const update = mutation({
  args: {
    orgSlug: v.string(),
    data: v.object({
      name: v.optional(v.string()),
      slug: v.optional(v.string()),
      logo: v.optional(v.id("_storage")),
    }),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) {
      throw new ConvexError("UNAUTHORIZED");
    }

    // Find organization
    const org = await ctx.db
      .query("organizations")
      .withIndex("by_slug", (q) => q.eq("slug", args.orgSlug))
      .first();

    if (!org) {
      throw new ConvexError("ORGANIZATION_NOT_FOUND");
    }

    // Verify user is owner or admin
    const membership = await ctx.db
      .query("members")
      .withIndex("by_org_user", (q) =>
        q.eq("organizationId", org._id).eq("userId", userId),
      )
      .first();

    if (
      !membership ||
      (membership.role !== "owner" && membership.role !== "admin")
    ) {
      throw new ConvexError("INSUFFICIENT_PERMISSIONS_UPDATE_ORGANIZATION");
    }

    // Validate input
    if (args.data.name && !args.data.name.trim()) {
      throw new ConvexError("ORGANIZATION_NAME_EMPTY");
    }
    if (args.data.name && args.data.name.length > 100) {
      throw new ConvexError("ORGANIZATION_NAME_TOO_LONG");
    }
    if (args.data.slug && !args.data.slug.trim()) {
      throw new ConvexError("ORGANIZATION_SLUG_EMPTY");
    }
    if (args.data.slug && args.data.slug.length > 50) {
      throw new ConvexError("ORGANIZATION_SLUG_TOO_LONG");
    }

    // Check if slug is unique (if being updated)
    if (args.data?.slug && args.data.slug.trim() !== org.slug) {
      const existingOrg = await ctx.db
        .query("organizations")
        .withIndex("by_slug", (q) => q.eq("slug", args.data.slug!.trim()))
        .first();

      if (existingOrg) {
        throw new ConvexError("ORGANIZATION_SLUG_UNIQUE");
      }
    }

    // Update organization
    const updateData: Partial<{
      name: string;
      slug: string;
      logo: Id<"_storage">;
    }> = {};

    if (args.data.name !== undefined) {
      updateData.name = args.data.name.trim();
    }
    if (args.data.slug !== undefined) {
      updateData.slug = args.data.slug.trim();
    }
    if (args.data.logo !== undefined) {
      updateData.logo = args.data.logo;
    }

    if (Object.keys(updateData).length > 0) {
      await ctx.db.patch(org._id, updateData);
    }

    return { success: true };
  },
});

/**
 * List organization members
 */
export const listMembers = query({
  args: {
    orgSlug: v.string(),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) {
      throw new ConvexError("UNAUTHORIZED");
    }

    // Find organization
    const org = await ctx.db
      .query("organizations")
      .withIndex("by_slug", (q) => q.eq("slug", args.orgSlug))
      .first();

    if (!org) {
      throw new ConvexError("ORGANIZATION_NOT_FOUND");
    }

    // Verify user is a member
    const membership = await ctx.db
      .query("members")
      .withIndex("by_org_user", (q) =>
        q.eq("organizationId", org._id).eq("userId", userId),
      )
      .first();

    if (!membership) {
      throw new ConvexError("FORBIDDEN");
    }

    // Get all members
    const members = await ctx.db
      .query("members")
      .withIndex("by_organization", (q) => q.eq("organizationId", org._id))
      .collect();

    // Get user details for each member
    const memberUserIds = members.map((m) => m.userId);
    const users = await Promise.all(memberUserIds.map((id) => ctx.db.get(id)));
    const userMap = new Map(memberUserIds.map((id, i) => [id, users[i]]));

    // Combine results
    const membersWithUsers = members.map((member) => {
      const user = userMap.get(member.userId);
      return {
        ...member,
        user: user
          ? {
              _id: user._id,
              name: user.name,
              email: user.email,
              username: user.username,
              role: user.role,
            }
          : null,
      };
    });

    return membersWithUsers;
  },
});

/**
 * Search organization members
 */
export const searchMembers = query({
  args: {
    orgSlug: v.string(),
    query: v.optional(v.string()),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) {
      throw new ConvexError("UNAUTHORIZED");
    }

    // Find organization
    const org = await ctx.db
      .query("organizations")
      .withIndex("by_slug", (q) => q.eq("slug", args.orgSlug))
      .first();

    if (!org) {
      throw new ConvexError("ORGANIZATION_NOT_FOUND");
    }

    // Verify user is a member
    const membership = await ctx.db
      .query("members")
      .withIndex("by_org_user", (q) =>
        q.eq("organizationId", org._id).eq("userId", userId),
      )
      .first();

    if (!membership) {
      throw new ConvexError("FORBIDDEN");
    }

    // Get all members
    const members = await ctx.db
      .query("members")
      .withIndex("by_organization", (q) => q.eq("organizationId", org._id))
      .collect();

    // Get user details for each member
    const memberUserIds = members.map((m) => m.userId);
    const users = await Promise.all(memberUserIds.map((id) => ctx.db.get(id)));
    const userMap = new Map(memberUserIds.map((id, i) => [id, users[i]]));

    // Filter and search
    let results = members.map((member) => {
      const user = userMap.get(member.userId);
      return {
        ...member,
        user: user
          ? {
              _id: user._id,
              name: user.name,
              email: user.email,
              username: user.username,
              role: user.role,
            }
          : null,
      };
    });

    // Apply search filter
    if (args.query) {
      const searchTerm = args.query.toLowerCase();
      results = results.filter(
        (member) =>
          member.user &&
          (member.user.name?.toLowerCase().includes(searchTerm) ||
            member.user.email?.toLowerCase().includes(searchTerm) ||
            member.user.username?.toLowerCase().includes(searchTerm)),
      );
    }

    // Apply limit
    if (args.limit) {
      results = results.slice(0, args.limit);
    }

    return results;
  },
});

/**
 * List organization teams
 */
export const listTeams = query({
  args: {
    orgSlug: v.string(),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) {
      throw new ConvexError("UNAUTHORIZED");
    }

    // Find organization
    const org = await ctx.db
      .query("organizations")
      .withIndex("by_slug", (q) => q.eq("slug", args.orgSlug))
      .first();

    if (!org) {
      throw new ConvexError("ORGANIZATION_NOT_FOUND");
    }

    // Verify user is a member
    const membership = await ctx.db
      .query("members")
      .withIndex("by_org_user", (q) =>
        q.eq("organizationId", org._id).eq("userId", userId),
      )
      .first();

    if (!membership) {
      throw new ConvexError("FORBIDDEN");
    }

    // Get all teams
    const allTeams = await ctx.db
      .query("teams")
      .withIndex("by_organization", (q) => q.eq("organizationId", org._id))
      .collect();

    // Filter teams based on visibility permissions
    const teamPromises = allTeams.map(async (team) => {
      const canView = await canViewTeam(ctx, team);
      return canView ? team : null;
    });
    const visibleTeams = (await Promise.all(teamPromises)).filter(
      (team): team is Doc<"teams"> => team !== null,
    );

    return visibleTeams;
  },
});

/**
 * List organization projects
 */
export const listProjects = query({
  args: {
    orgSlug: v.string(),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) {
      throw new ConvexError("UNAUTHORIZED");
    }

    // Find organization
    const org = await ctx.db
      .query("organizations")
      .withIndex("by_slug", (q) => q.eq("slug", args.orgSlug))
      .first();

    if (!org) {
      throw new ConvexError("ORGANIZATION_NOT_FOUND");
    }

    // Verify user is a member
    const membership = await ctx.db
      .query("members")
      .withIndex("by_org_user", (q) =>
        q.eq("organizationId", org._id).eq("userId", userId),
      )
      .first();

    if (!membership) {
      throw new ConvexError("FORBIDDEN");
    }

    // Get all projects
    const allProjects = await ctx.db
      .query("projects")
      .withIndex("by_organization", (q) => q.eq("organizationId", org._id))
      .collect();

    // Filter projects based on visibility permissions
    const projectPromises = allProjects.map(async (project) => {
      const canView = await canViewProject(ctx, project);
      return canView ? project : null;
    });
    const visibleProjects = (await Promise.all(projectPromises)).filter(
      (project): project is Doc<"projects"> => project !== null,
    );

    // Get project statuses and attach to projects
    const projectsWithStatus = await Promise.all(
      visibleProjects.map(async (project) => {
        const status = project.statusId
          ? await ctx.db.get(project.statusId)
          : null;

        return {
          ...project,
          statusColor: status?.color,
          statusIcon: status?.icon,
        };
      }),
    );

    return projectsWithStatus;
  },
});

/**
 * List issue states
 */
export const listIssueStates = query({
  args: {
    orgSlug: v.string(),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) {
      throw new ConvexError("UNAUTHORIZED");
    }

    // Find organization
    const org = await ctx.db
      .query("organizations")
      .withIndex("by_slug", (q) => q.eq("slug", args.orgSlug))
      .first();

    if (!org) {
      throw new ConvexError("ORGANIZATION_NOT_FOUND");
    }

    // Verify user is a member
    const membership = await ctx.db
      .query("members")
      .withIndex("by_org_user", (q) =>
        q.eq("organizationId", org._id).eq("userId", userId),
      )
      .first();

    if (!membership) {
      throw new ConvexError("FORBIDDEN");
    }

    // Get issue states
    const states = await ctx.db
      .query("issueStates")
      .withIndex("by_organization", (q) => q.eq("organizationId", org._id))
      .collect();

    return states;
  },
});

/**
 * List project statuses
 */
export const listProjectStatuses = query({
  args: {
    orgSlug: v.string(),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) {
      throw new ConvexError("UNAUTHORIZED");
    }

    // Find organization
    const org = await ctx.db
      .query("organizations")
      .withIndex("by_slug", (q) => q.eq("slug", args.orgSlug))
      .first();

    if (!org) {
      throw new ConvexError("ORGANIZATION_NOT_FOUND");
    }

    // Verify user is a member
    const membership = await ctx.db
      .query("members")
      .withIndex("by_org_user", (q) =>
        q.eq("organizationId", org._id).eq("userId", userId),
      )
      .first();

    if (!membership) {
      throw new ConvexError("FORBIDDEN");
    }

    // Get project statuses
    const statuses = await ctx.db
      .query("projectStatuses")
      .withIndex("by_organization", (q) => q.eq("organizationId", org._id))
      .collect();

    return statuses;
  },
});

/**
 * List issue priorities
 */
export const listIssuePriorities = query({
  args: {
    orgSlug: v.string(),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) {
      throw new ConvexError("UNAUTHORIZED");
    }

    // Find organization
    const org = await ctx.db
      .query("organizations")
      .withIndex("by_slug", (q) => q.eq("slug", args.orgSlug))
      .first();

    if (!org) {
      throw new ConvexError("ORGANIZATION_NOT_FOUND");
    }

    // Verify user is a member
    const membership = await ctx.db
      .query("members")
      .withIndex("by_org_user", (q) =>
        q.eq("organizationId", org._id).eq("userId", userId),
      )
      .first();

    if (!membership) {
      throw new ConvexError("FORBIDDEN");
    }

    // Get issue priorities
    const priorities = await ctx.db
      .query("issuePriorities")
      .withIndex("by_organization", (q) => q.eq("organizationId", org._id))
      .collect();

    return priorities;
  },
});

/**
 * Create an issue priority
 */
export const createIssuePriority = mutation({
  args: {
    orgSlug: v.string(),
    name: v.string(),
    weight: v.number(),
    color: v.string(),
    icon: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) {
      throw new ConvexError("UNAUTHORIZED");
    }

    // Find organization
    const org = await ctx.db
      .query("organizations")
      .withIndex("by_slug", (q) => q.eq("slug", args.orgSlug))
      .first();

    if (!org) {
      throw new ConvexError("ORGANIZATION_NOT_FOUND");
    }

    // Verify user is admin or owner
    const membership = await ctx.db
      .query("members")
      .withIndex("by_org_user", (q) =>
        q.eq("organizationId", org._id).eq("userId", userId),
      )
      .first();

    if (
      !membership ||
      (membership.role !== "owner" && membership.role !== "admin")
    ) {
      throw new ConvexError("INSUFFICIENT_PERMISSIONS_CREATE_PRIORITY");
    }

    const id = await ctx.db.insert("issuePriorities", {
      organizationId: org._id,
      name: args.name,
      weight: args.weight,
      color: args.color,
      icon: args.icon,
    });

    return { id } as const;
  },
});

/**
 * Update an issue priority
 */
export const updateIssuePriority = mutation({
  args: {
    orgSlug: v.string(),
    priorityId: v.id("issuePriorities"),
    name: v.string(),
    weight: v.optional(v.number()),
    color: v.string(),
    icon: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) {
      throw new ConvexError("UNAUTHORIZED");
    }

    const org = await ctx.db
      .query("organizations")
      .withIndex("by_slug", (q) => q.eq("slug", args.orgSlug))
      .first();

    if (!org) {
      throw new ConvexError("ORGANIZATION_NOT_FOUND");
    }

    const membership = await ctx.db
      .query("members")
      .withIndex("by_org_user", (q) =>
        q.eq("organizationId", org._id).eq("userId", userId),
      )
      .first();

    if (
      !membership ||
      (membership.role !== "owner" && membership.role !== "admin")
    ) {
      throw new ConvexError("INSUFFICIENT_PERMISSIONS_UPDATE_PRIORITY");
    }

    await ctx.db.patch(args.priorityId, {
      name: args.name,
      weight: args.weight,
      color: args.color,
      icon: args.icon,
    });
  },
});

/**
 * Reset issue priorities to defaults
 */
export const resetIssuePriorities = mutation({
  args: {
    orgSlug: v.string(),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) {
      throw new ConvexError("UNAUTHORIZED");
    }

    const org = await ctx.db
      .query("organizations")
      .withIndex("by_slug", (q) => q.eq("slug", args.orgSlug))
      .first();

    if (!org) {
      throw new ConvexError("ORGANIZATION_NOT_FOUND");
    }

    const membership = await ctx.db
      .query("members")
      .withIndex("by_org_user", (q) =>
        q.eq("organizationId", org._id).eq("userId", userId),
      )
      .first();

    if (
      !membership ||
      (membership.role !== "owner" && membership.role !== "admin")
    ) {
      throw new ConvexError("INSUFFICIENT_PERMISSIONS_RESET_PRIORITY");
    }

    // Delete existing priorities
    const priorities = await ctx.db
      .query("issuePriorities")
      .withIndex("by_organization", (q) => q.eq("organizationId", org._id))
      .collect();

    for (const p of priorities) {
      await ctx.db.delete(p._id);
    }

    // Insert defaults
    for (const priority of ISSUE_PRIORITY_DEFAULTS) {
      await ctx.db.insert("issuePriorities", {
        organizationId: org._id,
        name: priority.name,
        weight: priority.weight,
        color: priority.color,
        icon: priority.icon,
      });
    }
  },
});

/**
 * Delete an issue priority
 */
export const deleteIssuePriority = mutation({
  args: {
    orgSlug: v.string(),
    priorityId: v.id("issuePriorities"),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) {
      throw new ConvexError("UNAUTHORIZED");
    }

    const org = await ctx.db
      .query("organizations")
      .withIndex("by_slug", (q) => q.eq("slug", args.orgSlug))
      .first();

    if (!org) {
      throw new ConvexError("ORGANIZATION_NOT_FOUND");
    }

    const membership = await ctx.db
      .query("members")
      .withIndex("by_org_user", (q) =>
        q.eq("organizationId", org._id).eq("userId", userId),
      )
      .first();

    if (
      !membership ||
      (membership.role !== "owner" && membership.role !== "admin")
    ) {
      throw new ConvexError("INSUFFICIENT_PERMISSIONS_DELETE_PRIORITY");
    }

    await ctx.db.delete(args.priorityId);
  },
});

/**
 * Create an issue state
 */
export const createIssueState = mutation({
  args: {
    orgSlug: v.string(),
    name: v.string(),
    position: v.number(),
    color: v.string(),
    icon: v.optional(v.string()),
    type: v.union(
      v.literal("backlog"),
      v.literal("todo"),
      v.literal("in_progress"),
      v.literal("done"),
      v.literal("canceled"),
    ),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) {
      throw new ConvexError("UNAUTHORIZED");
    }

    // Find organization
    const org = await ctx.db
      .query("organizations")
      .withIndex("by_slug", (q) => q.eq("slug", args.orgSlug))
      .first();

    if (!org) {
      throw new ConvexError("ORGANIZATION_NOT_FOUND");
    }

    // Verify user is admin or owner
    const membership = await ctx.db
      .query("members")
      .withIndex("by_org_user", (q) =>
        q.eq("organizationId", org._id).eq("userId", userId),
      )
      .first();

    if (
      !membership ||
      (membership.role !== "owner" && membership.role !== "admin")
    ) {
      throw new ConvexError("INSUFFICIENT_PERMISSIONS_CREATE_STATE");
    }

    const id = await ctx.db.insert("issueStates", {
      organizationId: org._id,
      name: args.name,
      position: args.position,
      color: args.color,
      icon: args.icon,
      type: args.type,
    });

    return { id } as const;
  },
});

/**
 * Update an issue state
 */
export const updateIssueState = mutation({
  args: {
    orgSlug: v.string(),
    stateId: v.id("issueStates"),
    name: v.string(),
    position: v.number(),
    color: v.string(),
    icon: v.optional(v.string()),
    type: v.union(
      v.literal("backlog"),
      v.literal("todo"),
      v.literal("in_progress"),
      v.literal("done"),
      v.literal("canceled"),
    ),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) {
      throw new ConvexError("UNAUTHORIZED");
    }

    const org = await ctx.db
      .query("organizations")
      .withIndex("by_slug", (q) => q.eq("slug", args.orgSlug))
      .first();

    if (!org) {
      throw new ConvexError("ORGANIZATION_NOT_FOUND");
    }

    const membership = await ctx.db
      .query("members")
      .withIndex("by_org_user", (q) =>
        q.eq("organizationId", org._id).eq("userId", userId),
      )
      .first();

    if (
      !membership ||
      (membership.role !== "owner" && membership.role !== "admin")
    ) {
      throw new ConvexError("INSUFFICIENT_PERMISSIONS_UPDATE_STATE");
    }

    await ctx.db.patch(args.stateId, {
      name: args.name,
      position: args.position,
      color: args.color,
      icon: args.icon,
      type: args.type,
    });
  },
});

/**
 * Create a project status
 */
export const createProjectStatus = mutation({
  args: {
    orgSlug: v.string(),
    name: v.string(),
    position: v.number(),
    color: v.string(),
    icon: v.optional(v.string()),
    type: v.union(
      v.literal("backlog"),
      v.literal("planned"),
      v.literal("in_progress"),
      v.literal("completed"),
      v.literal("canceled"),
    ),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) {
      throw new ConvexError("UNAUTHORIZED");
    }

    const org = await ctx.db
      .query("organizations")
      .withIndex("by_slug", (q) => q.eq("slug", args.orgSlug))
      .first();

    if (!org) {
      throw new ConvexError("ORGANIZATION_NOT_FOUND");
    }

    const membership = await ctx.db
      .query("members")
      .withIndex("by_org_user", (q) =>
        q.eq("organizationId", org._id).eq("userId", userId),
      )
      .first();

    if (
      !membership ||
      (membership.role !== "owner" && membership.role !== "admin")
    ) {
      throw new ConvexError("INSUFFICIENT_PERMISSIONS_CREATE_STATUS");
    }

    const id = await ctx.db.insert("projectStatuses", {
      organizationId: org._id,
      name: args.name,
      position: args.position,
      color: args.color,
      icon: args.icon,
      type: args.type,
    });

    return { id } as const;
  },
});

/**
 * Update a project status
 */
export const updateProjectStatus = mutation({
  args: {
    orgSlug: v.string(),
    statusId: v.id("projectStatuses"),
    name: v.string(),
    position: v.number(),
    color: v.string(),
    icon: v.optional(v.string()),
    type: v.union(
      v.literal("backlog"),
      v.literal("planned"),
      v.literal("in_progress"),
      v.literal("completed"),
      v.literal("canceled"),
    ),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) {
      throw new ConvexError("UNAUTHORIZED");
    }

    const org = await ctx.db
      .query("organizations")
      .withIndex("by_slug", (q) => q.eq("slug", args.orgSlug))
      .first();

    if (!org) {
      throw new ConvexError("ORGANIZATION_NOT_FOUND");
    }

    const membership = await ctx.db
      .query("members")
      .withIndex("by_org_user", (q) =>
        q.eq("organizationId", org._id).eq("userId", userId),
      )
      .first();

    if (
      !membership ||
      (membership.role !== "owner" && membership.role !== "admin")
    ) {
      throw new ConvexError("INSUFFICIENT_PERMISSIONS_UPDATE_STATUS");
    }

    await ctx.db.patch(args.statusId, {
      name: args.name,
      position: args.position,
      color: args.color,
      icon: args.icon,
      type: args.type,
    });
  },
});

/**
 * Delete an issue state
 */
export const deleteIssueState = mutation({
  args: {
    orgSlug: v.string(),
    stateId: v.id("issueStates"),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) {
      throw new ConvexError("UNAUTHORIZED");
    }

    const org = await ctx.db
      .query("organizations")
      .withIndex("by_slug", (q) => q.eq("slug", args.orgSlug))
      .first();

    if (!org) {
      throw new ConvexError("ORGANIZATION_NOT_FOUND");
    }

    const membership = await ctx.db
      .query("members")
      .withIndex("by_org_user", (q) =>
        q.eq("organizationId", org._id).eq("userId", userId),
      )
      .first();

    if (
      !membership ||
      (membership.role !== "owner" && membership.role !== "admin")
    ) {
      throw new ConvexError("INSUFFICIENT_PERMISSIONS_DELETE_STATE");
    }

    await ctx.db.delete(args.stateId);
  },
});

/**
 * Delete a project status
 */
export const deleteProjectStatus = mutation({
  args: {
    orgSlug: v.string(),
    statusId: v.id("projectStatuses"),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) {
      throw new ConvexError("UNAUTHORIZED");
    }

    const org = await ctx.db
      .query("organizations")
      .withIndex("by_slug", (q) => q.eq("slug", args.orgSlug))
      .first();

    if (!org) {
      throw new ConvexError("ORGANIZATION_NOT_FOUND");
    }

    const membership = await ctx.db
      .query("members")
      .withIndex("by_org_user", (q) =>
        q.eq("organizationId", org._id).eq("userId", userId),
      )
      .first();

    if (
      !membership ||
      (membership.role !== "owner" && membership.role !== "admin")
    ) {
      throw new ConvexError("INSUFFICIENT_PERMISSIONS_DELETE_STATUS");
    }

    await ctx.db.delete(args.statusId);
  },
});

/**
 * Reset issue states to defaults
 */
export const resetIssueStates = mutation({
  args: {
    orgSlug: v.string(),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) {
      throw new ConvexError("UNAUTHORIZED");
    }

    const org = await ctx.db
      .query("organizations")
      .withIndex("by_slug", (q) => q.eq("slug", args.orgSlug))
      .first();

    if (!org) {
      throw new ConvexError("ORGANIZATION_NOT_FOUND");
    }

    const membership = await ctx.db
      .query("members")
      .withIndex("by_org_user", (q) =>
        q.eq("organizationId", org._id).eq("userId", userId),
      )
      .first();

    if (
      !membership ||
      (membership.role !== "owner" && membership.role !== "admin")
    ) {
      throw new ConvexError("INSUFFICIENT_PERMISSIONS_RESET_STATES");
    }

    // Delete existing states
    const states = await ctx.db
      .query("issueStates")
      .withIndex("by_organization", (q) => q.eq("organizationId", org._id))
      .collect();

    for (const s of states) {
      await ctx.db.delete(s._id);
    }

    // Insert defaults
    for (const state of ISSUE_STATE_DEFAULTS) {
      await ctx.db.insert("issueStates", {
        organizationId: org._id,
        name: state.name,
        position: state.position,
        color: state.color,
        icon: state.icon,
        type: state.type,
      });
    }
  },
});

/**
 * Reset project statuses to defaults
 */
export const resetProjectStatuses = mutation({
  args: {
    orgSlug: v.string(),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) {
      throw new ConvexError("UNAUTHORIZED");
    }

    const org = await ctx.db
      .query("organizations")
      .withIndex("by_slug", (q) => q.eq("slug", args.orgSlug))
      .first();

    if (!org) {
      throw new ConvexError("ORGANIZATION_NOT_FOUND");
    }

    const membership = await ctx.db
      .query("members")
      .withIndex("by_org_user", (q) =>
        q.eq("organizationId", org._id).eq("userId", userId),
      )
      .first();

    if (
      !membership ||
      (membership.role !== "owner" && membership.role !== "admin")
    ) {
      throw new ConvexError("INSUFFICIENT_PERMISSIONS_RESET_STATUSES");
    }

    // Delete existing statuses
    const statuses = await ctx.db
      .query("projectStatuses")
      .withIndex("by_organization", (q) => q.eq("organizationId", org._id))
      .collect();

    for (const s of statuses) {
      await ctx.db.delete(s._id);
    }

    // Insert defaults
    for (const status of PROJECT_STATUS_DEFAULTS) {
      await ctx.db.insert("projectStatuses", {
        organizationId: org._id,
        name: status.name,
        position: status.position,
        color: status.color,
        icon: status.icon,
        type: status.type,
      });
    }
  },
});

/**
 * Invite a user to the organization
 */
export const invite = mutation({
  args: {
    orgSlug: v.string(),
    email: v.string(),
    role: v.union(v.literal("member"), v.literal("admin")),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) {
      throw new ConvexError("UNAUTHORIZED");
    }

    // Find organization
    const org = await ctx.db
      .query("organizations")
      .withIndex("by_slug", (q) => q.eq("slug", args.orgSlug))
      .first();

    if (!org) {
      throw new ConvexError("ORGANIZATION_NOT_FOUND");
    }

    // Verify user has permission to invite
    const membership = await ctx.db
      .query("members")
      .withIndex("by_org_user", (q) =>
        q.eq("organizationId", org._id).eq("userId", userId),
      )
      .first();

    if (
      !membership ||
      (membership.role !== "owner" && membership.role !== "admin")
    ) {
      throw new ConvexError("INSUFFICIENT_PERMISSIONS_INVITE_USERS");
    }

    // Check if user already exists
    const existingUser = await ctx.db
      .query("users")
      .withIndex("email", (q) => q.eq("email", args.email))
      .first();

    if (existingUser) {
      // Check if user is already a member
      const existingMembership = await ctx.db
        .query("members")
        .withIndex("by_org_user", (q) =>
          q.eq("organizationId", org._id).eq("userId", existingUser._id),
        )
        .first();

      if (existingMembership) {
        throw new ConvexError("USER_ALREADY_MEMBER");
      }
    }

    // Create invitation
    const inviteId = await ctx.db.insert("invitations", {
      organizationId: org._id,
      email: args.email.toLowerCase(),
      role: args.role,
      status: "pending",
      expiresAt: Date.now() + 7 * 24 * 60 * 60 * 1000, // 7 days
      inviterId: userId,
    });

    return { inviteId };
  },
});

export const getOrgMember = query({
  args: {
    orgSlug: v.string(),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) {
      return null;
    }

    const org = await ctx.db
      .query("organizations")
      .withIndex("by_slug", (q) => q.eq("slug", args.orgSlug))
      .first();

    if (!org) {
      return null;
    }

    const membership = await ctx.db
      .query("members")
      .withIndex("by_org_user", (q) =>
        q.eq("organizationId", org._id).eq("userId", userId),
      )
      .first();

    return membership;
  },
});

/**
 * Generate upload URL for organization logo
 */
export const generateLogoUploadUrl = mutation({
  args: {
    orgSlug: v.string(),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) {
      throw new ConvexError("UNAUTHORIZED");
    }

    // Find organization
    const org = await ctx.db
      .query("organizations")
      .withIndex("by_slug", (q) => q.eq("slug", args.orgSlug))
      .first();

    if (!org) {
      throw new ConvexError("ORGANIZATION_NOT_FOUND");
    }

    // Verify user is owner or admin
    const membership = await ctx.db
      .query("members")
      .withIndex("by_org_user", (q) =>
        q.eq("organizationId", org._id).eq("userId", userId),
      )
      .first();

    if (
      !membership ||
      (membership.role !== "owner" && membership.role !== "admin")
    ) {
      throw new ConvexError("INSUFFICIENT_PERMISSIONS_UPLOAD_LOGO");
    }

    // Generate upload URL
    return await ctx.storage.generateUploadUrl();
  },
});

/**
 * Update organization logo with storage ID
 */
export const updateLogoWithStorageId = mutation({
  args: {
    orgSlug: v.string(),
    storageId: v.id("_storage"),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) {
      throw new ConvexError("UNAUTHORIZED");
    }

    // Find organization
    const org = await ctx.db
      .query("organizations")
      .withIndex("by_slug", (q) => q.eq("slug", args.orgSlug))
      .first();

    if (!org) {
      throw new ConvexError("ORGANIZATION_NOT_FOUND");
    }

    // Verify user is owner or admin
    const membership = await ctx.db
      .query("members")
      .withIndex("by_org_user", (q) =>
        q.eq("organizationId", org._id).eq("userId", userId),
      )
      .first();

    if (
      !membership ||
      (membership.role !== "owner" && membership.role !== "admin")
    ) {
      throw new ConvexError("INSUFFICIENT_PERMISSIONS_UPDATE_LOGO");
    }

    // Update organization with storage ID
    await ctx.db.patch(org._id, {
      logo: args.storageId,
    });

    return { success: true };
  },
});

/**
 * Get organization logo URL
 */
export const getLogoUrl = query({
  args: {
    orgSlug: v.string(),
  },
  handler: async (ctx, args) => {
    // Find organization
    const org = await ctx.db
      .query("organizations")
      .withIndex("by_slug", (q) => q.eq("slug", args.orgSlug))
      .first();

    if (!org || !org.logo) {
      return null;
    }

    // Generate URL for the logo
    return await ctx.storage.getUrl(org.logo);
  },
});

/**
 * Get file URL by storage ID string (for API routes)
 */
export const getFileUrlByString = query({
  args: {
    storageIdString: v.string(),
  },
  handler: async (ctx, args) => {
    try {
      // Convert string to storage ID
      const storageId = args.storageIdString as Id<"_storage">;
      // Generate URL for the file
      return await ctx.storage.getUrl(storageId);
    } catch (error) {
      return null;
    }
  },
});
