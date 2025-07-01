import { db } from "@/db";
import {
  project as projectTable,
  projectMember as projectMemberTable,
  projectTeam as projectTeamTable,
  team as teamTable,
  teamMember as teamMemberTable,
  projectStatus,
  organization as organizationTable,
  user as userTable,
} from "@/db/schema";
import {
  eq,
  and,
  inArray,
  InferInsertModel,
  InferSelectModel,
  desc,
  or,
} from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { formatDateForDb } from "@/lib/date";

// -----------------------------------------------------------------------------
// Types
// -----------------------------------------------------------------------------

type ProjectInsertModel = InferInsertModel<typeof projectTable>;
export type Project = InferSelectModel<typeof projectTable>;

// Use table-derived type to stay in sync with schema. All insertable columns minus
// auto-generated audit fields → compile-safe params for `createProject()`.
export type CreateProjectParams =
  // everything except internal audit columns …
  Omit<ProjectInsertModel, "id" | "createdAt" | "updatedAt"> &
    // … but make these core fields mandatory
    Required<Pick<ProjectInsertModel, "organizationId" | "name" | "key">> & {
      /** Optional array of team IDs; falls back to single `teamId` for legacy */
      teamIds?: string[];
    };

export interface UpdateProjectParams {
  id: string;
  data: Partial<
    Pick<
      ProjectInsertModel,
      | "name"
      | "description"
      | "leadId"
      | "startDate"
      | "dueDate"
      | "statusId"
      | "teamId"
    >
  >;
}

// -----------------------------------------------------------------------------
// CRUD operations
// -----------------------------------------------------------------------------

/**
 * Creates a new project under a **team** & organization.
 *
 * Business rules enforced:
 * 1. The referenced team must belong to the same organization.
 * 2. If `leadId` is provided the user must be a member of the team.
 */
export async function createProject(
  params: CreateProjectParams,
): Promise<{ id: string }> {
  const {
    organizationId,
    teamId,
    name,
    description,
    leadId,
    startDate,
    dueDate,
    statusId,
    teamIds = teamId ? [teamId] : [],
    createdBy,
  } = params;

  // 1) Validate team–organization relationship for each teamId
  for (const tId of teamIds) {
    const teamRow = await db
      .select({ organizationId: teamTable.organizationId })
      .from(teamTable)
      .where(eq(teamTable.id, tId))
      .limit(1);

    if (teamRow.length === 0) {
      throw new Error("Team does not exist");
    }

    if (teamRow[0].organizationId !== organizationId) {
      throw new Error("Team belongs to a different organization");
    }
  }

  // 2) If `statusId` provided – ensure status belongs to organization
  if (statusId) {
    const statusRow = await db
      .select({
        id: projectStatus.id,
        organizationId: projectStatus.organizationId,
      })
      .from(projectStatus)
      .where(eq(projectStatus.id, statusId))
      .limit(1);

    if (statusRow.length === 0) {
      throw new Error("Invalid project status");
    }

    if (statusRow[0].organizationId !== organizationId) {
      throw new Error("Status belongs to a different organization");
    }
  }

  // 3) If lead provided and teams exist – ensure member of at least one team
  if (leadId && teamIds.length > 0) {
    const membership = await db
      .select({ userId: teamMemberTable.userId })
      .from(teamMemberTable)
      .where(
        and(
          inArray(teamMemberTable.teamId, teamIds),
          eq(teamMemberTable.userId, leadId),
        ),
      )
      .limit(1);

    if (membership.length === 0) {
      throw new Error("Lead must be a member of at least one team");
    }
  }

  const now = new Date();

  let insertedProjectId: string | undefined;

  await db.transaction(async (tx) => {
    // Use shared date helpers – keeps logic in one place and ensures date-fns
    // is used consistently across the code-base.

    const newProject: ProjectInsertModel = {
      organizationId,
      teamId,
      name,
      key: params.key,
      description,
      leadId,
      createdBy,
      startDate: formatDateForDb(startDate),
      dueDate: formatDateForDb(dueDate),
      statusId,
      createdAt: now,
      updatedAt: now,
    };

    const [inserted] = await tx
      .insert(projectTable)
      .values(newProject)
      .returning({ id: projectTable.id });

    insertedProjectId = inserted.id;

    // 5) Insert team associations
    if (teamIds.length > 0) {
      await Promise.all(
        teamIds.map((tid) =>
          tx
            .insert(projectTeamTable)
            .values({ projectId: inserted.id, teamId: tid }),
        ),
      );
    }

    // 6) Insert lead as project member (role = "lead")
    if (leadId) {
      await tx.insert(projectMemberTable).values({
        projectId: insertedProjectId,
        userId: leadId,
        role: "lead",
        joinedAt: now,
      });
    }
  });

  return { id: insertedProjectId! } as const;
}

