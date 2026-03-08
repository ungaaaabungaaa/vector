import type { Doc } from '../_generated/dataModel';

export function buildIssueSearchText(input: {
  key: string;
  title: string;
  description?: string | null;
}) {
  return [input.key, input.title, input.description ?? '']
    .join(' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function buildIssueSearchTextFromIssue(
  issue: Pick<Doc<'issues'>, 'key' | 'title' | 'description'>,
) {
  return buildIssueSearchText(issue);
}
