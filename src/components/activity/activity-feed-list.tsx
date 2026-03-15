'use client';

import { useState } from 'react';
import type { ReactNode } from 'react';
import Link from 'next/link';
import { format, isToday, isYesterday } from 'date-fns';
import {
  ChevronLeft,
  ChevronRight,
  FileText,
  FolderOpen,
  MessageSquare,
  Target,
  Users,
} from 'lucide-react';
import { UserAvatar } from '@/components/user-avatar';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { formatDateHuman } from '@/lib/date';
import { cn } from '@/lib/utils';

type ActivityStatus =
  | 'LoadingFirstPage'
  | 'LoadingMore'
  | 'CanLoadMore'
  | 'Exhausted';

export interface ActivityFeedItem {
  _id: string;
  createdAt: number;
  entityType: 'issue' | 'project' | 'team' | 'document';
  eventType: string;
  actor: {
    _id: string;
    name: string;
    email: string | null;
    image: string | null;
  } | null;
  subjectUser: {
    _id: string;
    name: string;
    email: string | null;
    image: string | null;
  } | null;
  target: {
    type: 'issue' | 'project' | 'team' | 'document';
    id: string | null;
    key: string | null;
    name: string | null;
  };
  details: {
    field: string | null;
    fromLabel: string | null;
    toLabel: string | null;
    roleName: string | null;
    commentPreview: string | null;
    addedUserNames: string[];
    removedUserNames: string[];
  };
}

interface ActivityFeedListProps {
  items: ActivityFeedItem[];
  orgSlug: string;
  status: ActivityStatus;
  loadMore: (count: number) => void;
  emptyMessage: string;
  /** Number of items to load per "Show more" click (default: 20) */
  pageSize?: number;
  className?: string;
}

function getTargetHref(orgSlug: string, target: ActivityFeedItem['target']) {
  if (!target.key && !target.id) return null;
  if (target.type === 'issue')
    return target.key ? `/${orgSlug}/issues/${target.key}` : null;
  if (target.type === 'project')
    return target.key ? `/${orgSlug}/projects/${target.key}` : null;
  if (target.type === 'document')
    return target.id ? `/${orgSlug}/documents/${target.id}` : null;
  return target.key ? `/${orgSlug}/teams/${target.key}` : null;
}

function ActivityTarget({
  orgSlug,
  target,
  className,
}: {
  orgSlug: string;
  target: ActivityFeedItem['target'];
  className?: string;
}) {
  const label = target.key ?? target.name ?? 'unknown';
  const href = getTargetHref(orgSlug, target);

  if (!href) {
    return <span className={cn('font-medium', className)}>{label}</span>;
  }

  return (
    <Link
      href={href}
      className={cn(
        'hover:text-foreground text-foreground/90 font-medium transition-colors',
        className,
      )}
    >
      {label}
    </Link>
  );
}

function renderUsers(names: string[]) {
  return names.filter(Boolean).join(', ');
}

