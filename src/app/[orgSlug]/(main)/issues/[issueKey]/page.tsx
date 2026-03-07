'use client';

import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Skeleton } from '@/components/ui/skeleton';
import { ArrowLeft, Circle, Save, X, Pencil } from 'lucide-react';
import { useQuery, useMutation } from 'convex/react';
import { api } from '@/convex/_generated/api';
import { formatDateHuman } from '@/lib/date';
import Link from 'next/link';
import { cn } from '@/lib/utils';
import type { Id } from '@/convex/_generated/dataModel';

// Re-use shared issue selectors
import { IssueAssignments } from '@/components/issues/issue-assignments';
import {
  TeamSelector,
  ProjectSelector,
  StateSelector,
  PrioritySelector,
  IssueSelector,
} from '@/components/issues/issue-selectors';
import { getDynamicIcon } from '@/lib/dynamic-icons';
import {
  VisibilitySelector,
  type VisibilityState,
} from '@/components/ui/visibility-selector';
import {
  usePermissionCheck,
  PermissionAwareWrapper,
  PermissionAwareSelector,
} from '@/components/ui/permission-aware';
import { PERMISSIONS } from '@/convex/_shared/permissions';

interface IssueViewPageProps {
  params: Promise<{ orgSlug: string; issueKey: string }>;
}

