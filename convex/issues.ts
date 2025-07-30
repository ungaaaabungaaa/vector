import { query, mutation } from "./_generated/server";
import { v, ConvexError } from "convex/values";
import type { Id, Doc } from "./_generated/dataModel";
import { getAuthUserId } from "@convex-dev/auth/server";
import { requirePermission, PERMISSIONS } from "./permissions";
import {
  canViewIssue,
  canEditIssue,
  canDeleteIssue,
  canAssignIssue,
  canUpdateAssignmentState,
  canUpdateIssueRelations,
} from "./access";

/**
 * Get issue by organization slug and issue key
 */
export const getByKey = query({
  args: {
    orgSlug: v.string(),
    issueKey: v.string(),
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

    // Find issue by key within the organization
    const issue = await ctx.db
      .query("issues")
      .withIndex("by_key", (q) => q.eq("key", args.issueKey))
      .filter((q) => q.eq(q.field("organizationId"), org._id))
      .first();

    if (!issue) {
      throw new ConvexError("ISSUE_NOT_FOUND");
    }

    // Check if user can view this issue based on visibility
    if (!(await canViewIssue(ctx, issue))) {
      throw new ConvexError("FORBIDDEN");
    }

    // Get related data
    const project = issue.projectId ? await ctx.db.get(issue.projectId) : null;
    const assignees = await ctx.db
      .query("issueAssignees")
      .withIndex("by_issue", (q) => q.eq("issueId", issue._id))
      .collect();

    const assigneeUsers = await Promise.all(
      assignees.map(async (assignee) => {
        if (!assignee.assigneeId) return null;
        return await ctx.db.get(assignee.assigneeId);
      }),
    ).then((users) => users.filter(Boolean));

    const createdByUser = issue.reporterId
      ? await ctx.db.get(issue.reporterId)
      : null;
    const priority = issue.priorityId
      ? await ctx.db.get(issue.priorityId)
      : null;

    return {
      ...issue,
      project,
      assignees: assigneeUsers,
      createdBy: createdByUser,
      priority,
    };
  },
});

/**
 * Create new issue
 */
