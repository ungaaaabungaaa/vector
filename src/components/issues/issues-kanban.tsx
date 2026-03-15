'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import {
  Check,
  Circle,
  ExternalLink,
  FolderOpen,
  Trash2,
  Users,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { DynamicIcon, getDynamicIcon } from '@/lib/dynamic-icons';
import { UserAvatar } from '@/components/user-avatar';
import { formatDateHuman } from '@/lib/date';
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useSensor,
  useSensors,
  useDroppable,
  useDraggable,
  type DragStartEvent,
  type DragEndEvent,
} from '@dnd-kit/core';

import type {
  State,
  Priority,
  Team,
  Project,
} from '@/components/issues/issue-selectors';
import {
  PrioritySelector,
  MultiAssigneeSelector,
} from '@/components/issues/issue-selectors';
import type { IssueRowData } from './issues-table';
import { CreateIssueDialog } from './create-issue-dialog';
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuSub,
  ContextMenuSubContent,
  ContextMenuSubTrigger,
  ContextMenuTrigger,
} from '@/components/ui/context-menu';

export interface IssuesKanbanProps {
  orgSlug: string;
  issues: ReadonlyArray<IssueRowData>;
  states: ReadonlyArray<State>;
  priorities: ReadonlyArray<Priority>;
  teams?: ReadonlyArray<Team>;
  projects?: ReadonlyArray<Project>;
  currentUserId: string;
  /** Called when an issue card is dropped on a different state column */
  onStateChange?: (
    issueId: string,
    assignmentId: string,
    newStateId: string,
  ) => void;
  onPriorityChange?: (issueId: string, priorityId: string) => void;
  onAssigneesChange?: (issueId: string, assigneeIds: string[]) => void;
  onTeamChange?: (issueId: string, teamId: string) => void;
  onProjectChange?: (issueId: string, projectId: string) => void;
  onDelete?: (issueId: string) => void;
  deletePending?: boolean;
  /** Extra defaults passed to the create-issue dialog (e.g. projectId) */
  createDefaults?: Record<string, unknown>;
  canChangeAll?: boolean;
}

interface GroupedIssue {
  id: string;
  key: string;
  title: string;
  priorityId: string | null;
  priorityIcon: string | null;
  priorityColor: string | null;
  priorityName: string | null;
  teamId: string | null;
  projectId: string | null;
  assignees: Array<{
    id: string;
    name: string | null;
    email: string | null;
  }>;
  assigneeIds: string[];
  assignments: Array<{
    assignmentId: string;
    assigneeId: string | null;
    assigneeName: string | null;
    assigneeEmail: string | null;
    assigneeImage: string | null;
    stateId: string | null;
    stateIcon: string | null;
    stateColor: string | null;
    stateName: string | null;
    stateType: string | null;
  }>;
  updatedAt: number;
}

interface KanbanIssueCard extends GroupedIssue {
  cardId: string;
  assignmentId: string | null;
  assigneeId: string | null;
  assigneeName: string | null;
  assigneeEmail: string | null;
  assigneeImage: string | null;
  stateId: string | null;
  stateIcon: string | null;
  stateColor: string | null;
  stateName: string | null;
  stateType: string | null;
}