// Loading skeleton component that matches the actual layout
function IssueLoadingSkeleton() {
  return (
    <div className='bg-background h-full overflow-y-auto'>
      <div className='h-full'>
        <div>
          {/* Header Skeleton */}
          <div className='bg-background/95 supports-[backdrop-filter]:bg-background/60 flex items-center justify-between border-b px-2 backdrop-blur'>
            <div className='flex h-8 flex-wrap items-center gap-2'>
              <div className='text-muted-foreground hover:text-foreground flex items-center gap-2 text-sm transition-colors'>
                <ArrowLeft className='size-3' />
                Issues
              </div>
              <div className='flex items-center gap-2'>
                <Skeleton className='h-6 w-16' />
                <div className='bg-muted-foreground/20 h-4 w-px' />
                <Skeleton className='h-6 w-20' />
              </div>
              <span className='text-muted-foreground text-sm'>/</span>
              <Skeleton className='h-4 w-12' />
            </div>

            <div className='flex items-center gap-2'>
              <Skeleton className='h-6 w-20' />
              <div className='bg-muted-foreground/20 h-4 w-px' />
              <Skeleton className='h-6 w-16' />
              <div className='bg-muted-foreground/20 h-4 w-px' />
              <Skeleton className='h-6 w-8 rounded-full' />
            </div>
          </div>

          {/* Main Content Skeleton */}
          <div className='mx-auto max-w-5xl px-4 py-4'>
            {/* Issue Header Skeleton */}
            <div className='mb-2 max-w-4xl space-y-2'>
              <div className='flex items-center gap-2'>
                <Skeleton className='h-3 w-16' />
                <span>•</span>
                <Skeleton className='h-3 w-24' />
              </div>

              {/* Title Skeleton */}
              <Skeleton className='h-9 w-3/4' />
            </div>

            {/* Description Skeleton */}
            <div className='mb-8 space-y-3'>
              <Skeleton className='h-4 w-full' />
              <Skeleton className='h-4 w-5/6' />
              <Skeleton className='h-4 w-4/5' />
              <Skeleton className='h-4 w-3/4' />
            </div>

            {/* Activity Section Skeleton */}
            <div>
              <Skeleton className='mb-2 h-5 w-16' />
              <div className='rounded-lg border p-8'>
                <div className='flex flex-col items-center gap-2'>
                  <Skeleton className='h-4 w-48' />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function IssueViewPage({ params }: IssueViewPageProps) {
  const [resolvedParams, setResolvedParams] = useState<{
    orgSlug: string;
    issueKey: string;
  } | null>(null);
  const [editingTitle, setEditingTitle] = useState(false);
  const [titleValue, setTitleValue] = useState('');
  const [editingDescription, setEditingDescription] = useState(false);
  const [descriptionValue, setDescriptionValue] = useState('');
  const [editingEstimates, setEditingEstimates] = useState<
    Record<string, boolean>
  >({});
  const [estimatesValue, setEstimatesValue] = useState<Record<string, number>>(
    {},
  );
  const [currentStateId, setCurrentStateId] = useState<string>('');

  useEffect(() => {
    void params.then(setResolvedParams);
  }, [params]);

  const user = useQuery(api.users.currentUser);

  const [isUpdatingTitle, setIsUpdatingTitle] = useState(false);
  const [isUpdatingDescription, setIsUpdatingDescription] = useState(false);
  const [isUpdatingEstimates, setIsUpdatingEstimates] = useState(false);

  const issue = useQuery(
    api.issues.queries.getByKey,
    resolvedParams
      ? { orgSlug: resolvedParams.orgSlug, issueKey: resolvedParams.issueKey }
      : 'skip',
  );

  const states = useQuery(
    api.organizations.queries.listIssueStates,
    resolvedParams ? { orgSlug: resolvedParams.orgSlug } : 'skip',
  );
  const members = useQuery(
    api.organizations.queries.listMembers,
    resolvedParams ? { orgSlug: resolvedParams.orgSlug } : 'skip',
  );
  const teams = useQuery(
    api.organizations.queries.listTeams,
    resolvedParams ? { orgSlug: resolvedParams.orgSlug } : 'skip',
  );
  const projects = useQuery(
    api.organizations.queries.listProjects,
    resolvedParams ? { orgSlug: resolvedParams.orgSlug } : 'skip',
  );
  const priorities = useQuery(
    api.organizations.queries.listIssuePriorities,
    resolvedParams ? { orgSlug: resolvedParams.orgSlug } : 'skip',
  );

  const updateTitleMutation = useMutation(api.issues.mutations.updateTitle);
  const updateDescriptionMutation = useMutation(
    api.issues.mutations.updateDescription,
  );
  const updateEstimatesMutation = useMutation(
    api.issues.mutations.updateEstimatedTimes,
  );
  const changeTeamMutation = useMutation(api.issues.mutations.changeTeam);
  const changeProjectMutation = useMutation(api.issues.mutations.changeProject);
  const changePriorityMutation = useMutation(
    api.issues.mutations.changePriority,
  );
  const changeAssignmentStateMutation = useMutation(
    api.issues.mutations.changeAssignmentState,
  );
  const changeVisibilityMutation = useMutation(
    api.issues.mutations.changeVisibility,
  );
  const updateIssueParentMutation = useMutation(api.issues.mutations.update);

  const assignments = useQuery(
    api.issues.queries.getAssignments,
    issue?._id ? { issueId: issue._id } : 'skip',
  );

  const currentUserAssignment = assignments?.find(
    assignment => assignment.assigneeId === user?._id,
  ); // Permission checks for issue editing
  const { isAllowed: canEditIssue } = usePermissionCheck(
    resolvedParams?.orgSlug || '',
    PERMISSIONS.ISSUE_EDIT,
  );

  const { isAllowed: canEditPriority } = usePermissionCheck(
    resolvedParams?.orgSlug || '',
    PERMISSIONS.ISSUE_PRIORITY_UPDATE,
  );

  const { isAllowed: canEditVisibility } = usePermissionCheck(
    resolvedParams?.orgSlug || '',
    PERMISSIONS.ISSUE_EDIT,
  );

  const { isAllowed: canChangeTeam } = usePermissionCheck(
    resolvedParams?.orgSlug || '',
    PERMISSIONS.ISSUE_RELATION_UPDATE,
  );

  const { isAllowed: canChangeProject } = usePermissionCheck(
    resolvedParams?.orgSlug || '',
    PERMISSIONS.ISSUE_RELATION_UPDATE,
  );

  useEffect(() => {
    if (assignments && assignments.length > 0) {
      setCurrentStateId(assignments[0].stateId);
    }
  }, [assignments]);

  useEffect(() => {
    if (issue) {
      setTitleValue(issue.title);
      setDescriptionValue(issue.description || '');
    }
  }, [issue]);

  useEffect(() => {
    if (Object.keys(editingEstimates).length > 0 && issue?.estimatedTimes) {
      setEstimatesValue(issue.estimatedTimes as Record<string, number>);
    }
  }, [editingEstimates, issue?.estimatedTimes]);

  const estimateStates =
    states?.filter(state => ['done'].includes(state.type)) || [];

  if (!resolvedParams || !issue || !states) {
    return <IssueLoadingSkeleton />;
  }

  const handleTitleSave = async () => {
    if (!user) return;
    setIsUpdatingTitle(true);
    try {
      await updateTitleMutation({
        issueId: issue._id,
        title: titleValue.trim(),
      });
      setEditingTitle(false);
    } finally {
      setIsUpdatingTitle(false);
    }
  };

  const handleDescriptionSave = async () => {
    if (!user) return;
    setIsUpdatingDescription(true);
    try {
      await updateDescriptionMutation({
        issueId: issue._id,
        description: descriptionValue.trim() || null,
      });
      setEditingDescription(false);
    } finally {
      setIsUpdatingDescription(false);
    }
  };

  const handleEstimatesSave = async () => {
    if (!issue || !user) return;
    setIsUpdatingEstimates(true);
    try {
      await updateEstimatesMutation({
        issueId: issue._id,
        estimatedTimes:
          Object.keys(estimatesValue).length > 0 ? estimatesValue : undefined,
      });
      setEditingEstimates({});
    } finally {
      setIsUpdatingEstimates(false);
    }
  };

  const handleTeamChange = (teamId: string) => {
    if (!issue || !user) return;
    void changeTeamMutation({
      issueId: issue._id,
      teamId: (teamId as Id<'teams'>) || null,
    });
  };

  const handleProjectChange = (projectId: string) => {
    if (!issue || !user) return;
    void changeProjectMutation({
      issueId: issue._id,
      projectId: (projectId as Id<'projects'>) || null,
    });
  };

  const handlePriorityChange = (priorityId: string) => {
    if (!issue || !user) return;
    if (priorityId === '') return;
    void changePriorityMutation({
      issueId: issue._id,
      priorityId: priorityId as Id<'issuePriorities'>,
    });
  };

  const handleVisibilityChange = async (visibility: VisibilityState) => {
    if (!issue) return;
    await changeVisibilityMutation({
      issueId: issue._id,
      visibility,
    });
  };

  const handleParentIssueChange = (parentIssueId: string) => {
    if (!issue || !user) return;
    void updateIssueParentMutation({
      issueId: issue._id,
      data: {
        parentIssueId: parentIssueId
          ? (parentIssueId as Id<'issues'>)
          : undefined,
      },
    });
  };

  return (
    <div className='bg-background h-full overflow-y-auto'>
      {/* Page Grid: main area + sidebar */}
      <div className='flex h-full'>
        {/* LEFT COLUMN - Main Content */}
        <div className='min-w-0 flex-1'>
          {/* Header */}
          <div className='bg-background/95 supports-[backdrop-filter]:bg-background/60 flex items-center justify-between border-b px-2 backdrop-blur'>
            <div className='flex h-8 flex-wrap items-center gap-2'>
              <Link
                href={`/${resolvedParams.orgSlug}/issues`}
                className='text-muted-foreground hover:text-foreground flex items-center gap-2 text-sm transition-colors'
              >
                <ArrowLeft className='size-3' />
                Issues
              </Link>
              <div className='flex items-center'>
                {/* Team & Project selectors */}
                <PermissionAwareSelector
                  orgSlug={resolvedParams.orgSlug}
                  permission={PERMISSIONS.ISSUE_RELATION_UPDATE}
                  fallbackMessage="You don't have permission to change issue team"
                >
                  <TeamSelector
                    teams={teams ?? []}
                    selectedTeam={issue.teamId || ''}
                    onTeamSelect={canChangeTeam ? handleTeamChange : () => {}}
                    displayMode='iconWhenUnselected'
                    className='border-none bg-transparent shadow-none'
                  />
                </PermissionAwareSelector>
                <PermissionAwareSelector
                  orgSlug={resolvedParams.orgSlug}
                  permission={PERMISSIONS.ISSUE_RELATION_UPDATE}
                  fallbackMessage="You don't have permission to change issue project"
                >
                  <ProjectSelector
                    projects={projects ?? []}
                    selectedProject={issue.projectId || ''}
                    onProjectSelect={
                      canChangeProject ? handleProjectChange : () => {}
                    }
                    displayMode='iconWhenUnselected'
                    className='border-none bg-transparent shadow-none'
                  />
                </PermissionAwareSelector>
                <PermissionAwareSelector
                  orgSlug={resolvedParams.orgSlug}
                  permission={PERMISSIONS.ISSUE_RELATION_UPDATE}
                  fallbackMessage="You don't have permission to change parent issue"
                >
                  <IssueSelector
                    orgSlug={resolvedParams.orgSlug}
                    selectedIssue={issue.parentIssueId || ''}
                    onIssueSelect={
                      canChangeProject ? handleParentIssueChange : () => {}
                    }
                    excludeIssueId={issue._id}
                    displayMode='iconWhenUnselected'
                    className='border-none bg-transparent shadow-none'
                  />
                </PermissionAwareSelector>
              </div>
              <span className='text-muted-foreground text-sm'>/</span>
              <span className='text-sm font-medium'>{issue.key}</span>
            </div>

            <div className='flex items-center'>
              {/* Only show state selector if current user is assigned - they can change their own assignment status */}
              {currentUserAssignment && (
                <>
                  <StateSelector
                    states={states ?? []}
                    selectedState={currentUserAssignment.stateId}
                    onStateSelect={stateId => {
                      if (!issue || !user) return;
                      // Update the specific assignment state for this user
                      void changeAssignmentStateMutation({
                        assignmentId: currentUserAssignment._id,
                        stateId: stateId as Id<'issueStates'>,
                      });
                    }}
                    className='border-none bg-transparent shadow-none'
                  />
                  <div className='bg-muted-foreground/20 h-4 w-px' />
                </>
              )}

              <PermissionAwareSelector
                orgSlug={resolvedParams.orgSlug}
                permission={PERMISSIONS.ISSUE_PRIORITY_UPDATE}
                fallbackMessage="You don't have permission to change issue priority"
              >
                <PrioritySelector
                  priorities={priorities ?? []}
                  selectedPriority={issue.priorityId || ''}
                  onPrioritySelect={
                    canEditPriority ? handlePriorityChange : () => {}
                  }
                  className='border-none bg-transparent shadow-none'
                />
              </PermissionAwareSelector>
              <div className='bg-muted-foreground/20 h-4 w-px' />
              <PermissionAwareSelector
                orgSlug={resolvedParams.orgSlug}
                permission={PERMISSIONS.ISSUE_EDIT}
                fallbackMessage="You don't have permission to change issue visibility"
              >
                <VisibilitySelector
                  value={issue.visibility as VisibilityState}
                  onValueChange={
                    canEditVisibility ? handleVisibilityChange : () => {}
                  }
                  displayMode='iconWhenUnselected'
                  className='border-none bg-transparent shadow-none'
                />
              </PermissionAwareSelector>
            </div>
          </div>

          {/* Main Content */}
          <div className='mx-auto max-w-5xl px-4 py-4'>
            {/* Issue Header */}
            <div className='mb-2 max-w-4xl space-y-2'>
              <div className='text-muted-foreground flex items-center gap-2 text-xs'>
                <span className='font-mono'>{issue.key}</span>
                <span>•</span>
                <span>
                  Updated {formatDateHuman(new Date(issue._creationTime))}
                </span>
              </div>

              {/* Title */}
              {editingTitle ? (
                <div className='flex items-center gap-2'>
                  <Input
                    value={titleValue}
                    onChange={e => setTitleValue(e.target.value)}
                    className='h-auto border-none p-0 !text-3xl !leading-tight font-semibold shadow-none focus-visible:ring-0'
                    style={{ fontFamily: 'var(--font-title)' }}
                    onKeyDown={e => {
                      if (e.key === 'Enter') void handleTitleSave();
                      if (e.key === 'Escape') {
                        setTitleValue(issue.title);
                        setEditingTitle(false);
                      }
                    }}
                    autoFocus
                  />
                  <div className='flex items-center gap-1'>
                    <Button
                      size='sm'
                      onClick={handleTitleSave}
                      disabled={isUpdatingTitle || !titleValue.trim()}
                    >
                      <Save className='size-4' />
                    </Button>
                    <Button
                      size='sm'
                      variant='ghost'
                      onClick={() => {
                        setTitleValue(issue.title);
                        setEditingTitle(false);
                      }}
                    >
                      <X className='size-4' />
                    </Button>
                  </div>
                </div>
              ) : (
                <PermissionAwareWrapper
                  orgSlug={resolvedParams.orgSlug}
                  permission={PERMISSIONS.ISSUE_EDIT}
                  fallbackMessage="You don't have permission to edit issue title"
                >
                  <h1
                    className={cn(
                      canEditIssue
                        ? 'hover:text-muted-foreground cursor-pointer text-3xl leading-tight font-semibold transition-colors'
                        : 'text-3xl leading-tight font-semibold',
                    )}
                    onClick={
                      canEditIssue ? () => setEditingTitle(true) : undefined
                    }
                  >
                    {issue.title}
                  </h1>
                </PermissionAwareWrapper>
              )}
            </div>

            {/* Schedule Info */}
            <div className='flex items-center gap-4'>
              {(issue.startDate || issue.dueDate) && (
                <div className='text-muted-foreground flex items-center gap-2 text-sm'>
                  <span>Schedule:</span>
                  {issue.startDate && (
                    <span>From {formatDateHuman(issue.startDate)}</span>
                  )}
                  {issue.startDate && issue.dueDate && <span>→</span>}
                  {issue.dueDate && (
                    <span
                      className={cn(
                        'font-medium',
                        new Date(issue.dueDate) < new Date() &&
                          states &&
                          !['done'].includes(
                            states.find(s => s._id === currentStateId)?.type ||
                              '',
                          )
                          ? 'text-red-500 dark:text-red-400'
                          : '',
                      )}
                    >
                      Due {formatDateHuman(issue.dueDate)}
                    </span>
                  )}
                </div>
              )}
            </div>

            {/* Description */}
            <div className='mb-8'>
              {editingDescription ? (
                <div className='space-y-4'>
                  <Textarea
                    value={descriptionValue}
                    onChange={e => setDescriptionValue(e.target.value)}
                    placeholder='Add a description...'
                    className='min-h-[120px] resize-none text-base'
                    onKeyDown={e => {
                      if (e.key === 'Escape') {
                        setDescriptionValue(issue.description || '');
                        setEditingDescription(false);
                      }
                    }}
                    autoFocus
                  />
                  <div className='flex items-center gap-3'>
                    <Button
                      onClick={handleDescriptionSave}
                      disabled={isUpdatingDescription}
                    >
                      <Save className='mr-2 size-4' />
                      Save
                    </Button>
                    <Button
                      variant='outline'
                      onClick={() => {
                        setDescriptionValue(issue.description || '');
                        setEditingDescription(false);
                      }}
                    >
                      Cancel
                    </Button>
                  </div>
                </div>
              ) : (
                <PermissionAwareWrapper
                  orgSlug={resolvedParams.orgSlug}
                  permission={PERMISSIONS.ISSUE_EDIT}
                  fallbackMessage="You don't have permission to edit issue description"
                >
                  <div>
                    {issue.description ? (
                      <div
                        className={cn(
                          canEditIssue
                            ? 'prose prose-sm text-muted-foreground hover:text-foreground max-w-none cursor-pointer transition-colors'
                            : 'prose prose-sm text-muted-foreground max-w-none',
                        )}
                        onClick={
                          canEditIssue
                            ? () => setEditingDescription(true)
                            : undefined
                        }
                      >
                        <p className='whitespace-pre-wrap'>
                          {issue.description}
                        </p>
                      </div>
                    ) : (
                      <button
                        className={cn(
                          'w-full rounded-lg border-2 border-dashed bg-transparent p-4 text-left text-base',
                          canEditIssue
                            ? 'text-muted-foreground hover:text-foreground border-muted-foreground/20 hover:border-muted-foreground/40 cursor-pointer'
                            : 'text-muted-foreground border-muted-foreground/20 cursor-not-allowed opacity-50',
                        )}
                        onClick={
                          canEditIssue
                            ? () => setEditingDescription(true)
                            : undefined
                        }
                        disabled={!canEditIssue}
                      >
                        Add a description...
                      </button>
                    )}
                  </div>
                </PermissionAwareWrapper>
              )}
            </div>

            {/* Sub-Issues */}
            <div>
              <div className='mb-2 flex items-center justify-between'>
                <h2 className='text-sm font-semibold'>Sub-Issues</h2>
                <PermissionAwareWrapper
                  orgSlug={resolvedParams.orgSlug}
                  permission={PERMISSIONS.ISSUE_CREATE}
                  fallbackMessage="You don't have permission to create sub-issues"
                >
                  <Button
                    size='sm'
                    variant='outline'
                    onClick={() => {
                      // TODO: Open create issue dialog with this issue as parent
                      console.log('Create sub-issue for', issue.key);
                    }}
                    className='h-6 text-xs'
                  >
                    + Add Sub-Issue
                  </Button>
                </PermissionAwareWrapper>
              </div>
              {issue.children && issue.children.length > 0 ? (
                <div className='space-y-1'>
                  {issue.children.map(child => {
                    const childPriorityIcon = child.priority?.icon
                      ? getDynamicIcon(child.priority.icon)
                      : Circle;
                    const childPriorityColor =
                      child.priority?.color || '#94a3b8';

                    return (
                      <Link
                        key={child._id}
                        href={`/${resolvedParams.orgSlug}/issues/${child.key}`}
                        className='hover:bg-muted/50 group flex items-center gap-3 rounded-md border p-2 transition-colors'
                      >
                        {/* Priority indicator */}
                        <div className='flex-shrink-0'>
                          {childPriorityIcon ? (
                            React.createElement(childPriorityIcon, {
                              className: 'h-3 w-3',
                              style: { color: childPriorityColor },
                            })
                          ) : (
                            <Circle
                              className='h-3 w-3'
                              style={{ color: childPriorityColor }}
                            />
                          )}
                        </div>

                        {/* Issue key */}
                        <span className='text-muted-foreground flex-shrink-0 font-mono text-xs'>
                          {child.key}
                        </span>

                        {/* Title */}
                        <span className='group-hover:text-foreground truncate text-sm'>
                          {child.title}
                        </span>

                        {/* Status indicator if available */}
                        {child.state && (
                          <div className='ml-auto flex-shrink-0'>
                            <div
                              className='h-2 w-2 rounded-full'
                              style={{ backgroundColor: child.state.color }}
                              title={child.state.name}
                            />
                          </div>
                        )}
                      </Link>
                    );
                  })}
                </div>
              ) : (
                <div className='text-muted-foreground py-2 text-sm'>
                  No sub-issues yet. Create one to break down this issue into
                  smaller tasks.
                </div>
              )}
            </div>

            {/* Activity Feed */}
            <div>
              <h2 className='mb-2 text-sm font-semibold'>Activity</h2>
              <div className='text-muted-foreground rounded-lg border p-8 text-center'>
                Activity feed coming soon...
              </div>
            </div>
          </div>
        </div>

        {/* RIGHT SIDEBAR - Assignments */}
        <div className='bg-background w-80 overflow-y-auto border-l'>
          <div className='flex h-full flex-col'>
            {/* Assignments Section with max height */}
            <div className='max-h-96 overflow-y-auto'>
              {states && members && (
                <IssueAssignments
                  orgSlug={resolvedParams.orgSlug}
                  issueId={issue._id}
                  states={states}
                  members={members}
                  defaultStateId={
                    states?.find(s => s.type === 'todo')?._id ||
                    states?.[0]?._id ||
                    undefined
                  }
                />
              )}
            </div>

            {/* Time Estimates Section */}
            {estimateStates.length > 0 && (
              <div className='border-t'>
                <div className='flex items-center justify-between border-b px-1 py-1 pl-2'>
                  <h4 className='text-sm'>Time Estimates</h4>
                </div>

                <div className='divide-y'>
                  {estimateStates.map(state => {
                    const StateIcon = getDynamicIcon(state.icon) || Circle;
                    const hours = (
                      issue?.estimatedTimes as Record<string, number>
                    )?.[state._id];
                    const isEditing = editingEstimates[state._id];

                    return (
                      <div key={state._id}>
                        <div className='flex h-10 items-center justify-between px-2 py-2'>
                          {/* State icon and name - consistent across both states */}
                          <div className='flex items-center gap-2'>
                            <StateIcon
                              className='size-4'
                              style={{
                                color: state.color || 'currentColor',
                              }}
                            />
                            <span className='text-sm'>{state.name}</span>
                          </div>

                          {/* Right side - changes based on edit state */}
                          {isEditing ? (
                            <div className='flex items-center gap-1'>
                              <Input
                                type='number'
                                min='0'
                                step='0.5'
                                placeholder='Hours'
                                className='h-7 w-20 text-sm'
                                value={estimatesValue[state._id] || ''}
                                onChange={e => {
                                  const value = parseFloat(e.target.value);
                                  setEstimatesValue(prev => ({
                                    ...prev,
                                    [state._id]: isNaN(value) ? 0 : value,
                                  }));
                                }}
                                onKeyDown={e => {
                                  if (e.key === 'Enter') {
                                    void handleEstimatesSave();
                                  }
                                  if (e.key === 'Escape') {
                                    setEstimatesValue(
                                      (issue?.estimatedTimes as Record<
                                        string,
                                        number
                                      >) || {},
                                    );
                                    setEditingEstimates(prev => ({
                                      ...prev,
                                      [state._id]: false,
                                    }));
                                  }
                                }}
                                autoFocus
                              />
                              <Button
                                size='sm'
                                className='h-7 w-7 cursor-pointer p-0'
                                onClick={handleEstimatesSave}
                                disabled={isUpdatingEstimates}
                              >
                                <Save className='h-3 w-3' />
                              </Button>
                              <Button
                                size='sm'
                                variant='ghost'
                                className='h-7 w-7 cursor-pointer p-0'
                                onClick={() => {
                                  setEstimatesValue(
                                    (issue?.estimatedTimes as Record<
                                      string,
                                      number
                                    >) || {},
                                  );
                                  setEditingEstimates(prev => ({
                                    ...prev,
                                    [state._id]: false,
                                  }));
                                }}
                              >
                                <X className='h-3 w-3' />
                              </Button>
                            </div>
                          ) : (
                            <PermissionAwareWrapper
                              orgSlug={resolvedParams.orgSlug}
                              permission={PERMISSIONS.ISSUE_EDIT}
                              fallbackMessage="You don't have permission to edit time estimates"
                            >
                              <div
                                className={cn(
                                  'flex cursor-pointer items-center gap-2 rounded px-1 py-1 transition-colors',
                                  canEditIssue
                                    ? 'hover:bg-muted/50'
                                    : 'cursor-not-allowed opacity-50',
                                )}
                                onClick={
                                  canEditIssue
                                    ? () => {
                                        setEstimatesValue(
                                          (issue?.estimatedTimes as Record<
                                            string,
                                            number
                                          >) || {},
                                        );
                                        setEditingEstimates(prev => ({
                                          ...prev,
                                          [state._id]: true,
                                        }));
                                      }
                                    : undefined
                                }
                              >
                                <span className='text-muted-foreground text-sm'>
                                  {hours ? `${hours}h` : '—'}
                                </span>
                                {canEditIssue && (
                                  <Button
                                    size='sm'
                                    variant='ghost'
                                    className='h-4 w-4 cursor-pointer p-0'
                                    onClick={e => {
                                      e.stopPropagation();
                                      setEstimatesValue(
                                        (issue?.estimatedTimes as Record<
                                          string,
                                          number
                                        >) || {},
                                      );
                                      setEditingEstimates(prev => ({
                                        ...prev,
                                        [state._id]: true,
                                      }));
                                    }}
                                  >
                                    <Pencil className='size-3' />
                                  </Button>
                                )}
                              </div>
                            </PermissionAwareWrapper>
                          )}
                        </div>
                      </div>
                    );
                  })}
                  {(!issue?.estimatedTimes ||
                    Object.keys(issue.estimatedTimes).length === 0) && (
                    <div className='text-muted-foreground py-4 text-center text-sm'>
                      No estimates yet
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
