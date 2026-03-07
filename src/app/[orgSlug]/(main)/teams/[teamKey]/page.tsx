'use client';

import { useState, useMemo } from 'react';
import { useQuery, useMutation } from '@/lib/convex';
import { api } from '@/convex/_generated/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  Save,
  X,
  ArrowLeft,
  Users,
  Plus,
  MoreHorizontal,
  Trash2,
  ChevronsUpDown,
  Target,
  FolderOpen,
} from 'lucide-react';
import { IconPicker } from '@/components/ui/icon-picker';
import { notFound } from 'next/navigation';
import { formatDateHuman } from '@/lib/date';
import Link from 'next/link';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { IssuesTable } from '@/components/issues/issues-table';
import { ProjectsTable } from '@/components/projects/projects-table';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from '@/components/ui/dropdown-menu';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Check } from 'lucide-react';
import { cn } from '@/lib/utils';
import { motion, AnimatePresence } from 'motion/react';
import { getDynamicIcon } from '@/lib/dynamic-icons';
import { PERMISSIONS } from '@/convex/_shared/permissions';
import {
  usePermissionCheck,
  PermissionAware,
} from '@/components/ui/permission-aware';
import { toast } from 'sonner';
import { CreateIssueDialog } from '@/components/issues/create-issue-dialog';
import { CreateProjectDialog } from '@/components/projects/create-project-dialog';
import { useParams } from 'next/navigation';
import {
  VisibilitySelector,
  type VisibilityState,
} from '@/components/ui/visibility-selector';

import { Id } from '@/convex/_generated/dataModel';
import { FunctionReturnType } from 'convex/server';

