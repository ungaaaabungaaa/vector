import { db } from "@/db";
import {
  issue as issueTable,
  issueActivity as activityTable,
  project as projectTable,
  organization as organizationTable,
  team as teamTable,
  issueAssignee as assignmentTable,
} from "@/db/schema";
import { getNextIssueSequence } from "@/entities/teams/team.service";
import {
  eq,
  and,
  InferInsertModel,
  InferSelectModel,
  desc,
  like,
} from "drizzle-orm";
import { randomUUID } from "crypto";
import {
  createAssignmentInTx,
  createAssignment,
  changeAssignmentState,
  updateAssignmentAssignee,
} from "./assignment.service";

// -----------------------------------------------------------------------------
// Types
// -----------------------------------------------------------------------------

type IssueInsertModel = InferInsertModel<typeof issueTable>;
export type Issue = InferSelectModel<typeof issueTable>;

type BaseCreateIssueParams = Pick<
  IssueInsertModel,
  "teamId" | "reporterId" | "title" | "description" | "projectId" | "priorityId"
> &
  Partial<
    Pick<IssueInsertModel, "startDate" | "dueDate" | "estimatedTimes">
  > & {
    /** Initial workflow state for first assignment */
    stateId: string;
    /** Initial assignee for first assignment (nullable) */
    assigneeId?: string | null;
  };

export type CreateIssueParams = BaseCreateIssueParams & {
  orgSlug: string;
  issueKeyFormat: "org" | "project" | "team";
};

// -----------------------------------------------------------------------------
// Sequence generation helpers
// -----------------------------------------------------------------------------

/**
 * Generates a project-based issue key from project key.
 */
export async function generateProjectIssueKey(
  projectId: string,
  sequenceNumber: number,
): Promise<string> {
  const projectResult = await db
    .select({ key: projectTable.key })
    .from(projectTable)
    .where(eq(projectTable.id, projectId))
    .limit(1);

  if (projectResult.length === 0) {
    throw new Error(`Project not found: ${projectId}`);
  }

  const { key } = projectResult[0];
  return `${key}-${sequenceNumber}`.toUpperCase();
}

/**
 * Generates a team-based issue key from team key.
 */
export async function generateTeamIssueKey(
  teamId: string,
  sequenceNumber: number,
): Promise<string> {
  const teamResult = await db
    .select({ key: teamTable.key })
    .from(teamTable)
    .where(eq(teamTable.id, teamId))
    .limit(1);

  if (teamResult.length === 0) {
    throw new Error(`Team not found: ${teamId}`);
  }

  const { key } = teamResult[0];
  return `${key}-${sequenceNumber}`.toUpperCase();
}

/**
 * Generates the next sequence number for project-based issues within a given project.
 * Optimized: counts all issues associated with the project (since project format
 * issues will always have a projectId), rather than using LIKE pattern matching.
 */
export async function getNextProjectIssueSequence(
  projectId: string,
): Promise<number> {
  // Count all issues that belong to this project
  // More optimized than LIKE query since we know project format issues always have projectId
  const res = await db
    .select({ seq: issueTable.sequenceNumber })
    .from(issueTable)
    .where(eq(issueTable.projectId, projectId))
    .orderBy(desc(issueTable.sequenceNumber))
    .limit(1);

  const current = res[0]?.seq ?? 0;
  return current + 1;
}

// Org ------------------------------------------------------------------------

function generateOrgIssueKey(orgSlug: string, sequenceNumber: number): string {
  return `${orgSlug.toUpperCase()}-${sequenceNumber}`;
}

async function getNextOrgIssueSequence(orgSlug: string): Promise<number> {
  const res = await db
    .select({ seq: issueTable.sequenceNumber })
    .from(issueTable)
    .where(like(issueTable.key, `${orgSlug.toUpperCase()}-%`))
    .orderBy(desc(issueTable.sequenceNumber))
    .limit(1);
  return (res[0]?.seq ?? 0) + 1;
}

