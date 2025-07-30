import { query, mutation } from "./_generated/server";
import { v, ConvexError } from "convex/values";
import type { Id, Doc } from "./_generated/dataModel";
import { getAuthUserId } from "@convex-dev/auth/server";
import { requirePermission, PERMISSIONS } from "./permissions";
import {
  canViewProject,
  canEditProject,
  canDeleteProject,
  canManageProjectMembers,
} from "./access";

/**
 * Get project by organization slug and project key
 */
export const getByKey = query({
  args: {
    orgSlug: v.string(),
    projectKey: v.string(),
  },
  handler: async (ctx, args) => {
    // Find organization
    const org = await ctx.db
      .query("organizations")
      .withIndex("by_slug", (q) => q.eq("slug", args.orgSlug))
      .first();

    if (!org) {
      throw new ConvexError("ORGANIZATION_NOT_FOUND");
    }

    // Find project by key and organization
    const project = await ctx.db
      .query("projects")
      .withIndex("by_org_key", (q) =>
        q.eq("organizationId", org._id).eq("key", args.projectKey),
      )
      .first();

    if (!project) {
      throw new ConvexError("PROJECT_NOT_FOUND");
    }

    // Check if user can view this project based on visibility
    if (!(await canViewProject(ctx, project))) {
      throw new ConvexError("FORBIDDEN");
    }

    // Get project details including lead user
    const leadUser = project.leadId ? await ctx.db.get(project.leadId) : null;

    return {
      ...project,
      lead: leadUser,
    };
  },
});

/**
 * Create new project
 */
export const create = mutation({
  args: {
    orgSlug: v.string(),
    data: v.object({
      key: v.string(),
      name: v.string(),
      description: v.optional(v.string()),
      leadId: v.optional(v.id("users")),
      teamId: v.optional(v.id("teams")),
      statusId: v.optional(v.id("projectStatuses")),
      visibility: v.optional(
        v.union(
          v.literal("private"),
          v.literal("organization"),
          v.literal("public"),
        ),
      ),
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

    await requirePermission(ctx, org._id, PERMISSIONS.PROJECT_CREATE);

    // Check if project key is unique within the organization
    const existingProject = await ctx.db
      .query("projects")
      .withIndex("by_org_key", (q) =>
        q.eq("organizationId", org._id).eq("key", args.data.key),
      )
      .first();

    if (existingProject) {
      throw new ConvexError("PROJECT_KEY_EXISTS");
    }

    // Validate lead user exists and is member of org if provided
    if (args.data.leadId) {
      const leadId = args.data.leadId;
      const leadMembership = await ctx.db
        .query("members")
        .withIndex("by_org_user", (q) =>
          q.eq("organizationId", org._id).eq("userId", leadId),
        )
        .first();

      if (!leadMembership) {
        throw new ConvexError("INVALID_PROJECT_LEAD");
      }
    }

    // Validate team exists in organization if provided
    if (args.data.teamId) {
      const team = await ctx.db.get(args.data.teamId);
      if (!team || team.organizationId !== org._id) {
        throw new ConvexError("INVALID_TEAM");
      }
    }

    // Validate input
    if (!args.data.key.trim()) {
      throw new ConvexError("INVALID_INPUT");
    }
    if (!args.data.name.trim()) {
      throw new ConvexError("INVALID_INPUT");
    }
    if (args.data.key.length > 20) {
      throw new ConvexError("INVALID_INPUT");
    }
    if (args.data.name.length > 100) {
      throw new ConvexError("INVALID_INPUT");
    }
    if (args.data.description && args.data.description.length > 1000) {
      throw new ConvexError("INVALID_INPUT");
    }

    // Create project
    const projectId = await ctx.db.insert("projects", {
      organizationId: org._id,
      key: args.data.key.trim(),
      name: args.data.name.trim(),
      description: args.data.description?.trim(),
      leadId: args.data.leadId,
      teamId: args.data.teamId,
      statusId: args.data.statusId,
      createdBy: userId,
      visibility: args.data.visibility || "organization", // Default to organization visibility
    });

    // Automatically add the creator as a project member with "lead" role
    await ctx.db.insert("projectMembers", {
      projectId: projectId,
      userId: userId,
      role: "lead", // Using "lead" as the owner role for project members
      joinedAt: Date.now(),
    });

    return { projectId };
  },
});

/**
 * Update project details
 */
export const update = mutation({
  args: {
    projectId: v.id("projects"),
    data: v.object({
      name: v.optional(v.string()),
      description: v.optional(v.string()),
      leadId: v.optional(v.id("users")),
      teamId: v.optional(v.id("teams")),
      statusId: v.optional(v.id("projectStatuses")),
      icon: v.optional(v.string()),
      color: v.optional(v.string()),
    }),
  },
  handler: async (ctx, args) => {
    const project = await ctx.db.get(args.projectId);
    if (!project) {
      throw new ConvexError("PROJECT_NOT_FOUND");
    }

    if (!(await canEditProject(ctx, project))) {
      throw new ConvexError("FORBIDDEN");
    }

    // Validate lead user if provided
    if (args.data.leadId) {
      const leadMembership = await ctx.db
        .query("members")
        .withIndex("by_org_user", (q) =>
          q
            .eq("organizationId", project.organizationId)
            .eq("userId", args.data.leadId!),
        )
        .first();

      if (!leadMembership) {
        throw new ConvexError("INVALID_PROJECT_LEAD");
      }
    }

    // Validate team exists in organization if provided
    if (args.data.teamId) {
      const team = await ctx.db.get(args.data.teamId);
      if (!team || team.organizationId !== project.organizationId) {
        throw new ConvexError("INVALID_TEAM");
      }
    }

    await ctx.db.patch(project._id, { ...args.data });

    return { success: true };
  },
});

export const changeStatus = mutation({
  args: {
    projectId: v.id("projects"),
    statusId: v.union(v.id("projectStatuses"), v.null()),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.projectId, {
      statusId: args.statusId ?? undefined,
    });
  },
});

export const changeTeam = mutation({
  args: {
    projectId: v.id("projects"),
    teamId: v.union(v.id("teams"), v.null()),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.projectId, {
      teamId: args.teamId ?? undefined,
    });
  },
});

