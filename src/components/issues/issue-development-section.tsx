'use client';

import { useAction, useMutation, api } from '@/lib/convex';
import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import {
  Bug,
  ExternalLink,
  GitBranch,
  GitCommitHorizontal,
  GitPullRequest,
  Github,
  Link2,
  RefreshCw,
  ShieldOff,
  Unlink2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { BarsSpinner } from '@/components/bars-spinner';
import { formatDateHuman } from '@/lib/date';
import { usePermissionCheck } from '@/components/ui/permission-aware';
import { PERMISSIONS } from '@/convex/_shared/permissions';
import { toast } from 'sonner';
import { getGitHubLinkErrorMessage } from '@/lib/error-handling';
import type { FunctionReturnType } from 'convex/server';
import type { Id } from '@/convex/_generated/dataModel';
import { useQuery } from 'convex/react';

const STALE_AFTER_MS = 5 * 60 * 1000;

type DevelopmentData = FunctionReturnType<
  typeof api.github.queries.getIssueDevelopment
>;
type PullRequestItem = DevelopmentData['pullRequests'][number];
type GitHubIssueItem = DevelopmentData['githubIssues'][number];
type CommitItem = DevelopmentData['commits'][number];

function isStale(lastSyncedAt?: number | null) {
  if (!lastSyncedAt) return true;
  return Date.now() - lastSyncedAt > STALE_AFTER_MS;
}

function StatusBadge({
  label,
  tone,
}: {
  label: string;
  tone: 'default' | 'secondary' | 'outline';
}) {
  return (
    <Badge
      variant={tone}
      className='h-5 rounded-md px-1.5 text-[10px] font-medium tracking-wide uppercase'
    >
      {label}
    </Badge>
  );
}

function PullRequestStateBadge({ state }: { state: PullRequestItem['state'] }) {
  if (state === 'merged') {
    return <StatusBadge label='merged' tone='default' />;
  }
  if (state === 'closed') {
    return <StatusBadge label='closed' tone='outline' />;
  }
  if (state === 'draft') {
    return <StatusBadge label='draft' tone='secondary' />;
  }
  return <StatusBadge label='open' tone='secondary' />;
}

function GitHubIssueStateBadge({ state }: { state: GitHubIssueItem['state'] }) {
  return (
    <StatusBadge
      label={state === 'closed' ? 'closed' : 'open'}
      tone={state === 'closed' ? 'outline' : 'secondary'}
    />
  );
}

function ArtifactMeta({
  repository,
  syncedAt,
  source,
}: {
  repository: string;
  syncedAt?: number | null;
  source?: 'auto' | 'manual' | 'rollup' | null;
}) {
  return (
    <div className='text-muted-foreground flex flex-wrap items-center gap-2 text-xs'>
      <span className='font-mono'>{repository}</span>
      {source ? (
        <Badge variant='outline' className='h-5 rounded-md px-1.5 text-[10px]'>
          {source === 'auto'
            ? 'auto'
            : source === 'manual'
              ? 'manual'
              : 'rollup'}
        </Badge>
      ) : null}
      <span>
        {syncedAt
          ? `Synced ${formatDateHuman(new Date(syncedAt))}`
          : 'Sync pending'}
      </span>
      {isStale(syncedAt) ? (
        <span className='text-amber-600 dark:text-amber-400'>Stale</span>
      ) : null}
    </div>
  );
}

function RowActions({
  href,
  canEdit,
  busy,
  onPrimaryAction,
  primaryLabel,
}: {
  href: string;
  canEdit: boolean;
  busy: boolean;
  onPrimaryAction?: () => void;
  primaryLabel?: string;
}) {
  return (
    <div className='flex shrink-0 items-center gap-1'>
      <Link
        href={href}
        target='_blank'
        rel='noreferrer'
        className='hover:bg-muted inline-flex size-6 items-center justify-center rounded-[min(var(--radius-md),10px)] transition-colors'
      >
        <ExternalLink className='size-3.5' />
      </Link>
      {onPrimaryAction && primaryLabel ? (
        <Button
          variant='ghost'
          size='xs'
          disabled={!canEdit || busy}
          onClick={onPrimaryAction}
        >
          {busy ? <BarsSpinner size={10} /> : null}
          {primaryLabel === 'Suppress' ? (
            <ShieldOff className='size-3.5' />
          ) : (
            <Unlink2 className='size-3.5' />
          )}
          {primaryLabel}
        </Button>
      ) : null}
    </div>
  );
}

function PullRequestRow({
  item,
  canEdit,
  busy,
  onUnlink,
}: {
  item: PullRequestItem;
  canEdit: boolean;
  busy: boolean;
  onUnlink: (linkId: Id<'githubArtifactLinks'>, suppress: boolean) => void;
}) {
  return (
    <div className='flex items-start gap-3 rounded-lg border px-3 py-2'>
      <div className='bg-muted flex size-7 shrink-0 items-center justify-center rounded-md'>
        <GitPullRequest className='size-3.5' />
      </div>
      <div className='min-w-0 flex-1'>
        <div className='flex flex-wrap items-center gap-2'>
          <Link
            href={item.url}
            target='_blank'
            rel='noreferrer'
            className='hover:text-foreground truncate text-sm font-medium transition-colors'
          >
            {item.title}
          </Link>
          <PullRequestStateBadge state={item.state} />
          <span className='text-muted-foreground font-mono text-xs'>
            #{item.number}
          </span>
        </div>
        <ArtifactMeta
          repository={item.repository?.fullName ?? 'Unknown repository'}
          syncedAt={item.lastSyncedAt}
          source={item.source}
        />
        {item.headRefName ? (
          <div className='text-muted-foreground mt-1 flex items-center gap-1 text-xs'>
            <GitBranch className='size-3' />
            <span className='truncate font-mono'>{item.headRefName}</span>
          </div>
        ) : null}
      </div>
      <RowActions
        href={item.url}
        canEdit={canEdit}
        busy={busy}
        onPrimaryAction={
          item.linkId
            ? () =>
                onUnlink(
                  item.linkId as Id<'githubArtifactLinks'>,
                  item.source === 'auto',
                )
            : undefined
        }
        primaryLabel={item.source === 'auto' ? 'Suppress' : 'Unlink'}
      />
    </div>
  );
}

function GitHubIssueRow({
  item,
  canEdit,
  busy,
  onUnlink,
}: {
  item: GitHubIssueItem;
  canEdit: boolean;
  busy: boolean;
  onUnlink: (linkId: Id<'githubArtifactLinks'>, suppress: boolean) => void;
}) {
  return (
    <div className='flex items-start gap-3 rounded-lg border px-3 py-2'>
      <div className='bg-muted flex size-7 shrink-0 items-center justify-center rounded-md'>
        <Bug className='size-3.5' />
      </div>
      <div className='min-w-0 flex-1'>
        <div className='flex flex-wrap items-center gap-2'>
          <Link
            href={item.url}
            target='_blank'
            rel='noreferrer'
            className='hover:text-foreground truncate text-sm font-medium transition-colors'
          >
            {item.title}
          </Link>
          <GitHubIssueStateBadge state={item.state} />
          <span className='text-muted-foreground font-mono text-xs'>
            #{item.number}
          </span>
        </div>
        <ArtifactMeta
          repository={item.repository?.fullName ?? 'Unknown repository'}
          syncedAt={item.lastSyncedAt}
          source={item.source}
        />
      </div>
      <RowActions
        href={item.url}
        canEdit={canEdit}
        busy={busy}
        onPrimaryAction={
          item.linkId
            ? () =>
                onUnlink(
                  item.linkId as Id<'githubArtifactLinks'>,
                  item.source === 'auto',
                )
            : undefined
        }
        primaryLabel={item.source === 'auto' ? 'Suppress' : 'Unlink'}
      />
    </div>
  );
}

function CommitRow({
  item,
  canEdit,
  busy,
  onUnlink,
}: {
  item: CommitItem;
  canEdit: boolean;
  busy: boolean;
  onUnlink: (linkId: Id<'githubArtifactLinks'>, suppress: boolean) => void;
}) {
  return (
    <div className='flex items-start gap-3 rounded-lg border px-3 py-2'>
      <div className='bg-muted flex size-7 shrink-0 items-center justify-center rounded-md'>
        <GitCommitHorizontal className='size-3.5' />
      </div>
      <div className='min-w-0 flex-1'>
        <div className='flex flex-wrap items-center gap-2'>
          <Link
            href={item.url}
            target='_blank'
            rel='noreferrer'
            className='hover:text-foreground truncate text-sm font-medium transition-colors'
          >
            {item.messageHeadline}
          </Link>
          <span className='text-muted-foreground font-mono text-xs'>
            {item.shortSha}
          </span>
        </div>
        <ArtifactMeta
          repository={item.repository?.fullName ?? 'Unknown repository'}
          syncedAt={item.lastSyncedAt}
          source={item.source}
        />
      </div>
      <RowActions
        href={item.url}
        canEdit={canEdit}
        busy={busy}
        onPrimaryAction={
          item.linkId
            ? () =>
                onUnlink(
                  item.linkId as Id<'githubArtifactLinks'>,
                  item.source === 'auto',
                )
            : undefined
        }
        primaryLabel={item.source === 'auto' ? 'Suppress' : 'Unlink'}
      />
    </div>
  );
}

function LinkArtifactInput({
  url,
  setUrl,
  isLinking,
  onLink,
}: {
  url: string;
  setUrl: (v: string) => void;
  isLinking: boolean;
  onLink: () => void;
}) {
  const [open, setOpen] = useState(false);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant='ghost' size='xs' className='h-6 gap-1 px-2'>
          <Link2 className='size-3.5' />
          Link
        </Button>
      </PopoverTrigger>
      <PopoverContent align='end' className='w-80 p-2'>
        <div className='flex gap-2'>
          <Input
            value={url}
            onChange={event => setUrl(event.target.value)}
            placeholder='Paste a GitHub URL'
            className='h-8'
            disabled={isLinking}
            autoFocus
            onKeyDown={event => {
              if (event.key === 'Enter') {
                event.preventDefault();
                onLink();
                setOpen(false);
              }
            }}
          />
          <Button
            size='sm'
            variant='outline'
            className='h-8 shrink-0'
            disabled={isLinking || !url.trim()}
            onClick={() => {
              onLink();
              setOpen(false);
            }}
          >
            {isLinking ? <BarsSpinner size={10} /> : null}
            Link
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}

function DevelopmentSkeleton() {
  return (
    <div className='space-y-2'>
      <Skeleton className='h-9 w-full rounded-lg' />
      <Skeleton className='h-16 w-full rounded-lg' />
      <Skeleton className='h-16 w-full rounded-lg' />
    </div>
  );
}

export function IssueDevelopmentSection({
  orgSlug,
  issueId,
  issueKey,
}: {
  orgSlug: string;
  issueId: Id<'issues'>;
  issueKey: string;
}) {
  const development = useQuery(api.github.queries.getIssueDevelopment, {
    issueId,
  });
  const githubCapabilities = useQuery(
    api.github.queries.getGitHubCapabilities,
    {
      orgSlug,
    },
  );
  const refreshDevelopment = useAction(
    api.github.actions.refreshIssueDevelopment,
  );
  const linkArtifactByUrl = useAction(api.github.actions.linkArtifactByUrl);
  const unlinkArtifact = useMutation(api.github.mutations.unlinkArtifact);
  const { isAllowed: canEdit } = usePermissionCheck(
    orgSlug,
    PERMISSIONS.ISSUE_EDIT,
  );

  const [url, setUrl] = useState('');
  const [isLinking, setIsLinking] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [busyLinkId, setBusyLinkId] = useState<string | null>(null);
  const autoRefreshRef = useRef<string | null>(null);
  const hasApiAccess = Boolean(githubCapabilities?.hasApiAccess);

  const hasArtifacts = useMemo(() => {
    if (!development) return false;
    return (
      development.pullRequests.length > 0 ||
      development.githubIssues.length > 0 ||
      development.commits.length > 0 ||
      development.childCommitRollup.length > 0
    );
  }, [development]);

  const hasStaleArtifacts = useMemo(() => {
    if (!development) return false;
    return [
      ...development.pullRequests.map(item => item.lastSyncedAt),
      ...development.githubIssues.map(item => item.lastSyncedAt),
      ...development.commits.map(item => item.lastSyncedAt),
    ].some(value => isStale(value));
  }, [development]);

  useEffect(() => {
    if (
      !hasApiAccess ||
      !development ||
      !hasArtifacts ||
      !hasStaleArtifacts ||
      isRefreshing
    ) {
      return;
    }
    if (autoRefreshRef.current === String(issueId)) {
      return;
    }

    autoRefreshRef.current = String(issueId);
    setIsRefreshing(true);
    void refreshDevelopment({ issueId })
      .catch(error => {
        console.error(error);
      })
      .finally(() => {
        setIsRefreshing(false);
      });
  }, [
    development,
    hasArtifacts,
    hasApiAccess,
    hasStaleArtifacts,
    isRefreshing,
    issueId,
    refreshDevelopment,
  ]);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      await refreshDevelopment({ issueId });
    } catch (error) {
      console.error(error);
      toast.error('Failed to refresh GitHub development data');
    } finally {
      setIsRefreshing(false);
    }
  };

  const handleLink = async () => {
    const nextUrl = url.trim();
    if (!nextUrl || !canEdit) return;

    setIsLinking(true);
    try {
      await linkArtifactByUrl({
        orgSlug,
        issueKey,
        url: nextUrl,
      });
      setUrl('');
    } catch (error) {
      toast.error(getGitHubLinkErrorMessage(error));
    } finally {
      setIsLinking(false);
    }
  };

  const handleUnlink = async (
    linkId: Id<'githubArtifactLinks'>,
    suppress: boolean,
  ) => {
    setBusyLinkId(String(linkId));
    try {
      await unlinkArtifact({ linkId, suppress });
    } catch (error) {
      console.error(error);
      toast.error(
        suppress
          ? 'Failed to suppress GitHub auto-link'
          : 'Failed to unlink GitHub artifact',
      );
    } finally {
      setBusyLinkId(null);
    }
  };

  if (development !== undefined && !hasArtifacts) {
    return null;
  }

  return (
    <div className='mb-8'>
      <div className='mb-2 flex items-center justify-between gap-3'>
        <div className='flex items-center gap-2'>
          <Github className='size-4' />
          <h2 className='text-sm font-semibold'>Development</h2>
          {!hasApiAccess ? (
            <Badge
              variant='outline'
              className='h-5 rounded-md px-1.5 text-[10px]'
            >
              Webhook-driven
            </Badge>
          ) : null}
        </div>
        <div className='flex items-center gap-1'>
          {canEdit && hasApiAccess ? (
            <LinkArtifactInput
              url={url}
              setUrl={setUrl}
              isLinking={isLinking}
              onLink={() => void handleLink()}
            />
          ) : null}
          {hasApiAccess ? (
            <Button
              variant='ghost'
              size='xs'
              className='h-6 gap-1 px-2'
              disabled={!canEdit || isRefreshing}
              onClick={() => void handleRefresh()}
            >
              {isRefreshing ? (
                <BarsSpinner size={10} />
              ) : (
                <RefreshCw className='size-3.5' />
              )}
              Refresh
            </Button>
          ) : null}
        </div>
      </div>

      {development === undefined ? (
        <DevelopmentSkeleton />
      ) : (
        <div className='space-y-3'>
          {development.pullRequests.length > 0 ? (
            <div className='space-y-2'>
              <div className='text-muted-foreground text-xs font-medium tracking-wide uppercase'>
                Pull Requests
              </div>
              {development.pullRequests.map(item => (
                <PullRequestRow
                  key={item._id}
                  item={item}
                  canEdit={canEdit}
                  busy={busyLinkId === String(item.linkId)}
                  onUnlink={handleUnlink}
                />
              ))}
            </div>
          ) : null}

          {development.githubIssues.length > 0 ? (
            <div className='space-y-2'>
              <div className='text-muted-foreground text-xs font-medium tracking-wide uppercase'>
                GitHub Issues
              </div>
              {development.githubIssues.map(item => (
                <GitHubIssueRow
                  key={item._id}
                  item={item}
                  canEdit={canEdit}
                  busy={busyLinkId === String(item.linkId)}
                  onUnlink={handleUnlink}
                />
              ))}
            </div>
          ) : null}

          {development.commits.length > 0 ? (
            <div className='space-y-2'>
              <div className='text-muted-foreground text-xs font-medium tracking-wide uppercase'>
                Commits
              </div>
              {development.commits.map(item => (
                <CommitRow
                  key={item._id}
                  item={item}
                  canEdit={canEdit}
                  busy={busyLinkId === String(item.linkId)}
                  onUnlink={handleUnlink}
                />
              ))}
            </div>
          ) : null}

          {development.childCommitRollup.length > 0 ? (
            <div className='space-y-2'>
              <div className='text-muted-foreground text-xs font-medium tracking-wide uppercase'>
                Child Issue Commits
              </div>
              <div className='space-y-1 rounded-lg border p-2'>
                {development.childCommitRollup.map(item => (
                  <div
                    key={item.sha}
                    className='flex items-center justify-between gap-3 rounded-md px-1 py-1'
                  >
                    <div className='min-w-0 flex-1'>
                      <div className='flex items-center gap-2'>
                        <GitCommitHorizontal className='text-muted-foreground size-3.5 shrink-0' />
                        <Link
                          href={`/${orgSlug}/issues/${item.issueKey}`}
                          className='truncate text-sm font-medium'
                        >
                          {item.issueKey}
                        </Link>
                        <span className='text-muted-foreground truncate text-xs'>
                          {item.messageHeadline}
                        </span>
                      </div>
                      <div className='text-muted-foreground mt-1 flex flex-wrap items-center gap-2 pl-5 text-xs'>
                        <span className='font-mono'>{item.repository}</span>
                        <span className='font-mono'>{item.shortSha}</span>
                        <span>
                          {item.committedAt
                            ? formatDateHuman(new Date(item.committedAt))
                            : 'Commit time unavailable'}
                        </span>
                      </div>
                    </div>
                    <Link
                      href={item.url}
                      target='_blank'
                      rel='noreferrer'
                      className='hover:bg-muted inline-flex size-6 items-center justify-center rounded-[min(var(--radius-md),10px)] transition-colors'
                    >
                      <ExternalLink className='size-3.5' />
                    </Link>
                  </div>
                ))}
              </div>
            </div>
          ) : null}
        </div>
      )}
    </div>
  );
}