function renderActivityDescription(
  item: ActivityFeedItem,
  orgSlug: string,
): ReactNode {
  const { details, eventType, subjectUser } = item;
  const subjectName = subjectUser?.name ?? details.toLabel ?? details.fromLabel;

  switch (eventType) {
    case 'project_created':
    case 'team_created':
    case 'issue_created':
      return (
        <>
          created <ActivityTarget orgSlug={orgSlug} target={item.target} />
        </>
      );
    case 'project_name_changed':
    case 'team_name_changed':
    case 'issue_title_changed':
      return (
        <>
          renamed <ActivityTarget orgSlug={orgSlug} target={item.target} /> from{' '}
          <span className='text-foreground/75'>{details.fromLabel ?? '—'}</span>{' '}
          to{' '}
          <span className='text-foreground/75'>{details.toLabel ?? '—'}</span>
        </>
      );
    case 'project_description_changed':
    case 'team_description_changed':
    case 'issue_description_changed':
      return (
        <>
          updated the description on{' '}
          <ActivityTarget orgSlug={orgSlug} target={item.target} />
        </>
      );
    case 'project_status_changed':
      return (
        <>
          changed the status on{' '}
          <ActivityTarget orgSlug={orgSlug} target={item.target} /> from{' '}
          <span className='text-foreground/75'>
            {details.fromLabel ?? 'Unset'}
          </span>{' '}
          to{' '}
          <span className='text-foreground/75'>
            {details.toLabel ?? 'Unset'}
          </span>
        </>
      );
    case 'project_team_changed':
    case 'issue_team_changed':
      return (
        <>
          changed the team on{' '}
          <ActivityTarget orgSlug={orgSlug} target={item.target} /> from{' '}
          <span className='text-foreground/75'>
            {details.fromLabel ?? 'Unset'}
          </span>{' '}
          to{' '}
          <span className='text-foreground/75'>
            {details.toLabel ?? 'Unset'}
          </span>
        </>
      );
    case 'project_team_added':
    case 'issue_team_added':
      return (
        <>
          linked <ActivityTarget orgSlug={orgSlug} target={item.target} /> to{' '}
          <span className='text-foreground/75'>
            {details.toLabel ?? 'a team'}
          </span>
        </>
      );
    case 'project_team_removed':
    case 'issue_team_removed':
      return (
        <>
          removed <ActivityTarget orgSlug={orgSlug} target={item.target} /> from{' '}
          <span className='text-foreground/75'>
            {details.fromLabel ?? 'a team'}
          </span>
        </>
      );
    case 'project_lead_changed':
    case 'team_lead_changed':
      return (
        <>
          changed the lead on{' '}
          <ActivityTarget orgSlug={orgSlug} target={item.target} /> to{' '}
          <span className='text-foreground/75'>
            {details.toLabel ?? 'Unset'}
          </span>
        </>
      );
    case 'project_visibility_changed':
    case 'team_visibility_changed':
    case 'issue_visibility_changed':
      return (
        <>
          changed visibility on{' '}
          <ActivityTarget orgSlug={orgSlug} target={item.target} /> from{' '}
          <span className='text-foreground/75'>
            {details.fromLabel ?? 'Unset'}
          </span>{' '}
          to{' '}
          <span className='text-foreground/75'>
            {details.toLabel ?? 'Unset'}
          </span>
        </>
      );
    case 'project_member_added':
    case 'team_member_added':
      return (
        <>
          added{' '}
          <span className='text-foreground/75'>
            {subjectName ?? 'a member'}
          </span>{' '}
          to <ActivityTarget orgSlug={orgSlug} target={item.target} />
          {details.toLabel ? (
            <>
              {' '}
              as <span className='text-foreground/75'>{details.toLabel}</span>
            </>
          ) : null}
        </>
      );
    case 'project_member_removed':
    case 'team_member_removed':
      return (
        <>
          removed{' '}
          <span className='text-foreground/75'>
            {subjectName ?? 'a member'}
          </span>{' '}
          from <ActivityTarget orgSlug={orgSlug} target={item.target} />
        </>
      );
    case 'project_role_assigned':
    case 'team_role_assigned':
      return (
        <>
          assigned{' '}
          <span className='text-foreground/75'>
            {details.roleName ?? 'a role'}
          </span>{' '}
          to{' '}
          <span className='text-foreground/75'>
            {subjectName ?? 'a member'}
          </span>{' '}
          on <ActivityTarget orgSlug={orgSlug} target={item.target} />
        </>
      );
    case 'issue_priority_changed':
      return (
        <>
          changed priority on{' '}
          <ActivityTarget orgSlug={orgSlug} target={item.target} /> from{' '}
          <span className='text-foreground/75'>
            {details.fromLabel ?? 'Unset'}
          </span>{' '}
          to{' '}
          <span className='text-foreground/75'>
            {details.toLabel ?? 'Unset'}
          </span>
        </>
      );
    case 'issue_assignment_state_changed':
      return (
        <>
          moved{' '}
          <span className='text-foreground/75'>
            {subjectName ?? 'an assignee'}
          </span>{' '}
          on <ActivityTarget orgSlug={orgSlug} target={item.target} /> from{' '}
          <span className='text-foreground/75'>
            {details.fromLabel ?? 'Unset'}
          </span>{' '}
          to{' '}
          <span className='text-foreground/75'>
            {details.toLabel ?? 'Unset'}
          </span>
        </>
      );
    case 'issue_workflow_state_changed':
      return (
        <>
          changed state on{' '}
          <ActivityTarget orgSlug={orgSlug} target={item.target} /> from{' '}
          <span className='text-foreground/75'>
            {details.fromLabel ?? 'Unset'}
          </span>{' '}
          to{' '}
          <span className='text-foreground/75'>
            {details.toLabel ?? 'Unset'}
          </span>
        </>
      );
    case 'issue_github_artifact_linked':
      return (
        <>
          linked{' '}
          <span className='text-foreground/75'>
            {details.toLabel ?? 'a GitHub artifact'}
          </span>{' '}
          to <ActivityTarget orgSlug={orgSlug} target={item.target} />
        </>
      );
    case 'issue_github_artifact_unlinked':
      return (
        <>
          unlinked{' '}
          <span className='text-foreground/75'>
            {details.toLabel ?? 'a GitHub artifact'}
          </span>{' '}
          from <ActivityTarget orgSlug={orgSlug} target={item.target} />
        </>
      );
    case 'issue_github_artifact_suppressed':
      return (
        <>
          suppressed auto-linking for{' '}
          <span className='text-foreground/75'>
            {details.toLabel ?? 'a GitHub artifact'}
          </span>{' '}
          on <ActivityTarget orgSlug={orgSlug} target={item.target} />
        </>
      );
    case 'issue_github_artifact_status_changed':
      return (
        <>
          updated GitHub status on{' '}
          <ActivityTarget orgSlug={orgSlug} target={item.target} /> to{' '}
          <span className='text-foreground/75'>
            {details.toLabel ?? 'a new status'}
          </span>
        </>
      );
    case 'issue_assignees_changed': {
      const added = renderUsers(details.addedUserNames);
      const removed = renderUsers(details.removedUserNames);
      if (added && removed) {
        return (
          <>
            updated assignees on{' '}
            <ActivityTarget orgSlug={orgSlug} target={item.target} /> by adding{' '}
            <span className='text-foreground/75'>{added}</span> and removing{' '}
            <span className='text-foreground/75'>{removed}</span>
          </>
        );
      }
      if (added) {
        return (
          <>
            assigned <span className='text-foreground/75'>{added}</span> to{' '}
            <ActivityTarget orgSlug={orgSlug} target={item.target} />
          </>
        );
      }
      return (
        <>
          unassigned{' '}
          <span className='text-foreground/75'>{removed || 'a member'}</span>{' '}
          from <ActivityTarget orgSlug={orgSlug} target={item.target} />
        </>
      );
    }
    case 'issue_project_changed':
      return (
        <>
          changed the project on{' '}
          <ActivityTarget orgSlug={orgSlug} target={item.target} /> from{' '}
          <span className='text-foreground/75'>
            {details.fromLabel ?? 'Unset'}
          </span>{' '}
          to{' '}
          <span className='text-foreground/75'>
            {details.toLabel ?? 'Unset'}
          </span>
        </>
      );
    case 'issue_project_added':
      return (
        <>
          linked <ActivityTarget orgSlug={orgSlug} target={item.target} /> to{' '}
          <span className='text-foreground/75'>
            {details.toLabel ?? 'a project'}
          </span>
        </>
      );
    case 'issue_project_removed':
      return (
        <>
          removed <ActivityTarget orgSlug={orgSlug} target={item.target} /> from{' '}
          <span className='text-foreground/75'>
            {details.fromLabel ?? 'a project'}
          </span>
        </>
      );
    case 'issue_comment_added':
      return (
        <>
          commented on <ActivityTarget orgSlug={orgSlug} target={item.target} />
        </>
      );
    case 'issue_sub_issue_created':
      return (
        <>
          created sub-issue{' '}
          <span className='text-foreground/75'>
            {details.toLabel ?? item.target.key ?? 'issue'}
          </span>
        </>
      );
    case 'document_created':
      return (
        <>
          created <ActivityTarget orgSlug={orgSlug} target={item.target} />
        </>
      );
    case 'document_title_changed':
      return (
        <>
          renamed <ActivityTarget orgSlug={orgSlug} target={item.target} /> from{' '}
          <span className='text-foreground/75'>{details.fromLabel ?? '—'}</span>{' '}
          to{' '}
          <span className='text-foreground/75'>{details.toLabel ?? '—'}</span>
        </>
      );
    case 'document_content_changed':
      return (
        <>
          updated the content of{' '}
          <ActivityTarget orgSlug={orgSlug} target={item.target} />
        </>
      );
    case 'document_icon_changed':
      return (
        <>
          updated the icon on{' '}
          <ActivityTarget orgSlug={orgSlug} target={item.target} />
        </>
      );
    case 'document_color_changed':
      return (
        <>
          changed the color on{' '}
          <ActivityTarget orgSlug={orgSlug} target={item.target} /> from{' '}
          <span className='text-foreground/75'>
            {details.fromLabel ?? 'Unset'}
          </span>{' '}
          to{' '}
          <span className='text-foreground/75'>
            {details.toLabel ?? 'Unset'}
          </span>
        </>
      );
    case 'document_team_changed':
      return (
        <>
          changed the team on{' '}
          <ActivityTarget orgSlug={orgSlug} target={item.target} /> from{' '}
          <span className='text-foreground/75'>
            {details.fromLabel ?? 'Unset'}
          </span>{' '}
          to{' '}
          <span className='text-foreground/75'>
            {details.toLabel ?? 'Unset'}
          </span>
        </>
      );
    case 'document_project_changed':
      return (
        <>
          changed the project on{' '}
          <ActivityTarget orgSlug={orgSlug} target={item.target} /> from{' '}
          <span className='text-foreground/75'>
            {details.fromLabel ?? 'Unset'}
          </span>{' '}
          to{' '}
          <span className='text-foreground/75'>
            {details.toLabel ?? 'Unset'}
          </span>
        </>
      );
    case 'document_visibility_changed':
      return (
        <>
          changed visibility on{' '}
          <ActivityTarget orgSlug={orgSlug} target={item.target} /> from{' '}
          <span className='text-foreground/75'>
            {details.fromLabel ?? 'Unset'}
          </span>{' '}
          to{' '}
          <span className='text-foreground/75'>
            {details.toLabel ?? 'Unset'}
          </span>
        </>
      );
    case 'document_deleted':
      return (
        <>
          deleted{' '}
          <span className='text-foreground/75'>
            {item.target.name ?? 'a document'}
          </span>
        </>
      );
    default:
      return (
        <>
          updated <ActivityTarget orgSlug={orgSlug} target={item.target} />
        </>
      );
  }
}

