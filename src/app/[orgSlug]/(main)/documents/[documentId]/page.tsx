'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useQuery, useMutation } from 'convex/react';
import { api } from '@/convex/_generated/api';
import { Skeleton } from '@/components/ui/skeleton';
import { ArrowLeft, FileText, Check, Loader2, Plus } from 'lucide-react';
import { MobileNavTrigger } from '../../layout';
import Link from 'next/link';
import { formatDateHuman } from '@/lib/date';
import { RichEditor } from '@/components/ui/rich-editor';
import { TeamSelector } from '@/components/issues/issue-selectors';
import {
  VisibilitySelector,
  type VisibilityState,
} from '@/components/ui/visibility-selector';
import { UserAvatar } from '@/components/user-avatar';
import { UserProfilePopover } from '@/components/user-profile-popover';
import { MentionClickHandler } from '@/components/mention-click-handler';
import { withIds } from '@/lib/convex-helpers';
import type { Id } from '@/convex/_generated/dataModel';
import {
  PermissionAwareSelector,
  useAccess,
  usePermissionCheck,
} from '@/components/ui/permission-aware';
import { PERMISSIONS } from '@/convex/_shared/permissions';
import { DocumentActivityFeed } from '@/components/activity/document-activity-feed';
import { IconPicker } from '@/components/ui/icon-picker';
import { DynamicIcon } from '@/lib/dynamic-icons';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { useOptimisticValue } from '@/hooks/use-optimistic';
import { DEFAULT_DOCUMENT_COLORS } from '@/convex/_shared/document_appearance';

interface DocumentDetailPageProps {
  params: Promise<{ orgSlug: string; documentId: string }>;
}

const DOCUMENT_COLOR_LABELS: Record<string, string> = {
  '#94a3b8': 'Slate',
  '#3b82f6': 'Blue',
  '#10b981': 'Emerald',
  '#f59e0b': 'Amber',
  '#ef4444': 'Red',
  '#8b5cf6': 'Violet',
  '#06b6d4': 'Cyan',
  '#6b7280': 'Gray',
};