export function IssuesKanban({
  orgSlug,
  issues,
  states,
  priorities,
  teams,
  projects,
  currentUserId,
  onStateChange,
  onPriorityChange,
  onAssigneesChange,
  onTeamChange,
  onProjectChange,
  onDelete,
  deletePending = false,
  createDefaults,
  canChangeAll = false,
}: IssuesKanbanProps) {
  const [activeId, setActiveId] = useState<string | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 5 },
    }),
  );

  const groupedIssues = React.useMemo(() => {
    const map = new Map<string, GroupedIssue>();

    for (const row of issues) {
      const existing = map.get(row.id);

      const assignment = {
        assignmentId: row.assignmentId ?? '',
        assigneeId: row.assigneeId ?? null,
        assigneeName: row.assigneeName ?? null,
        assigneeEmail: row.assigneeEmail ?? null,
        assigneeImage: row.assigneeImage ?? null,
        stateId: row.stateId ?? null,
        stateIcon: row.stateIcon ?? null,
        stateColor: row.stateColor ?? null,
        stateName: row.stateName ?? null,
        stateType: row.stateType ?? null,
      };

      if (existing) {
        if (
          row.assigneeId &&
          !existing.assignees.some(a => a.id === row.assigneeId)
        ) {
          existing.assignees.push({
            id: row.assigneeId,
            name: row.assigneeName ?? null,
            email: row.assigneeEmail ?? null,
          });
          existing.assigneeIds.push(row.assigneeId);
        }
        existing.assignments.push(assignment);
      } else {
        map.set(row.id, {
          id: row.id,
          key: row.key,
          title: row.title,
          priorityId: row.priorityId ?? null,
          priorityIcon: row.priorityIcon ?? null,
          priorityColor: row.priorityColor ?? null,
          priorityName: row.priorityName ?? null,
          teamId: row.teamId ?? null,
          projectId: row.projectId ?? null,
          assignees: row.assigneeId
            ? [
                {
                  id: row.assigneeId,
                  name: row.assigneeName ?? null,
                  email: row.assigneeEmail ?? null,
                },
              ]
            : [],
          assigneeIds: row.assigneeId ? [row.assigneeId] : [],
          assignments: [assignment],
          updatedAt: row.updatedAt ?? 0,
        });
      }
    }

    return [...map.values()];
  }, [issues]);

  // Sort states by position (must be before issueCards which uses it)
  const sortedStates = React.useMemo(
    () => [...states].sort((a, b) => a.position - b.position),
    [states],
  );

  const issueCards = React.useMemo(() => {
    return groupedIssues
      .flatMap(issue => {
        const visibleAssignments = issue.assignments.filter(
          assignment => assignment.assigneeId && assignment.stateType,
        );

        // If no visible assignments, show as unassigned in the first state column
        if (visibleAssignments.length === 0) {
          const firstState = sortedStates[0];
          if (!firstState) return [];
          return [
            {
              ...issue,
              cardId: `${issue.id}:unassigned`,
              assignmentId: null,
              assigneeId: null,
              assigneeName: null,
              assigneeEmail: null,
              assigneeImage: null,
              stateId: null,
              stateIcon: firstState.icon ?? null,
              stateColor: firstState.color ?? null,
              stateName: firstState.name ?? null,
              stateType: firstState.type ?? null,
            },
          ] satisfies KanbanIssueCard[];
        }

        return visibleAssignments.map<KanbanIssueCard>(assignment => ({
          ...issue,
          cardId: `${issue.id}:${assignment.assignmentId}`,
          assignmentId: assignment.assignmentId,
          assigneeId: assignment.assigneeId,
          assigneeName: assignment.assigneeName,
          assigneeEmail: assignment.assigneeEmail,
          assigneeImage: assignment.assigneeImage,
          stateId: assignment.stateId,
          stateIcon: assignment.stateIcon,
          stateColor: assignment.stateColor,
          stateName: assignment.stateName,
          stateType: assignment.stateType,
        }));
      })
      .sort((a, b) => b.updatedAt - a.updatedAt);
  }, [groupedIssues, sortedStates]);

  const canMoveCard = React.useCallback(
    (issue: KanbanIssueCard) =>
      Boolean(
        onStateChange &&
          issue.assignmentId &&
          (canChangeAll || issue.assigneeId === currentUserId),
      ),
    [canChangeAll, currentUserId, onStateChange],
  );

  const columns = React.useMemo(() => {
    return sortedStates.map(state => ({
      state,
      issues: issueCards.filter(issue => issue.stateType === state.type),
    }));
  }, [sortedStates, issueCards]);

  const activeIssue = activeId
    ? (issueCards.find(i => i.cardId === activeId) ?? null)
    : null;

  function handleDragStart(event: DragStartEvent) {
    setActiveId(event.active.id as string);
  }

  function handleDragEnd(event: DragEndEvent) {
    setActiveId(null);
    const { active, over } = event;
    if (!over || !onStateChange) return;

    const issueId = active.id as string;
    const targetStateId = over.id as string;
    const issue = issueCards.find(i => i.cardId === issueId);
    if (!issue || !issue.assignmentId || !canMoveCard(issue)) return;

    // Find the target state and check if it's different
    const targetState = sortedStates.find(s => s._id === targetStateId);
    if (!targetState || targetState.type === issue.stateType) return;

    onStateChange(issue.id, issue.assignmentId, targetStateId);
  }

  return (
    <DndContext
      sensors={sensors}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      <div className='flex h-full gap-3 overflow-x-auto p-3'>
        {columns.map(({ state, issues: columnIssues }) => (
          <KanbanColumn
            key={state._id}
            state={state}
            issues={columnIssues}
            orgSlug={orgSlug}
            activeId={activeId}
            states={sortedStates}
            priorities={priorities}
            teams={teams}
            projects={projects}
            currentUserId={currentUserId}
            canChangeAll={canChangeAll}
            onStateChange={onStateChange}
            onPriorityChange={onPriorityChange}
            onAssigneesChange={onAssigneesChange}
            onTeamChange={onTeamChange}
            onProjectChange={onProjectChange}
            onDelete={onDelete}
            deletePending={deletePending}
            createDefaults={createDefaults}
          />
        ))}
      </div>

      <DragOverlay
        dropAnimation={{
          duration: 200,
          easing: 'cubic-bezier(0.18, 0.67, 0.6, 1.22)',
        }}
      >
        {activeIssue ? (
          <div className='animate-tilt w-72'>
            <KanbanCardContent
              issue={activeIssue}
              orgSlug={orgSlug}
              isDragging
            />
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}

function KanbanColumn({
  state,
  issues,
  orgSlug,
  activeId,
  states,
  priorities,
  teams,
  projects,
  currentUserId,
  canChangeAll,
  onStateChange,
  onPriorityChange,
  onAssigneesChange,
  onTeamChange,
  onProjectChange,
  onDelete,
  deletePending,
  createDefaults,
}: {
  state: State;
  issues: KanbanIssueCard[];
  orgSlug: string;
  activeId: string | null;
  states: ReadonlyArray<State>;
  priorities: ReadonlyArray<Priority>;
  teams?: ReadonlyArray<Team>;
  projects?: ReadonlyArray<Project>;
  currentUserId: string;
  canChangeAll?: boolean;
  onStateChange?: (
    issueId: string,
    assignmentId: string,
    newStateId: string,
  ) => void;
  onPriorityChange?: (issueId: string, priorityId: string) => void;
  onAssigneesChange?: (issueId: string, assigneeIds: string[]) => void;
  onTeamChange?: (issueId: string, teamId: string) => void;
  onProjectChange?: (issueId: string, projectId: string) => void;
  onDelete?: (issueId: string) => void;
  deletePending?: boolean;
  createDefaults?: Record<string, unknown>;
}) {
  const { isOver, setNodeRef } = useDroppable({ id: state._id });
  const count = issues.length;

  return (
    <div
      ref={setNodeRef}
      className={cn(
        'flex w-72 flex-shrink-0 flex-col rounded-lg transition-colors',
        isOver && 'bg-muted/50',
      )}
    >
      {/* Column header */}
      <div className='mb-2 flex items-center gap-2 px-1'>
        <DynamicIcon
          name={state.icon}
          className='size-3.5'
          style={{ color: state.color || '#6b7280' }}
          fallback={Circle}
        />
        <span className='text-sm font-medium'>{state.name}</span>
        <span className='text-muted-foreground text-xs'>{count}</span>
      </div>

      {/* Column body */}
      <div className='min-h-[80px] flex-1 space-y-2 overflow-y-auto rounded-lg'>
        {issues.length === 0 ? (
          <div
            className={cn(
              'text-muted-foreground rounded-lg border border-dashed px-3 py-6 text-center text-xs',
              isOver && 'border-primary/50 bg-primary/5',
            )}
          >
            {isOver ? 'Drop here' : 'No issues'}
          </div>
        ) : (
          issues.map(issue => (
            <KanbanCard
              key={issue.cardId}
              issue={issue}
              orgSlug={orgSlug}
              isHidden={issue.cardId === activeId}
              states={states}
              priorities={priorities}
              teams={teams}
              projects={projects}
              currentUserId={currentUserId}
              canChangeAll={canChangeAll}
              onStateChange={onStateChange}
              onPriorityChange={onPriorityChange}
              onAssigneesChange={onAssigneesChange}
              onTeamChange={onTeamChange}
              onProjectChange={onProjectChange}
              onDelete={onDelete}
              deletePending={deletePending}
            />
          ))
        )}

        {/* Add issue button */}
        <CreateIssueDialog
          orgSlug={orgSlug}
          variant='default'
          defaultStates={{ stateId: state._id, ...createDefaults }}
          className='text-muted-foreground hover:text-foreground hover:bg-muted/50 w-full border-dashed'
        />
      </div>
    </div>
  );
}

function KanbanCard({
  issue,
  orgSlug,
  isHidden,
  states,
  priorities,
  teams,
  projects,
  currentUserId,
  canChangeAll = false,
  onStateChange,
  onPriorityChange,
  onAssigneesChange,
  onTeamChange,
  onProjectChange,
  onDelete,
  deletePending,
}: {
  issue: KanbanIssueCard;
  orgSlug: string;
  isHidden?: boolean;
  states: ReadonlyArray<State>;
  priorities: ReadonlyArray<Priority>;
  teams?: ReadonlyArray<Team>;
  projects?: ReadonlyArray<Project>;
  currentUserId: string;
  canChangeAll?: boolean;
  onStateChange?: (
    issueId: string,
    assignmentId: string,
    newStateId: string,
  ) => void;
  onPriorityChange?: (issueId: string, priorityId: string) => void;
  onAssigneesChange?: (issueId: string, assigneeIds: string[]) => void;
  onTeamChange?: (issueId: string, teamId: string) => void;
  onProjectChange?: (issueId: string, projectId: string) => void;
  onDelete?: (issueId: string) => void;
  deletePending?: boolean;
}) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: issue.cardId,
    disabled:
      !onStateChange ||
      !issue.assignmentId ||
      !(canChangeAll || issue.assigneeId === currentUserId),
  });

  return (
    <ContextMenu>
      <ContextMenuTrigger
        ref={setNodeRef}
        {...listeners}
        {...attributes}
        className={cn('block', isHidden && 'scale-95 opacity-30')}
      >
        <KanbanCardContent
          issue={issue}
          orgSlug={orgSlug}
          isDragging={isDragging}
          priorities={priorities}
          currentUserId={currentUserId}
          onPriorityChange={onPriorityChange}
          onAssigneesChange={onAssigneesChange}
        />
      </ContextMenuTrigger>
      <KanbanCardMenu
        issue={issue}
        orgSlug={orgSlug}
        states={states}
        priorities={priorities}
        teams={teams}
        projects={projects}
        currentUserId={currentUserId}
        canChangeAll={canChangeAll}
        onStateChange={onStateChange}
        onPriorityChange={onPriorityChange}
        onTeamChange={onTeamChange}
        onProjectChange={onProjectChange}
        onDelete={onDelete}
        deletePending={deletePending}
      />
    </ContextMenu>
  );
}