function getDayLabel(date: Date) {
  if (isToday(date)) return 'Today';
  if (isYesterday(date)) return 'Yesterday';
  return format(date, 'MMM d, yyyy');
}

function groupByDay(items: ActivityFeedItem[]) {
  const groups = new Map<string, ActivityFeedItem[]>();

  for (const item of items) {
    const key = format(new Date(item.createdAt), 'yyyy-MM-dd');
    const existing = groups.get(key);
    if (existing) {
      existing.push(item);
      continue;
    }
    groups.set(key, [item]);
  }

  return [...groups.entries()].map(([dateKey, dayItems]) => ({
    dateKey,
    label: getDayLabel(new Date(dayItems[0].createdAt)),
    items: dayItems,
  }));
}

function ActivityRow({
  item,
  orgSlug,
}: {
  item: ActivityFeedItem;
  orgSlug: string;
}) {
  const actorName = item.actor?.name ?? 'Unknown user';

  return (
    <div className='hover:bg-muted/40 flex items-center gap-3 px-3 py-2 transition-colors'>
      <UserAvatar
        name={item.actor?.name}
        email={item.actor?.email}
        image={item.actor?.image}
        userId={item.actor?._id}
        size='sm'
        className='size-6 shrink-0'
      />

      <div className='min-w-0 flex-1 space-y-1'>
        <div className='flex flex-wrap items-center gap-1 text-sm leading-5'>
          <span className='font-medium'>{actorName}</span>
          <span className='text-muted-foreground'>
            {renderActivityDescription(item, orgSlug)}
          </span>
        </div>

        {item.details.commentPreview ? (
          <div className='border-border/60 text-muted-foreground rounded-md border bg-transparent px-2 py-1 text-xs leading-5'>
            {item.details.commentPreview}
          </div>
        ) : null}
      </div>

      <div className='flex shrink-0 items-center gap-2 pl-2'>
        <div className='text-muted-foreground flex size-6 items-center justify-center rounded-md border'>
          {item.eventType.includes('comment') ? (
            <MessageSquare className='size-3.5' />
          ) : item.entityType === 'project' ? (
            <FolderOpen className='size-3.5' />
          ) : item.entityType === 'team' ? (
            <Users className='size-3.5' />
          ) : item.entityType === 'document' ? (
            <FileText className='size-3.5' />
          ) : (
            <Target className='size-3.5' />
          )}
        </div>
        <span className='text-muted-foreground min-w-[88px] text-right text-xs'>
          {formatDateHuman(new Date(item.createdAt))}
        </span>
      </div>
    </div>
  );
}

