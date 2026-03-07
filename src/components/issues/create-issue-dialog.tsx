'use client';

import { useState, useEffect, useMemo } from 'react';
import { useQuery, useMutation } from 'convex/react';
import { api } from '@/lib/convex';
import { PermissionAwareButton } from '@/components/ui/permission-aware';
import { PERMISSIONS } from '@/convex/_shared/permissions';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Building2,
  Users,
  FolderOpen,
  Check,
  MoreHorizontal,
  Plus,
} from 'lucide-react';
import { Textarea } from '../ui/textarea';
import { cn } from '@/lib/utils';
import { Id } from '@/convex/_generated/dataModel';
import { withIds } from '@/lib/convex-helpers';
import { toast } from 'sonner';

// Extracted selector components
import {
  TeamSelector,
  ProjectSelector,
  StateSelector,
  PrioritySelector,
  AssigneeSelector,
  IssueSelector,
  type Team,
  type Project,
  type State,
  type Priority,
} from './issue-selectors';
import {
  VisibilitySelector,
  type VisibilityState,
} from '@/components/ui/visibility-selector';

// Types with id field added by withIds transformation
type TeamWithId = Team & { id: string };
type ProjectWithId = Project & { id: string };
type StateWithId = State & { id: string };
type PriorityWithId = Priority & { id: string };

// ---------------------------------------------------------------------------
// 🧩 Type inference – derive types directly from Convex API
// ---------------------------------------------------------------------------

// Key Format Selector Component
interface KeyFormatSelectorProps {
  manualFormatOverride: 'team' | 'project' | 'org' | null;
  setManualFormatOverride: (value: 'team' | 'project' | 'org' | null) => void;
  preview: string;
}

function KeyFormatSelector({
  manualFormatOverride,
  setManualFormatOverride,
  preview,
}: KeyFormatSelectorProps) {
  return (
    <div className='flex items-center gap-2'>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant='ghost'
            size='sm'
            className='hover:bg-muted/50 h-6 w-6 rounded-md p-0'
          >
            <MoreHorizontal className='text-muted-foreground h-3 w-3' />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align='end' className='w-52 p-1'>
          <DropdownMenuItem
            onClick={() => setManualFormatOverride(null)}
            className='cursor-pointer rounded-sm px-3 py-2 text-sm'
          >
            <span className='flex w-full items-center justify-between'>
              <span className='flex items-center gap-2'>
                <div className='flex h-4 w-4 items-center justify-center'>
                  {!manualFormatOverride && (
                    <Check className='text-primary h-3 w-3' />
                  )}
                </div>
                Auto-detect format
              </span>
            </span>
          </DropdownMenuItem>
          <DropdownMenuItem
            onClick={() => setManualFormatOverride('org')}
            className='cursor-pointer rounded-sm px-3 py-2 text-sm'
          >
            <span className='flex w-full items-center justify-between'>
              <span className='flex items-center gap-2'>
                <div className='flex h-4 w-4 items-center justify-center'>
                  {manualFormatOverride === 'org' ? (
                    <Check className='text-primary h-3 w-3' />
                  ) : (
                    <Building2 className='text-muted-foreground h-3 w-3' />
                  )}
                </div>
                Org format
              </span>
            </span>
          </DropdownMenuItem>
          <DropdownMenuItem
            onClick={() => setManualFormatOverride('team')}
            className='cursor-pointer rounded-sm px-3 py-2 text-sm'
          >
            <span className='flex w-full items-center justify-between'>
              <span className='flex items-center gap-2'>
                <div className='flex h-4 w-4 items-center justify-center'>
                  {manualFormatOverride === 'team' ? (
                    <Check className='text-primary h-3 w-3' />
                  ) : (
                    <Users className='text-muted-foreground h-3 w-3' />
                  )}
                </div>
                Team format
              </span>
            </span>
          </DropdownMenuItem>
          <DropdownMenuItem
            onClick={() => setManualFormatOverride('project')}
            className='cursor-pointer rounded-sm px-3 py-2 text-sm'
          >
            <span className='flex w-full items-center justify-between'>
              <span className='flex items-center gap-2'>
                <div className='flex h-4 w-4 items-center justify-center'>
                  {manualFormatOverride === 'project' ? (
                    <Check className='text-primary h-3 w-3' />
                  ) : (
                    <FolderOpen className='text-muted-foreground h-3 w-3' />
                  )}
                </div>
                Project format
              </span>
            </span>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      {manualFormatOverride && (
        <span className='flex items-center gap-1 text-xs text-orange-600 dark:text-orange-400'>
          <div className='h-1 w-1 rounded-full bg-orange-500' />
          forced
        </span>
      )}
      <code className='bg-muted flex h-8 items-center overflow-hidden rounded-md px-2.5 font-mono text-sm'>
        {preview}
      </code>
    </div>
  );
}

