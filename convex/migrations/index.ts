import { mutation } from '../_generated/server';
import { createDefaultTeamRoles, createDefaultProjectRoles } from '../roles';

/**
 * Migration to create default roles for existing teams and projects.
 * This should be run once after deploying the new permission system.
 */
export const migrateDefaultRoles = mutation({
  args: {},
  handler: async ctx => {
    // Get all existing teams that don't have roles yet
    const teams = await ctx.db.query('teams').collect();

    for (const team of teams) {
      // Check if team already has roles
      const existingRoles = await ctx.db
        .query('teamRoles')
        .withIndex('by_team', q => q.eq('teamId', team._id))
        .collect();

      if (existingRoles.length === 0) {
        // Create default roles for this team
        const { leadRole, memberRole: _memberRole } =
          await createDefaultTeamRoles(ctx, team._id);

        // Assign the team lead to the Lead role if they exist
        if (team.leadId) {
          await ctx.db.insert('teamRoleAssignments', {
            roleId: leadRole,
            userId: team.leadId,
            teamId: team._id,
            assignedAt: Date.now(),
          });
        }

        // Assign the team creator to the Lead role if they exist
        if (team.createdBy) {
          await ctx.db.insert('teamRoleAssignments', {
            roleId: leadRole,
            userId: team.createdBy,
            teamId: team._id,
            assignedAt: Date.now(),
          });
        }
      }
    }

    // Get all existing projects that don't have roles yet
    const projects = await ctx.db.query('projects').collect();

    for (const project of projects) {
      // Check if project already has roles
      const existingRoles = await ctx.db
        .query('projectRoles')
        .withIndex('by_project', q => q.eq('projectId', project._id))
        .collect();

      if (existingRoles.length === 0) {
        // Create default roles for this project
        const { leadRole, memberRole: _memberRole } =
          await createDefaultProjectRoles(ctx, project._id);

        // Assign the project lead to the Lead role if they exist
        if (project.leadId) {
          await ctx.db.insert('projectRoleAssignments', {
            roleId: leadRole,
            userId: project.leadId,
            projectId: project._id,
            assignedAt: Date.now(),
          });
        }

        // Assign the project creator to the Lead role if they exist
        if (project.createdBy) {
          await ctx.db.insert('projectRoleAssignments', {
            roleId: leadRole,
            userId: project.createdBy,
            projectId: project._id,
            assignedAt: Date.now(),
          });
        }
      }
    }

    return {
      success: true,
      message: 'Default roles created for existing teams and projects',
    };
  },
});

/**
 * Migration to assign existing team members to the Member role.
 * This should be run after migrateDefaultRoles.
 */
export const migrateTeamMembers = mutation({
  args: {},
  handler: async ctx => {
    // Get all team members
    const teamMembers = await ctx.db.query('teamMembers').collect();

    for (const member of teamMembers) {
      // Get the Member role for this team
      const memberRole = await ctx.db
        .query('teamRoles')
        .withIndex('by_team_name', q =>
          q.eq('teamId', member.teamId).eq('name', 'Member'),
        )
        .first();

      if (memberRole) {
        // Check if assignment already exists
        const existingAssignment = await ctx.db
          .query('teamRoleAssignments')
          .withIndex('by_role_user', q =>
            q.eq('roleId', memberRole._id).eq('userId', member.userId),
          )
          .first();

        if (!existingAssignment) {
          // Assign the team member to the Member role
          await ctx.db.insert('teamRoleAssignments', {
            roleId: memberRole._id,
            userId: member.userId,
            teamId: member.teamId,
            assignedAt: Date.now(),
          });
        }
      }
    }

    return {
      success: true,
      message: 'Team members assigned to Member roles',
    };
  },
});

/**
 * Migration to assign existing project members to the Member role.
 * This should be run after migrateDefaultRoles.
 */
export const migrateProjectMembers = mutation({
  args: {},
  handler: async ctx => {
    // Get all project members
    const projectMembers = await ctx.db.query('projectMembers').collect();

    for (const member of projectMembers) {
      // Get the Member role for this project
      const memberRole = await ctx.db
        .query('projectRoles')
        .withIndex('by_project_name', q =>
          q.eq('projectId', member.projectId).eq('name', 'Member'),
        )
        .first();

      if (memberRole) {
        // Check if assignment already exists
        const existingAssignment = await ctx.db
          .query('projectRoleAssignments')
          .withIndex('by_role_user', q =>
            q.eq('roleId', memberRole._id).eq('userId', member.userId),
          )
          .first();

        if (!existingAssignment) {
          // Assign the project member to the Member role
          await ctx.db.insert('projectRoleAssignments', {
            roleId: memberRole._id,
            userId: member.userId,
            projectId: member.projectId,
            assignedAt: Date.now(),
          });
        }
      }
    }

    return {
      success: true,
      message: 'Project members assigned to Member roles',
    };
  },
});