function DocumentAppearanceSelector({
  icon,
  color,
  onIconChange,
  onColorChange,
}: {
  icon: string | null;
  color: string | null;
  onIconChange: (iconName: string | null) => void;
  onColorChange: (colorValue: string) => void;
}) {
  const { viewOnly } = useAccess();

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type='button'
          aria-label={
            icon
              ? 'Change document icon and color'
              : 'Set document icon and color'
          }
          className='focus-visible:ring-primary/50 flex size-5 items-center justify-center rounded-sm transition-opacity hover:opacity-80 focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none'
        >
          {icon ? (
            <DynamicIcon
              name={icon}
              fallback={FileText}
              className='size-3.5'
              style={{ color: color || undefined }}
            />
          ) : (
            <div className='border-muted-foreground/50 flex size-3.5 items-center justify-center rounded border border-dashed'>
              <Plus className='text-muted-foreground size-2' />
            </div>
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent className='w-80' align='start'>
        <div className='space-y-4'>
          <div>
            <h4 className='mb-2 text-sm font-medium'>Document Icon</h4>
            <IconPicker
              value={icon}
              onValueChange={onIconChange}
              placeholder='Select document icon'
              className='h-8 w-full'
            />
          </div>
          <div>
            <div className='mb-2 flex items-center justify-between gap-2'>
              <h4 className='text-sm font-medium'>Document Color</h4>
              {viewOnly ? (
                <span className='text-muted-foreground text-xs'>View only</span>
              ) : null}
            </div>
            <div className='flex flex-wrap gap-2'>
              {DEFAULT_DOCUMENT_COLORS.map(colorOption => (
                <button
                  key={colorOption}
                  type='button'
                  aria-label={`Set document color to ${DOCUMENT_COLOR_LABELS[colorOption] ?? colorOption}`}
                  aria-pressed={color === colorOption}
                  disabled={viewOnly}
                  className={`size-8 rounded-md border-2 transition-all ${
                    color === colorOption
                      ? 'border-foreground scale-110'
                      : 'border-border hover:scale-105'
                  } ${viewOnly ? 'cursor-not-allowed opacity-50 hover:scale-100' : ''}`}
                  style={{ backgroundColor: colorOption }}
                  onClick={() => {
                    if (!viewOnly) {
                      onColorChange(colorOption);
                    }
                  }}
                />
              ))}
            </div>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}

function DocumentLoadingSkeleton() {
  return (
    <div className='bg-background h-full overflow-y-auto'>
      <div className='h-full'>
        <div className='flex items-center justify-between border-b px-2'>
          <div className='flex h-8 items-center gap-2'>
            <Skeleton className='h-4 w-20' />
          </div>
        </div>
        <div className='mx-auto max-w-[720px] px-6 py-12 sm:px-8'>
          <Skeleton className='mb-2 h-8 w-2/3' />
          <Skeleton className='mb-8 h-3 w-40' />
          <div className='space-y-3'>
            <Skeleton className='h-4 w-full' />
            <Skeleton className='h-4 w-5/6' />
            <Skeleton className='h-4 w-4/5' />
            <Skeleton className='mt-6 h-4 w-full' />
            <Skeleton className='h-4 w-3/4' />
          </div>
        </div>
      </div>
    </div>
  );
}

/** Extract a title from markdown: prefer h1, then h2, etc., then first text line */
function extractTitle(markdown: string): string | null {
  for (let level = 1; level <= 6; level++) {
    const re = new RegExp(`^${'#'.repeat(level)}\\s+(.+)$`, 'm');
    const match = markdown.match(re);
    if (match) return match[1].trim() || null;
  }
  // Fall back to first non-empty text line
  const lines = markdown.split('\n');
  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed) return trimmed;
  }
  return null;
}

type SaveStatus = 'idle' | 'saving' | 'saved';

const HEARTBEAT_INTERVAL = 15_000; // 15 seconds

function useDocumentPresence(documentId: string | null) {
  const heartbeatMutation = useMutation(api.documents.presence.heartbeat);
  const leaveMutation = useMutation(api.documents.presence.leave);
  const viewers = useQuery(
    api.documents.presence.getViewers,
    documentId ? { documentId: documentId as Id<'documents'> } : 'skip',
  );

  useEffect(() => {
    if (!documentId) return;
    const docId = documentId as Id<'documents'>;

    // Initial heartbeat
    void heartbeatMutation({ documentId: docId });

    const interval = setInterval(() => {
      void heartbeatMutation({ documentId: docId });
    }, HEARTBEAT_INTERVAL);

    return () => {
      clearInterval(interval);
      void leaveMutation({ documentId: docId });
    };
  }, [documentId, heartbeatMutation, leaveMutation]);

  return viewers ?? [];
}