export const create = mutation({
  args: {
    orgSlug: v.string(),
    data: v.object({
      title: v.string(),
      description: v.optional(v.string()),
      projectId: v.optional(v.id("projects")),
      stateId: v.optional(v.id("issueStates")),
      priorityId: v.optional(v.id("issuePriorities")),
      assigneeIds: v.optional(v.array(v.id("users"))),
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

    // Check if user has permission to create issues
    await requirePermission(ctx, org._id, PERMISSIONS.ISSUE_CREATE);

    // Handle project if provided
    let project = null;
    let issueKey: string;
    let nextNumber: number;

    if (args.data.projectId) {
      // Verify project exists and belongs to org
      project = await ctx.db.get(args.data.projectId);
      if (!project || project.organizationId !== org._id) {
        throw new ConvexError("PROJECT_NOT_FOUND");
      }

      // Generate issue key - get next number for the project
      const existingIssues = await ctx.db
        .query("issues")
        .withIndex("by_project", (q) => q.eq("projectId", args.data.projectId))
        .collect();

      nextNumber = existingIssues.length + 1;
      issueKey = `${project.key}-${nextNumber}`;
    } else {
      // Generate org-based issue key
      const existingIssues = await ctx.db
        .query("issues")
        .withIndex("by_organization", (q) => q.eq("organizationId", org._id))
        .collect();

      nextNumber = existingIssues.length + 1;
      issueKey = `${org.slug.toUpperCase()}-${nextNumber}`;
    }

    // Validate assignees if provided
    if (args.data.assigneeIds && args.data.assigneeIds.length > 0) {
      for (const assigneeId of args.data.assigneeIds) {
        const assigneeMembership = await ctx.db
          .query("members")
          .withIndex("by_org_user", (q) =>
            q.eq("organizationId", org._id).eq("userId", assigneeId),
          )
          .first();

        if (!assigneeMembership) {
          throw new ConvexError("INVALID_ASSIGNEE");
        }
      }
    }

    // Validate input
    if (!args.data.title.trim()) {
      throw new ConvexError("INVALID_INPUT");
    }
    if (args.data.title.length > 200) {
      throw new ConvexError("INVALID_INPUT");
    }
    if (args.data.description && args.data.description.length > 5000) {
      throw new ConvexError("INVALID_INPUT");
    }

    // Create issue
    const issueId = await ctx.db.insert("issues", {
      organizationId: org._id,
      projectId: args.data.projectId,
      key: issueKey,
      sequenceNumber: nextNumber,
      title: args.data.title.trim(),
      description: args.data.description?.trim(),
      priorityId: args.data.priorityId,
      reporterId: userId,
      teamId: project?.teamId, // Use project's team if available
      visibility: args.data.visibility || "organization", // Default to organization visibility
      createdBy: userId,
    });

    // Get the explicitly selected state, or fall back to the default "todo" state
    const assigneeStateId =
      args.data.stateId ||
      (
        await ctx.db
          .query("issueStates")
          .withIndex("by_organization", (q) => q.eq("organizationId", org._id))
          .filter((q) => q.eq(q.field("type"), "todo"))
          .first()
      )?._id;

    if (assigneeStateId) {
      if (args.data.assigneeIds && args.data.assigneeIds.length > 0) {
        // Create an assignment for each selected assignee
        for (const assigneeId of args.data.assigneeIds) {
          await ctx.db.insert("issueAssignees", {
            issueId,
            assigneeId,
            stateId: assigneeStateId,
          });
        }
      } else {
        // No assignee chosen – create an "unassigned" entry so the issue still has a default state
        await ctx.db.insert("issueAssignees", {
          issueId,
          assigneeId: undefined, // nullable field supports "unassigned"
          stateId: assigneeStateId,
        });
      }
    }

    return { issueId, key: issueKey };
  },
});

/**
 * Update issue details
 */
export const update = mutation({
  args: {
    issueId: v.id("issues"),
    data: v.object({
      title: v.optional(v.string()),
      description: v.optional(v.string()),
      priorityId: v.optional(v.id("issuePriorities")),
    }),
  },
  handler: async (ctx, args) => {
    const issue = await ctx.db.get(args.issueId);
    if (!issue) {
      throw new ConvexError("ISSUE_NOT_FOUND");
    }

    if (!(await canEditIssue(ctx, issue))) {
      throw new ConvexError("FORBIDDEN");
    }

    // Update issue - only update provided fields
    await ctx.db.patch(issue._id, { ...args.data });

    return { success: true };
  },
});

/**
 * List issues by project or organization
 */
export const list = query({
  args: {
    orgSlug: v.string(),
    projectKey: v.optional(v.string()),
    stateId: v.optional(v.id("issueStates")),
    assigneeId: v.optional(v.id("users")),
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
      throw new ConvexError("ACCESS_DENIED");
    }

    let issues;

    if (args.projectKey) {
      const projectKey = args.projectKey;
      // Find project first
      const project = await ctx.db
        .query("projects")
        .withIndex("by_org_key", (q) =>
          q.eq("organizationId", org._id).eq("key", projectKey),
        )
        .first();

      if (!project) {
        throw new ConvexError("PROJECT_NOT_FOUND");
      }

      // Get issues for specific project
      issues = await ctx.db
        .query("issues")
        .withIndex("by_project", (q) => q.eq("projectId", project._id))
        .collect();
    } else {
      // Get all issues in organization
      issues = await ctx.db
        .query("issues")
        .withIndex("by_organization", (q) => q.eq("organizationId", org._id))
        .collect();
    }

    // Apply filters
    // NOTE: Issue state is stored per-assignee; global state filter not supported yet

    if (args.assigneeId) {
      // Filter by assignee - need to check issueAssignees table
      const assigneeIssueIds = new Set();
      const assignments = await ctx.db
        .query("issueAssignees")
        .withIndex("by_assignee", (q) => q.eq("assigneeId", args.assigneeId))
        .collect();

      assignments.forEach((assignment) => {
        assigneeIssueIds.add(assignment.issueId);
      });

      issues = issues.filter((issue) => assigneeIssueIds.has(issue._id));
    }

    // Apply limit
    if (args.limit) {
      issues = issues.slice(0, args.limit);
    }

    // Filter issues based on visibility permissions
    const issuePromises = issues.map(async (issue) => {
      const canView = await canViewIssue(ctx, issue);
      return canView ? issue : null;
    });
    const visibleIssues = (await Promise.all(issuePromises)).filter(
      (issue): issue is Doc<"issues"> => issue !== null,
    );

    // Batch database calls for better performance
    const projectIds = visibleIssues
      .map((i) => i.projectId)
      .filter(Boolean) as Id<"projects">[];
    const priorityIds = visibleIssues
      .map((i) => i.priorityId)
      .filter(Boolean) as Id<"issuePriorities">[];
    const reporterIds = visibleIssues
      .map((i) => i.reporterId)
      .filter(Boolean) as Id<"users">[];

    const projects = await Promise.all(projectIds.map((id) => ctx.db.get(id)));
    const priorities = await Promise.all(
      priorityIds.map((id) => ctx.db.get(id)),
    );
    const reporters = await Promise.all(
      reporterIds.map((id) => ctx.db.get(id)),
    );

    const projectMap = new Map();
    projectIds.forEach((id, i) => {
      if (projects[i]) projectMap.set(id, projects[i]);
    });

    const priorityMap = new Map();
    priorityIds.forEach((id, i) => {
      if (priorities[i]) priorityMap.set(id, priorities[i]);
    });

    const reporterMap = new Map();
    reporterIds.forEach((id, i) => {
      if (reporters[i]) reporterMap.set(id, reporters[i]);
    });

    // Get all assignees for all issues - need to query individually since index doesn't support inArray
    const allAssignments = await Promise.all(
      visibleIssues.map((issue) =>
        ctx.db
          .query("issueAssignees")
          .withIndex("by_issue", (q) => q.eq("issueId", issue._id))
          .collect(),
      ),
    ).then((results) => results.flat());

    const assigneeIds = allAssignments
      .map((a) => a.assigneeId)
      .filter(Boolean) as Id<"users">[];
    const assigneeUsers = await Promise.all(
      assigneeIds.map((id) => ctx.db.get(id)),
    );
    const assigneeMap = new Map();
    assigneeIds.forEach((id, i) => {
      if (assigneeUsers[i]) assigneeMap.set(id, assigneeUsers[i]);
    });

    // Group assignments by issue
    const assignmentsByIssue = new Map<Id<"issues">, typeof allAssignments>();
    for (const assignment of allAssignments) {
      if (!assignmentsByIssue.has(assignment.issueId)) {
        assignmentsByIssue.set(assignment.issueId, []);
      }
      assignmentsByIssue.get(assignment.issueId)!.push(assignment);
    }

    // Combine results
    const issuesWithDetails = visibleIssues.map((issue) => {
      const project = issue.projectId ? projectMap.get(issue.projectId) : null;
      const priority = issue.priorityId
        ? priorityMap.get(issue.priorityId)
        : null;
      const createdBy = issue.reporterId
        ? reporterMap.get(issue.reporterId)
        : null;

      // Get assignees for this issue
      const issueAssignments = assignmentsByIssue.get(issue._id) ?? [];
      const assigneeUsers = issueAssignments
        .map((assignment) => {
          if (!assignment.assigneeId) return null;
          return assigneeMap.get(assignment.assigneeId);
        })
        .filter(Boolean);

      return {
        ...issue,
        project,
        priority,
        createdBy,
        state: null, // per-assignee state not loaded here
        assignees: assigneeUsers,
      };
    });

    return issuesWithDetails;
  },
});

/**
 * Add comment to issue
 */
export const addComment = mutation({
  args: {
    issueId: v.id("issues"),
    body: v.string(),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) {
      throw new ConvexError("UNAUTHORIZED");
    }

    const issue = await ctx.db.get(args.issueId);
    if (!issue) {
      throw new ConvexError("ISSUE_NOT_FOUND");
    }

    // Verify user can view issue to comment
    if (!(await canViewIssue(ctx, issue))) {
      throw new ConvexError("FORBIDDEN");
    }

    // Create comment
    const commentId = await ctx.db.insert("comments", {
      issueId: issue._id,
      authorId: userId,
      body: args.body,
      deleted: false,
    });

    return { commentId };
  },
});