export function ActivityFeedSkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <div className='rounded-lg border'>
      <ActivityFeedSkeletonRows rows={rows} />
    </div>
  );
}

function ActivityFeedSkeletonRows({ rows = 5 }: { rows?: number }) {
  return (
    <div className='space-y-0'>
      {Array.from({ length: rows }).map((_, index) => (
        <div
          key={index}
          className={cn(
            'flex items-start gap-3 px-3 py-2',
            index > 0 && 'border-t',
          )}
        >
          <Skeleton className='size-6 rounded-full' />
          <div className='min-w-0 flex-1 space-y-2 py-0.5'>
            <Skeleton className='h-3.5 w-3/5' />
            <Skeleton className='h-3.5 w-2/5' />
          </div>
          <Skeleton className='h-3.5 w-16' />
        </div>
      ))}
    </div>
  );
}

export function ActivityFeedList({
  items,
  orgSlug,
  status,
  loadMore,
  emptyMessage,
  pageSize = 20,
  className,
}: ActivityFeedListProps) {
  const [page, setPage] = useState(0);
  const [pendingPage, setPendingPage] = useState<number | null>(null);

  // Reset to first page when items become empty (valid setState-during-render pattern)
  if (items.length === 0 && page !== 0) setPage(0);
  if (items.length === 0 && pendingPage !== null) setPendingPage(null);

  if (status === 'LoadingFirstPage') {
    return <ActivityFeedSkeleton />;
  }

  if (items.length === 0) {
    return (
      <div className={cn('rounded-lg border px-3 py-8 text-center', className)}>
        <div className='text-muted-foreground text-sm'>{emptyMessage}</div>
      </div>
    );
  }

  if (pendingPage !== null && pendingPage * pageSize < items.length) {
    setPage(pendingPage);
    setPendingPage(null);
  }

  if (
    pendingPage !== null &&
    status !== 'LoadingMore' &&
    pendingPage * pageSize >= items.length
  ) {
    setPendingPage(null);
  }

  const activePage = pendingPage ?? page;
  const start = activePage * pageSize;
  const end = start + pageSize;
  const pageItems = items.slice(start, end);
  const groups = groupByDay(pageItems);
  const isLoadingNextPage =
    pendingPage !== null && pendingPage * pageSize >= items.length;

  const hasMoreOnServer = status !== 'Exhausted';
  const hasNextPage = end < items.length || hasMoreOnServer;
  const totalPages = hasMoreOnServer
    ? activePage + 2 // At least one more page
    : Math.max(1, Math.ceil(items.length / pageSize));

  const handleNext = () => {
    if (end >= items.length && hasMoreOnServer) {
      // Need to fetch more from server before advancing
      setPendingPage(page + 1);
      loadMore(pageSize);
      return;
    }
    setPage(p => p + 1);
  };

  return (
    <div className={cn('space-y-0', className)}>
      <div className='rounded-lg border'>
        {isLoadingNextPage ? (
          <ActivityFeedSkeletonRows rows={pageSize} />
        ) : (
          groups.map((group, groupIndex) => (
            <div key={group.dateKey}>
              <div
                className={cn(
                  'bg-background/95 text-muted-foreground sticky top-0 z-10 border-b px-3 py-1.5 text-[11px] font-medium tracking-wide uppercase backdrop-blur',
                  groupIndex === 0 && 'rounded-t-lg',
                )}
              >
                {group.label}
              </div>
              {group.items.map(item => (
                <ActivityRow key={item._id} item={item} orgSlug={orgSlug} />
              ))}
            </div>
          ))
        )}

        {/* Pagination footer */}
        {(totalPages > 1 || hasNextPage) && (
          <div className='text-muted-foreground flex items-center justify-between border-t px-3 py-1.5 text-xs'>
            <span>
              Page {activePage + 1}
              {!hasMoreOnServer ? ` of ${totalPages}` : ''}
            </span>
            <div className='flex items-center gap-1'>
              <Button
                type='button'
                variant='ghost'
                size='sm'
                className='h-6 w-6 p-0'
                onClick={() => setPage(p => p - 1)}
                disabled={page === 0 || isLoadingNextPage}
              >
                <ChevronLeft className='size-3.5' />
              </Button>
              <Button
                type='button'
                variant='ghost'
                size='sm'
                className='h-6 w-6 p-0'
                onClick={handleNext}
                disabled={!hasNextPage || status === 'LoadingMore'}
              >
                <ChevronRight className='size-3.5' />
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
