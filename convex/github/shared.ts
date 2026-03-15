import type { Doc } from '../_generated/dataModel';

export const ISSUE_KEY_REFERENCE_RE =
  /(^|[^A-Z0-9_])([A-Z]+-\d+)(?=$|[^A-Z0-9_])/gi;

export type GitHubArtifactType = 'pull_request' | 'issue' | 'commit';

export type GitHubPullRequestState = 'draft' | 'open' | 'closed' | 'merged';
export type GitHubIssueState = 'open' | 'closed';

export function normalizeIssueKey(value: string) {
  return value.trim().toUpperCase();
}

export function extractIssueKeysFromText(
  ...inputs: Array<string | null | undefined>
) {
  const keys = new Set<string>();

  for (const input of inputs) {
    if (!input) continue;
    const text = input.toUpperCase();
    let match: RegExpExecArray | null;
    ISSUE_KEY_REFERENCE_RE.lastIndex = 0;
    while ((match = ISSUE_KEY_REFERENCE_RE.exec(text)) !== null) {
      keys.add(normalizeIssueKey(match[2]));
    }
  }

  return Array.from(keys);
}

export function buildArtifactExternalKey(
  artifactType: GitHubArtifactType,
  repoFullName: string,
  identifier: string | number,
) {
  switch (artifactType) {
    case 'pull_request':
      return `pr:${repoFullName}#${identifier}`;
    case 'issue':
      return `issue:${repoFullName}#${identifier}`;
    case 'commit':
      return `commit:${repoFullName}@${identifier}`;
  }
}

export function mapPullRequestStateToWorkflowType(
  state: GitHubPullRequestState,
): Doc<'issueStates'>['type'] {
  switch (state) {
    case 'merged':
      return 'done';
    case 'closed':
      return 'canceled';
    case 'draft':
    case 'open':
    default:
      return 'in_progress';
  }
}

export function mapGitHubIssueStateToWorkflowType(
  state: GitHubIssueState,
): Doc<'issueStates'>['type'] {
  return state === 'closed' ? 'done' : 'todo';
}

export function selectWorkflowTypeFromPullRequests(
  states: readonly GitHubPullRequestState[],
): Doc<'issueStates'>['type'] | null {
  if (states.some(state => state === 'draft' || state === 'open')) {
    return 'in_progress';
  }
  if (states.some(state => state === 'merged')) {
    return 'done';
  }
  if (states.some(state => state === 'closed')) {
    return 'canceled';
  }
  return null;
}

export function selectWorkflowTypeFromGitHubIssues(
  states: readonly GitHubIssueState[],
): Doc<'issueStates'>['type'] | null {
  if (states.some(state => state === 'open')) {
    return 'todo';
  }
  if (states.some(state => state === 'closed')) {
    return 'done';
  }
  return null;
}