/**
 * List comments for an issue
 */
export const listComments = query({
  args: {
    issueId: v.id("issues"),
  },
  handler: async (ctx, args) => {
    const issue = await ctx.db.get(args.issueId);
    if (!issue) {
      throw new ConvexError("ISSUE_NOT_FOUND");
    }

    // Check if user can view this issue
    if (!(await canViewIssue(ctx, issue))) {
      throw new ConvexError("FORBIDDEN");
    }

    // Get comments
    const comments = await ctx.db
      .query("comments")
      .withIndex("by_issue", (q) => q.eq("issueId", issue._id))
      .collect();

    // Get author details for each comment
    const commentsWithAuthors = await Promise.all(
      comments.map(async (comment) => {
        const author = await ctx.db.get(comment.authorId);
        return {
          ...comment,
          author,
        };
      }),
    );

    return commentsWithAuthors;
  },
});

/**
 * Delete issue
 */
export const deleteIssue = mutation({
  args: {
    issueId: v.id("issues"),
  },
  handler: async (ctx, args) => {
    const issue = await ctx.db.get(args.issueId);
    if (!issue) {
      throw new ConvexError("ISSUE_NOT_FOUND");
    }

    // Check if user can delete this issue
    if (!(await canDeleteIssue(ctx, issue))) {
      throw new ConvexError("FORBIDDEN");
    }

    // Delete related data first
    // Delete assignees
    const assignees = await ctx.db
      .query("issueAssignees")
      .withIndex("by_issue", (q) => q.eq("issueId", issue._id))
      .collect();

    for (const assignee of assignees) {
      await ctx.db.delete(assignee._id);
    }

    // Delete comments
    const comments = await ctx.db
      .query("comments")
      .withIndex("by_issue", (q) => q.eq("issueId", issue._id))
      .collect();

    for (const comment of comments) {
      await ctx.db.delete(comment._id);
    }

    // Finally delete the issue
    await ctx.db.delete(issue._id);

    return { success: true };
  },
});

