import { db } from "@/db";
import {
  project as projectTable,
  projectMember as projectMemberTable,
  team as teamTable,
  teamMember as teamMemberTable,
  projectStatus,
} from "@/db/schema";
import { eq, and, InferInsertModel, InferSelectModel } from "drizzle-orm";
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
    Required<Pick<ProjectInsertModel, "organizationId" | "teamId" | "name">>;

export interface UpdateProjectParams {
  id: string;
  data: Partial<
    Pick<
      ProjectInsertModel,
      "name" | "description" | "leadId" | "startDate" | "dueDate" | "statusId"
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
  } = params;

  // 1) Validate team–organization relationship
  const teamRow = await db
    .select({ organizationId: teamTable.organizationId })
    .from(teamTable)
    .where(eq(teamTable.id, teamId!))
    .limit(1);

  if (teamRow.length === 0) {
    throw new Error("Team does not exist");
  }

  if (teamRow[0].organizationId !== organizationId) {
    throw new Error("Team belongs to a different organization");
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

  // 3) If lead provided – ensure member of the team
  if (leadId) {
    const membership = await db
      .select({ userId: teamMemberTable.userId })
      .from(teamMemberTable)
      .where(
        and(
          eq(teamMemberTable.teamId, teamId!),
          eq(teamMemberTable.userId, leadId),
        ),
      )
      .limit(1);

    if (membership.length === 0) {
      throw new Error("Lead must be a member of the team");
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
      description,
      leadId,
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

    // 5) Insert lead as project member (role = "lead")
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
  // 1) Fetch project & owning team
  const proj = await db
    .select({ teamId: projectTable.teamId })
    .from(projectTable)
    .where(eq(projectTable.id, projectId))
    .limit(1);

  if (proj.length === 0) {
    throw new Error("Project does not exist");
  }

  const teamId = proj[0].teamId!;

  // 2) Ensure user is part of the team
  const membership = await db
    .select({ userId: teamMemberTable.userId })
    .from(teamMemberTable)
    .where(
      and(
        eq(teamMemberTable.teamId, teamId),
        eq(teamMemberTable.userId, userId),
      ),
    )
    .limit(1);

  if (membership.length === 0) {
    throw new Error("User is not a member of the owning team");
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
  await db
    .delete(projectMemberTable)
    .where(
      and(
        eq(projectMemberTable.projectId, projectId),
        eq(projectMemberTable.userId, userId),
      ),
    );
}
