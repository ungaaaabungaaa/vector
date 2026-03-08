'use client';

import { useQuery, useMutation } from 'convex/react';
import { api } from '@/lib/convex';
import { Button } from '@/components/ui/button';
import { CreateIssueDialog } from '@/components/issues/create-issue-dialog';
import { useParams, useSearchParams } from 'next/navigation';
import { useDeferredValue, useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { cn } from '@/lib/utils';
import { LayoutList, Columns3, Search, Loader2 } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { IssuesTable } from '@/components/issues/issues-table';
import { IssuesKanban } from '@/components/issues/issues-kanban';
import { PageSkeleton, KanbanSkeleton } from '@/components/ui/table-skeleton';
import {
  ProjectSelector,
  TeamSelector,
} from '@/components/issues/issue-selectors';
import { ISSUE_STATE_DEFAULTS } from '@/lib/defaults';
import type { Id } from '@/convex/_generated/dataModel';
import { PermissionAware } from '@/components/ui/permission-aware';
import { PERMISSIONS } from '@/convex/_shared/permissions';
import { useConfirm } from '@/hooks/use-confirm';
import { MobileNavTrigger } from '../layout';

type StateType = (typeof ISSUE_STATE_DEFAULTS)[number]['type'];
type FilterType = 'all' | StateType;
type ViewMode = 'table' | 'kanban';

const TAB_LABELS: Record<FilterType, string> = {
  all: 'All',
  backlog: 'Backlog',
  todo: 'To Do',
  in_progress: 'In Progress',
  done: 'Done',
  canceled: 'Canceled',
} as const;

const BASE_TABS: { key: FilterType; label: string; count: number }[] = [
  { key: 'all', label: TAB_LABELS.all, count: 0 },
];
const filterTabs = [
  ...BASE_TABS,
  ...ISSUE_STATE_DEFAULTS.map(value => ({
    key: value.type as FilterType,
    label: TAB_LABELS[value.type as StateType],
    count: 0,
  })),
];

export default function IssuesPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const orgSlug = params.orgSlug as string;
  const [activeFilter, setActiveFilter] = useState<FilterType>('all');
  const isMyIssuesView = searchParams.get('assignee') === 'me';

  const viewParam = searchParams.get('view');
  const [viewMode, setViewModeState] = useState<ViewMode>(
    viewParam === 'table' ? 'table' : 'kanban',
  );
  const setViewMode = (mode: ViewMode) => {
    setViewModeState(mode);
    const sp = new URLSearchParams(window.location.search);
    if (mode === 'kanban') {
      sp.delete('view');
    } else {
      sp.set('view', mode);
    }
    const qs = sp.toString();
    window.history.replaceState(
      null,
      '',
      qs ? `?${qs}` : window.location.pathname,
    );
  };
  const [selectedProject, setSelectedProject] = useState<string>('');
  const [selectedTeam, setSelectedTeam] = useState<string>('');
  const [searchText, setSearchText] = useState('');
  const deferredSearch = useDeferredValue(searchText);
  const [page, setPage] = useState(1);
  const PAGE_SIZE = 25;

  const user = useQuery(api.users.currentUser);
  const currentUserId = user?._id || '';

  const [isDeleting, setIsDeleting] = useState(false);
  const [isUpdatingAssignees, setIsUpdatingAssignees] = useState(false);
  const [isUpdatingAssignmentStates, setIsUpdatingAssignmentStates] =
    useState(false);

  const [confirm, ConfirmDialog] = useConfirm();
  const deleteMutation = useMutation(api.issues.mutations.deleteIssue);
  const changePriorityMutation = useMutation(
    api.issues.mutations.changePriority,
  );
  const updateAssigneesMutation = useMutation(
    api.issues.mutations.updateAssignees,
  );
  const changeTeamMutation = useMutation(api.issues.mutations.changeTeam);
  const changeProjectMutation = useMutation(api.issues.mutations.changeProject);
  const changeAssignmentStateMutation = useMutation(
    api.issues.mutations.changeAssignmentState,
  );

  const states = useQuery(api.organizations.queries.listIssueStates, {
    orgSlug,
  });
  const priorities = useQuery(api.organizations.queries.listIssuePriorities, {
    orgSlug,
  });
  const teams = useQuery(api.organizations.queries.listTeams, { orgSlug });
  const projects = useQuery(api.organizations.queries.listProjects, {
    orgSlug,
  });

  const issuesData = useQuery(api.issues.queries.listIssues, {
    orgSlug,
    projectId: selectedProject || undefined,
    teamId: selectedTeam || undefined,
    assigneeId: isMyIssuesView ? currentUserId || undefined : undefined,
    searchQuery: deferredSearch || undefined,
    page: viewMode === 'table' ? page : undefined,
    pageSize: viewMode === 'table' ? PAGE_SIZE : undefined,
    includeCounts: true,
  });
  const { issues, total, counts } = issuesData ?? {
    issues: [],
    total: 0,
    counts: {},
  };

  // Reset page when filters change
  useEffect(() => {
    setPage(1);
  }, [deferredSearch, selectedProject, selectedTeam, activeFilter]);

  const handlePriorityChange = (issueId: string, priorityId: string) => {
    if (!user || !priorityId) return;
    void changePriorityMutation({
      issueId: issueId as Id<'issues'>,
      priorityId: priorityId as Id<'issuePriorities'>,
    });
  };

  const handleAssigneesChange = async (
    issueId: string,
    assigneeIds: string[],
  ) => {
    if (!user) return;
    setIsUpdatingAssignees(true);
    try {
      await updateAssigneesMutation({
        issueId: issueId as Id<'issues'>,
        assigneeIds: assigneeIds as Id<'users'>[],
      });
    } finally {
      setIsUpdatingAssignees(false);
    }
  };

  const handleTeamChange = (issueId: string, teamId: string) => {
    if (!user) return;
    void changeTeamMutation({
      issueId: issueId as Id<'issues'>,
      teamId: (teamId as Id<'teams'>) || null,
    });
  };

  const handleProjectChange = (issueId: string, projectId: string) => {
    if (!user) return;
    void changeProjectMutation({
      issueId: issueId as Id<'issues'>,
      projectId: (projectId as Id<'projects'>) || null,
    });
  };

  const handleAssignmentStateChange = async (
    assignmentId: string,
    stateId: string,
  ) => {
    if (!user || !assignmentId || !stateId) return;
    setIsUpdatingAssignmentStates(true);
    try {
      await changeAssignmentStateMutation({
        assignmentId: assignmentId as Id<'issueAssignees'>,
        stateId: stateId as Id<'issueStates'>,
      });
    } finally {
      setIsUpdatingAssignmentStates(false);
    }
  };

  const handleDelete = async (issueId: string) => {
    const ok = await confirm({
      title: 'Delete issue',
      description:
        'This will permanently delete the issue and cannot be undone.',
      confirmLabel: 'Delete',
      variant: 'destructive',
    });
    if (!ok) return;
    setIsDeleting(true);
    try {
      await deleteMutation({ issueId: issueId as Id<'issues'> });
    } finally {
      setIsDeleting(false);
    }
  };

  const canChangeAll = user?.role === 'admin';

  const updatedTabs = filterTabs.map(tab => ({
    ...tab,
    count:
      tab.key === 'all'
        ? total
        : ((counts as Record<string, number>)[tab.key as string] ?? 0),
  }));

  const visibleTabs = updatedTabs.filter(t => t.key === 'all' || t.count > 0);

  if (user === undefined || issuesData === undefined || states === undefined) {
    return viewMode === 'kanban' ? (
      <div className='bg-background h-full'>
        <div className='border-b'>
          <div className='flex items-center justify-between p-1'>
            <div className='flex items-center gap-1'>
              {Array.from({ length: 5 }).map((_, i) => (
                <div
                  key={i}
                  className='bg-muted/70 h-6 w-16 animate-pulse rounded-md'
                />
              ))}
            </div>
            <div className='bg-muted/70 h-6 w-20 animate-pulse rounded-md' />
          </div>
        </div>
        <KanbanSkeleton />
      </div>
    ) : (
      <PageSkeleton
        showTabs={true}
        tabCount={5}
        showCreateButton={true}
        tableRows={8}
        tableColumns={6}
      />
    );
  }

  const mappedTeams = teams ?? [];
  const mappedProjects = projects ?? [];

  return (
    <div className='bg-background h-full'>
      {/* Header with tabs */}
      <div className='border-b'>
        <div className='flex items-center justify-between gap-1 p-1'>
          <div className='flex min-w-0 flex-1 items-center gap-1 overflow-x-auto'>
            <MobileNavTrigger />
            {visibleTabs.map(tab => (
              <Button
                key={tab.key}
                variant={activeFilter === tab.key ? 'secondary' : 'ghost'}
                size='sm'
                className={cn(
                  'h-6 shrink-0 gap-2 rounded-xs px-3 text-xs font-normal',
                  activeFilter === tab.key && 'bg-secondary',
                )}
                onClick={() => setActiveFilter(tab.key)}
              >
                <span>{tab.label}</span>
                <span className='text-muted-foreground text-xs'>
                  {tab.count}
                </span>
              </Button>
            ))}
          </div>

          {/* View switcher + filters + create */}
          <div className='flex shrink-0 items-center gap-1'>
            {/* Search */}
            <div className='relative'>
              {deferredSearch !== searchText ? (
                <Loader2 className='text-muted-foreground pointer-events-none absolute top-1/2 left-2 size-3 -translate-y-1/2 animate-spin' />
              ) : (
                <Search className='text-muted-foreground pointer-events-none absolute top-1/2 left-2 size-3 -translate-y-1/2' />
              )}
              <Input
                placeholder='Search issues...'
                value={searchText}
                onChange={e => setSearchText(e.target.value)}
                className='h-6 w-40 pl-7 text-xs'
              />
            </div>
            {/* View mode toggle */}
            <div className='border-border flex items-center rounded-md border'>
              <Button
                variant={viewMode === 'table' ? 'secondary' : 'ghost'}
                size='sm'
                className='h-6 rounded-r-none px-2'
                onClick={() => setViewMode('table')}
              >
                <LayoutList className='size-3.5' />
              </Button>
              <Button
                variant={viewMode === 'kanban' ? 'secondary' : 'ghost'}
                size='sm'
                className='h-6 rounded-l-none px-2'
                onClick={() => setViewMode('kanban')}
              >
                <Columns3 className='size-3.5' />
              </Button>
            </div>

            {/* Team filter */}
            <PermissionAware
              orgSlug={orgSlug}
              permission={PERMISSIONS.TEAM_VIEW}
              fallbackMessage="You don't have permission to view teams"
              showTooltip={true}
            >
              <TeamSelector
                teams={mappedTeams}
                selectedTeam={selectedTeam}
                onTeamSelect={setSelectedTeam}
                displayMode='iconWhenUnselected'
                className='h-6 text-xs'
              />
            </PermissionAware>

            {/* Project filter - hidden on small screens */}
            <div className='hidden sm:block'>
              <PermissionAware
                orgSlug={orgSlug}
                permission={PERMISSIONS.PROJECT_VIEW}
                fallbackMessage="You don't have permission to view projects"
                showTooltip={true}
              >
                <ProjectSelector
                  projects={mappedProjects}
                  selectedProject={selectedProject}
                  onProjectSelect={setSelectedProject}
                  displayMode='iconWhenUnselected'
                  className='h-6 text-xs'
                />
              </PermissionAware>
            </div>

            <CreateIssueDialog className='h-6' orgSlug={orgSlug} />
          </div>
        </div>
      </div>

      {/* Issues content */}
      <AnimatePresence mode='wait' initial={false}>
        {viewMode === 'table' ? (
          <motion.div
            key='table'
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            className='flex flex-1 flex-col'
          >
            <div className='flex-1'>
              <IssuesTable
                orgSlug={orgSlug}
                issues={issues}
                states={states ?? []}
                priorities={priorities ?? []}
                teams={teams ?? []}
                projects={projects ?? []}
                onPriorityChange={handlePriorityChange}
                onAssigneesChange={handleAssigneesChange}
                onTeamChange={handleTeamChange}
                onProjectChange={handleProjectChange}
                onDelete={handleDelete}
                deletePending={isDeleting}
                isUpdatingAssignees={isUpdatingAssignees}
                onAssignmentStateChange={handleAssignmentStateChange}
                isUpdatingAssignmentStates={isUpdatingAssignmentStates}
                currentUserId={currentUserId}
                canChangeAll={canChangeAll}
                activeFilter={activeFilter}
              />
            </div>

            {/* Pagination controls */}
            <div className='text-muted-foreground flex items-center justify-between border-t px-3 py-1.5 text-xs'>
              <span>
                Page {page} of {Math.max(1, Math.ceil(total / PAGE_SIZE))}
              </span>
              <div className='flex gap-1'>
                <Button
                  variant='ghost'
                  size='sm'
                  className='h-6 px-2 text-xs'
                  disabled={page === 1}
                  onClick={() => setPage(p => Math.max(1, p - 1))}
                >
                  Prev
                </Button>
                <Button
                  variant='ghost'
                  size='sm'
                  className='h-6 px-2 text-xs'
                  disabled={page * PAGE_SIZE >= total}
                  onClick={() => setPage(p => p + 1)}
                >
                  Next
                </Button>
              </div>
            </div>
          </motion.div>
        ) : (
          <motion.div
            key='kanban'
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            className='flex-1 overflow-hidden'
          >
            <IssuesKanban
              orgSlug={orgSlug}
              issues={issues}
              states={states ?? []}
              priorities={priorities ?? []}
              teams={teams ?? []}
              projects={projects ?? []}
              currentUserId={currentUserId}
              onStateChange={(_issueId, assignmentId, stateId) => {
                void handleAssignmentStateChange(assignmentId, stateId);
              }}
              onPriorityChange={handlePriorityChange}
              onAssigneesChange={(issueId, ids) => {
                void handleAssigneesChange(issueId, ids);
              }}
              onTeamChange={handleTeamChange}
              onProjectChange={handleProjectChange}
              onDelete={handleDelete}
              deletePending={isDeleting}
            />
          </motion.div>
        )}
      </AnimatePresence>
      <ConfirmDialog />
    </div>
  );
}