/**
 * Get assignments for a specific issue
 */
export const getAssignments = query({
  args: {
    issueId: v.id("issues"),
  },
  handler: async (ctx, args) => {
    // Get the issue to check permissions
    const issue = await ctx.db.get(args.issueId);
    if (!issue) {
      throw new ConvexError("ISSUE_NOT_FOUND");
    }

    // Check if user can view this issue
    if (!(await canViewIssue(ctx, issue))) {
      throw new ConvexError("FORBIDDEN");
    }

    // Get all assignments for this issue
    const assignments = await ctx.db
      .query("issueAssignees")
      .withIndex("by_issue", (q) => q.eq("issueId", args.issueId))
      .collect();

    // Get assignee details
    const assigneeIds = assignments
      .map((a) => a.assigneeId)
      .filter((id): id is Id<"users"> => Boolean(id));
    const assignees = await Promise.all(
      assigneeIds.map((id) => ctx.db.get(id)),
    );
    const assigneeMap = new Map(assigneeIds.map((id, i) => [id, assignees[i]]));

    // Get state details
    const stateIds = assignments
      .map((a) => a.stateId)
      .filter((id): id is Id<"issueStates"> => Boolean(id));
    const states = await Promise.all(stateIds.map((id) => ctx.db.get(id)));
    const stateMap = new Map(stateIds.map((id, i) => [id, states[i]]));

    return assignments.map((assignment) => ({
      ...assignment,
      assignee: assignment.assigneeId
        ? assigneeMap.get(assignment.assigneeId)
        : null,
      state: assignment.stateId ? stateMap.get(assignment.stateId) : null,
    }));
  },
});

