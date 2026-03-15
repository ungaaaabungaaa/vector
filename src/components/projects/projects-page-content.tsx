'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { useQuery, useMutation } from 'convex/react';
import { api } from '@/lib/convex';
import type { Id } from '../../../convex/_generated/dataModel';
import { ProjectsTable } from './projects-table';
import type { ProjectRowData } from './projects-table';
import { ProjectsKanban } from './projects-kanban';
import { CreateProjectButton } from './create-project-button';

import { cn } from '@/lib/utils';
import { LayoutList, Columns3 } from 'lucide-react';
import { PageSkeleton } from '@/components/ui/table-skeleton';
import { MobileNavTrigger } from '@/app/[orgSlug]/(main)/layout';
import { useSearchParams, useRouter } from 'next/navigation';

// Define project status types based on Convex schema
type StatusType =
  | 'backlog'
  | 'planned'
  | 'in_progress'
  | 'completed'
  | 'canceled';
type FilterType = 'all' | StatusType;

const TAB_LABELS: Record<FilterType, string> = {
  all: 'All',
  backlog: 'Backlog',
  planned: 'Planned',
  in_progress: 'In Progress',
  completed: 'Completed',
  canceled: 'Canceled',
};

// Base tabs array used to compute counts later
const BASE_TABS: { key: FilterType; label: string; count: number }[] = [
  { key: 'all', label: TAB_LABELS.all, count: 0 },
  // status tabs appended dynamically below
];

const statusValues: StatusType[] = [
  'backlog',
  'planned',
  'in_progress',
  'completed',
  'canceled',
];

const filterTabs = [
  ...BASE_TABS,
  ...statusValues.map(value => ({
    key: value as FilterType,
    label: TAB_LABELS[value],
    count: 0,
  })),
];

interface ProjectsPageContentProps {
  orgSlug: string;
}

type ViewMode = 'table' | 'kanban';