export async function updateProject(
  params: UpdateProjectParams,
): Promise<void> {
  const { id, data } = params;
  if (Object.keys(data).length === 0) return;

  await db
    .update(projectTable)
    .set({ ...data, updatedAt: new Date() })
    .where(eq(projectTable.id, id));
}

export async function deleteProject(projectId: string): Promise<void> {
  await db.delete(projectTable).where(eq(projectTable.id, projectId));
}

// -----------------------------------------------------------------------------
// Member helpers
// -----------------------------------------------------------------------------

/**
 * Adds a member to a project ensuring the user belongs to the **owning team**.
 */
export async function addMember(
  projectId: string,
  userId: string,
  role: string = "member",
): Promise<void> {
  // 1) Ensure project exists
  const exists = await db
    .select({ id: projectTable.id })
    .from(projectTable)
    .where(eq(projectTable.id, projectId))
    .limit(1);

  if (exists.length === 0) {
    throw new Error("Project does not exist");
  }

  // 2) Validate membership against ANY associated team (if any)
  const teamIds = await listProjectTeams(projectId);

  if (teamIds.length > 0) {
    const membershipRows = await db
      .select({ userId: teamMemberTable.userId })
      .from(teamMemberTable)
      .where(
        and(
          inArray(teamMemberTable.teamId, teamIds),
          eq(teamMemberTable.userId, userId),
        ),
      )
      .limit(1);

    if (membershipRows.length === 0) {
      throw new Error(
        "User is not a member of any associated team for this project",
      );
    }
  }

  const now = new Date();

  await db
    .insert(projectMemberTable)
    .values({ projectId, userId, role, joinedAt: now })
    .onConflictDoNothing();
}

export async function removeMember(
  projectId: string,
  userId: string,
): Promise<void> {
  // Check if the user being removed is a lead
  const rows = await db
    .select({ role: projectMemberTable.role })
    .from(projectMemberTable)
    .where(
      and(
        eq(projectMemberTable.projectId, projectId),
        eq(projectMemberTable.userId, userId),
      ),
    )
    .limit(1);

  if (rows.length === 0) return; // nothing to remove

  // Total members count
  const allMembers = await db
    .select({
      userId: projectMemberTable.userId,
      role: projectMemberTable.role,
    })
    .from(projectMemberTable)
    .where(eq(projectMemberTable.projectId, projectId));

  if (allMembers.length <= 1) {
    throw new Error("Cannot remove the last member from the project");
  }

  // Lead constraint
  if (rows[0].role === "lead") {
    const leadCount = allMembers.filter((m) => m.role === "lead").length;
    if (leadCount <= 1) {
      throw new Error("Cannot remove the last lead from the project");
    }
  }

  await db
    .delete(projectMemberTable)
    .where(
      and(
        eq(projectMemberTable.projectId, projectId),
        eq(projectMemberTable.userId, userId),
      ),
    );
}

/**
 * Finds a project by its key within an organization.
 */