/**
 * Add assignee to issue
 */
export const addAssignee = mutation({
  args: {
    issueId: v.id("issues"),
    assigneeId: v.id("users"),
    stateId: v.optional(v.id("issueStates")),
  },
  handler: async (ctx, args) => {
    // Get the issue to check permissions
    const issue = await ctx.db.get(args.issueId);
    if (!issue) {
      throw new ConvexError("ISSUE_NOT_FOUND");
    }

    // Check if user can assign users to this issue
    if (!(await canAssignIssue(ctx, issue))) {
      throw new ConvexError("FORBIDDEN");
    }

    // Check if already assigned
    const existingAssignment = await ctx.db
      .query("issueAssignees")
      .withIndex("by_issue_assignee", (q) =>
        q.eq("issueId", args.issueId).eq("assigneeId", args.assigneeId),
      )
      .first();

    if (existingAssignment) {
      throw new ConvexError("USER_ALREADY_ASSIGNED");
    }

    // Get default state if not provided
    let stateId = args.stateId;
    if (!stateId) {
      const defaultState = await ctx.db
        .query("issueStates")
        .withIndex("by_organization", (q) =>
          q.eq("organizationId", issue.organizationId),
        )
        .order("asc")
        .first();

      if (!defaultState) {
        throw new ConvexError("NO_ISSUE_STATES_FOUND");
      }

      stateId = defaultState._id;
    }

    // Add assignment
    const assignmentId = await ctx.db.insert("issueAssignees", {
      issueId: args.issueId,
      assigneeId: args.assigneeId,
      stateId,
    });

    return { assignmentId };
  },
});

/**
 * Change assignment state
 */
export const changeAssignmentState = mutation({
  args: {
    assignmentId: v.id("issueAssignees"),
    stateId: v.id("issueStates"),
  },
  handler: async (ctx, args) => {
    // Get the assignment
    const assignment = await ctx.db.get(args.assignmentId);
    if (!assignment || !assignment.assigneeId) {
      throw new ConvexError("ASSIGNMENT_NOT_FOUND");
    }

    // Get the issue to check permissions
    const issue = await ctx.db.get(assignment.issueId);
    if (!issue) {
      throw new ConvexError("ISSUE_NOT_FOUND");
    }

    // Check if user can update this assignment state
    if (!(await canUpdateAssignmentState(ctx, issue, assignment.assigneeId))) {
      throw new ConvexError("FORBIDDEN");
    }

    // Update assignment state
    await ctx.db.patch(args.assignmentId, {
      stateId: args.stateId,
    });

    return { success: true };
  },
});

/**
 * Update assignment assignee
 */
export const updateAssignmentAssignee = mutation({
  args: {
    assignmentId: v.id("issueAssignees"),
    assigneeId: v.id("users"),
  },
  handler: async (ctx, args) => {
    // Get the assignment
    const assignment = await ctx.db.get(args.assignmentId);
    if (!assignment) {
      throw new ConvexError("ASSIGNMENT_NOT_FOUND");
    }

    // Get the issue to check permissions
    const issue = await ctx.db.get(assignment.issueId);
    if (!issue) {
      throw new ConvexError("ISSUE_NOT_FOUND");
    }

    // Check if user can assign users to this issue
    if (!(await canAssignIssue(ctx, issue))) {
      throw new ConvexError("FORBIDDEN");
    }

    // Check if the new assignee is already assigned to this issue
    const existingAssignment = await ctx.db
      .query("issueAssignees")
      .withIndex("by_issue_assignee", (q) =>
        q.eq("issueId", assignment.issueId).eq("assigneeId", args.assigneeId),
      )
      .first();

    if (existingAssignment && existingAssignment._id !== args.assignmentId) {
      throw new ConvexError("USER_ALREADY_ASSIGNED");
    }

    // Update assignment assignee
    await ctx.db.patch(args.assignmentId, {
      assigneeId: args.assigneeId,
    });

    return { success: true };
  },
});

