import type { OptimisticLocalStore } from 'convex/browser';
import type {
  FunctionArgs,
  FunctionReference,
  FunctionReturnType,
} from 'convex/server';
import type { Id } from '@/convex/_generated/dataModel';
import { api } from '@/convex/_generated/api';

export function updateQuery<Query extends FunctionReference<'query'>>(
  store: OptimisticLocalStore,
  query: Query,
  args: FunctionArgs<Query>,
  update: (current: FunctionReturnType<Query>) => FunctionReturnType<Query>,
) {
  const current = store.getQuery(query, args);
  if (current === undefined) {
    return;
  }
  store.setQuery(query, args, update(current));
}

type IssueListResult = FunctionReturnType<typeof api.issues.queries.listIssues>;
type IssueListRow = IssueListResult['issues'][number];
type IssueAssignment = FunctionReturnType<
  typeof api.issues.queries.getAssignments
>[number];
type ProjectList = FunctionReturnType<typeof api.projects.queries.list>;
type ProjectListRow = ProjectList[number];
type TeamList = FunctionReturnType<typeof api.organizations.queries.listTeams>;
type TeamListRow = TeamList[number];
type OrgMembersWithRoles = FunctionReturnType<
  typeof api.organizations.queries.listMembersWithRoles
>;
type NotificationPreferences = FunctionReturnType<
  typeof api.notifications.queries.getPreferences
>;

export function updateIssueRows(
  current: IssueListResult,
  issueId: string,
  update: (row: IssueListRow) => IssueListRow,
): IssueListResult {
  return {
    ...current,
    issues: current.issues.map(row =>
      String(row.id) === issueId ? update(row) : row,
    ),
  };
}

export function replaceIssueRows(
  current: IssueListResult,
  issueId: string,
  nextRows: IssueListRow[],
): IssueListResult {
  const remaining = current.issues.filter(row => String(row.id) !== issueId);
  const nextIssues: IssueListRow[] = [];
  let inserted = false;

  for (const row of current.issues) {
    if (String(row.id) === issueId) {
      if (!inserted) {
        nextIssues.push(...nextRows);
        inserted = true;
      }
      continue;
    }
    nextIssues.push(row);
  }

  if (!inserted) {
    nextIssues.push(...remaining);
    nextIssues.push(...nextRows);
  }

  return {
    ...current,
    issues: nextIssues,
  };
}

export function removeIssueRows(
  current: IssueListResult,
  issueId: string,
): IssueListResult {
  return {
    ...current,
    issues: current.issues.filter(row => String(row.id) !== issueId),
    total: Math.max(
      0,
      current.total -
        (current.issues.some(row => String(row.id) === issueId) ? 1 : 0),
    ),
  };
}

export function updateIssueAssignmentRows(
  current: IssueAssignment[],
  assignmentId: string,
  update: (assignment: IssueAssignment) => IssueAssignment,
) {
  return current.map(assignment =>
    String(assignment._id) === assignmentId ? update(assignment) : assignment,
  );
}

export function removeIssueAssignmentRow(
  current: IssueAssignment[],
  assignmentId: string,
) {
  return current.filter(assignment => String(assignment._id) !== assignmentId);
}

export function addIssueAssignmentRow(
  current: IssueAssignment[],
  assignment: IssueAssignment,
) {
  return [...current, assignment];
}

export function buildOptimisticIssueRows(
  existingRows: IssueListRow[],
  issueId: Id<'issues'>,
  assigneeIds: Id<'users'>[],
  members:
    | FunctionReturnType<typeof api.organizations.queries.listMembers>
    | undefined,
  fallbackState: {
    _id?: Id<'issueStates'>;
    name?: string | null;
    icon?: string | null;
    color?: string | null;
    type?: string | null;
  } | null,
): IssueListRow[] {
  const baseRow = existingRows[0];
  if (!baseRow) {
    return [];
  }

  if (assigneeIds.length === 0) {
    return [
      {
        ...baseRow,
        assignmentId: 'unassigned',
        assigneeId: undefined,
        assigneeName: null,
        assigneeEmail: null,
        assigneeImage: null,
        stateId: undefined,
        stateName: null,
        stateIcon: null,
        stateColor: null,
        stateType: null,
      },
    ] as IssueListRow[];
  }

  return assigneeIds.map(assigneeId => {
    const existingRow = existingRows.find(
      row => String(row.assigneeId) === String(assigneeId),
    );
    const member = members?.find(
      row => String(row.userId) === String(assigneeId),
    )?.user;
    const now = Date.now();

    return {
      ...(existingRow ?? baseRow),
      assignmentId:
        existingRow?.assignmentId ??
        (`optimistic-${issueId}-${assigneeId}-${now}` as Id<'issueAssignees'>),
      assigneeId,
      assigneeName: existingRow?.assigneeName ?? member?.name ?? undefined,
      assigneeEmail: existingRow?.assigneeEmail ?? member?.email ?? undefined,
      assigneeImage: existingRow?.assigneeImage ?? member?.image ?? undefined,
      stateId: existingRow?.stateId ?? fallbackState?._id,
      stateName: existingRow?.stateName ?? fallbackState?.name ?? undefined,
      stateIcon: existingRow?.stateIcon ?? fallbackState?.icon ?? undefined,
      stateColor: existingRow?.stateColor ?? fallbackState?.color ?? undefined,
      stateType: existingRow?.stateType ?? fallbackState?.type ?? undefined,
    };
  }) as IssueListRow[];
}

export function updateProjectRows(
  current: ProjectList,
  projectId: string,
  update: (project: ProjectListRow) => ProjectListRow,
) {
  return current.map(project =>
    String(project._id) === projectId ? update(project) : project,
  );
}

export function removeProjectRow(current: ProjectList, projectId: string) {
  return current.filter(project => String(project._id) !== projectId);
}

export function updateTeamRows(
  current: TeamList,
  teamId: string,
  update: (team: TeamListRow) => TeamListRow,
) {
  return current.map(team =>
    String(team._id) === teamId ? update(team) : team,
  );
}

export function updateOrgMemberRole(
  current: OrgMembersWithRoles,
  userId: string,
  role: 'member' | 'admin',
) {
  return current.map(member =>
    String(member.userId) === userId ? { ...member, role } : member,
  );
}

export function updateNotificationPreference(
  current: NotificationPreferences,
  category: NotificationPreferences[number]['category'],
  update: (
    preference: NotificationPreferences[number],
  ) => NotificationPreferences[number],
) {
  return current.map(preference =>
    preference.category === category ? update(preference) : preference,
  );
}