export const changeLead = mutation({
  args: {
    projectId: v.id("projects"),
    leadId: v.union(v.id("users"), v.null()),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.projectId, {
      leadId: args.leadId ?? undefined,
    });
  },
});

/**
 * List projects in organization
 */
export const list = query({
  args: {
    orgSlug: v.string(),
    teamId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    // Find organization
    const org = await ctx.db
      .query("organizations")
      .withIndex("by_slug", (q) => q.eq("slug", args.orgSlug))
      .first();

    if (!org) {
      throw new ConvexError("ORGANIZATION_NOT_FOUND");
    }

    // Get all projects in organization
    let projectsQuery = ctx.db
      .query("projects")
      .withIndex("by_organization", (q) => q.eq("organizationId", org._id));

    // Filter by team if teamId is provided
    if (args.teamId) {
      const team = await ctx.db
        .query("teams")
        .withIndex("by_org_key", (q) =>
          q.eq("organizationId", org._id).eq("key", args.teamId!),
        )
        .first();
      if (team) {
        projectsQuery = projectsQuery.filter((q) =>
          q.eq(q.field("teamId"), team._id),
        );
      }
    }

    const allProjects = await projectsQuery.collect();

    // Filter projects based on visibility permissions
    const projectPromises = allProjects.map(async (project) => {
      const canView = await canViewProject(ctx, project);
      return canView ? project : null;
    });
    const projects = (await Promise.all(projectPromises)).filter(
      (project): project is Doc<"projects"> => project !== null,
    );

    // Batch database calls for better performance
    const leadIds = projects
      .map((p) => p.leadId)
      .filter(Boolean) as Id<"users">[];
    const statusIds = projects
      .map((p) => p.statusId)
      .filter(Boolean) as Id<"projectStatuses">[];

    const leadUsers = await Promise.all(leadIds.map((id) => ctx.db.get(id)));
    const statuses = await Promise.all(statusIds.map((id) => ctx.db.get(id)));

    const leadUserMap = new Map(leadIds.map((id, i) => [id, leadUsers[i]]));
    const statusMap = new Map(statusIds.map((id, i) => [id, statuses[i]]));

    // Combine results
    const projectsWithDetails = projects.map((project) => {
      const leadUser = project.leadId ? leadUserMap.get(project.leadId) : null;
      const status = project.statusId ? statusMap.get(project.statusId) : null;

      return {
        ...project,
        lead: leadUser,
        status,
      };
    });

    return projectsWithDetails;
  },
});

/**
 * List project members
 */