/**
 * Delete assignment
 */
export const deleteAssignment = mutation({
  args: {
    assignmentId: v.id("issueAssignees"),
  },
  handler: async (ctx, args) => {
    const assignment = await ctx.db.get(args.assignmentId);
    if (!assignment) {
      throw new ConvexError("ASSIGNMENT_NOT_FOUND");
    }

    // Get the issue to check permissions
    const issue = await ctx.db.get(assignment.issueId);
    if (!issue) {
      throw new ConvexError("ISSUE_NOT_FOUND");
    }

    // Check if user can assign users to this issue
    if (!(await canAssignIssue(ctx, issue))) {
      throw new ConvexError("FORBIDDEN");
    }

    // Delete assignment
    await ctx.db.delete(args.assignmentId);

    return { success: true };
  },
});

export const changePriority = mutation({
  args: {
    issueId: v.id("issues"),
    priorityId: v.id("issuePriorities"),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) {
      throw new ConvexError("UNAUTHORIZED");
    }

    const issue = await ctx.db.get(args.issueId);
    if (!issue) {
      throw new ConvexError("ISSUE_NOT_FOUND");
    }

    if (!(await canEditIssue(ctx, issue))) {
      throw new ConvexError("FORBIDDEN");
    }

    await ctx.db.patch(args.issueId, { priorityId: args.priorityId });

    await ctx.db.insert("activities", {
      issueId: args.issueId,
      actorId: userId,
      type: "priority_changed",
      payload: { priorityId: args.priorityId },
    });
  },
});

export const updateAssignees = mutation({
  args: {
    issueId: v.id("issues"),
    assigneeIds: v.array(v.id("users")),
  },
  handler: async (ctx, args) => {
    const issue = await ctx.db.get(args.issueId);
    if (!issue) {
      throw new ConvexError("ISSUE_NOT_FOUND");
    }

    if (!(await canAssignIssue(ctx, issue))) {
      throw new ConvexError("FORBIDDEN");
    }

    // Get existing assignments
    const existingAssignments = await ctx.db
      .query("issueAssignees")
      .withIndex("by_issue", (q) => q.eq("issueId", args.issueId))
      .collect();

    // Determine the state to use for new assignments
    let stateId: Id<"issueStates">;

    if (existingAssignments.length > 0) {
      // Use the state from existing assignments
      stateId = existingAssignments[0].stateId;
    } else {
      // Get default state from organization
      const defaultState = await ctx.db
        .query("issueStates")
        .withIndex("by_organization", (q) =>
          q.eq("organizationId", issue.organizationId),
        )
        .order("asc")
        .first();

      if (!defaultState) {
        throw new ConvexError("NO_ISSUE_STATES_FOUND");
      }

      stateId = defaultState._id;
    }

    // Remove existing assignments
    for (const assignment of existingAssignments) {
      await ctx.db.delete(assignment._id);
    }

    // Add new assignments
    for (const assigneeId of args.assigneeIds) {
      await ctx.db.insert("issueAssignees", {
        issueId: args.issueId,
        assigneeId,
        stateId,
      });
    }
  },
});

export const changeTeam = mutation({
  args: {
    issueId: v.id("issues"),
    teamId: v.union(v.id("teams"), v.null()),
  },
  handler: async (ctx, args) => {
    const issue = await ctx.db.get(args.issueId);
    if (!issue) {
      throw new ConvexError("ISSUE_NOT_FOUND");
    }

    if (!(await canUpdateIssueRelations(ctx, issue))) {
      throw new ConvexError("FORBIDDEN");
    }

    await ctx.db.patch(args.issueId, { teamId: args.teamId ?? undefined });
  },
});