export async function createIssue(
  params: CreateIssueParams,
): Promise<{ id: string; key: string }> {
  const {
    orgSlug,
    teamId,
    reporterId,
    title,
    description,
    projectId,
    priorityId,
    stateId,
    assigneeId,
    issueKeyFormat,
    startDate,
    dueDate,
    estimatedTimes,
  } = params;

  let seq: number;
  let issueKey: string;

  // Generate sequence number and key based on the selected format
  switch (issueKeyFormat) {
    case "team": {
      if (!teamId) {
        throw new Error("Team ID is required for team-based issue keys");
      }
      seq = await getNextIssueSequence(teamId);
      issueKey = await generateTeamIssueKey(teamId, seq);
      break;
    }
    case "project": {
      if (!projectId) {
        throw new Error("Project ID is required for project-based issue keys");
      }
      seq = await getNextProjectIssueSequence(projectId);
      issueKey = await generateProjectIssueKey(projectId, seq);
      break;
    }
    case "org":
    default: {
      seq = await getNextOrgIssueSequence(orgSlug);
      issueKey = generateOrgIssueKey(orgSlug, seq);
      break;
    }
  }

  const now = new Date();

  // ---------------------------------------------------------------
  // Resolve organization ID from slug
  // ---------------------------------------------------------------
  const orgRow = await db
    .select({ id: organizationTable.id })
    .from(organizationTable)
    .where(eq(organizationTable.slug, orgSlug))
    .limit(1);

  if (orgRow.length === 0) {
    throw new Error(`Organization not found for slug: ${orgSlug}`);
  }

  const organizationId = orgRow[0].id;

  // -----------------------------------------------------------------------
  // Concurrency-safe insert with retry on unique-violation (race condition)
  // -----------------------------------------------------------------------

  let attempts = 0;
  while (true) {
    attempts++;
    const id = randomUUID();

    try {
      await db.transaction(async (tx) => {
        await tx.insert(issueTable).values({
          id,
          key: issueKey,
          sequenceNumber: seq,
          title,
          description,
          teamId,
          reporterId: reporterId!,
          projectId,
          priorityId,
          organizationId,
          startDate: startDate ?? null,
          dueDate: dueDate ?? null,
          estimatedTimes: estimatedTimes ?? null,
          createdAt: now,
          updatedAt: now,
        });

        // ------------------------------------------------------------------
        //  Create initial assignment row so issue always has at least one
        // ------------------------------------------------------------------

        await createAssignmentInTx(tx, {
          issueId: id,
          assigneeId,
          stateId: stateId!,
          actorId: reporterId!,
        });

        await tx.insert(activityTable).values({
          id: randomUUID(),
          issueId: id,
          actorId: reporterId!,
          type: "created",
          createdAt: now,
        });
      });

      return { id, key: issueKey } as const;
    } catch (err: unknown) {
      // 23505 is unique_violation in Postgres
      const code =
        typeof err === "object" && err !== null && "code" in err
          ? (err as { code?: string }).code
          : undefined;
      const isDupKey = code === "23505";
      if (!isDupKey || attempts >= 5) throw err;

      // Recompute sequence/key based on format and retry
      switch (issueKeyFormat) {
        case "team":
          seq = await getNextIssueSequence(teamId!);
          issueKey = await generateTeamIssueKey(teamId!, seq);
          break;
        case "project":
          seq = await getNextProjectIssueSequence(projectId!);
          issueKey = await generateProjectIssueKey(projectId!, seq);
          break;
        case "org":
        default:
          seq = await getNextOrgIssueSequence(orgSlug);
          issueKey = generateOrgIssueKey(orgSlug, seq);
          break;
      }
    }
  }
}

// ----------------------------------------------------------------------------
// Updates
// ----------------------------------------------------------------------------

export async function changeState(
  issueId: string,
  actorId: string,
  stateId: string,
): Promise<void> {
  // Update all assignments for this actor on the issue (simplified permissions)
  // changeAssignmentState imported statically above

  // Find existing assignment rows for actor
  const assignments = await db
    .select({ id: assignmentTable.id })
    .from(assignmentTable)
    .where(
      and(
        eq(assignmentTable.issueId, issueId),
        eq(assignmentTable.assigneeId, actorId),
      ),
    );

  if (assignments.length === 0) {
    // No assignment – create placeholder then update
    const { id: newId } = await createAssignment({
      issueId,
      assigneeId: actorId,
      stateId,
      actorId,
    });
    await changeAssignmentState(newId, actorId, stateId);
  } else {
    await Promise.all(
      assignments.map((a) => changeAssignmentState(a.id, actorId, stateId)),
    );
  }
}

export async function changePriority(
  issueId: string,
  actorId: string,
  priorityId: string,
): Promise<void> {
  const now = new Date();
  await db.transaction(async (tx) => {
    await tx
      .update(issueTable)
      .set({ priorityId, updatedAt: now })
      .where(eq(issueTable.id, issueId));

    await tx.insert(activityTable).values({
      id: randomUUID(),
      issueId,
      actorId: actorId!,
      type: "priority_changed",
      payload: { priorityId },
      createdAt: now,
    });
  });
}

export async function changeProject(
  issueId: string,
  actorId: string,
  projectId: string | null,
): Promise<void> {
  const now = new Date();
  await db
    .update(issueTable)
    .set({ projectId, updatedAt: now })
    .where(eq(issueTable.id, issueId));
}

