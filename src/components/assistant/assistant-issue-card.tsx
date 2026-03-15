'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useMutation, useQuery } from 'convex/react';
import { api } from '@/lib/convex';
import { DynamicIcon } from '@/lib/dynamic-icons';
import { Circle } from 'lucide-react';
import type { Id } from '@/convex/_generated/dataModel';
import { Button } from '@/components/ui/button';
import {
  PrioritySelector,
  StateSelector,
  MultiAssigneeSelector,
} from '@/components/issues/issue-selectors';
import { PermissionAware } from '@/components/ui/permission-aware';
import { PERMISSIONS } from '@/convex/_shared/permissions';
import { useOptimisticValue } from '@/hooks/use-optimistic';

export function AssistantIssueCard({ issueKey }: { issueKey: string }) {
  const params = useParams();
  const orgSlug = params.orgSlug as string;

  const issue = useQuery(api.issues.queries.getByKey, { orgSlug, issueKey });
  const assignments = useQuery(
    api.issues.queries.getAssignments,
    issue ? { issueId: issue._id } : 'skip',
  );
  const states = useQuery(api.organizations.queries.listIssueStates, {
    orgSlug,
  });
  const priorities = useQuery(api.organizations.queries.listIssuePriorities, {
    orgSlug,
  });
  const user = useQuery(api.users.currentUser);

  const changePriority = useMutation(api.issues.mutations.changePriority);
  const changeAssignmentState = useMutation(
    api.issues.mutations.changeWorkflowState,
  );
  const updateAssignees = useMutation(api.issues.mutations.updateAssignees);
  const assigneeIds = (assignments ?? [])
    .map(a => a.assignee?._id)
    .filter((id): id is Id<'users'> => Boolean(id));
  const serverPriorityId =
    issue && issue !== null ? (issue.priorityId ?? '') : '';
  const serverStateId =
    issue && issue !== null ? (issue.workflowStateId ?? '') : '';
  const serverAssigneeIds = assigneeIds.map(String);
  const [displayPriorityId, setDisplayPriorityId] =
    useOptimisticValue(serverPriorityId);
  const [displayStateId, setDisplayStateId] = useOptimisticValue(serverStateId);
  const [displayAssigneeIdsKey, setDisplayAssigneeIdsKey] = useOptimisticValue(
    serverAssigneeIds.join(','),
  );
  const displayAssigneeIds = displayAssigneeIdsKey
    ? displayAssigneeIdsKey.split(',').filter(Boolean)
    : [];
  const displayPriority = priorities?.find(
    priority => priority._id === displayPriorityId,
  );
  const displayState = states?.find(state => state._id === displayStateId);

  if (issue === undefined) {
    return (
      <div className='bg-muted/30 flex animate-pulse items-center gap-2.5 rounded-lg border px-3 py-2'>
        <div className='bg-muted size-4 rounded' />
        <div className='bg-muted h-3 w-12 rounded' />
        <div className='bg-muted h-3 flex-1 rounded' />
      </div>
    );
  }

  if (issue === null) {
    return (
      <div className='bg-muted/20 text-muted-foreground flex items-center gap-2.5 rounded-lg border border-dashed px-3 py-2 text-xs'>
        <Circle className='size-3.5 shrink-0' />
        <span className='shrink-0 font-mono text-[11px]'>{issueKey}</span>
        <span className='min-w-0 flex-1 truncate'>Issue probably deleted</span>
      </div>
    );
  }

  const priorityColor = issue.priority?.color ?? '#94a3b8';
  const priorityIcon = issue.priority?.icon;

  return (
    <div className='bg-background hover:bg-muted/30 flex items-center gap-2.5 rounded-lg border px-3 py-2 transition-colors'>
      {/* Priority selector */}
      <PermissionAware
        orgSlug={orgSlug}
        permission={PERMISSIONS.ISSUE_PRIORITY_UPDATE}
        fallbackMessage='No permission to change priority'
      >
        <PrioritySelector
          priorities={(priorities ?? []) as never[]}
          selectedPriority={displayPriorityId}
          onPrioritySelect={pid => {
            setDisplayPriorityId(pid);
            void changePriority({
              issueId: issue._id,
              priorityId: pid as Id<'issuePriorities'>,
            });
          }}
          displayMode='iconOnly'
          trigger={
            <Button
              variant='ghost'
              size='icon'
              className='size-6 shrink-0 rounded-md'
              aria-label='Change issue priority'
            >
              {(displayPriority?.icon ?? priorityIcon) ? (
                <DynamicIcon
                  name={displayPriority?.icon ?? priorityIcon}
                  className='size-3.5'
                  style={{ color: displayPriority?.color ?? priorityColor }}
                />
              ) : (
                <Circle
                  className='size-3.5'
                  style={{ color: displayPriority?.color ?? priorityColor }}
                />
              )}
            </Button>
          }
        />
      </PermissionAware>

      {/* Issue key */}
      <span className='text-muted-foreground shrink-0 font-mono text-[11px]'>
        {issue.key}
      </span>

      {/* State selector */}
      {states ? (
        <PermissionAware
          orgSlug={orgSlug}
          permission={PERMISSIONS.ISSUE_EDIT}
          fallbackMessage='No permission to change state'
        >
          <StateSelector
            states={(states ?? []) as never[]}
            selectedState={displayStateId}
            onStateSelect={stateId => {
              setDisplayStateId(stateId);
              void changeAssignmentState({
                issueId: issue._id,
                stateId: stateId as Id<'issueStates'>,
              });
            }}
            displayMode='iconOnly'
            trigger={
              <Button
                variant='ghost'
                size='icon'
                className='size-6 shrink-0 rounded-md'
                aria-label='Change issue state'
              >
                <DynamicIcon
                  name={displayState?.icon ?? issue.workflowState?.icon}
                  className='size-3.5'
                  style={{
                    color:
                      displayState?.color ??
                      issue.workflowState?.color ??
                      '#94a3b8',
                  }}
                />
              </Button>
            }
          />
        </PermissionAware>
      ) : null}

      {/* Title — links to issue page */}
      <Link
        href={`/${orgSlug}/issues/${issue.key}`}
        className='hover:text-primary min-w-0 flex-1 truncate text-sm font-medium transition-colors'
      >
        {issue.title}
      </Link>

      {/* Project badge */}
      {issue.project ? (
        <span className='text-muted-foreground/60 hidden shrink-0 text-[10px] sm:block'>
          {issue.project.name}
        </span>
      ) : null}

      {/* Assignee selector */}
      <PermissionAware
        orgSlug={orgSlug}
        permission={PERMISSIONS.ISSUE_EDIT}
        fallbackMessage='No permission to change assignees'
      >
        <MultiAssigneeSelector
          orgSlug={orgSlug}
          selectedAssigneeIds={displayAssigneeIds}
          onAssigneesChange={ids => {
            setDisplayAssigneeIdsKey(ids.join(','));
            void updateAssignees({
              issueId: issue._id,
              assigneeIds: ids as Id<'users'>[],
            });
          }}
          isLoading={false}
          assignments={(assignments ?? []).map(a => ({
            assignmentId: String(a._id),
            assigneeId: a.assignee?._id ? String(a.assignee._id) : null,
            assigneeName: a.assignee?.name ?? null,
            assigneeEmail: a.assignee?.email ?? null,
            assigneeImage: a.assignee?.image ?? null,
            stateId: a.state?._id ? String(a.state._id) : null,
            stateIcon: a.state?.icon ?? null,
            stateColor: a.state?.color ?? null,
            stateName: a.state?.name ?? null,
            stateType: a.state?.type ?? null,
          }))}
          activeFilter='all'
          currentUserId={user?._id ? String(user._id) : ''}
          canManageAll={false}
        />
      </PermissionAware>
    </div>
  );
}