function KanbanCardMenu({
  issue,
  orgSlug,
  states,
  priorities,
  teams,
  projects,
  currentUserId,
  canChangeAll = false,
  onStateChange,
  onPriorityChange,
  onTeamChange,
  onProjectChange,
  onDelete,
  deletePending,
}: {
  issue: KanbanIssueCard;
  orgSlug: string;
  states: ReadonlyArray<State>;
  priorities: ReadonlyArray<Priority>;
  teams?: ReadonlyArray<Team>;
  projects?: ReadonlyArray<Project>;
  currentUserId: string;
  canChangeAll?: boolean;
  onStateChange?: (
    issueId: string,
    assignmentId: string,
    newStateId: string,
  ) => void;
  onPriorityChange?: (issueId: string, priorityId: string) => void;
  onTeamChange?: (issueId: string, teamId: string) => void;
  onProjectChange?: (issueId: string, projectId: string) => void;
  onDelete?: (issueId: string) => void;
  deletePending?: boolean;
}) {
  const canMoveIssue = Boolean(
    onStateChange &&
      issue.assignmentId &&
      (canChangeAll || issue.assigneeId === currentUserId),
  );

  return (
    <ContextMenuContent className='w-56'>
      <ContextMenuItem asChild>
        <Link href={`/${orgSlug}/issues/${issue.key}`}>
          <ExternalLink className='size-4' />
          Open issue
        </Link>
      </ContextMenuItem>

      {canMoveIssue ? (
        <ContextMenuSub>
          <ContextMenuSubTrigger>
            <Circle className='size-4' />
            Move to
          </ContextMenuSubTrigger>
          <ContextMenuSubContent>
            {states.map(state => {
              const StateIcon = state.icon
                ? getDynamicIcon(state.icon) || Circle
                : Circle;
              const isSelected = issue.stateType === state.type;
              return (
                <ContextMenuItem
                  key={state._id}
                  onClick={() => {
                    if (!onStateChange || !issue.assignmentId) return;
                    onStateChange(issue.id, issue.assignmentId, state._id);
                  }}
                >
                  <span className='flex size-4 items-center justify-center'>
                    {isSelected ? <Check className='size-3.5' /> : null}
                  </span>
                  <StateIcon
                    className='size-4'
                    style={{ color: state.color || '#94a3b8' }}
                  />
                  <span className='min-w-0 flex-1 truncate'>{state.name}</span>
                </ContextMenuItem>
              );
            })}
          </ContextMenuSubContent>
        </ContextMenuSub>
      ) : null}

      {onPriorityChange ? (
        <ContextMenuSub>
          <ContextMenuSubTrigger>
            <Circle className='size-4' />
            Priority
          </ContextMenuSubTrigger>
          <ContextMenuSubContent>
            {priorities.map(priority => {
              const PriorityIcon = priority.icon
                ? getDynamicIcon(priority.icon) || Circle
                : Circle;
              const isSelected = issue.priorityId === priority._id;
              return (
                <ContextMenuItem
                  key={priority._id}
                  onClick={() => {
                    onPriorityChange(issue.id, priority._id);
                  }}
                >
                  <span className='flex size-4 items-center justify-center'>
                    {isSelected ? <Check className='size-3.5' /> : null}
                  </span>
                  <PriorityIcon
                    className='size-4'
                    style={{ color: priority.color || '#94a3b8' }}
                  />
                  <span className='min-w-0 flex-1 truncate'>
                    {priority.name}
                  </span>
                </ContextMenuItem>
              );
            })}
          </ContextMenuSubContent>
        </ContextMenuSub>
      ) : null}

      {teams && teams.length > 0 && onTeamChange ? (
        <ContextMenuSub>
          <ContextMenuSubTrigger>
            <Users className='size-4' />
            Team
          </ContextMenuSubTrigger>
          <ContextMenuSubContent>
            <ContextMenuItem onClick={() => onTeamChange(issue.id, '')}>
              <span className='flex size-4 items-center justify-center'>
                {!issue.teamId ? <Check className='size-3.5' /> : null}
              </span>
              <span className='min-w-0 flex-1 truncate'>No team</span>
            </ContextMenuItem>
            {teams.map(team => {
              const TeamIcon = team.icon
                ? getDynamicIcon(team.icon) || Users
                : Users;
              const isSelected = issue.teamId === team._id;
              return (
                <ContextMenuItem
                  key={team._id}
                  onClick={() => onTeamChange(issue.id, team._id)}
                >
                  <span className='flex size-4 items-center justify-center'>
                    {isSelected ? <Check className='size-3.5' /> : null}
                  </span>
                  <TeamIcon
                    className='size-4'
                    style={{ color: team.color || '#94a3b8' }}
                  />
                  <span className='min-w-0 flex-1 truncate'>{team.name}</span>
                </ContextMenuItem>
              );
            })}
          </ContextMenuSubContent>
        </ContextMenuSub>
      ) : null}

      {projects && projects.length > 0 && onProjectChange ? (
        <ContextMenuSub>
          <ContextMenuSubTrigger>
            <FolderOpen className='size-4' />
            Project
          </ContextMenuSubTrigger>
          <ContextMenuSubContent>
            <ContextMenuItem onClick={() => onProjectChange(issue.id, '')}>
              <span className='flex size-4 items-center justify-center'>
                {!issue.projectId ? <Check className='size-3.5' /> : null}
              </span>
              <span className='min-w-0 flex-1 truncate'>No project</span>
            </ContextMenuItem>
            {projects.map(project => {
              const ProjectIcon = project.icon
                ? getDynamicIcon(project.icon) || FolderOpen
                : FolderOpen;
              const isSelected = issue.projectId === project._id;
              return (
                <ContextMenuItem
                  key={project._id}
                  onClick={() => onProjectChange(issue.id, project._id)}
                >
                  <span className='flex size-4 items-center justify-center'>
                    {isSelected ? <Check className='size-3.5' /> : null}
                  </span>
                  <ProjectIcon
                    className='size-4'
                    style={{ color: project.color || '#94a3b8' }}
                  />
                  <span className='min-w-0 flex-1 truncate'>
                    {project.name}
                  </span>
                </ContextMenuItem>
              );
            })}
          </ContextMenuSubContent>
        </ContextMenuSub>
      ) : null}

      {onDelete ? (
        <>
          <ContextMenuSeparator />
          <ContextMenuItem
            variant='destructive'
            disabled={deletePending}
            onClick={() => onDelete(issue.id)}
          >
            <Trash2 className='size-4' />
            Delete issue
          </ContextMenuItem>
        </>
      ) : null}
    </ContextMenuContent>
  );
}