export function ProjectsPageContent({ orgSlug }: ProjectsPageContentProps) {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [activeFilter, setActiveFilter] = useState<FilterType>('all');

  const viewParam = searchParams.get('view');
  const viewMode: ViewMode = viewParam === 'kanban' ? 'kanban' : 'table';
  const setViewMode = (mode: ViewMode) => {
    const sp = new URLSearchParams(searchParams.toString());
    if (mode === 'table') {
      sp.delete('view');
    } else {
      sp.set('view', mode);
    }
    router.replace(`?${sp.toString()}`, { scroll: false });
  };

  // Pagination constants
  const PAGE_SIZE = 25;
  const [page, setPage] = useState(1);

  // Queries
  const projectsData = useQuery(api.projects.queries.list, { orgSlug });
  const statusesData = useQuery(api.organizations.queries.listProjectStatuses, {
    orgSlug,
  });
  const teamsData = useQuery(api.organizations.queries.listTeams, { orgSlug });
  const membersData = useQuery(api.organizations.queries.listMembers, {
    orgSlug,
  });

  // Transform data to match expected interfaces
  const projects: ProjectRowData[] = (projectsData ?? []).map(project => ({
    id: project._id,
    name: project.name,
    description: project.description,
    key: project.key,
    updatedAt: new Date(project._creationTime), // Using creation time as update time for now
    createdAt: new Date(project._creationTime),
    icon: project.icon,
    color: project.color,
    statusId: project.status?._id,
    statusName: project.status?.name,
    statusColor: project.status?.color,
    statusIcon: project.status?.icon,
    statusType: project.status?.type,
    teamId: project.teamId,
    teamName: undefined, // Will need to be populated from teams data
    teamKey: undefined, // Will need to be populated from teams data
    leadId: project.lead?._id,
    leadName: project.lead?.name,
    leadEmail: project.lead?.email,
    leadImage: project.lead?.image,
  }));

  const statuses = (statusesData ?? []).map(status => ({
    _id: status._id,
    name: status.name,
    color: status.color,
    icon: status.icon,
    type: status.type,
  }));

  const teams = (teamsData ?? []).map(team => ({
    id: team._id,
    name: team.name,
    key: team.key,
    color: team.color,
    icon: team.icon,
  }));

  // Mutations
  const changeStatusMutation = useMutation(api.projects.mutations.update);
  const changeTeamMutation = useMutation(api.projects.mutations.update);
  const changeLeadMutation = useMutation(api.projects.mutations.update);
  const deleteMutation = useMutation(api.projects.mutations.deleteProject);

  // Event handlers
  const handleStatusChange = (projectId: string, statusId: string) => {
    if (statusId) {
      void changeStatusMutation({
        projectId: projectId as Id<'projects'>,
        data: { statusId: statusId as Id<'projectStatuses'> },
      });
    }
  };

  const handleTeamChange = (projectId: string, teamId: string) => {
    if (teamId) {
      void changeTeamMutation({
        projectId: projectId as Id<'projects'>,
        data: { teamId: teamId as Id<'teams'> },
      });
    }
  };

  const handleLeadChange = (projectId: string, leadId: string) => {
    if (leadId) {
      void changeLeadMutation({
        projectId: projectId as Id<'projects'>,
        data: { leadId: leadId as Id<'users'> },
      });
    }
  };

  const handleDelete = (projectId: string) => {
    void deleteMutation({
      projectId: projectId as Id<'projects'>,
    });
  };

  // Filter projects based on active filter
  const filteredProjects = projects.filter(project => {
    if (activeFilter === 'all') return true;
    const status = statuses.find(s => s._id === project.statusId);
    return status?.type === activeFilter;
  });

  // Calculate counts for each status
  const statusCounts = statusValues.reduce(
    (acc, statusType) => {
      const count = projects.filter(project => {
        const status = statuses.find(s => s._id === project.statusId);
        return status?.type === statusType;
      }).length;
      acc[statusType] = count;
      return acc;
    },
    {} as Record<StatusType, number>,
  );

  // Update tabs with counts
  const updatedTabs = filterTabs.map(tab => {
    if (tab.key === 'all') {
      return { ...tab, count: projects.length };
    }
    return { ...tab, count: statusCounts[tab.key as StatusType] || 0 };
  });

  const visibleTabs = updatedTabs.filter(t => t.key === 'all' || t.count > 0);

  const isLoading =
    projectsData === undefined ||
    statusesData === undefined ||
    teamsData === undefined ||
    membersData === undefined;

  const total = projects.length;

  if (isLoading) {
    return (
      <PageSkeleton
        showTabs={true}
        tabCount={visibleTabs.length || 6}
        showCreateButton={true}
        tableRows={8}
        tableColumns={6}
      />
    );
  }

  return (
    <div className='bg-background h-full'>
      <div className='flex flex-col'>
        {/* Header with tabs and create button */}
        <div className='flex items-center justify-between gap-1 border-b p-1'>
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

          <div className='flex shrink-0 items-center gap-1'>
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

            <CreateProjectButton
              className='h-6 shrink-0'
              orgSlug={orgSlug}
              size='sm'
            />
          </div>
        </div>

        {/* Projects content */}
        {viewMode === 'table' ? (
          <>
            <div className='flex-1 overflow-y-auto'>
              <ProjectsTable
                orgSlug={orgSlug}
                projects={filteredProjects}
                statuses={statuses}
                teams={teams}
                onStatusChange={handleStatusChange}
                onTeamChange={handleTeamChange}
                onLeadChange={handleLeadChange}
                onDelete={handleDelete}
                deletePending={false}
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
          </>
        ) : (
          <div className='flex-1 overflow-hidden'>
            <ProjectsKanban
              orgSlug={orgSlug}
              projects={filteredProjects}
              statuses={statuses}
              onStatusChange={handleStatusChange}
              onLeadChange={handleLeadChange}
            />
          </div>
        )}
      </div>
    </div>
  );
}