export const changeProject = mutation({
  args: {
    issueId: v.id("issues"),
    projectId: v.union(v.id("projects"), v.null()),
  },
  handler: async (ctx, args) => {
    const issue = await ctx.db.get(args.issueId);
    if (!issue) {
      throw new ConvexError("ISSUE_NOT_FOUND");
    }

    if (!(await canUpdateIssueRelations(ctx, issue))) {
      throw new ConvexError("FORBIDDEN");
    }

    await ctx.db.patch(args.issueId, {
      projectId: args.projectId ?? undefined,
    });
  },
});

export const updateTitle = mutation({
  args: {
    issueId: v.id("issues"),
    title: v.string(),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) {
      throw new ConvexError("UNAUTHORIZED");
    }

    const issue = await ctx.db.get(args.issueId);
    if (!issue) {
      throw new ConvexError("ISSUE_NOT_FOUND");
    }

    if (!(await canEditIssue(ctx, issue))) {
      throw new ConvexError("FORBIDDEN");
    }

    await ctx.db.patch(args.issueId, { title: args.title });

    await ctx.db.insert("activities", {
      issueId: args.issueId,
      actorId: userId,
      type: "title_changed",
      payload: { title: args.title },
    });
  },
});

export const updateDescription = mutation({
  args: {
    issueId: v.id("issues"),
    description: v.union(v.string(), v.null()),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) {
      throw new ConvexError("UNAUTHORIZED");
    }

    const issue = await ctx.db.get(args.issueId);
    if (!issue) {
      throw new ConvexError("ISSUE_NOT_FOUND");
    }

    if (!(await canEditIssue(ctx, issue))) {
      throw new ConvexError("FORBIDDEN");
    }

    await ctx.db.patch(args.issueId, {
      description: args.description ?? undefined,
    });

    await ctx.db.insert("activities", {
      issueId: args.issueId,
      actorId: userId,
      type: "description_changed",
    });
  },
});

export const updateEstimatedTimes = mutation({
  args: {
    issueId: v.id("issues"),
    estimatedTimes: v.optional(v.record(v.string(), v.number())),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) {
      throw new ConvexError("UNAUTHORIZED");
    }

    const issue = await ctx.db.get(args.issueId);
    if (!issue) {
      throw new ConvexError("ISSUE_NOT_FOUND");
    }

    if (!(await canEditIssue(ctx, issue))) {
      throw new ConvexError("FORBIDDEN");
    }

    await ctx.db.patch(args.issueId, {
      estimatedTimes: args.estimatedTimes ?? undefined,
    });

    await ctx.db.insert("activities", {
      issueId: args.issueId,
      actorId: userId,
      type: "estimated_times_changed",
      payload: { estimatedTimes: args.estimatedTimes },
    });
  },
});