export async function changeTeam(
  issueId: string,
  actorId: string,
  teamId: string | null,
): Promise<void> {
  const now = new Date();
  await db
    .update(issueTable)
    .set({ teamId, updatedAt: now })
    .where(eq(issueTable.id, issueId));
}

export async function assign(
  issueId: string,
  actorId: string,
  assigneeId: string | null,
): Promise<void> {
  // Find first assignment (unassigned or current actor) and update
  const assignment = await db
    .select({ id: assignmentTable.id })
    .from(assignmentTable)
    .where(eq(assignmentTable.issueId, issueId))
    .limit(1);

  if (assignment[0]) {
    await updateAssignmentAssignee(assignment[0].id, actorId, assigneeId);
  } else {
    // none exists – create new
    await createAssignment({
      issueId,
      assigneeId,
      // Without specific state, reuse default (stateId param undefined?). We'll pass null for now requiring later update.
      stateId: randomUUID(),
      actorId,
    });
  }
}

export async function updateTitle(
  issueId: string,
  actorId: string,
  title: string,
): Promise<void> {
  const now = new Date();
  await db.transaction(async (tx) => {
    await tx
      .update(issueTable)
      .set({ title, updatedAt: now })
      .where(eq(issueTable.id, issueId));
    await tx.insert(activityTable).values({
      id: randomUUID(),
      issueId,
      actorId: actorId!,
      type: "title_changed",
      payload: { title },
      createdAt: now,
    });
  });
}

export async function updateDescription(
  issueId: string,
  actorId: string,
  description: string | null,
): Promise<void> {
  const now = new Date();
  await db.transaction(async (tx) => {
    await tx
      .update(issueTable)
      .set({ description, updatedAt: now })
      .where(eq(issueTable.id, issueId));
    await tx.insert(activityTable).values({
      id: randomUUID(),
      issueId,
      actorId: actorId!,
      type: "description_changed",
      createdAt: now,
    });
  });
}

export async function updateEstimatedTimes(
  issueId: string,
  actorId: string,
  estimatedTimes: Record<string, number> | null,
): Promise<void> {
  const now = new Date();

  await db.transaction(async (tx) => {
    await tx
      .update(issueTable)
      .set({
        estimatedTimes,
        updatedAt: now,
      })
      .where(eq(issueTable.id, issueId));

    await tx.insert(activityTable).values({
      id: randomUUID(),
      issueId,
      actorId,
      // Reusing "comment_added" activity type to log estimate changes
      type: "comment_added",
      payload: { estimatedTimes },
      createdAt: now,
    });
  });
}

// -----------------------------------------------------------------------------
// Query operations
// -----------------------------------------------------------------------------

/**
 * Finds an issue by its stored key (e.g., "JOH-123", "ENG-45", "PROJ-67") within an organization.
 */
export async function findIssueByKey(
  orgSlug: string,
  issueKey: string,
): Promise<Issue | null> {
  // Check if it's a UUID (fallback for direct ID lookup)
  const uuidRegex =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (uuidRegex.test(issueKey)) {
    // Direct UUID lookup
    const issueResult = await db
      .select()
      .from(issueTable)
      .where(eq(issueTable.id, issueKey))
      .limit(1);
    return issueResult[0] || null;
  }

  // Get organization ID from slug
  const orgResult = await db
    .select({ id: organizationTable.id })
    .from(organizationTable)
    .where(eq(organizationTable.slug, orgSlug))
    .limit(1);

  if (orgResult.length === 0) {
    return null;
  }

  const organizationId = orgResult[0].id;

  // Find issue by stored key ensuring it belongs to the organization directly
  const issueResult = await db
    .select({ issue: issueTable })
    .from(issueTable)
    .where(
      and(
        eq(issueTable.key, issueKey),
        eq(issueTable.organizationId, organizationId),
      ),
    )
    .limit(1);

  return issueResult[0]?.issue || null;
}

/**
 * Gets the stored issue key for an issue (e.g., "JOH-123").
 */
export async function getIssueKey(issueId: string): Promise<string | null> {
  const result = await db
    .select({ key: issueTable.key })
    .from(issueTable)
    .where(eq(issueTable.id, issueId))
    .limit(1);

  if (result.length === 0) {
    return null;
  }

  return result[0].key;
}

// -----------------------------------------------------------------------------
// Deletion
// -----------------------------------------------------------------------------

export async function deleteIssue(issueId: string): Promise<void> {
  await db.delete(issueTable).where(eq(issueTable.id, issueId));
}