function KanbanCardContent({
  issue,
  orgSlug,
  isDragging,
  priorities,
  currentUserId,
  onPriorityChange,
  onAssigneesChange,
}: {
  issue: KanbanIssueCard;
  orgSlug: string;
  isDragging?: boolean;
  priorities?: ReadonlyArray<Priority>;
  currentUserId?: string;
  onPriorityChange?: (issueId: string, priorityId: string) => void;
  onAssigneesChange?: (issueId: string, assigneeIds: string[]) => void;
}) {
  const assigneeLabel =
    issue.assigneeName || issue.assigneeEmail || 'Unassigned';
  const assigneeStateCluster = (
    <div className='flex min-w-0 items-center gap-1.5'>
      <UserAvatar
        name={issue.assigneeName}
        email={issue.assigneeEmail}
        image={issue.assigneeImage}
        size='sm'
        className='size-5 shrink-0'
      />
      <div className='flex min-w-0 items-center gap-1.5 text-[11px]'>
        <span className='truncate font-medium text-current'>
          {assigneeLabel}
        </span>
        <span className='text-muted-foreground/60 shrink-0'>·</span>
        <DynamicIcon
          name={issue.stateIcon}
          className='text-muted-foreground size-3 shrink-0'
          style={{ color: issue.stateColor || '#94a3b8' }}
          fallback={Circle}
        />
        <span className='text-muted-foreground truncate'>
          {issue.stateName ?? 'No state'}
        </span>
      </div>
    </div>
  );

  return (
    <div
      className={cn(
        'bg-card block rounded-lg border p-3 shadow-xs transition-colors',
        isDragging
          ? 'ring-primary/30 shadow-lg ring-2'
          : 'hover:border-border/80 hover:shadow-sm',
      )}
    >
      {/* Issue key + priority */}
      <div className='mb-1.5 flex items-center gap-2'>
        {onPriorityChange && priorities ? (
          <div onClick={e => e.stopPropagation()}>
            <PrioritySelector
              priorities={priorities as Priority[]}
              selectedPriority={issue.priorityId || ''}
              onPrioritySelect={pid => onPriorityChange(issue.id, pid)}
              displayMode='labelOnly'
              trigger={
                <div className='flex-shrink-0 cursor-pointer'>
                  <DynamicIcon
                    name={issue.priorityIcon}
                    className='size-3'
                    style={{ color: issue.priorityColor || '#94a3b8' }}
                    fallback={Circle}
                  />
                </div>
              }
              className='border-none bg-transparent p-0 shadow-none'
            />
          </div>
        ) : (
          issue.priorityIcon && (
            <DynamicIcon
              name={issue.priorityIcon}
              className='size-3'
              style={{ color: issue.priorityColor || '#94a3b8' }}
            />
          )
        )}
        <Link
          href={`/${orgSlug}/issues/${issue.key}`}
          onClick={e => {
            if (isDragging) e.preventDefault();
          }}
          className='text-muted-foreground hover:text-foreground font-mono text-[11px] transition-colors'
        >
          {issue.key}
        </Link>
      </div>

      {/* Title */}
      <Link
        href={`/${orgSlug}/issues/${issue.key}`}
        onClick={e => {
          if (isDragging) e.preventDefault();
        }}
        className='hover:text-primary transition-colors'
      >
        <p className='line-clamp-2 text-sm leading-snug font-medium'>
          {issue.title}
        </p>
      </Link>

      {/* Bottom row: assignees + date */}
      <div className='mt-2 flex items-center justify-between'>
        {onAssigneesChange && currentUserId ? (
          <div onClick={e => e.stopPropagation()}>
            <MultiAssigneeSelector
              orgSlug={orgSlug}
              selectedAssigneeIds={issue.assigneeIds}
              onAssigneesChange={ids => onAssigneesChange(issue.id, ids)}
              assignments={issue.assignments}
              activeFilter='all'
              currentUserId={currentUserId}
              canManageAll={false}
              trigger={
                <div className='hover:bg-muted/40 rounded-sm px-0.5 py-0.5 transition-colors'>
                  {assigneeStateCluster}
                </div>
              }
            />
          </div>
        ) : (
          assigneeStateCluster
        )}

        <span className='text-muted-foreground text-[11px]'>
          {formatDateHuman(new Date(issue.updatedAt))}
        </span>
      </div>
    </div>
  );
}
