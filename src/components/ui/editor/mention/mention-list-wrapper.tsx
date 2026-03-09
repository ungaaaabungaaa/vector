import {
  forwardRef,
  useImperativeHandle,
  useRef,
  useMemo,
  useState,
  useEffect,
} from 'react';
import { useQuery } from 'convex/react';
import { api } from '@/lib/convex';
import MentionList, {
  type MentionListHandle,
  type MentionItem,
} from './mention-list';

type MentionListWrapperProps = {
  items: string[]; // items[0] is the query string
  command: (item: MentionItem) => void;
  orgSlug: string;
};

export type MentionListWrapperHandle = {
  onKeyDown: (event: KeyboardEvent) => boolean;
};

function useDebouncedValue(value: string, delay: number): string {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);
  return debounced;
}

const MentionListWrapper = forwardRef<
  MentionListWrapperHandle,
  MentionListWrapperProps
>(({ items: rawItems, command, orgSlug }, ref) => {
  const query = rawItems[0] || '';
  const debouncedQuery = useDebouncedValue(query.trim(), 150);
  const innerRef = useRef<MentionListHandle>(null);

  useImperativeHandle(ref, () => ({
    onKeyDown: (event: KeyboardEvent) => {
      return innerRef.current?.onKeyDown(event) ?? false;
    },
  }));

  const searchResults = useQuery(
    api.search.queries.searchEntities,
    debouncedQuery ? { orgSlug, query: debouncedQuery, limit: 5 } : 'skip',
  );

  const mentionItems: MentionItem[] = useMemo(() => {
    if (!searchResults) return [];
    const items: MentionItem[] = [];

    for (const user of searchResults.users) {
      items.push({
        id: user._id,
        label: user.name || user.email || user.username || 'Unknown',
        type: 'user',
        href: `/${orgSlug}/people/${user._id}`,
        subtitle: user.username
          ? `@${user.username}`
          : (user.email ?? undefined),
        email: user.email ?? undefined,
      });
    }

    for (const team of searchResults.teams) {
      items.push({
        id: team._id,
        label: team.name,
        type: 'team',
        href: `/${orgSlug}/teams/${team.key}`,
        subtitle: team.key,
        icon: team.icon ?? undefined,
        color: team.color ?? undefined,
      });
    }

    for (const project of searchResults.projects) {
      items.push({
        id: project._id,
        label: project.name,
        type: 'project',
        href: `/${orgSlug}/projects/${project.key}`,
        subtitle: project.key,
        icon: project.icon ?? undefined,
        color: project.color ?? undefined,
      });
    }

    for (const issue of searchResults.issues) {
      items.push({
        id: issue._id,
        label: `${issue.key} ${issue.title}`,
        type: 'issue',
        href: `/${orgSlug}/issues/${issue.key}`,
        subtitle: issue.key,
        icon: issue.stateIcon ?? undefined,
        color: issue.stateColor ?? undefined,
      });
    }

    return items;
  }, [searchResults, orgSlug]);

  const hasQuery = query.trim() !== '';
  const isDebouncing = hasQuery && query.trim() !== debouncedQuery;
  const isLoading = hasQuery && (isDebouncing || searchResults === undefined);

  return (
    <MentionList
      ref={innerRef}
      items={mentionItems}
      command={command}
      isLoading={isLoading}
      hasQuery={hasQuery}
    />
  );
});

MentionListWrapper.displayName = 'MentionListWrapper';

export default MentionListWrapper;