export const listMembers = query({
  // Support either direct projectId lookup or orgSlug + projectKey lookup
  args: {
    projectId: v.optional(v.id("projects")),
    orgSlug: v.optional(v.string()),
    projectKey: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    // Resolve project first
    let project: Doc<"projects"> | null = null;

    if (args.projectId) {
      project = await ctx.db.get(args.projectId);
    } else if (args.orgSlug && args.projectKey) {
      // Find organization by slug
      const org = await ctx.db
        .query("organizations")
        .withIndex("by_slug", (q) => q.eq("slug", args.orgSlug!))
        .first();

      if (!org) {
        throw new ConvexError("ORGANIZATION_NOT_FOUND");
      }

      // Find project within organization by key
      project = await ctx.db
        .query("projects")
        .withIndex("by_org_key", (q) =>
          q.eq("organizationId", org._id).eq("key", args.projectKey!),
        )
        .first();
    }

    if (!project) {
      throw new ConvexError("PROJECT_NOT_FOUND");
    }

    // Permission check – ensure current user can view this project
    if (!(await canViewProject(ctx, project))) {
      throw new ConvexError("FORBIDDEN");
    }

    // Get project members
    const projectMembers = await ctx.db
      .query("projectMembers")
      .withIndex("by_project", (q) => q.eq("projectId", project._id))
      .collect();

    // Get user details for each member
    const membersWithUsers = await Promise.all(
      projectMembers.map(async (member) => {
        const user = await ctx.db.get(member.userId);
        return {
          ...member,
          user,
        };
      }),
    );

    return membersWithUsers;
  },
});

/**
 * Add member to project
 */
export const addMember = mutation({
  args: {
    projectId: v.id("projects"),
    userId: v.id("users"),
    role: v.union(v.literal("lead"), v.literal("member")),
  },
  handler: async (ctx, args) => {
    const project = await ctx.db.get(args.projectId);
    if (!project) {
      throw new ConvexError("PROJECT_NOT_FOUND");
    }

    if (!(await canManageProjectMembers(ctx, project, "add"))) {
      throw new ConvexError("FORBIDDEN");
    }

    // Verify target user is member of organization
    const targetUserMembership = await ctx.db
      .query("members")
      .withIndex("by_org_user", (q) =>
        q
          .eq("organizationId", project.organizationId)
          .eq("userId", args.userId),
      )
      .first();

    if (!targetUserMembership) {
      throw new ConvexError("USER_NOT_MEMBER");
    }

    // Check if user is already a project member
    const existingMember = await ctx.db
      .query("projectMembers")
      .withIndex("by_project_user", (q) =>
        q.eq("projectId", project._id).eq("userId", args.userId),
      )
      .first();

    if (existingMember) {
      throw new ConvexError("USER_ALREADY_MEMBER");
    }

    // Add project member
    const membershipId = await ctx.db.insert("projectMembers", {
      projectId: project._id,
      userId: args.userId,
      role: args.role,
      joinedAt: Date.now(),
    });

    return { membershipId };
  },
});

/**
 * Remove member from project
 */
export const removeMember = mutation({
  args: {
    membershipId: v.id("projectMembers"),
  },
  handler: async (ctx, args) => {
    const membership = await ctx.db.get(args.membershipId);
    if (!membership) {
      throw new ConvexError("PROJECT_MEMBERSHIP_NOT_FOUND");
    }

    const project = await ctx.db.get(membership.projectId);
    if (!project) {
      throw new ConvexError("PROJECT_NOT_FOUND");
    }

    if (!(await canManageProjectMembers(ctx, project, "remove"))) {
      throw new ConvexError("FORBIDDEN");
    }

    // Remove membership
    await ctx.db.delete(args.membershipId);

    return { success: true };
  },
});

/**
 * Delete project
 */
export const deleteProject = mutation({
  args: {
    projectId: v.id("projects"),
  },
  handler: async (ctx, args) => {
    const project = await ctx.db.get(args.projectId);
    if (!project) {
      throw new ConvexError("PROJECT_NOT_FOUND");
    }

    if (!(await canDeleteProject(ctx, project))) {
      throw new ConvexError("FORBIDDEN");
    }

    // Delete project and related data
    // First delete all project members
    const projectMembers = await ctx.db
      .query("projectMembers")
      .withIndex("by_project", (q) => q.eq("projectId", project._id))
      .collect();

    for (const member of projectMembers) {
      await ctx.db.delete(member._id);
    }

    // Delete project teams associations
    const projectTeams = await ctx.db
      .query("projectTeams")
      .withIndex("by_project", (q) => q.eq("projectId", project._id))
      .collect();

    for (const team of projectTeams) {
      await ctx.db.delete(team._id);
    }

    // Finally delete the project
    await ctx.db.delete(project._id);

    return { success: true };
  },
});

export const changeVisibility = mutation({
  args: {
    projectId: v.id("projects"),
    visibility: v.union(
      v.literal("private"),
      v.literal("organization"),
      v.literal("public"),
    ),
  },
  handler: async (ctx, args) => {
    const project = await ctx.db.get(args.projectId);
    if (!project) throw new ConvexError("PROJECT_NOT_FOUND");

    if (!(await canEditProject(ctx, project))) {
      throw new ConvexError("FORBIDDEN");
    }

    await ctx.db.patch(project._id, {
      visibility: args.visibility,
    });

    return { success: true };
  },
});