export const listIssues = query({
  args: {
    orgSlug: v.string(),
    projectId: v.optional(v.string()),
    teamId: v.optional(v.string()),
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

    let issuesQuery = ctx.db
      .query("issues")
      .withIndex("by_organization", (q) => q.eq("organizationId", org._id));

    if (args.projectId) {
      const project = await ctx.db
        .query("projects")
        .withIndex("by_org_key", (q) =>
          q.eq("organizationId", org._id).eq("key", args.projectId!),
        )
        .first();
      if (project) {
        issuesQuery = issuesQuery.filter((q) =>
          q.eq(q.field("projectId"), project._id),
        );
      }
    }

    if (args.teamId) {
      const team = await ctx.db
        .query("teams")
        .withIndex("by_org_key", (q) =>
          q.eq("organizationId", org._id).eq("key", args.teamId!),
        )
        .first();
      if (team) {
        issuesQuery = issuesQuery.filter((q) =>
          q.eq(q.field("teamId"), team._id),
        );
      }
    }

    const allIssues = await issuesQuery.order("desc").collect();

    // Filter issues based on visibility permissions
    const visibleIssues = [];
    for (const issue of allIssues) {
      const canView = await canViewIssue(ctx, issue);
      if (canView) {
        visibleIssues.push(issue);
      }
    }

    const issuesWithDetails = await Promise.all(
      visibleIssues.map(async (issue) => {
        const priority = issue.priorityId
          ? await ctx.db.get(issue.priorityId)
          : null;
        const project = issue.projectId
          ? await ctx.db.get(issue.projectId)
          : null;
        const team = issue.teamId ? await ctx.db.get(issue.teamId) : null;
        const reporter = issue.reporterId
          ? await ctx.db.get(issue.reporterId)
          : null;

        const assignments = await ctx.db
          .query("issueAssignees")
          .withIndex("by_issue", (q) => q.eq("issueId", issue._id))
          .collect();

        const assignees = await Promise.all(
          assignments.map(async (assignment) => {
            const assignee = assignment.assigneeId
              ? await ctx.db.get(assignment.assigneeId)
              : null;
            const state = assignment.stateId
              ? await ctx.db.get(assignment.stateId)
              : null;
            return {
              assignmentId: assignment._id,
              assigneeId: assignee?._id,
              assigneeName: assignee?.name,
              assigneeEmail: assignee?.email,
              stateId: state?._id,
              stateName: state?.name,
              stateIcon: state?.icon,
              stateColor: state?.color,
              stateType: state?.type,
            };
          }),
        );

        return {
          ...issue,
          id: issue._id,
          updatedAt: issue._creationTime,
          priorityId: priority?._id,
          priorityName: priority?.name,
          priorityIcon: priority?.icon,
          priorityColor: priority?.color,
          projectKey: project?.key,
          teamKey: team?.key,
          reporterName: reporter?.name,
          assignments:
            assignees.length > 0
              ? assignees
              : [
                  {
                    assignmentId: "unassigned",
                    assigneeId: undefined,
                    assigneeName: null,
                    assigneeEmail: null,
                    stateId: undefined,
                    stateName: null,
                    stateIcon: null,
                    stateColor: null,
                    stateType: null,
                  },
                ], // Ensure at least one empty assignment for structure
        };
      }),
    );

    const flattenedIssues = issuesWithDetails.flatMap((issue) =>
      issue.assignments.map((assignment) => ({
        ...issue,
        ...assignment,
      })),
    );

    const allStates = await ctx.db
      .query("issueStates")
      .withIndex("by_organization", (q) => q.eq("organizationId", org._id))
      .collect();

    const counts = allStates.reduce(
      (acc, state) => {
        acc[state.type] = 0;
        return acc;
      },
      {} as Record<string, number>,
    );
    let total = 0;

    issuesWithDetails.forEach((issue) => {
      total++;
      const uniqueStates = new Set(
        issue.assignments.map((a) => a.stateType).filter(Boolean),
      );
      uniqueStates.forEach((stateType) => {
        if (stateType) {
          counts[stateType] = (counts[stateType] || 0) + 1;
        }
      });
    });

    return {
      issues: flattenedIssues.filter((issue) => issue.id !== "unassigned"), // Filter out empty assignments
      total,
      counts,
    };
  },
});

export const changeVisibility = mutation({
  args: {
    issueId: v.id("issues"),
    visibility: v.union(
      v.literal("private"),
      v.literal("organization"),
      v.literal("public"),
    ),
  },
  handler: async (ctx, args) => {
    const issue = await ctx.db.get(args.issueId);
    if (!issue) throw new ConvexError("ISSUE_NOT_FOUND");

    if (!(await canEditIssue(ctx, issue))) {
      throw new ConvexError("FORBIDDEN");
    }

    await ctx.db.patch(args.issueId, {
      visibility: args.visibility,
    });

    return { success: true };
  },
});