interface CreateIssueDialogContentProps {
  orgSlug: string;
  onClose: () => void;
  onSuccess?: (issueId: string) => void;
  defaultStates?: {
    teamId?: string;
    projectId?: string;
    stateId?: string;
    priorityId?: string;
    assigneeIds?: string[];
    [key: string]: unknown;
  };
}

function CreateIssueDialogContent({
  orgSlug,
  onClose,
  onSuccess,
  defaultStates,
}: CreateIssueDialogContentProps) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [selectedTeam, setSelectedTeam] = useState<string>(
    defaultStates?.teamId || '',
  );
  const [selectedProject, setSelectedProject] = useState<string>(
    defaultStates?.projectId || '',
  );
  const [selectedState, setSelectedState] = useState<string>(
    defaultStates?.stateId || '',
  );
  const [selectedAssignees, setSelectedAssignees] = useState<string[]>(
    defaultStates?.assigneeIds || [],
  );
  const [hasUserInteractedWithAssignees, setHasUserInteractedWithAssignees] =
    useState(false);
  const [selectedPriority, setSelectedPriority] = useState<string>(
    defaultStates?.priorityId || '',
  );
  const [selectedVisibility, setSelectedVisibility] =
    useState<VisibilityState>('organization');
  const [selectedParentIssue, setSelectedParentIssue] = useState<string>('');
  const [manualFormatOverride, setManualFormatOverride] = useState<
    'team' | 'project' | 'org' | null
  >(null);

  // ---------------------------------------------
  //   Fetch data (teams, projects, states)
  // ---------------------------------------------
  // Get teams and projects data
  const teamsData = useQuery(api.organizations.queries.listTeams, { orgSlug });
  const projectsData = useQuery(api.organizations.queries.listProjects, {
    orgSlug,
  });
  const statesData = useQuery(api.organizations.queries.listIssueStates, {
    orgSlug,
  });
  const membersData = useQuery(api.organizations.queries.listMembers, {
    orgSlug,
  });
  const prioritiesData = useQuery(
    api.organizations.queries.listIssuePriorities,
    {
      orgSlug,
    },
  );
  const currentUser = useQuery(api.users.currentUser);

  // Transform data to maintain frontend compatibility
  const teams = teamsData ? withIds(teamsData) : [];
  const projects = projectsData ? withIds(projectsData) : [];
  const states = useMemo(
    () => (statesData ? withIds(statesData) : []),
    [statesData],
  );
  const members = useMemo(
    () => (membersData ? withIds(membersData) : []),
    [membersData],
  );
  const priorities = useMemo(
    () => (prioritiesData ? withIds(prioritiesData) : []),
    [prioritiesData],
  );

  // Auto-infer the format based on selections
  const getEffectiveFormat = (): 'team' | 'project' | 'org' => {
    // Manual override takes precedence
    if (manualFormatOverride) {
      return manualFormatOverride;
    }

    // Auto-infer: Project > Team > Org
    if (selectedProject) {
      return 'project';
    }
    if (selectedTeam) {
      return 'team';
    }
    return 'org';
  };

  const effectiveFormat = getEffectiveFormat();

  // Auto-select the first "todo" state as default
  useEffect(() => {
    if (states.length > 0 && !selectedState) {
      const defaultState =
        states.find((state: StateWithId) => state.type === 'todo') || states[0];
      setSelectedState(defaultState.id);
    }
  }, [states, selectedState]);

  // Auto-select default priority (weight === 0) once priorities load
  useEffect(() => {
    if (priorities.length > 0 && !selectedPriority) {
      const defaultPriority =
        priorities.find((p: PriorityWithId) => p.weight === 0) || priorities[0];
      if (defaultPriority) {
        setSelectedPriority(defaultPriority.id);
      }
    }
  }, [priorities, selectedPriority]);

  // Auto-select current user as default assignee only if user hasn't interacted with assignees
  useEffect(() => {
    if (
      currentUser &&
      selectedAssignees.length === 0 &&
      !defaultStates?.assigneeIds &&
      !hasUserInteractedWithAssignees
    ) {
      setSelectedAssignees([currentUser._id]);
    }
  }, [
    currentUser,
    selectedAssignees.length,
    defaultStates?.assigneeIds,
    hasUserInteractedWithAssignees,
  ]);

  // Wrapper function to track user interaction with assignees
  const handleAssigneesChange = (assignees: string[]) => {
    setSelectedAssignees(assignees);
    setHasUserInteractedWithAssignees(true);
  };

  const createIssueMutation = useMutation(api.issues.mutations.create);

  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;

    // Validate required selections based on effective format
    if (effectiveFormat === 'team' && !selectedTeam) {
      alert('Please select a team for team-based issue keys');
      return;
    }
    if (effectiveFormat === 'project' && !selectedProject) {
      alert('Please select a project for project-based issue keys');
      return;
    }

    setIsLoading(true);
    createIssueMutation({
      orgSlug,
      data: {
        title,
        description,
        projectId: selectedProject
          ? (selectedProject as Id<'projects'>)
          : undefined,
        stateId: selectedState
          ? (selectedState as Id<'issueStates'>)
          : undefined,
        priorityId: selectedPriority
          ? (selectedPriority as Id<'issuePriorities'>)
          : undefined,
        assigneeIds:
          selectedAssignees.length > 0
            ? selectedAssignees.map(id => id as Id<'users'>)
            : [],
        visibility: selectedVisibility,
        parentIssueId: selectedParentIssue
          ? (selectedParentIssue as Id<'issues'>)
          : undefined,
      },
    })
      .then(result => {
        toast.success(`Issue ${result.key} created`);
        onSuccess?.(result.issueId);
        onClose();

        // Reset form
        setTitle('');
        setDescription('');
        setSelectedTeam('');
        setSelectedProject('');
        setSelectedState('');
        setSelectedPriority('');
        setSelectedAssignees([]);
        setHasUserInteractedWithAssignees(false);
        setSelectedVisibility('organization');
        setSelectedParentIssue('');
        setManualFormatOverride(null);
      })
      .catch(() => {
        toast.error('Failed to create issue');
      })
      .finally(() => {
        setIsLoading(false);
      });
  };

  const getIssueKeyPreview = () => {
    const nextNumber = 1; // Placeholder for preview

    // Show different examples based on manual override
    if (manualFormatOverride === 'team') {
      const team = teams.find((t: TeamWithId) => t.id === selectedTeam);
      return team ? `${team.key}-${nextNumber}` : `TEAM-${nextNumber}`;
    }
    if (manualFormatOverride === 'project') {
      const project = projects.find(
        (p: ProjectWithId) => p.id === selectedProject,
      );
      return project ? `${project.key}-${nextNumber}` : `PROJ-${nextNumber}`;
    }
    if (manualFormatOverride === 'org') {
      return `${orgSlug.toUpperCase()}-${nextNumber}`;
    }

    // Auto-detect logic (original behavior)
    if (effectiveFormat === 'team' && selectedTeam) {
      const team = teams.find((t: TeamWithId) => t.id === selectedTeam);
      return team ? `${team.key}-${nextNumber}` : `TEAM-${nextNumber}`;
    }
    if (effectiveFormat === 'project' && selectedProject) {
      const project = projects.find(
        (p: ProjectWithId) => p.id === selectedProject,
      );
      return project ? `${project.key}-${nextNumber}` : `PROJ-${nextNumber}`;
    }
    // Org default
    return `${orgSlug.toUpperCase()}-${nextNumber}`;
  };

  return (
    <Dialog open onOpenChange={(isOpen: boolean) => !isOpen && onClose()}>
      <DialogContent showCloseButton={false} className='gap-2 p-2 sm:max-w-2xl'>
        <DialogHeader className=''>
          <DialogTitle className='flex items-center'>
            <div className='text-muted-foreground flex w-full items-center gap-2 text-sm'>
              {/* Properties Row */}
              <div className='flex flex-wrap gap-2'>
                <TeamSelector
                  teams={teams}
                  selectedTeam={selectedTeam}
                  onTeamSelect={setSelectedTeam}
                  displayMode='iconWhenUnselected'
                />

                <AssigneeSelector
                  members={members}
                  selectedAssignees={selectedAssignees}
                  onAssigneesSelect={handleAssigneesChange}
                  multiple={true}
                  displayMode='iconWhenUnselected'
                  currentUserId={currentUser?._id || ''}
                  canManageAll={true}
                />

                <ProjectSelector
                  projects={projects}
                  selectedProject={selectedProject}
                  onProjectSelect={setSelectedProject}
                />

                <IssueSelector
                  orgSlug={orgSlug}
                  selectedIssue={selectedParentIssue}
                  onIssueSelect={setSelectedParentIssue}
                  displayMode='iconWhenUnselected'
                />
              </div>

              <div className='ml-auto flex items-center gap-2'>
                <StateSelector
                  states={states}
                  selectedState={selectedState}
                  onStateSelect={setSelectedState}
                />

                <PrioritySelector
                  priorities={priorities}
                  selectedPriority={selectedPriority}
                  onPrioritySelect={setSelectedPriority}
                />

                <VisibilitySelector
                  value={selectedVisibility}
                  onValueChange={setSelectedVisibility}
                  displayMode='iconOnly'
                />
              </div>
            </div>
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className='space-y-2'>
          {/* Title and Issue Key Preview */}
          <div className='flex items-center gap-2'>
            <Input
              placeholder='Issue title'
              value={title}
              onChange={e => setTitle(e.target.value)}
              className='flex-grow text-base'
              autoFocus
            />
            <div className='flex-shrink-0'>
              <KeyFormatSelector
                manualFormatOverride={manualFormatOverride}
                setManualFormatOverride={setManualFormatOverride}
                preview={getIssueKeyPreview()}
              />
            </div>
          </div>

          {/* Description */}
          <Textarea
            placeholder='Add description...'
            value={description}
            onChange={e => setDescription(e.target.value)}
            className='border-input bg-background placeholder:text-muted-foreground focus-visible:ring-ring min-h-[120px] w-full resize-none rounded-md border px-3 py-2 text-sm focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none'
          />
        </form>

        <div className='flex w-full flex-row items-center justify-between gap-2'>
          <Button variant='ghost' size='sm' onClick={onClose}>
            Cancel
          </Button>
          <Button
            size='sm'
            disabled={
              !title.trim() ||
              isLoading ||
              (effectiveFormat === 'team' && !selectedTeam) ||
              (effectiveFormat === 'project' && !selectedProject)
            }
            onClick={handleSubmit}
          >
            {isLoading ? 'Creating…' : 'Create issue'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ---------------------------------------------------------------------------
// 🖱️ Public wrapper — handles trigger button + open state
// ---------------------------------------------------------------------------

export interface CreateIssueDialogProps {
  /** Organization slug the issue belongs to */
  orgSlug: string;
  /** Optional callback fired after the issue is successfully created */
  onIssueCreated?: () => void;
  /** Visual style of trigger button */
  variant?: 'default' | 'floating';
  /** Additional classes for the trigger button */
  className?: string;
  /** Object for default values for selectors */
  defaultStates?: {
    teamId?: string;
    projectId?: string;
    stateId?: string;
    priorityId?: string;
    assigneeIds?: string[];
    [key: string]: unknown;
  };
}

export function CreateIssueDialog({
  orgSlug,
  onIssueCreated,
  variant = 'default',
  className,
  defaultStates,
}: CreateIssueDialogProps) {
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  const handleSuccess = () => {
    onIssueCreated?.();
    setIsDialogOpen(false);
  };

  const trigger =
    variant === 'floating' ? (
      <PermissionAwareButton
        orgSlug={orgSlug}
        permission={PERMISSIONS.ISSUE_CREATE}
        onClick={() => setIsDialogOpen(true)}
        className={cn(
          'h-12 w-12 rounded-full bg-blue-600 text-white shadow-lg transition-all hover:bg-blue-700 hover:shadow-xl',
          className,
        )}
        size='icon'
        fallbackMessage="You don't have permission to create issues"
      >
        <Plus className='h-5 w-5' />
      </PermissionAwareButton>
    ) : (
      <PermissionAwareButton
        orgSlug={orgSlug}
        permission={PERMISSIONS.ISSUE_CREATE}
        size='sm'
        onClick={() => setIsDialogOpen(true)}
        className={cn('gap-1 text-xs', className)}
        variant='outline'
        fallbackMessage="You don't have permission to create issues"
      >
        <Plus className='size-3' />
      </PermissionAwareButton>
    );

  return (
    <>
      {trigger}
      {isDialogOpen && (
        <CreateIssueDialogContent
          orgSlug={orgSlug}
          onClose={() => setIsDialogOpen(false)}
          onSuccess={handleSuccess}
          defaultStates={defaultStates}
        />
      )}
    </>
  );
}