// Add Member Dialog
function AddMemberDialog({
  orgSlug,
  teamId,
  onClose,
  onSuccess,
}: {
  orgSlug: string;
  teamId: Id<'teams'>;
  onClose: () => void;
  onSuccess?: () => void;
}) {
  const [selectedMember, setSelectedMember] = useState<string>('');
  const [memberComboboxOpen, setMemberComboboxOpen] = useState(false);
  const [isAddingMember, setIsAddingMember] = useState(false);

  const orgMembersQuery = useQuery(api.organizations.queries.listMembers, {
    orgSlug,
  });
  const orgMembers = orgMembersQuery.data ?? [];
  const addMemberMutation = useMutation(api.teams.mutations.addMember);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedMember) return;

    setIsAddingMember(true);
    try {
      await addMemberMutation({
        teamId,
        userId: selectedMember as Id<'users'>,
        role: 'member',
      });
      onSuccess?.();
      onClose();
      toast.success('Member added to team');
    } catch (error: unknown) {
      console.error(error);
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
      toast.error(`Failed to add member: ${errorMessage}`);
    } finally {
      setIsAddingMember(false);
    }
  };

  return (
    <Dialog open onOpenChange={(isOpen: boolean) => !isOpen && onClose()}>
      <DialogHeader className='sr-only'>
        <DialogTitle>Add team member</DialogTitle>
      </DialogHeader>
      <DialogContent showCloseButton={false} className='gap-2 p-2 sm:max-w-2xl'>
        <form onSubmit={handleSubmit} className='space-y-2'>
          {/* Member Selection */}
          <div className='relative'>
            <Popover
              open={memberComboboxOpen}
              onOpenChange={setMemberComboboxOpen}
            >
              <PopoverTrigger asChild>
                <Button
                  variant='outline'
                  role='combobox'
                  aria-expanded={memberComboboxOpen}
                  className='h-9 w-full justify-between pr-20 text-base'
                >
                  {selectedMember
                    ? orgMembers.find(
                        member => member.userId === selectedMember,
                      )?.user?.name
                    : 'Select member...'}
                  <ChevronsUpDown className='ml-2 h-4 w-4 shrink-0 opacity-50' />
                </Button>
              </PopoverTrigger>
              <PopoverContent className='max-h-[200px] w-[var(--radix-popover-trigger-width)] p-0'>
                <Command>
                  <CommandInput
                    placeholder='Search member...'
                    className='h-9'
                  />
                  <CommandList>
                    <CommandEmpty>No member found.</CommandEmpty>
                    <CommandGroup>
                      {orgMembers.map(member => (
                        <CommandItem
                          key={member.userId}
                          value={member.user?.name ?? ''}
                          onSelect={() => {
                            setSelectedMember(member.userId);
                            setMemberComboboxOpen(false);
                          }}
                        >
                          <Check
                            className={cn(
                              'mr-2 h-4 w-4',
                              selectedMember === member.userId
                                ? 'opacity-100'
                                : 'opacity-0',
                            )}
                          />
                          {member.user?.name}
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>
            <span className='text-muted-foreground bg-background pointer-events-none absolute top-1/2 right-2 -translate-y-1/2 rounded px-2 py-0.5 text-xs'>
              Member
            </span>
          </div>
        </form>

        <div className='flex w-full flex-row items-center justify-between gap-2'>
          <Button variant='ghost' size='sm' onClick={onClose}>
            Cancel
          </Button>
          <Button
            size='sm'
            disabled={!selectedMember || isAddingMember}
            onClick={handleSubmit}
          >
            {isAddingMember ? 'Adding…' : 'Add member'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// Members List Component
function MembersList({
  members,
  onRemoveMember,
  removePending,
  canEdit,
}: {
  members: FunctionReturnType<typeof api.teams.queries.listMembers>;
  onRemoveMember?: (membershipId: Id<'teamMembers'>) => void;
  removePending?: boolean;
  canEdit: boolean;
}) {
  const getInitials = (name?: string, email?: string): string => {
    const displayName = name || email;
    if (!displayName) return '?';
    return displayName
      .split(' ')
      .map(part => part.charAt(0))
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  if (members.length === 0) {
    return (
      <div className='flex items-center justify-center py-12'>
        <div className='text-center'>
          <div className='mb-4 flex justify-center'>
            <Users className='text-muted-foreground/50 h-16 w-16' />
          </div>
          <h3 className='mb-2 text-lg font-semibold'>No members yet</h3>
          <p className='text-muted-foreground mb-6'>
            Add team members to get started.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className='divide-y'>
      <AnimatePresence initial={false}>
        {members.map(member => (
          <motion.div
            layout
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 8 }}
            transition={{ duration: 0.2 }}
            key={member._id}
            className='hover:bg-muted/50 flex items-center gap-3 px-3 py-2 transition-colors'
          >
            {/* Avatar */}
            <Avatar className='size-8'>
              <AvatarFallback className='text-xs'>
                {getInitials(member.user?.name, member.user?.email)}
              </AvatarFallback>
            </Avatar>

            {/* Member info */}
            <div className='min-w-0 flex-1'>
              <div className='text-sm font-medium'>{member.user?.name}</div>
              <div className='text-muted-foreground text-xs'>
                {member.user?.email}
              </div>
            </div>

            {/* Role */}
            <div className='flex-shrink-0 text-xs capitalize'>
              {member.role || 'member'}
            </div>

            {/* Actions */}
            {canEdit && onRemoveMember && (
              <div className='flex-shrink-0'>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant='ghost'
                      size='sm'
                      className='h-6 w-6 p-0'
                      aria-label='Open member actions'
                    >
                      <MoreHorizontal className='size-4' />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align='end'>
                    <DropdownMenuItem
                      variant='destructive'
                      disabled={removePending}
                      onClick={() => {
                        if (confirm('Remove this member from the team?')) {
                          onRemoveMember(member._id);
                        }
                      }}
                    >
                      <Trash2 className='mr-2 h-4 w-4' />
                      Remove from team
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            )}
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}

// Add the DEFAULT_COLORS constant from states settings
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

export default function TeamViewPage() {
  const params = useParams();
  const orgSlug = params.orgSlug as string;
  const teamKey = params.teamKey as string;

  const [editingName, setEditingName] = useState(false);
  const [editingDescription, setEditingDescription] = useState(false);
  const [editingKey, setEditingKey] = useState(false);
  const [nameValue, setNameValue] = useState('');
  const [descriptionValue, setDescriptionValue] = useState('');
  const [keyValue, setKeyValue] = useState('');
  const [iconValue, setIconValue] = useState<string | null>(null);
  const [colorValue, setColorValue] = useState<string | null>(null);
  const [showAddMemberDialog, setShowAddMemberDialog] = useState(false);
  const [activeTab, setActiveTab] = useState('members');
  const [isUpdating, setIsUpdating] = useState(false);
  const [isUpdatingIssues, setIsUpdatingIssues] = useState(false);
  const [isUpdatingProjects, setIsUpdatingProjects] = useState(false);

  // Check user permissions for team management
  const userQuery = useQuery(api.users.currentUser);
  const user = userQuery.data;

  // Fetch team data
  const teamQuery = useQuery(api.teams.queries.getByKey, {
    orgSlug,
    teamKey,
  });
  const team = teamQuery.data;

  // Fetch team members
  const teamMembersQuery = useQuery(
    api.teams.queries.listMembers,
    team?._id ? { teamId: team._id } : 'skip',
  );
  const teamMembers = teamMembersQuery.data ?? [];

  // Fetch team issues
  const teamIssuesQuery = useQuery(
    api.issues.queries.listIssues,
    team?.key ? { orgSlug, teamId: team.key } : 'skip',
  );
  const teamIssuesData = teamIssuesQuery.data;

  // Fetch team projects
  const teamProjectsQuery = useQuery(
    api.projects.queries.list,
    team?.key ? { orgSlug, teamId: team.key } : 'skip',
  );
  const teamProjects = teamProjectsQuery.data ?? [];

  // Fetch supporting data for tables
  const statesQuery = useQuery(api.organizations.queries.listIssueStates, {
    orgSlug,
  });
  const states = statesQuery.data ?? [];

  const prioritiesQuery = useQuery(
    api.organizations.queries.listIssuePriorities,
    {
      orgSlug,
    },
  );
  const priorities = prioritiesQuery.data ?? [];

  const teamsQuery = useQuery(api.organizations.queries.listTeams, { orgSlug });
  const teams = teamsQuery.data ?? [];

  const projectsQuery = useQuery(api.organizations.queries.listProjects, {
    orgSlug,
  });
  const projects = projectsQuery.data ?? [];

  const statusesQuery = useQuery(
    api.organizations.queries.listProjectStatuses,
    {
      orgSlug,
    },
  );
  const statuses = statusesQuery.data ?? [];

  // Determine if user can edit team (team lead or has permission)
  // Moved ABOVE any conditional early returns to keep hook order consistent
  const permissionScope = useMemo(() => {
    return team?._id ? { orgSlug, teamId: team._id } : { orgSlug };
  }, [orgSlug, team?._id]);

  const { isAllowed: canEditTeam } = usePermissionCheck(
    orgSlug,
    PERMISSIONS.TEAM_EDIT,
    permissionScope,
  ); // Mutations with toast error handling - ALL HOOKS MUST BE CALLED BEFORE ANY CONDITIONAL RETURNS
  const updateTeamMutation = useMutation(api.teams.mutations.update);
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
  const changeStatusMutation = useMutation(api.projects.mutations.changeStatus);
  const changeProjectTeamMutation = useMutation(
    api.projects.mutations.changeTeam,
  );
  const changeLeadMutation = useMutation(api.projects.mutations.changeLead);
  const deleteProjectMutation = useMutation(
    api.projects.mutations.deleteProject,
  );
  const removeMemberMutation = useMutation(api.teams.mutations.removeMember);
  const changeVisibilityMutation = useMutation(
    api.teams.mutations.changeVisibility,
  );

  // Check if any queries are still loading
  const isLoading =
    userQuery.isPending ||
    teamQuery.isPending ||
    teamMembersQuery.isPending ||
    teamIssuesQuery.isPending ||
    teamProjectsQuery.isPending ||
    statesQuery.isPending ||
    prioritiesQuery.isPending ||
    teamsQuery.isPending ||
    projectsQuery.isPending ||
    statusesQuery.isPending;

  // Check for errors
  const hasError =
    userQuery.isError ||
    teamQuery.isError ||
    teamMembersQuery.isError ||
    teamIssuesQuery.isError ||
    teamProjectsQuery.isError ||
    statesQuery.isError ||
    prioritiesQuery.isError ||
    teamsQuery.isError ||
    projectsQuery.isError ||
    statusesQuery.isError;

  // Show loading state
  if (isLoading) {
    return <div>Loading...</div>;
  }

  // Show error state
  if (hasError) {
    return <div>Error loading team data. Please try again.</div>;
  }

  // Show not found if team doesn't exist
  if (!team) {
    notFound();
  }

  const canEdit = !!(user && team && (team.leadId === user._id || canEditTeam));

  // Initialize editing values when team loads
  if (team) {
    if (nameValue !== team.name) setNameValue(team.name);
    if (descriptionValue !== (team.description || ''))
      setDescriptionValue(team.description || '');
    if (keyValue !== team.key) setKeyValue(team.key);
    if (iconValue !== (team.icon || null)) setIconValue(team.icon || null);
    if (colorValue !== (team.color || null)) setColorValue(team.color || null);
  }

  if (!user) return <div>Loading...</div>; // Or a proper loading state

  const handleNameSave = async () => {
    if (!nameValue.trim() || !team) return;
    setIsUpdating(true);
    await updateTeamMutation({
      teamId: team._id,
      data: { name: nameValue.trim() },
    });
    setIsUpdating(false);
    setEditingName(false);
  };

  const handleDescriptionSave = async () => {
    if (!team) return;
    setIsUpdating(true);
    await updateTeamMutation({
      teamId: team._id,
      data: { description: descriptionValue.trim() || undefined },
    });
    setIsUpdating(false);
    setEditingDescription(false);
  };

  const handleKeySave = async () => {
    if (!keyValue.trim() || !team) return;
    setIsUpdating(true);
    await updateTeamMutation({
      teamId: team._id,
      data: { name: keyValue.trim().toUpperCase() },
    });
    setIsUpdating(false);
    setEditingKey(false);
  };

  const handleIconChange = async (iconName: string | null) => {
    if (!team) return;
    setIconValue(iconName);
    setIsUpdating(true);
    await updateTeamMutation({
      teamId: team._id,
      data: { icon: iconName ?? undefined },
    });
    setIsUpdating(false);
  };

  const handleColorChange = async (color: string) => {
    if (!team) return;
    setColorValue(color);
    setIsUpdating(true);
    await updateTeamMutation({
      teamId: team._id,
      data: { color },
    });
    setIsUpdating(false);
  };

  const handleRemoveMember = async (membershipId: Id<'teamMembers'>) => {
    if (!team) return;
    setIsUpdating(true);
    await removeMemberMutation({
      membershipId,
    });
    setIsUpdating(false);
  };

  const handleVisibilityChange = async (visibility: VisibilityState) => {
    if (!team) return;
    setIsUpdating(true);
    await changeVisibilityMutation({
      teamId: team._id,
      visibility,
    });
    setIsUpdating(false);
  };

  // Issue handlers
  const handlePriorityChange = async (issueId: string, priorityId: string) => {
    if (!user?._id || !priorityId) return;
    setIsUpdatingIssues(true);
    await changePriorityMutation({
      issueId: issueId as Id<'issues'>,
      priorityId: priorityId as Id<'issuePriorities'>,
    });
    setIsUpdatingIssues(false);
  };

  const handleAssigneesChange = async (
    issueId: string,
    assigneeIds: string[],
  ) => {
    if (!user?._id) return;
    setIsUpdatingIssues(true);
    await updateAssigneesMutation({
      issueId: issueId as Id<'issues'>,
      assigneeIds: assigneeIds as Id<'users'>[],
    });
    setIsUpdatingIssues(false);
  };

  const handleIssueTeamChange = async (issueId: string, teamId: string) => {
    if (!user?._id) return;
    setIsUpdatingIssues(true);
    await changeTeamMutation({
      issueId: issueId as Id<'issues'>,
      teamId: (teamId as Id<'teams'>) || null,
    });
    setIsUpdatingIssues(false);
  };

  const handleIssueProjectChange = async (
    issueId: string,
    projectId: string,
  ) => {
    if (!user?._id) return;
    setIsUpdatingIssues(true);
    await changeProjectMutation({
      issueId: issueId as Id<'issues'>,
      projectId: (projectId as Id<'projects'>) || null,
    });
    setIsUpdatingIssues(false);
  };

  const handleAssignmentStateChange = async (
    assignmentId: string,
    stateId: string,
  ) => {
    if (!user?._id || !assignmentId || !stateId) return;
    setIsUpdatingIssues(true);
    await changeAssignmentStateMutation({
      assignmentId: assignmentId as Id<'issueAssignees'>,
      stateId: stateId as Id<'issueStates'>,
    });
    setIsUpdatingIssues(false);
  };

  const handleIssueDelete = async (issueId: string) => {
    if (!confirm('Delete this issue? This action cannot be undone.')) return;
    setIsUpdatingIssues(true);
    await deleteMutation({ issueId: issueId as Id<'issues'> });
    setIsUpdatingIssues(false);
  };

  // Project handlers
  const handleStatusChange = async (projectId: string, statusId: string) => {
    if (!user?._id) return;
    setIsUpdatingProjects(true);
    await changeStatusMutation({
      projectId: projectId as Id<'projects'>,
      statusId: (statusId as Id<'projectStatuses'>) || null,
    });
    setIsUpdatingProjects(false);
  };

  const handleProjectTeamChange = async (projectId: string, teamId: string) => {
    if (!user?._id) return;
    setIsUpdatingProjects(true);
    await changeProjectTeamMutation({
      projectId: projectId as Id<'projects'>,
      teamId: (teamId as Id<'teams'>) || null,
    });
    setIsUpdatingProjects(false);
  };

  const handleProjectLeadChange = async (projectId: string, leadId: string) => {
    if (!user?._id) return;
    setIsUpdatingProjects(true);
    await changeLeadMutation({
      projectId: projectId as Id<'projects'>,
      leadId: (leadId as Id<'users'>) || null,
    });
    setIsUpdatingProjects(false);
  };

  const handleProjectDelete = async (projectKey: string) => {
    if (!confirm('Delete this project? This cannot be undone.')) return;
    setIsUpdatingProjects(true);
    await deleteProjectMutation({
      projectId: projectKey as Id<'projects'>,
    });
    setIsUpdatingProjects(false);
  };

  return (
    <div className='bg-background h-full overflow-y-auto'>
      <div className='h-full'>
        <div>
          {/* Header */}
          <div className='bg-background/95 supports-[backdrop-filter]:bg-background/60 flex items-center justify-between border-b px-2 backdrop-blur'>
            <div className='flex h-8 flex-wrap items-center gap-2'>
              <Link
                href={`/${orgSlug}/teams`}
                className='text-muted-foreground hover:text-foreground flex items-center gap-2 text-sm transition-colors'
              >
                <ArrowLeft className='size-3' />
                Teams
              </Link>
              <span className='text-muted-foreground text-sm'>/</span>
              <span className='text-sm font-medium'>{teamKey}</span>
            </div>

            <div className='flex items-center gap-2'>
              <PermissionAware
                orgSlug={orgSlug}
                permission={PERMISSIONS.TEAM_EDIT}
                fallbackMessage="You don't have permission to change team visibility"
              >
                <VisibilitySelector
                  value={team?.visibility as VisibilityState}
                  onValueChange={handleVisibilityChange}
                  displayMode='iconWhenUnselected'
                  className='border-none bg-transparent shadow-none'
                />
              </PermissionAware>
              <div className='bg-muted-foreground/20 h-4 w-px' />
              {editingKey ? (
                <div className='flex items-center gap-1'>
                  <Input
                    value={keyValue}
                    onChange={e =>
                      setKeyValue(e.target.value.toUpperCase().slice(0, 10))
                    }
                    className='h-6 w-24 font-mono text-xs'
                    autoFocus
                    onKeyDown={e => {
                      if (e.key === 'Enter') void handleKeySave();
                      if (e.key === 'Escape') {
                        setKeyValue(team?.key || '');
                        setEditingKey(false);
                      }
                    }}
                  />
                  <Button
                    size='sm'
                    className='h-6 px-1'
                    onClick={handleKeySave}
                  >
                    <Save className='size-3' />
                  </Button>
                  <Button
                    size='sm'
                    variant='ghost'
                    className='h-6 px-1'
                    onClick={() => {
                      setKeyValue(team?.key || '');
                      setEditingKey(false);
                    }}
                  >
                    <X className='size-3' />
                  </Button>
                </div>
              ) : (
                <Badge
                  variant='secondary'
                  className={cn(
                    'font-mono text-xs',
                    canEdit && 'cursor-pointer',
                  )}
                  onClick={() => canEdit && setEditingKey(true)}
                >
                  {team?.key}
                </Badge>
              )}
            </div>
          </div>

          {/* Main Content */}
          <div className='mx-auto max-w-5xl px-4 py-4'>
            {/* Team Header */}
            <div className='mb-2 max-w-4xl space-y-2'>
              <div className='text-muted-foreground flex items-center gap-2 text-xs'>
                <span className='font-mono'>{team?.key}</span>
                <span>•</span>
                <span>
                  Created {formatDateHuman(new Date(team?._creationTime || 0))}
                </span>
              </div>

              {/* Name */}
              {editingName ? (
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
                                  <Users className='text-muted-foreground size-6' />
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
                              Team Icon
                            </h4>
                            <IconPicker
                              value={iconValue}
                              onValueChange={handleIconChange}
                              placeholder='Select team icon'
                              className='h-8 w-full'
                            />
                          </div>
                          <div>
                            <h4 className='mb-2 text-sm font-medium'>
                              Team Color
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
                    value={nameValue}
                    onChange={e => setNameValue(e.target.value)}
                    className='h-auto border-none p-0 !text-3xl !leading-tight font-semibold shadow-none focus-visible:ring-0'
                    style={{ fontFamily: 'var(--font-title)' }}
                    onKeyDown={e => {
                      if (e.key === 'Enter') void handleNameSave();
                      if (e.key === 'Escape') {
                        setNameValue(team?.name || '');
                        setEditingName(false);
                      }
                    }}
                    autoFocus
                  />
                  <div className='flex items-center gap-1'>
                    <Button
                      size='sm'
                      onClick={handleNameSave}
                      disabled={isUpdating}
                    >
                      <Save className='size-4' />
                    </Button>
                    <Button
                      size='sm'
                      variant='ghost'
                      onClick={() => {
                        setNameValue(team?.name || '');
                        setEditingName(false);
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
                                  <Users className='text-muted-foreground size-6' />
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
                              Team Icon
                            </h4>
                            <IconPicker
                              value={iconValue}
                              onValueChange={handleIconChange}
                              placeholder='Select team icon'
                              className='h-8 w-full'
                            />
                          </div>
                          <div>
                            <h4 className='mb-2 text-sm font-medium'>
                              Team Color
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
                    onClick={() => canEdit && setEditingName(true)}
                  >
                    {team?.name}
                  </span>
                </h1>
              )}
            </div>

            {/* Description */}
            <div className='mb-2'>
              {editingDescription ? (
                <div className='space-y-4'>
                  <Textarea
                    value={descriptionValue}
                    onChange={e => setDescriptionValue(e.target.value)}
                    placeholder='Add a description...'
                    className='min-h-[120px] resize-none text-base'
                    onKeyDown={e => {
                      if (e.key === 'Escape') {
                        setDescriptionValue(team?.description || '');
                        setEditingDescription(false);
                      }
                    }}
                    autoFocus
                  />
                  <div className='flex items-center gap-3'>
                    <Button
                      onClick={handleDescriptionSave}
                      disabled={isUpdating}
                    >
                      <Save className='mr-2 size-4' />
                      Save
                    </Button>
                    <Button
                      variant='outline'
                      onClick={() => {
                        setDescriptionValue(team?.description || '');
                        setEditingDescription(false);
                      }}
                    >
                      Cancel
                    </Button>
                  </div>
                </div>
              ) : (
                <div>
                  {team?.description ? (
                    <div
                      className={cn(
                        'prose prose-sm text-muted-foreground max-w-none transition-colors',
                        canEdit && 'hover:text-foreground cursor-pointer',
                      )}
                      onClick={() => canEdit && setEditingDescription(true)}
                    >
                      <p className='whitespace-pre-wrap'>{team?.description}</p>
                    </div>
                  ) : canEdit ? (
                    <button
                      className='text-muted-foreground hover:text-foreground border-muted-foreground/20 hover:border-muted-foreground/40 w-full rounded-lg border-2 border-dashed bg-transparent p-4 text-left text-base'
                      onClick={() => setEditingDescription(true)}
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

            {/* Team Content Tabs */}
            <Tabs value={activeTab} onValueChange={setActiveTab}>
              <TabsList className='grid w-full grid-cols-3'>
                <TabsTrigger asChild value='members'>
                  <div className='flex items-center gap-2'>
                    Members ({teamMembers.length})
                    {canEdit && (
                      <Button
                        onClick={() => setShowAddMemberDialog(true)}
                        className='h-5 gap-1 px-0 text-xs'
                        variant='outline'
                      >
                        <Plus className='size-3' />
                      </Button>
                    )}
                  </div>
                </TabsTrigger>
                <TabsTrigger asChild value='issues'>
                  <div className='flex items-center gap-2'>
                    Issues ({teamIssuesData?.total || 0})
                    {canEdit && (
                      <CreateIssueDialog
                        orgSlug={orgSlug}
                        defaultStates={{ teamId: team?._id }}
                        className='h-5 gap-1 px-0 text-xs'
                      />
                    )}
                  </div>
                </TabsTrigger>
                <TabsTrigger asChild value='projects'>
                  <div className='flex items-center gap-2'>
                    Projects ({teamProjects.length})
                    {canEdit && (
                      <CreateProjectDialog
                        orgSlug={orgSlug}
                        defaultStates={{ teamId: team?._id }}
                        className='h-5 gap-1 px-0 text-xs'
                      />
                    )}
                  </div>
                </TabsTrigger>
              </TabsList>

              {/* Members Tab */}
              <TabsContent value='members'>
                <div className='rounded-lg border'>
                  <MembersList
                    members={teamMembers}
                    onRemoveMember={canEdit ? handleRemoveMember : undefined}
                    removePending={isUpdating}
                    canEdit={canEdit}
                  />
                </div>
              </TabsContent>

              {/* Issues Tab */}
              <TabsContent value='issues'>
                <div className='rounded-lg border'>
                  {teamIssuesData?.issues &&
                  teamIssuesData.issues.length > 0 ? (
                    <IssuesTable
                      orgSlug={orgSlug}
                      issues={teamIssuesData.issues}
                      states={states}
                      priorities={priorities}
                      teams={teams}
                      projects={projects}
                      onPriorityChange={handlePriorityChange}
                      onAssigneesChange={handleAssigneesChange}
                      onTeamChange={handleIssueTeamChange}
                      onProjectChange={handleIssueProjectChange}
                      onDelete={handleIssueDelete}
                      deletePending={isUpdatingIssues}
                      isUpdatingAssignees={isUpdatingIssues}
                      onAssignmentStateChange={handleAssignmentStateChange}
                      isUpdatingAssignmentStates={isUpdatingIssues}
                      currentUserId={user?._id || ''}
                      canChangeAll={user?.role === 'admin'}
                      activeFilter='all'
                    />
                  ) : (
                    <div className='flex items-center justify-center py-12'>
                      <div className='text-center'>
                        <div className='mb-4 flex justify-center'>
                          <Target className='text-muted-foreground/50 h-16 w-16' />
                        </div>
                        <h3 className='mb-2 text-lg font-semibold'>
                          No issues found
                        </h3>
                        <p className='text-muted-foreground mb-6'>
                          This team doesn&apos;t have any issues yet.
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              </TabsContent>

              {/* Projects Tab */}
              <TabsContent value='projects'>
                <div className='rounded-lg border'>
                  {teamProjects && teamProjects.length > 0 ? (
                    <ProjectsTable
                      orgSlug={orgSlug}
                      projects={teamProjects.map(project => ({
                        ...project,
                        id: project._id,
                        icon: project.icon,
                        color: project.color,
                        statusId: project.status?._id,
                        statusName: project.status?.name,
                        statusColor: project.status?.color,
                        statusIcon: project.status?.icon,
                        statusType: project.status?.type,
                        updatedAt: new Date(project._creationTime),
                        createdAt: new Date(project._creationTime),
                      }))}
                      statuses={statuses.map(s => ({ ...s, id: s._id }))}
                      teams={teams.map(t => ({ ...t, id: t._id }))}
                      onStatusChange={handleStatusChange}
                      onTeamChange={handleProjectTeamChange}
                      onLeadChange={handleProjectLeadChange}
                      onDelete={handleProjectDelete}
                      deletePending={isUpdatingProjects}
                    />
                  ) : (
                    <div className='flex items-center justify-center py-12'>
                      <div className='text-center'>
                        <div className='mb-4 flex justify-center'>
                          <FolderOpen className='text-muted-foreground/50 h-16 w-16' />
                        </div>
                        <h3 className='mb-2 text-lg font-semibold'>
                          No projects found
                        </h3>
                        <p className='text-muted-foreground mb-6'>
                          This team doesn&apos;t have any projects yet.
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              </TabsContent>
            </Tabs>
          </div>
        </div>
      </div>

      {/* Add Member Dialog */}
      {showAddMemberDialog && (
        <AddMemberDialog
          orgSlug={orgSlug}
          teamId={team?._id}
          onClose={() => setShowAddMemberDialog(false)}
          onSuccess={() => {
            // No need to refetch here, useQuery will handle re-renders
          }}
        />
      )}
    </div>
  );
}
