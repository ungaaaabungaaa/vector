'use client';

import { useDeferredValue, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { AnimatePresence, motion } from 'motion/react';
import {
  ArrowLeft,
  Save,
  X,
  Plus,
  FolderOpen,
  LayoutList,
  Columns3,
  Trash2,
} from 'lucide-react';
import { useQuery, useMutation } from 'convex/react';
import { api } from '@/convex/_generated/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { RichEditor } from '@/components/ui/rich-editor';
import { formatDateHuman } from '@/lib/date';
import { StatusSelector } from '@/components/projects/project-selectors';
import { ProjectLeadSelector } from '@/components/projects/project-lead-selector';
import { TeamSelector } from '@/components/teams/team-selector';
import { ProjectMembersSection } from '@/components/projects/project-members';
import { ProjectActivityFeed } from '@/components/activity/project-activity-feed';
import { PERMISSIONS } from '@/convex/_shared/permissions';
import {
  usePermissionCheck,
  PermissionAware,
} from '@/components/ui/permission-aware';
import { cn } from '@/lib/utils';
import { IconPicker } from '@/components/ui/icon-picker';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { getDynamicIcon } from '@/lib/dynamic-icons';
import { CalendarIcon, ClockIcon, Search, Loader2 } from 'lucide-react';
import { MobileNavTrigger } from '../../layout';
import type { Id } from '@/convex/_generated/dataModel';
import {
  VisibilitySelector,
  type VisibilityState,
} from '@/components/ui/visibility-selector';
import { IssuesKanban } from '@/components/issues/issues-kanban';
import { IssuesTable } from '@/components/issues/issues-table';
import { CreateIssueDialog } from '@/components/issues/create-issue-dialog';
import { TableSkeleton, KanbanSkeleton } from '@/components/ui/table-skeleton';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { useConfirm } from '@/hooks/use-confirm';
import {
  Tooltip,
  TooltipTrigger,
  TooltipContent,
  TooltipProvider,
} from '@/components/ui/tooltip';
import { Calendar } from '@/components/ui/calendar';
import type { DateRange } from 'react-day-picker';
import {
  buildOptimisticIssueRows,
  replaceIssueRows,
  updateIssueRows,
  updateQuery,
} from '@/lib/optimistic-updates';

interface ProjectViewClientProps {
  params: { orgSlug: string; projectKey: string };
}

// Default colors for project customization
const DEFAULT_COLORS = [
  '#94a3b8', // slate-400
  '#3b82f6', // blue-500
  '#10b981', // emerald-500
  '#f59e0b', // amber-500
  '#ef4444', // red-500
  '#8b5cf6', // violet-500
  '#06b6d4', // cyan-500
  '#6b7280', // gray-500
];

/** Parse a YYYY-MM-DD string as a local-timezone Date (not UTC). */
function parseLocalDate(dateStr: string): Date {
  const [y, m, d] = dateStr.split('-').map(Number);
  return new Date(y, m - 1, d);
}

/** Format a Date as YYYY-MM-DD in local timezone. */
function toDateString(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function ProjectDateRangePicker({
  project,
  updateMutation,
  orgSlug,
  permissionScope,
}: {
  project: { _id: Id<'projects'>; startDate?: string; dueDate?: string };
  updateMutation: ReturnType<
    typeof useMutation<typeof api.projects.mutations.update>
  >;
  orgSlug: string;
  permissionScope: {
    orgSlug: string;
    teamId?: Id<'teams'>;
    projectId?: Id<'projects'>;
  };
}) {
  // Local state for optimistic calendar updates
  const [localRange, setLocalRange] = useState<DateRange | undefined>(
    undefined,
  );
  const [open, setOpen] = useState(false);

  // Sync from server when popover opens or server data changes
  const serverRange: DateRange | undefined = useMemo(() => {
    if (!project.startDate && !project.dueDate) return undefined;
    return {
      from: project.startDate ? parseLocalDate(project.startDate) : undefined,
      to: project.dueDate ? parseLocalDate(project.dueDate) : undefined,
    };
  }, [project.startDate, project.dueDate]);

  // Use local range while popover is open, otherwise server
  const displayRange = open ? localRange : serverRange;
  const displayStart = displayRange?.from
    ? toDateString(displayRange.from)
    : '';
  const displayDue = displayRange?.to ? toDateString(displayRange.to) : '';

  // Whether user has picked start but not yet end
  const isSelectingEnd = !!(displayRange?.from && !displayRange?.to);

  const handleOpenChange = (next: boolean) => {
    setOpen(next);
    if (next) {
      // Reset local state to match server when opening
      setLocalRange(serverRange);
    }
  };

  const handleSelect = (range: DateRange | undefined) => {
    setLocalRange(range);
    // Only persist when we have a complete range (both from and to)
    // or when clearing (undefined)
    if (range?.from && range?.to) {
      void updateMutation({
        projectId: project._id,
        data: {
          startDate: toDateString(range.from),
          dueDate: toDateString(range.to),
        },
      });
    }
  };

  const handleClear = () => {
    setLocalRange(undefined);
    void updateMutation({
      projectId: project._id,
      data: { startDate: null, dueDate: null },
    });
  };

  return (
    <PermissionAware
      orgSlug={orgSlug}
      permission={PERMISSIONS.PROJECT_EDIT}
      scope={permissionScope}
      fallbackMessage="You don't have permission to change dates"
    >
      <Popover open={open} onOpenChange={handleOpenChange}>
        <Tooltip>
          <TooltipTrigger asChild>
            <PopoverTrigger asChild>
              <button className='text-muted-foreground hover:bg-muted/50 bg-muted/30 flex h-8 cursor-pointer items-center gap-1.5 rounded-md border px-2.5 text-sm transition-colors'>
                <CalendarIcon className='size-3.5' />
                {displayStart || displayDue ? (
                  <span>
                    {displayStart
                      ? formatDateHuman(parseLocalDate(displayStart))
                      : '—'}
                    {displayDue
                      ? ` → ${formatDateHuman(parseLocalDate(displayDue))}`
                      : ''}
                  </span>
                ) : null}
              </button>
            </PopoverTrigger>
          </TooltipTrigger>
          <TooltipContent side='bottom'>Dates</TooltipContent>
        </Tooltip>
        <PopoverContent className='w-auto p-0' align='start'>
          <div className='flex flex-col'>
            {/* Header indicating current selection step */}
            <div className='flex items-center justify-between border-b px-3 py-2'>
              <span className='text-muted-foreground text-xs font-medium'>
                {isSelectingEnd
                  ? 'Select end date'
                  : displayRange?.from
                    ? `${formatDateHuman(displayRange.from)} → ${displayRange.to ? formatDateHuman(displayRange.to) : '...'}`
                    : 'Select start date'}
              </span>
              {(displayRange?.from || displayRange?.to) && (
                <button
                  className='text-muted-foreground hover:text-foreground text-xs underline-offset-2 transition-colors hover:underline'
                  onClick={handleClear}
                >
                  Clear
                </button>
              )}
            </div>
            <Calendar
              mode='range'
              selected={displayRange}
              onSelect={handleSelect}
              numberOfMonths={2}
            />
          </div>
        </PopoverContent>
      </Popover>
    </PermissionAware>
  );
}

export default function ProjectViewClient({ params }: ProjectViewClientProps) {
  const router = useRouter();
  const [editingTitle, setEditingTitle] = useState(false);
  const [editingDescription, setEditingDescription] = useState(false);
  const [titleValue, setTitleValue] = useState('');
  const [descriptionValue, setDescriptionValue] = useState('');
  const [isDeletingProject, setIsDeletingProject] = useState(false);
  const [isDeletingIssue, setIsDeletingIssue] = useState(false);
  const [confirmDelete, ConfirmDeleteDialog] = useConfirm();
  const [projectTab, setProjectTab] = useState('issues');
  // Issue view mode from URL search params
  const issueViewParam =
    typeof window !== 'undefined'
      ? new URLSearchParams(window.location.search).get('issueView')
      : null;
  const [issueViewMode, setIssueViewModeState] = useState<'table' | 'kanban'>(
    issueViewParam === 'table' ? 'table' : 'kanban',
  );
  const setIssueViewMode = (mode: 'table' | 'kanban') => {
    setIssueViewModeState(mode);
    const sp = new URLSearchParams(window.location.search);
    if (mode === 'kanban') {
      sp.delete('issueView');
    } else {
      sp.set('issueView', mode);
    }
    const qs = sp.toString();
    window.history.replaceState(
      null,
      '',
      qs ? `?${qs}` : window.location.pathname,
    );
  };

  const [issueSearchText, setIssueSearchText] = useState('');
  const deferredIssueSearch = useDeferredValue(issueSearchText);
  const [memberSearchText, setMemberSearchText] = useState('');
  const deferredMemberSearch = useDeferredValue(memberSearchText);
  const [issuePage, setIssuePage] = useState(1);
  const ISSUE_PAGE_SIZE = 25;

  const user = useQuery(api.users.currentUser);

  const project = useQuery(api.projects.queries.getByKey, {
    orgSlug: params.orgSlug,
    projectKey: params.projectKey,
  });
  const projectQueryArgs = {
    orgSlug: params.orgSlug,
    projectKey: params.projectKey,
  };

  const projectId = project?._id;
  const displayTitle = project?.name ?? '';
  const displayDescription = project?.description ?? '';
  const displayIcon = project?.icon ?? '';
  const displayColor = project?.color ?? '';
  const iconValue = displayIcon || null;
  const colorValue = displayColor || null;

  // Use useMemo to stabilize the scope object and prevent hook rerenders
  const permissionScope = useMemo(() => {
    return projectId
      ? { orgSlug: params.orgSlug, projectId }
      : { orgSlug: params.orgSlug };
  }, [params.orgSlug, projectId]);

  const { isAllowed: canEditProject } = usePermissionCheck(
    params.orgSlug,
    PERMISSIONS.PROJECT_EDIT,
    permissionScope,
  );
  const { isAllowed: canDeleteProject } = usePermissionCheck(
    params.orgSlug,
    PERMISSIONS.PROJECT_DELETE,
    permissionScope,
  );
  const { isAllowed: canDeleteIssue } = usePermissionCheck(
    params.orgSlug,
    PERMISSIONS.ISSUE_DELETE,
    permissionScope,
  );

  const canEdit = !!(
    user &&
    project &&
    (project.leadId === user._id || canEditProject)
  );

  const statuses = useQuery(api.organizations.queries.listProjectStatuses, {
    orgSlug: params.orgSlug,
  });

  const teams = useQuery(api.organizations.queries.listTeams, {
    orgSlug: params.orgSlug,
  });

  // Issue data for project board
  const issueStates = useQuery(api.organizations.queries.listIssueStates, {
    orgSlug: params.orgSlug,
  });
  const issuePriorities = useQuery(
    api.organizations.queries.listIssuePriorities,
    {
      orgSlug: params.orgSlug,
    },
  );
  const projectIssuesData = useQuery(
    api.issues.queries.listIssues,
    project?._id
      ? {
          orgSlug: params.orgSlug,
          projectId: project._id,
          searchQuery: deferredIssueSearch || undefined,
          page: issueViewMode === 'table' ? issuePage : undefined,
          pageSize: issueViewMode === 'table' ? ISSUE_PAGE_SIZE : undefined,
        }
      : 'skip',
  );
  const projectIssues = projectIssuesData?.issues ?? [];
  const projectIssuesTotal = projectIssuesData?.total ?? 0;
  const projectIssuesQueryArgs = project?._id
    ? {
        orgSlug: params.orgSlug,
        projectId: project._id,
        searchQuery: deferredIssueSearch || undefined,
        page: issueViewMode === 'table' ? issuePage : undefined,
        pageSize: issueViewMode === 'table' ? ISSUE_PAGE_SIZE : undefined,
      }
    : null;

  // Reset page when search changes
  useEffect(() => {
    setIssuePage(1);
  }, [deferredIssueSearch]);

  const updateMutation = useMutation(
    api.projects.mutations.update,
  ).withOptimisticUpdate((store, args) => {
    updateQuery(
      store,
      api.projects.queries.getByKey,
      projectQueryArgs,
      current => ({
        ...current,
        ...(args.data.name !== undefined ? { name: args.data.name } : {}),
        ...(args.data.description !== undefined
          ? { description: args.data.description }
          : {}),
        ...(args.data.icon !== undefined ? { icon: args.data.icon } : {}),
        ...(args.data.color !== undefined ? { color: args.data.color } : {}),
        ...(args.data.startDate !== undefined
          ? { startDate: args.data.startDate ?? undefined }
          : {}),
        ...(args.data.dueDate !== undefined
          ? { dueDate: args.data.dueDate ?? undefined }
          : {}),
      }),
    );
  });
  const deleteProjectMutation = useMutation(
    api.projects.mutations.deleteProject,
  );
  const changeStatusMutation = useMutation(
    api.projects.mutations.changeStatus,
  ).withOptimisticUpdate((store, args) => {
    updateQuery(
      store,
      api.projects.queries.getByKey,
      projectQueryArgs,
      current => ({
        ...current,
        statusId: args.statusId ?? undefined,
      }),
    );
  });
  const changeTeamMutation = useMutation(
    api.projects.mutations.changeTeam,
  ).withOptimisticUpdate((store, args) => {
    updateQuery(
      store,
      api.projects.queries.getByKey,
      projectQueryArgs,
      current => ({
        ...current,
        teamId: args.teamId ?? undefined,
      }),
    );
  });
  const changeLeadMutation = useMutation(
    api.projects.mutations.changeLead,
  ).withOptimisticUpdate((store, args) => {
    updateQuery(
      store,
      api.projects.queries.getByKey,
      projectQueryArgs,
      current => ({
        ...current,
        leadId: args.leadId ?? undefined,
        ...(args.leadId === null ? { lead: null } : {}),
      }),
    );
  });
  const changeAssignmentStateMutation = useMutation(
    api.issues.mutations.changeAssignmentState,
  ).withOptimisticUpdate((store, args) => {
    if (!projectIssuesQueryArgs) return;
    const nextState = issueStates?.find(
      state => String(state._id) === String(args.stateId),
    );
    updateQuery(
      store,
      api.issues.queries.listIssues,
      projectIssuesQueryArgs,
      current => ({
        ...current,
        issues: current.issues.map(row =>
          String(row.assignmentId) === String(args.assignmentId)
            ? {
                ...row,
                stateId: nextState?._id,
                stateName: nextState?.name ?? undefined,
                stateIcon: nextState?.icon ?? undefined,
                stateColor: nextState?.color ?? undefined,
                stateType: nextState?.type ?? undefined,
              }
            : row,
        ) as typeof current.issues,
      }),
    );
  });
  const changePriorityMutation = useMutation(
    api.issues.mutations.changePriority,
  ).withOptimisticUpdate((store, args) => {
    if (!projectIssuesQueryArgs) return;
    const nextPriority = issuePriorities?.find(
      priority => String(priority._id) === String(args.priorityId),
    );
    updateQuery(
      store,
      api.issues.queries.listIssues,
      projectIssuesQueryArgs,
      current =>
        updateIssueRows(current, String(args.issueId), row => ({
          ...row,
          priorityId: nextPriority?._id,
          priorityName: nextPriority?.name ?? undefined,
          priorityIcon: nextPriority?.icon ?? undefined,
          priorityColor: nextPriority?.color ?? undefined,
        })),
    );
  });
  const updateAssigneesMutation = useMutation(
    api.issues.mutations.updateAssignees,
  ).withOptimisticUpdate((store, args) => {
    if (!projectIssuesQueryArgs) return;
    updateQuery(
      store,
      api.issues.queries.listIssues,
      projectIssuesQueryArgs,
      current => {
        const existingRows = current.issues.filter(
          row => String(row.id) === String(args.issueId),
        );
        const existingStateRow = existingRows.find(row => row.stateId);
        const fallbackState = existingStateRow
          ? {
              _id: existingStateRow.stateId,
              name: existingStateRow.stateName,
              icon: existingStateRow.stateIcon,
              color: existingStateRow.stateColor,
              type: existingStateRow.stateType,
            }
          : issueStates?.[0]
            ? {
                _id: issueStates[0]._id,
                name: issueStates[0].name,
                icon: issueStates[0].icon,
                color: issueStates[0].color,
                type: issueStates[0].type,
              }
            : null;
        const members =
          store.getQuery(api.organizations.queries.listMembers, {
            orgSlug: params.orgSlug,
          }) ?? undefined;
        const nextRows = buildOptimisticIssueRows(
          existingRows,
          args.issueId,
          args.assigneeIds,
          members,
          fallbackState,
        );
        return replaceIssueRows(current, String(args.issueId), nextRows);
      },
    );
  });
  const deleteIssueMutation = useMutation(api.issues.mutations.deleteIssue);
  const changeVisibilityMutation = useMutation(
    api.projects.mutations.changeVisibility,
  ).withOptimisticUpdate((store, args) => {
    updateQuery(
      store,
      api.projects.queries.getByKey,
      projectQueryArgs,
      current => ({
        ...current,
        visibility: args.visibility,
      }),
    );
  });

  const handleTitleSave = () => {
    if (!project) return;
    const nextTitle = titleValue.trim();
    if (!nextTitle) return;
    setTitleValue(nextTitle);
    void updateMutation({
      projectId: project._id,
      data: { name: nextTitle },
    });
    setEditingTitle(false);
  };

  const handleDescriptionSave = () => {
    if (!project) return;
    const nextDescription = descriptionValue.trim();
    setDescriptionValue(nextDescription);
    void updateMutation({
      projectId: project._id,
      data: { description: nextDescription || undefined },
    });
    setEditingDescription(false);
  };

  const handleStatusChange = (statusId: string) => {
    if (!project) return;
    void changeStatusMutation({
      projectId: project._id,
      statusId: (statusId as Id<'projectStatuses'>) || null,
    });
  };

  const handleTeamChange = (teamId: string) => {
    if (!project) return;
    void changeTeamMutation({
      projectId: project._id,
      teamId: (teamId as Id<'teams'>) || null,
    });
  };

  const handleLeadChange = (leadId: string) => {
    if (!project) return;
    void changeLeadMutation({
      projectId: project._id,
      leadId: (leadId as Id<'users'>) || null,
    });
  };

  const handleIconChange = (iconName: string | null) => {
    if (!project) return;
    void updateMutation({
      projectId: project._id,
      data: { icon: iconName || undefined },
    });
  };

  const handleColorChange = (color: string) => {
    if (!project) return;
    void updateMutation({
      projectId: project._id,
      data: { color },
    });
  };

  const handleVisibilityChange = async (visibility: VisibilityState) => {
    if (!project) return;
    await changeVisibilityMutation({
      projectId: project._id,
      visibility,
    });
  };

  const handleDeleteProject = async () => {
    if (!project || !canDeleteProject) return;
    const ok = await confirmDelete({
      title: 'Delete project',
      description:
        'This will permanently delete the project and cannot be undone.',
      confirmLabel: 'Delete',
      variant: 'destructive',
    });
    if (!ok) return;
    setIsDeletingProject(true);
    try {
      await deleteProjectMutation({ projectId: project._id });
      router.push(`/${params.orgSlug}/projects`);
    } finally {
      setIsDeletingProject(false);
    }
  };

  const handleDeleteIssue = async (issueId: string) => {
    if (!canDeleteIssue) return;
    const ok = await confirmDelete({
      title: 'Delete issue',
      description:
        'This will permanently delete the issue and cannot be undone.',
      confirmLabel: 'Delete',
      variant: 'destructive',
    });
    if (!ok) return;
    setIsDeletingIssue(true);
    try {
      await deleteIssueMutation({
        issueId: issueId as Id<'issues'>,
      });
    } finally {
      setIsDeletingIssue(false);
    }
  };

  if (!project) {
    return (
      <div className='bg-background h-full overflow-y-auto'>
        <div className='h-full'>
          <div className='bg-background/95 supports-[backdrop-filter]:bg-background/60 flex items-center justify-between border-b px-2 backdrop-blur'>
            <div className='flex h-8 items-center gap-2'>
              <div className='bg-muted h-4 w-16 animate-pulse rounded' />
            </div>
          </div>
          <div className='mx-auto max-w-5xl px-4 py-4'>
            <div className='space-y-4'>
              <div className='bg-muted h-8 w-3/4 animate-pulse rounded' />
              <div className='bg-muted h-20 animate-pulse rounded' />
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className='bg-background h-full overflow-y-auto'>
      <div className='h-full'>
        {/* Header */}
        <div className='bg-background/95 supports-[backdrop-filter]:bg-background/60 flex flex-wrap items-center justify-between gap-y-0 border-b px-2 backdrop-blur'>
          <div className='flex h-8 items-center gap-2'>
            <MobileNavTrigger />
            <Link
              href={`/${params.orgSlug}/projects`}
              className='text-muted-foreground hover:text-foreground flex items-center gap-2 text-sm transition-colors'
            >
              <ArrowLeft className='size-3' />
              <span className='hidden sm:inline'>Projects</span>
            </Link>
            <div className='flex items-center'>
              {/* Team & Status selectors */}
              <PermissionAware
                orgSlug={params.orgSlug}
                permission={PERMISSIONS.PROJECT_EDIT}
                scope={permissionScope}
                fallbackMessage="You don't have permission to change project team"
              >
                <TeamSelector
                  teams={teams || []}
                  selectedTeam={project.teamId || ''}
                  onTeamSelect={handleTeamChange}
                  displayMode='iconWhenUnselected'
                  className='border-none bg-transparent shadow-none'
                />
              </PermissionAware>
            </div>
            <span className='text-muted-foreground text-sm'>/</span>
            <span className='text-sm font-medium'>{params.projectKey}</span>
          </div>

          <div className='flex items-center'>
            <PermissionAware
              orgSlug={params.orgSlug}
              permission={PERMISSIONS.PROJECT_EDIT}
              scope={permissionScope}
              fallbackMessage="You don't have permission to change project visibility"
            >
              <VisibilitySelector
                value={project.visibility as VisibilityState}
                onValueChange={handleVisibilityChange}
                displayMode='iconWhenUnselected'
                className='border-none bg-transparent shadow-none'
              />
            </PermissionAware>
            <div className='bg-muted-foreground/20 h-4 w-px' />
            <PermissionAware
              orgSlug={params.orgSlug}
              permission={PERMISSIONS.PROJECT_EDIT}
              scope={permissionScope}
              fallbackMessage="You don't have permission to change project status"
            >
              <StatusSelector
                statuses={statuses || []}
                selectedStatus={project.statusId || ''}
                onStatusSelect={handleStatusChange}
                className='border-none bg-transparent shadow-none'
              />
            </PermissionAware>

            <div className='bg-muted-foreground/20 h-4 w-px' />

            {/* Lead */}
            <PermissionAware
              orgSlug={params.orgSlug}
              permission={PERMISSIONS.PROJECT_EDIT}
              scope={permissionScope}
              fallbackMessage="You don't have permission to change project lead"
            >
              <ProjectLeadSelector
                orgSlug={params.orgSlug}
                projectKey={params.projectKey}
                selectedLead={project.leadId || ''}
                onLeadSelect={handleLeadChange}
                className='border-none bg-transparent shadow-none'
              />
            </PermissionAware>
            <div className='bg-muted-foreground/20 h-4 w-px' />
            <PermissionAware
              orgSlug={params.orgSlug}
              permission={PERMISSIONS.PROJECT_DELETE}
              scope={permissionScope}
              fallbackMessage="You don't have permission to delete this project"
            >
              <Button
                variant='ghost'
                size='sm'
                className='text-destructive hover:bg-destructive/10 hover:text-destructive h-6 gap-1 px-2'
                disabled={!canDeleteProject || isDeletingProject}
                onClick={() => void handleDeleteProject()}
              >
                <Trash2 className='size-3.5' />
                <span className='hidden sm:inline'>Delete</span>
              </Button>
            </PermissionAware>
          </div>
        </div>

        {/* Main Content */}
        <div className='py-3 sm:py-4'>
          {/* Project Header */}
          <div className='mx-auto max-w-5xl px-3 sm:px-4'>
            <div className='mb-2 max-w-4xl space-y-2'>
              <div className='text-muted-foreground flex items-center gap-2 text-xs'>
                <span className='font-mono'>{params.projectKey}</span>
                <span>•</span>
                <span>
                  Updated {formatDateHuman(new Date(project._creationTime))}
                </span>
              </div>

              {/* Title */}
              {editingTitle ? (
                <div className='flex items-center gap-2'>
                  {/* Icon that stays visible during editing */}
                  {canEdit ? (
                    <Popover>
                      <PopoverTrigger asChild>
                        <button className='flex items-center gap-0 transition-opacity hover:opacity-80'>
                          {iconValue ? (
                            (() => {
                              const IconComp = getDynamicIcon(iconValue);
                              if (!IconComp)
                                return (
                                  <FolderOpen className='text-muted-foreground size-6' />
                                );
                              return (
                                <IconComp
                                  className='size-6'
                                  style={{ color: colorValue || undefined }}
                                />
                              );
                            })()
                          ) : (
                            <div className='border-muted-foreground/50 flex size-6 items-center justify-center rounded border-2 border-dashed'>
                              <Plus className='text-muted-foreground size-3' />
                            </div>
                          )}
                        </button>
                      </PopoverTrigger>
                      <PopoverContent className='w-80' align='start'>
                        <div className='space-y-4'>
                          <div>
                            <h4 className='mb-2 text-sm font-medium'>
                              Project Icon
                            </h4>
                            <IconPicker
                              value={iconValue}
                              onValueChange={handleIconChange}
                              placeholder='Select project icon'
                              className='h-8 w-full'
                            />
                          </div>
                          <div>
                            <h4 className='mb-2 text-sm font-medium'>
                              Project Color
                            </h4>
                            <div className='flex flex-wrap gap-2'>
                              {DEFAULT_COLORS.map(colorOption => (
                                <button
                                  key={colorOption}
                                  type='button'
                                  className={`size-8 rounded-md border-2 transition-all ${
                                    colorValue === colorOption
                                      ? 'border-foreground scale-110'
                                      : 'border-border hover:scale-105'
                                  }`}
                                  style={{ backgroundColor: colorOption }}
                                  onClick={() => handleColorChange(colorOption)}
                                />
                              ))}
                            </div>
                          </div>
                        </div>
                      </PopoverContent>
                    </Popover>
                  ) : (
                    iconValue &&
                    (() => {
                      const IconComp = getDynamicIcon(iconValue);
                      if (!IconComp) return null;
                      return (
                        <IconComp
                          className='size-6'
                          style={{ color: colorValue || undefined }}
                        />
                      );
                    })()
                  )}
                  <Input
                    value={titleValue}
                    onChange={e => setTitleValue(e.target.value)}
                    className='h-auto border-none p-0 !text-3xl !leading-tight font-semibold shadow-none focus-visible:ring-0'
                    style={{ fontFamily: 'var(--font-title)' }}
                    onKeyDown={e => {
                      if (e.key === 'Enter') handleTitleSave();
                      if (e.key === 'Escape') {
                        setTitleValue(displayTitle);
                        setEditingTitle(false);
                      }
                    }}
                    autoFocus
                  />
                  <div className='flex items-center gap-1'>
                    <Button size='sm' onClick={handleTitleSave}>
                      <Save className='size-4' />
                    </Button>
                    <Button
                      size='sm'
                      variant='ghost'
                      onClick={() => {
                        setTitleValue(displayTitle);
                        setEditingTitle(false);
                      }}
                    >
                      <X className='size-4' />
                    </Button>
                  </div>
                </div>
              ) : (
                <h1 className='flex items-center gap-2 text-3xl leading-tight font-semibold'>
                  {/* Clickable Icon with Color */}
                  {canEdit ? (
                    <Popover>
                      <PopoverTrigger asChild>
                        <button className='flex items-center gap-0 transition-opacity hover:opacity-80'>
                          {iconValue ? (
                            (() => {
                              const IconComp = getDynamicIcon(iconValue);
                              if (!IconComp)
                                return (
                                  <FolderOpen className='text-muted-foreground size-6' />
                                );
                              return (
                                <IconComp
                                  className='size-6'
                                  style={{ color: colorValue || undefined }}
                                />
                              );
                            })()
                          ) : (
                            <div className='border-muted-foreground/50 flex size-6 items-center justify-center rounded border-2 border-dashed'>
                              <Plus className='text-muted-foreground size-3' />
                            </div>
                          )}
                        </button>
                      </PopoverTrigger>
                      <PopoverContent className='w-80' align='start'>
                        <div className='space-y-4'>
                          <div>
                            <h4 className='mb-2 text-sm font-medium'>
                              Project Icon
                            </h4>
                            <IconPicker
                              value={iconValue}
                              onValueChange={handleIconChange}
                              placeholder='Select project icon'
                              className='h-8 w-full'
                            />
                          </div>
                          <div>
                            <h4 className='mb-2 text-sm font-medium'>
                              Project Color
                            </h4>
                            <div className='flex flex-wrap gap-2'>
                              {DEFAULT_COLORS.map(colorOption => (
                                <button
                                  key={colorOption}
                                  type='button'
                                  className={`size-8 rounded-md border-2 transition-all ${
                                    colorValue === colorOption
                                      ? 'border-foreground scale-110'
                                      : 'border-border hover:scale-105'
                                  }`}
                                  style={{ backgroundColor: colorOption }}
                                  onClick={() => handleColorChange(colorOption)}
                                />
                              ))}
                            </div>
                          </div>
                        </div>
                      </PopoverContent>
                    </Popover>
                  ) : (
                    iconValue &&
                    (() => {
                      const IconComp = getDynamicIcon(iconValue);
                      if (!IconComp) return null;
                      return (
                        <IconComp
                          className='size-6'
                          style={{ color: colorValue || undefined }}
                        />
                      );
                    })()
                  )}
                  <span
                    className={cn(
                      'transition-colors',
                      canEdit && 'hover:text-muted-foreground cursor-pointer',
                    )}
                    onClick={() => {
                      if (!canEdit) return;
                      setTitleValue(displayTitle);
                      setEditingTitle(true);
                    }}
                  >
                    {displayTitle}
                  </span>
                </h1>
              )}
            </div>

            {/* Description */}
            <div className='mb-4'>
              {editingDescription ? (
                <div className='space-y-4'>
                  <RichEditor
                    value={descriptionValue}
                    onChange={setDescriptionValue}
                    placeholder='Add a description...'
                    mode='compact'
                  />
                  <div className='flex items-center gap-3'>
                    <Button onClick={handleDescriptionSave}>
                      <Save className='mr-2 size-4' />
                      Save
                    </Button>
                    <Button
                      variant='outline'
                      onClick={() => {
                        setDescriptionValue(displayDescription);
                        setEditingDescription(false);
                      }}
                    >
                      Cancel
                    </Button>
                  </div>
                </div>
              ) : (
                <div>
                  {displayDescription ? (
                    <div
                      className={cn(
                        'prose prose-sm text-muted-foreground max-w-none transition-colors',
                        canEdit && 'hover:text-foreground cursor-pointer',
                      )}
                      onClick={() => {
                        if (!canEdit) return;
                        setDescriptionValue(displayDescription);
                        setEditingDescription(true);
                      }}
                    >
                      <RichEditor
                        value={displayDescription}
                        onChange={() => {}}
                        mode='compact'
                        disabled={true}
                      />
                    </div>
                  ) : canEdit ? (
                    <button
                      className='text-muted-foreground hover:text-foreground border-muted-foreground/20 hover:border-muted-foreground/40 w-full rounded-lg border-2 border-dashed bg-transparent p-4 text-left text-base'
                      onClick={() => {
                        setDescriptionValue(displayDescription);
                        setEditingDescription(true);
                      }}
                    >
                      Add a description...
                    </button>
                  ) : (
                    <p className='text-muted-foreground text-sm'>
                      No description provided.
                    </p>
                  )}
                </div>
              )}
            </div>

            {/* Properties Bar */}
            <TooltipProvider>
              <div className='mb-6 flex max-w-4xl flex-wrap items-center gap-2'>
                {/* Status */}
                <PermissionAware
                  orgSlug={params.orgSlug}
                  permission={PERMISSIONS.PROJECT_EDIT}
                  scope={permissionScope}
                  fallbackMessage="You don't have permission to change status"
                >
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <div>
                        <StatusSelector
                          statuses={statuses || []}
                          selectedStatus={project.statusId || ''}
                          onStatusSelect={handleStatusChange}
                          displayMode='iconWhenUnselected'
                        />
                      </div>
                    </TooltipTrigger>
                    <TooltipContent side='bottom'>Status</TooltipContent>
                  </Tooltip>
                </PermissionAware>

                {/* Lead */}
                <PermissionAware
                  orgSlug={params.orgSlug}
                  permission={PERMISSIONS.PROJECT_EDIT}
                  scope={permissionScope}
                  fallbackMessage="You don't have permission to change lead"
                >
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <div>
                        <ProjectLeadSelector
                          orgSlug={params.orgSlug}
                          projectKey={params.projectKey}
                          selectedLead={project.leadId || ''}
                          onLeadSelect={handleLeadChange}
                          displayMode='iconWhenUnselected'
                        />
                      </div>
                    </TooltipTrigger>
                    <TooltipContent side='bottom'>Lead</TooltipContent>
                  </Tooltip>
                </PermissionAware>

                {/* Team */}
                <PermissionAware
                  orgSlug={params.orgSlug}
                  permission={PERMISSIONS.PROJECT_EDIT}
                  scope={permissionScope}
                  fallbackMessage="You don't have permission to change team"
                >
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <div>
                        <TeamSelector
                          teams={teams || []}
                          selectedTeam={project.teamId || ''}
                          onTeamSelect={handleTeamChange}
                          displayMode='iconWhenUnselected'
                        />
                      </div>
                    </TooltipTrigger>
                    <TooltipContent side='bottom'>Team</TooltipContent>
                  </Tooltip>
                </PermissionAware>

                {/* Dates */}
                <ProjectDateRangePicker
                  project={project}
                  updateMutation={updateMutation}
                  orgSlug={params.orgSlug}
                  permissionScope={permissionScope}
                />

                {/* Created */}
                <Tooltip>
                  <TooltipTrigger asChild>
                    <div className='text-muted-foreground hover:bg-muted/50 flex h-8 items-center gap-1.5 rounded-md border px-2.5 text-sm transition-colors'>
                      <ClockIcon className='size-3.5' />
                      <span>
                        {formatDateHuman(new Date(project._creationTime))}
                      </span>
                    </div>
                  </TooltipTrigger>
                  <TooltipContent side='bottom'>Created</TooltipContent>
                </Tooltip>
              </div>
            </TooltipProvider>
          </div>
          {/* end max-w-5xl */}

          {/* Tabs: Issues / Activity / Members */}
          <Tabs value={projectTab} onValueChange={setProjectTab}>
            <div className='space-y-2 px-3 sm:px-4'>
              <div className='overflow-x-auto'>
                <TabsList>
                  <TabsTrigger value='issues'>Issues</TabsTrigger>
                  <TabsTrigger value='activity'>Activity</TabsTrigger>
                  <TabsTrigger value='members'>Members</TabsTrigger>
                </TabsList>
              </div>

              {/* Members controls */}
              {projectTab === 'members' && (
                <div className='flex items-center gap-2'>
                  <div className='relative'>
                    {deferredMemberSearch !== memberSearchText ? (
                      <Loader2 className='text-muted-foreground pointer-events-none absolute top-1/2 left-2 size-3 -translate-y-1/2 animate-spin' />
                    ) : (
                      <Search className='text-muted-foreground pointer-events-none absolute top-1/2 left-2 size-3 -translate-y-1/2' />
                    )}
                    <Input
                      placeholder='Search members...'
                      value={memberSearchText}
                      onChange={e => setMemberSearchText(e.target.value)}
                      className='h-6 w-40 pl-7 text-xs'
                    />
                  </div>
                </div>
              )}

              {/* Issues controls — only visible on issues tab */}
              {projectTab === 'issues' && (
                <div className='flex items-center gap-2'>
                  <div className='relative'>
                    {deferredIssueSearch !== issueSearchText ? (
                      <Loader2 className='text-muted-foreground pointer-events-none absolute top-1/2 left-2 size-3 -translate-y-1/2 animate-spin' />
                    ) : (
                      <Search className='text-muted-foreground pointer-events-none absolute top-1/2 left-2 size-3 -translate-y-1/2' />
                    )}
                    <Input
                      placeholder='Search issues...'
                      value={issueSearchText}
                      onChange={e => setIssueSearchText(e.target.value)}
                      className='h-6 w-40 pl-7 text-xs'
                    />
                  </div>
                  <div className='border-border flex items-center rounded-md border'>
                    <Button
                      variant={
                        issueViewMode === 'kanban' ? 'secondary' : 'ghost'
                      }
                      size='sm'
                      className='h-6 rounded-r-none px-2'
                      onClick={() => setIssueViewMode('kanban')}
                    >
                      <Columns3 className='size-3.5' />
                    </Button>
                    <Button
                      variant={
                        issueViewMode === 'table' ? 'secondary' : 'ghost'
                      }
                      size='sm'
                      className='h-6 rounded-l-none px-2'
                      onClick={() => setIssueViewMode('table')}
                    >
                      <LayoutList className='size-3.5' />
                    </Button>
                  </div>
                  {project && (
                    <CreateIssueDialog
                      orgSlug={params.orgSlug}
                      defaultStates={{ projectId: project._id }}
                      className='h-6 text-xs'
                    />
                  )}
                </div>
              )}
            </div>

            {/* Issues Tab */}
            <TabsContent value='issues'>
              <AnimatePresence mode='wait' initial={false}>
                {projectIssuesData === undefined ? (
                  <motion.div
                    key='loading'
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.15 }}
                  >
                    {issueViewMode === 'kanban' ? (
                      <KanbanSkeleton />
                    ) : (
                      <div className='px-3 sm:px-4'>
                        <div className='overflow-hidden rounded-lg border'>
                          <TableSkeleton rows={5} columns={4} />
                        </div>
                      </div>
                    )}
                  </motion.div>
                ) : projectIssues.length === 0 ? (
                  <motion.div
                    key='empty'
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.15 }}
                    className='px-3 sm:px-4'
                  >
                    <div className='text-muted-foreground flex flex-col items-center gap-3 rounded-lg border border-dashed px-3 py-12 text-center'>
                      <div className='flex items-end gap-1'>
                        <div className='bg-muted h-8 w-5 rounded-sm' />
                        <div className='bg-muted h-12 w-5 rounded-sm' />
                        <div className='bg-muted h-6 w-5 rounded-sm' />
                        <div className='bg-muted h-10 w-5 rounded-sm' />
                      </div>
                      <p className='text-sm'>
                        {issueSearchText
                          ? 'No issues match your search.'
                          : 'No issues yet. Create one to get started.'}
                      </p>
                    </div>
                  </motion.div>
                ) : issueViewMode === 'kanban' ? (
                  <motion.div
                    key='kanban'
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.15 }}
                    className='overflow-hidden'
                  >
                    <IssuesKanban
                      orgSlug={params.orgSlug}
                      issues={projectIssues}
                      states={issueStates ?? []}
                      priorities={issuePriorities ?? []}
                      teams={teams ?? []}
                      currentUserId={user?._id || ''}
                      onStateChange={(_issueId, assignmentId, stateId) => {
                        void changeAssignmentStateMutation({
                          assignmentId: assignmentId as Id<'issueAssignees'>,
                          stateId: stateId as Id<'issueStates'>,
                        });
                      }}
                      onPriorityChange={(issueId, priorityId) => {
                        void changePriorityMutation({
                          issueId: issueId as Id<'issues'>,
                          priorityId: priorityId as Id<'issuePriorities'>,
                        });
                      }}
                      onAssigneesChange={(issueId, assigneeIds) => {
                        void updateAssigneesMutation({
                          issueId: issueId as Id<'issues'>,
                          assigneeIds: assigneeIds as Id<'users'>[],
                        });
                      }}
                      onDelete={canDeleteIssue ? handleDeleteIssue : undefined}
                      deletePending={isDeletingIssue}
                      createDefaults={{ projectId: project._id }}
                    />
                  </motion.div>
                ) : (
                  <motion.div
                    key='table'
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.15 }}
                    className='px-3 sm:px-4'
                  >
                    <div className='overflow-hidden rounded-lg border'>
                      <IssuesTable
                        orgSlug={params.orgSlug}
                        issues={projectIssues}
                        states={issueStates ?? []}
                        priorities={issuePriorities ?? []}
                        teams={teams ?? []}
                        projects={[]}
                        onPriorityChange={() => {}}
                        onAssigneesChange={() => {}}
                        onTeamChange={() => {}}
                        onProjectChange={() => {}}
                        onDelete={() => {}}
                        onAssignmentStateChange={() => {}}
                        currentUserId={user?._id || ''}
                        activeFilter='all'
                      />
                    </div>
                    {projectIssuesTotal > ISSUE_PAGE_SIZE && (
                      <div className='text-muted-foreground flex items-center justify-between px-1 py-1.5 text-xs'>
                        <span>
                          Page {issuePage} of{' '}
                          {Math.max(
                            1,
                            Math.ceil(projectIssuesTotal / ISSUE_PAGE_SIZE),
                          )}
                        </span>
                        <div className='flex gap-1'>
                          <Button
                            variant='ghost'
                            size='sm'
                            className='h-6 px-2 text-xs'
                            disabled={issuePage === 1}
                            onClick={() =>
                              setIssuePage(p => Math.max(1, p - 1))
                            }
                          >
                            Prev
                          </Button>
                          <Button
                            variant='ghost'
                            size='sm'
                            className='h-6 px-2 text-xs'
                            disabled={
                              issuePage * ISSUE_PAGE_SIZE >= projectIssuesTotal
                            }
                            onClick={() => setIssuePage(p => p + 1)}
                          >
                            Next
                          </Button>
                        </div>
                      </div>
                    )}
                  </motion.div>
                )}
              </AnimatePresence>
            </TabsContent>

            {/* Activity Tab */}
            <TabsContent value='activity'>
              <div className='px-3 sm:px-4'>
                {projectId ? (
                  <ProjectActivityFeed
                    orgSlug={params.orgSlug}
                    projectId={projectId}
                  />
                ) : null}
              </div>
            </TabsContent>

            {/* Members Tab */}
            <TabsContent value='members'>
              <div className='px-3 sm:px-4'>
                <ProjectMembersSection
                  orgSlug={params.orgSlug}
                  projectKey={params.projectKey}
                  searchQuery={deferredMemberSearch}
                />
              </div>
            </TabsContent>
          </Tabs>
        </div>
      </div>
      <ConfirmDeleteDialog />
    </div>
  );
}