export default function DocumentDetailPage({
  params,
}: DocumentDetailPageProps) {
  const [resolvedParams, setResolvedParams] = useState<{
    orgSlug: string;
    documentId: string;
  } | null>(null);
  const [contentValue, setContentValue] = useState('');
  const [initialized, setInitialized] = useState(false);
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('idle');
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const savedTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const latestContentRef = useRef('');
  const isSavingRef = useRef(false);
  const documentIdRef = useRef<string | null>(null);

  useEffect(() => {
    void params.then(setResolvedParams);
  }, [params]);

  const document = useQuery(
    api.documents.queries.getById,
    resolvedParams
      ? { documentId: resolvedParams.documentId as Id<'documents'> }
      : 'skip',
  );

  const teamsData = useQuery(
    api.organizations.queries.listTeams,
    resolvedParams ? { orgSlug: resolvedParams.orgSlug } : 'skip',
  );
  const teams = teamsData ? withIds(teamsData) : [];

  const updateMutation = useMutation(api.documents.mutations.update);
  const viewers = useDocumentPresence(resolvedParams?.documentId ?? null);
  const [displayIcon, setOptimisticIcon] = useOptimisticValue(
    document?.icon ?? null,
  );
  const [displayColor, setOptimisticColor] = useOptimisticValue(
    document?.color ?? null,
  );

  const { isAllowed: canEdit } = usePermissionCheck(
    resolvedParams?.orgSlug || '',
    PERMISSIONS.DOCUMENT_EDIT,
  );

  // Initialize content from server once
  useEffect(() => {
    if (document && !initialized) {
      setContentValue(document.content || '');
      latestContentRef.current = document.content || '';
      documentIdRef.current = document._id;
      setInitialized(true);
    }
  }, [document, initialized]);

  const performSave = useCallback(
    async (content: string) => {
      if (!documentIdRef.current || isSavingRef.current) return;

      isSavingRef.current = true;
      setSaveStatus('saving');

      try {
        const updates: { content: string; title?: string } = { content };

        const inferred = extractTitle(content);
        if (inferred) {
          updates.title = inferred;
        } else {
          updates.title = 'Untitled';
        }

        await updateMutation({
          documentId: documentIdRef.current as Id<'documents'>,
          data: updates,
        });

        setSaveStatus('saved');
        if (savedTimerRef.current) clearTimeout(savedTimerRef.current);
        savedTimerRef.current = setTimeout(() => setSaveStatus('idle'), 2000);

        // If content changed while saving, save again
        if (latestContentRef.current !== content) {
          isSavingRef.current = false;
          void performSave(latestContentRef.current);
          return;
        }
      } catch {
        // Silently fail — user can keep typing and it'll retry
      } finally {
        isSavingRef.current = false;
      }
    },
    [updateMutation],
  );

  const scheduleAutoSave = useCallback(
    (content: string) => {
      latestContentRef.current = content;
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
      saveTimerRef.current = setTimeout(() => {
        void performSave(content);
      }, 1000);
    },
    [performSave],
  );

  // Flush pending save on unmount
  useEffect(() => {
    return () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
      if (savedTimerRef.current) clearTimeout(savedTimerRef.current);
    };
  }, []);

  const handleChange = (v: string) => {
    setContentValue(v);
    scheduleAutoSave(v);
  };

  if (!resolvedParams || document === undefined) {
    return <DocumentLoadingSkeleton />;
  }

  if (document === null) {
    return (
      <div className='flex h-full items-center justify-center'>
        <div className='text-center'>
          <FileText className='text-muted-foreground mx-auto mb-4 size-12' />
          <h2 className='text-lg font-medium'>Document not found</h2>
          <Link
            href={`/${resolvedParams.orgSlug}/documents`}
            className='text-primary mt-2 inline-block text-sm hover:underline'
          >
            Back to documents
          </Link>
        </div>
      </div>
    );
  }

  const handleTeamChange = (teamId: string) => {
    void updateMutation({
      documentId: document._id,
      data: { teamId: (teamId as Id<'teams'>) || null },
    });
  };

  const handleVisibilityChange = (visibility: VisibilityState) => {
    void updateMutation({
      documentId: document._id,
      data: { visibility },
    });
  };

  const handleIconChange = (iconName: string | null) => {
    setOptimisticIcon(iconName);
    void updateMutation({
      documentId: document._id,
      data: { icon: iconName },
    });
  };

  const handleColorChange = (color: string) => {
    setOptimisticColor(color);
    void updateMutation({
      documentId: document._id,
      data: { color },
    });
  };

  return (
    <div className='bg-background h-full overflow-y-auto'>
      <div className='h-full'>
        {/* Slim header bar */}
        <div className='bg-background/95 supports-[backdrop-filter]:bg-background/60 sticky top-0 z-10 flex items-center justify-between border-b px-2 backdrop-blur'>
          <div className='flex h-8 items-center gap-1.5'>
            <MobileNavTrigger />
            <Link
              href={`/${resolvedParams.orgSlug}/documents`}
              className='text-muted-foreground hover:text-foreground flex items-center gap-1.5 text-xs transition-colors'
            >
              <ArrowLeft className='size-3' />
              <span className='hidden sm:inline'>Documents</span>
            </Link>
            <span className='text-muted-foreground/50 hidden text-xs sm:inline'>
              /
            </span>
            <PermissionAwareSelector
              orgSlug={resolvedParams.orgSlug}
              permission={PERMISSIONS.DOCUMENT_EDIT}
              fallbackMessage="You don't have permission to change document appearance"
            >
              <DocumentAppearanceSelector
                icon={displayIcon}
                color={displayColor}
                onIconChange={handleIconChange}
                onColorChange={handleColorChange}
              />
            </PermissionAwareSelector>
            <span className='text-foreground hidden max-w-48 truncate text-xs font-medium sm:inline'>
              {document.title || 'Untitled'}
            </span>
            <TeamSelector
              teams={teams}
              selectedTeam={document.teamId || ''}
              onTeamSelect={canEdit ? handleTeamChange : () => {}}
              displayMode='iconWhenUnselected'
              className='border-none bg-transparent shadow-none'
            />
          </div>

          <div className='flex items-center gap-2'>
            {/* Live viewers */}
            {viewers.length > 0 && (
              <div className='flex -space-x-1.5'>
                {viewers.slice(0, 5).map(viewer =>
                  viewer ? (
                    <UserProfilePopover
                      key={viewer._id}
                      name={viewer.name}
                      email={viewer.email}
                      image={viewer.image}
                      userId={viewer._id}
                      side='bottom'
                      align='end'
                    >
                      <button
                        type='button'
                        className='focus-visible:ring-primary/50 relative cursor-pointer rounded-full focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none'
                      >
                        <UserAvatar
                          name={viewer.name}
                          email={viewer.email}
                          image={viewer.image}
                          userId={viewer._id}
                          size='sm'
                          className='ring-background size-5 ring-[1.5px]'
                        />
                      </button>
                    </UserProfilePopover>
                  ) : null,
                )}
                {viewers.length > 5 && (
                  <div className='ring-background bg-muted text-muted-foreground flex size-5 items-center justify-center rounded-full text-[9px] ring-[1.5px]'>
                    +{viewers.length - 5}
                  </div>
                )}
              </div>
            )}

            {saveStatus === 'saving' && (
              <span className='text-muted-foreground flex items-center gap-1 text-xs'>
                <Loader2 className='size-3 animate-spin' />
              </span>
            )}
            {saveStatus === 'saved' && (
              <span className='text-muted-foreground flex items-center gap-1 text-xs'>
                <Check className='size-3' />
              </span>
            )}
            <span className='text-muted-foreground hidden text-xs sm:inline'>
              {formatDateHuman(
                new Date(document.lastEditedAt || document._creationTime),
              )}
            </span>
            <VisibilitySelector
              value={(document.visibility as VisibilityState) || 'organization'}
              onValueChange={canEdit ? handleVisibilityChange : () => {}}
              displayMode='iconWhenUnselected'
              className='border-none bg-transparent shadow-none'
            />
          </div>
        </div>

        {/* Full-page editor */}
        <div className='mx-auto max-w-[720px] px-6 py-10 sm:px-8 sm:py-14'>
          <MentionClickHandler>
            <div className='document-prose'>
              <RichEditor
                value={contentValue}
                onChange={handleChange}
                mode='full'
                disabled={!canEdit}
                placeholder='Start writing... Use headings, lists, and more.'
                orgSlug={resolvedParams.orgSlug}
                className='notion-editor'
              />
            </div>
          </MentionClickHandler>

          {/* Activity Feed */}
          <div className='mt-20 border-t pt-8'>
            <DocumentActivityFeed
              orgSlug={resolvedParams.orgSlug}
              documentId={document._id}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