export async function findProjectByKey(
  orgSlug: string,
  projectKey: string,
): Promise<Project | null> {
  const leadUser = alias(userTable, "leadUser");

  const result = await db
    .select({
      id: projectTable.id,
      key: projectTable.key,
      name: projectTable.name,
      description: projectTable.description,
      organizationId: projectTable.organizationId,
      createdAt: projectTable.createdAt,
      updatedAt: projectTable.updatedAt,
      startDate: projectTable.startDate,
      dueDate: projectTable.dueDate,
      // Status details
      statusId: projectTable.statusId,
      statusName: projectStatus.name,
      statusColor: projectStatus.color,
      statusIcon: projectStatus.icon,
      statusType: projectStatus.type,
      // Team details
      teamId: projectTable.teamId,
      teamName: teamTable.name,
      teamKey: teamTable.key,
      // Lead details
      leadId: projectTable.leadId,
      createdBy: projectTable.createdBy,
      leadName: leadUser.name,
      leadEmail: leadUser.email,
    })
    .from(projectTable)
    .innerJoin(
      organizationTable,
      eq(projectTable.organizationId, organizationTable.id),
    )
    .leftJoin(projectStatus, eq(projectTable.statusId, projectStatus.id))
    .leftJoin(teamTable, eq(projectTable.teamId, teamTable.id))
    .leftJoin(leadUser, eq(projectTable.leadId, leadUser.id))
    .where(
      and(
        eq(organizationTable.slug, orgSlug),
        eq(projectTable.key, projectKey),
      ),
    )
    .limit(1);

  return result[0] || null;
}

export async function listProjectMembers(projectId: string) {
  // Returns all members of a project with user details ordered by join date (newest first)
  return await db
    .select({
      userId: projectMemberTable.userId,
      role: projectMemberTable.role,
      joinedAt: projectMemberTable.joinedAt,
      name: userTable.name,
      email: userTable.email,
    })
    .from(projectMemberTable)
    .innerJoin(userTable, eq(projectMemberTable.userId, userTable.id))
    .where(eq(projectMemberTable.projectId, projectId))
    .orderBy(desc(projectMemberTable.joinedAt));
}

// -----------------------------------------------------------------------------
// Team helpers
// -----------------------------------------------------------------------------

/**
 * Returns the team IDs associated with a project (includes legacy `teamId` column).
 */
export async function listProjectTeams(projectId: string): Promise<string[]> {
  const legacy = await db
    .select({ teamId: projectTable.teamId })
    .from(projectTable)
    .where(eq(projectTable.id, projectId))
    .limit(1);

  const viaJoin = await db
    .select({ teamId: projectTeamTable.teamId })
    .from(projectTeamTable)
    .where(eq(projectTeamTable.projectId, projectId));

  const ids = new Set<string>();
  if (legacy[0]?.teamId) ids.add(legacy[0].teamId);
  viaJoin.forEach((r) => ids.add(r.teamId));
  return Array.from(ids);
}

export async function addTeam(
  projectId: string,
  teamId: string,
): Promise<void> {
  const now = new Date();
  await db
    .insert(projectTeamTable)
    .values({ projectId, teamId })
    .onConflictDoNothing();

  // Keep legacy column (first team wins) if not set
  const proj = await db
    .select({ teamId: projectTable.teamId })
    .from(projectTable)
    .where(eq(projectTable.id, projectId))
    .limit(1);
  if (proj.length && !proj[0].teamId) {
    await db
      .update(projectTable)
      .set({ teamId, updatedAt: now })
      .where(eq(projectTable.id, projectId));
  }
}

export async function removeTeam(
  projectId: string,
  teamId: string,
): Promise<void> {
  await db
    .delete(projectTeamTable)
    .where(
      and(
        eq(projectTeamTable.projectId, projectId),
        eq(projectTeamTable.teamId, teamId),
      ),
    );
}

// -----------------------------------------------------------------------------
// Access helpers
// -----------------------------------------------------------------------------

export async function userHasProjectAccess(
  userId: string,
  projectId: string,
): Promise<boolean> {
  // Quick check using joins
  const pm = alias(projectMemberTable, "pm");
  const pt = alias(projectTeamTable, "pt");
  const tm = alias(teamMemberTable, "tm");

  const rows = await db
    .select({ id: projectTable.id })
    .from(projectTable)
    .leftJoin(pm, and(eq(pm.projectId, projectTable.id), eq(pm.userId, userId)))
    .leftJoin(pt, eq(pt.projectId, projectTable.id))
    .leftJoin(tm, and(eq(tm.teamId, pt.teamId), eq(tm.userId, userId)))
    .where(
      and(
        eq(projectTable.id, projectId),
        or(
          eq(projectTable.leadId, userId),
          eq(projectTable.createdBy, userId),
          eq(pm.userId, userId),
          eq(tm.userId, userId),
        ),
      ),
    )
    .limit(1);

  return rows.length > 0;
}
