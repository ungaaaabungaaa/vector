'use client';

import { useState, useMemo, useDeferredValue } from 'react';
import { useQuery, useMutation } from '@/lib/convex';
import { api } from '@/convex/_generated/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { RichEditor } from '@/components/ui/rich-editor';
import {
  Save,
  X,
  Users,
  Plus,
  MoreHorizontal,
  Trash2,
  Target,
  FolderOpen,
  FileText,
  Columns3,
  LayoutList,
  Search,
  Loader2,
  Clock,
  UsersRound,
} from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { IconPicker } from '@/components/ui/icon-picker';
import { notFound, useParams, useRouter } from 'next/navigation';
import { formatDateHuman } from '@/lib/date';
import Link from 'next/link';
import { Badge } from '@/components/ui/badge';
import { UserAvatar } from '@/components/user-avatar';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { IssuesTable } from '@/components/issues/issues-table';
import { IssuesKanban } from '@/components/issues/issues-kanban';
import { ProjectsTable } from '@/components/projects/projects-table';
import { TeamActivityFeed } from '@/components/activity/team-activity-feed';
import { LinkedDocuments } from '@/components/documents/linked-documents';
import { KanbanSkeleton } from '@/components/ui/table-skeleton';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from '@/components/ui/dropdown-menu';
import {
  ResponsiveDialog,
  ResponsiveDialogContent,
  ResponsiveDialogHeader,
  ResponsiveDialogTitle,
} from '@/components/ui/responsive-dialog';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import {
  Tooltip,
  TooltipTrigger,
  TooltipContent,
  TooltipProvider,
} from '@/components/ui/tooltip';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { cn } from '@/lib/utils';
import { motion, AnimatePresence } from 'motion/react';
import { getDynamicIcon } from '@/lib/dynamic-icons';
import { PERMISSIONS } from '@/convex/_shared/permissions';
import {
  usePermissionCheck,
  PermissionAware,
  PermissionGate,
} from '@/components/ui/permission-aware';
import { toast } from 'sonner';
import { CreateIssueDialog } from '@/components/issues/create-issue-dialog';
import { CreateProjectDialog } from '@/components/projects/create-project-dialog';
import {
  VisibilitySelector,
  type VisibilityState,
} from '@/components/ui/visibility-selector';

import { Id } from '@/convex/_generated/dataModel';
import { FunctionReturnType } from 'convex/server';
import { useConfirm } from '@/hooks/use-confirm';
import { MobileNavTrigger } from '../../layout';
import {
  buildOptimisticIssueRows,
  removeProjectRow,
  replaceIssueRows,
  updateIssueRows,
  updateProjectRows,
  updateQuery,
  updateTeamRows,
} from '@/lib/optimistic-updates';

// Add Member Dialog
function AddMemberDialog({
  orgSlug,
  teamId,
  existingMemberIds,
  onClose,
  onSuccess,
}: {
  orgSlug: string;
  teamId: Id<'teams'>;
  existingMemberIds: Set<string>;
  onClose: () => void;
  onSuccess?: () => void;
}) {
  const [addingUserId, setAddingUserId] = useState<string | null>(null);

  const orgMembersQuery = useQuery(api.organizations.queries.listMembers, {
    orgSlug,
  });
  const orgMembers = orgMembersQuery.data ?? [];
  const addMemberMutation = useMutation(api.teams.mutations.addMember);

  const availableMembers = orgMembers.filter(
    m => !existingMemberIds.has(m.userId),
  );

  const handleAdd = async (userId: string) => {
    setAddingUserId(userId);
    try {
      await addMemberMutation({
        teamId,
        userId: userId as Id<'users'>,
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
      setAddingUserId(null);
    }
  };

  return (
    <ResponsiveDialog
      open
      onOpenChange={(isOpen: boolean) => !isOpen && onClose()}
    >
      <ResponsiveDialogHeader className='sr-only'>
        <ResponsiveDialogTitle>Add team member</ResponsiveDialogTitle>
      </ResponsiveDialogHeader>
      <ResponsiveDialogContent
        showCloseButton={false}
        className='gap-0 p-0 sm:max-w-sm'
      >
        <Command className='rounded-lg'>
          <CommandInput placeholder='Search members...' className='h-9' />
          <CommandList className='max-h-[300px]'>
            <CommandEmpty>No members available to add.</CommandEmpty>
            <CommandGroup>
              {availableMembers.map(member => (
                <CommandItem
                  key={member.userId}
                  value={`${member.user?.name ?? ''} ${member.user?.email ?? ''}`}
                  onSelect={() => handleAdd(member.userId)}
                  disabled={addingUserId !== null}
                  className='flex items-center gap-2 px-3 py-2'
                >
                  <UserAvatar
                    name={member.user?.name}
                    email={member.user?.email}
                    image={member.user?.image}
                    userId={member.userId}
                    size='sm'
                  />
                  <div className='min-w-0 flex-1'>
                    <div className='truncate text-sm font-medium'>
                      {member.user?.name ?? 'Unknown'}
                    </div>
                    <div className='text-muted-foreground truncate text-xs'>
                      {member.user?.email}
                    </div>
                  </div>
                  {addingUserId === member.userId && (
                    <span className='text-muted-foreground text-xs'>
                      Adding...
                    </span>
                  )}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </ResponsiveDialogContent>
    </ResponsiveDialog>
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
  const [confirmRemove, ConfirmRemoveDialog] = useConfirm();

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
            <UserAvatar
              name={member.user?.name}
              email={member.user?.email}
              image={member.user?.image}
              userId={member.userId}
            />

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
                      onClick={async () => {
                        const ok = await confirmRemove({
                          title: 'Remove member',
                          description:
                            'Remove this member from the team? They will lose access to team resources.',
                          confirmLabel: 'Remove',
                          variant: 'destructive',
                        });
                        if (ok) onRemoveMember(member._id);
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
      <ConfirmRemoveDialog />
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
  const router = useRouter();
  const orgSlug = params.orgSlug as string;
  const teamKey = params.teamKey as string;

  const [editingName, setEditingName] = useState(false);
  const [editingDescription, setEditingDescription] = useState(false);
  const [editingKey, setEditingKey] = useState(false);
  const [nameValue, setNameValue] = useState('');
  const [descriptionValue, setDescriptionValue] = useState('');
  const [keyValue, setKeyValue] = useState('');
  const [showAddMemberDialog, setShowAddMemberDialog] = useState(false);
  const [activeTab, setActiveTab] = useState('issues');
  const [issueViewMode, setIssueViewMode] = useState<'table' | 'kanban'>(
    'kanban',
  );
  const [issueSearchText, setIssueSearchText] = useState('');
  const deferredIssueSearch = useDeferredValue(issueSearchText);
  const [memberSearchText, setMemberSearchText] = useState('');
  const deferredMemberSearch = useDeferredValue(memberSearchText);
  const [isUpdating, setIsUpdating] = useState(false);
  const [isUpdatingIssues, setIsUpdatingIssues] = useState(false);
  const [isUpdatingProjects, setIsUpdatingProjects] = useState(false);
  const [initializedTeamId, setInitializedTeamId] = useState<string | null>(
    null,
  );
  const [confirm, ConfirmDialog] = useConfirm();

  // Check user permissions for team management
  const userQuery = useQuery(api.users.currentUser);
  const user = userQuery.data;

  // Fetch team data
  const teamQuery = useQuery(api.teams.queries.getByKey, {
    orgSlug,
    teamKey,
  });
  const team = teamQuery.data;
  const teamQueryArgs = { orgSlug, teamKey };
  const displayName = team?.name ?? '';
  const displayDescription = team?.description ?? '';
  const iconValue = team?.icon ?? null;
  const colorValue = team?.color ?? null;

  // Fetch team members
  const teamMembersQuery = useQuery(
    api.teams.queries.listMembers,
    team?._id ? { teamId: team._id } : 'skip',
  );
  const teamMembers = teamMembersQuery.data;
  const filteredMembers = useMemo(() => {
    const memberRows = teamMembers ?? [];
    const q = deferredMemberSearch.trim().toLowerCase();
    if (!q) return memberRows;
    return memberRows.filter(m => {
      const name = m.user?.name?.toLowerCase() ?? '';
      const email = m.user?.email?.toLowerCase() ?? '';
      return name.includes(q) || email.includes(q);
    });
  }, [teamMembers, deferredMemberSearch]);

  // Fetch team issues
  const teamIssuesQuery = useQuery(
    api.issues.queries.listIssues,
    team?._id
      ? {
          orgSlug,
          teamId: team._id,
          searchQuery: deferredIssueSearch || undefined,
        }
      : 'skip',
  );
  const teamIssuesData = teamIssuesQuery.data;

  // Fetch team projects
  const teamProjectsQuery = useQuery(
    api.projects.queries.list,
    team?.key ? { orgSlug, teamId: team.key } : 'skip',
  );
  const teamProjects = teamProjectsQuery.data ?? [];
  const teamIssuesQueryArgs = team?._id
    ? {
        orgSlug,
        teamId: team._id,
        searchQuery: deferredIssueSearch || undefined,
      }
    : null;
  const teamProjectsQueryArgs = team?.key
    ? { orgSlug, teamId: team.key }
    : null;

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

  const teamDocumentsQuery = useQuery(
    api.documents.queries.list,
    team?._id ? { orgSlug, teamId: team._id } : 'skip',
  );
  const teamDocuments = teamDocumentsQuery.data ?? [];

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
  }, [orgSlug, team]);

  const { isAllowed: canEditTeam } = usePermissionCheck(
    orgSlug,
    PERMISSIONS.TEAM_EDIT,
    permissionScope,
  ); // Mutations with toast error handling - ALL HOOKS MUST BE CALLED BEFORE ANY CONDITIONAL RETURNS
  const { isAllowed: canDeleteTeam } = usePermissionCheck(
    orgSlug,
    PERMISSIONS.TEAM_DELETE,
    permissionScope,
  );
  const { isAllowed: canUpdateAssignmentStates } = usePermissionCheck(
    orgSlug,
    PERMISSIONS.ISSUE_ASSIGNMENT_UPDATE,
    permissionScope,
  );
  const updateTeamMutation = useMutation(
    api.teams.mutations.update,
  ).withOptimisticUpdate((store, args) => {
    updateQuery(store, api.teams.queries.getByKey, teamQueryArgs, current => ({
      ...current,
      ...(args.data.name !== undefined ? { name: args.data.name } : {}),
      ...(args.data.description !== undefined
        ? { description: args.data.description }
        : {}),
      ...(args.data.icon !== undefined ? { icon: args.data.icon } : {}),
      ...(args.data.color !== undefined ? { color: args.data.color } : {}),
      ...(args.data.leadId !== undefined ? { leadId: args.data.leadId } : {}),
    }));
    updateQuery(
      store,
      api.organizations.queries.listTeams,
      { orgSlug },
      current =>
        updateTeamRows(current, String(args.teamId), row => ({
          ...row,
          ...(args.data.name !== undefined ? { name: args.data.name } : {}),
          ...(args.data.description !== undefined
            ? { description: args.data.description }
            : {}),
          ...(args.data.icon !== undefined ? { icon: args.data.icon } : {}),
          ...(args.data.color !== undefined ? { color: args.data.color } : {}),
          ...(args.data.leadId !== undefined
            ? { leadId: args.data.leadId }
            : {}),
        })),
    );
  });
  const deleteTeamMutation = useMutation(api.teams.mutations.deleteTeam);
  const deleteMutation = useMutation(api.issues.mutations.deleteIssue);
  const changePriorityMutation = useMutation(
    api.issues.mutations.changePriority,
  ).withOptimisticUpdate((store, args) => {
    if (!teamIssuesQueryArgs) return;
    const nextPriority = priorities.find(
      priority => String(priority._id) === String(args.priorityId),
    );
    updateQuery(
      store,
      api.issues.queries.listIssues,
      teamIssuesQueryArgs,
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
    if (!teamIssuesQueryArgs) return;
    updateQuery(
      store,
      api.issues.queries.listIssues,
      teamIssuesQueryArgs,
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
          : states[0]
            ? {
                _id: states[0]._id,
                name: states[0].name,
                icon: states[0].icon,
                color: states[0].color,
                type: states[0].type,
              }
            : null;
        const membersForOrg =
          store.getQuery(api.organizations.queries.listMembers, { orgSlug }) ??
          undefined;
        const nextRows = buildOptimisticIssueRows(
          existingRows,
          args.issueId,
          args.assigneeIds,
          membersForOrg,
          fallbackState,
        );
        return replaceIssueRows(current, String(args.issueId), nextRows);
      },
    );
  });
  const changeTeamMutation = useMutation(
    api.issues.mutations.changeTeam,
  ).withOptimisticUpdate((store, args) => {
    if (!teamIssuesQueryArgs || !team) return;
    updateQuery(
      store,
      api.issues.queries.listIssues,
      teamIssuesQueryArgs,
      current => {
        if (String(args.teamId) !== String(team._id)) {
          return {
            ...current,
            issues: current.issues.filter(
              row => String(row.id) !== String(args.issueId),
            ),
            total: Math.max(
              0,
              current.total -
                (current.issues.some(
                  row => String(row.id) === String(args.issueId),
                )
                  ? 1
                  : 0),
            ),
          };
        }
        return current;
      },
    );
  });
  const changeProjectMutation = useMutation(
    api.issues.mutations.changeProject,
  ).withOptimisticUpdate((store, args) => {
    if (!teamIssuesQueryArgs) return;
    const nextProject =
      projects.find(
        project => String(project._id) === String(args.projectId),
      ) ?? null;
    updateQuery(
      store,
      api.issues.queries.listIssues,
      teamIssuesQueryArgs,
      current =>
        updateIssueRows(current, String(args.issueId), row => ({
          ...row,
          projectId: args.projectId ?? undefined,
          projectKey: nextProject?.key,
        })),
    );
  });
  const changeWorkflowStateMutation = useMutation(
    api.issues.mutations.changeWorkflowState,
  ).withOptimisticUpdate((store, args) => {
    if (!teamIssuesQueryArgs) return;
    const nextState = states.find(
      state => String(state._id) === String(args.stateId),
    );
    updateQuery(
      store,
      api.issues.queries.listIssues,
      teamIssuesQueryArgs,
      current =>
        updateIssueRows(current, String(args.issueId), row => ({
          ...row,
          workflowStateId: nextState?._id,
          workflowStateName: nextState?.name ?? undefined,
          workflowStateIcon: nextState?.icon ?? undefined,
          workflowStateColor: nextState?.color ?? undefined,
          workflowStateType: nextState?.type ?? undefined,
        })),
    );
  });
  const changeStatusMutation = useMutation(
    api.projects.mutations.changeStatus,
  ).withOptimisticUpdate((store, args) => {
    if (!teamProjectsQueryArgs) return;
    const nextStatus =
      statuses.find(status => String(status._id) === String(args.statusId)) ??
      null;
    updateQuery(
      store,
      api.projects.queries.list,
      teamProjectsQueryArgs,
      current =>
        updateProjectRows(current, String(args.projectId), row => ({
          ...row,
          statusId: args.statusId ?? undefined,
          status: nextStatus,
        })),
    );
  });
  const changeProjectTeamMutation = useMutation(
    api.projects.mutations.changeTeam,
  ).withOptimisticUpdate((store, args) => {
    if (!teamProjectsQueryArgs || !team) return;
    updateQuery(
      store,
      api.projects.queries.list,
      teamProjectsQueryArgs,
      current => {
        if (String(args.teamId) !== String(team._id)) {
          return removeProjectRow(current, String(args.projectId));
        }
        return updateProjectRows(current, String(args.projectId), row => ({
          ...row,
          teamId: args.teamId ?? undefined,
        }));
      },
    );
  });
  const changeLeadMutation = useMutation(
    api.projects.mutations.changeLead,
  ).withOptimisticUpdate((store, args) => {
    if (!teamProjectsQueryArgs) return;
    const projectRow = teamProjects.find(
      project => String(project._id) === String(args.projectId),
    );
    updateQuery(
      store,
      api.projects.queries.list,
      teamProjectsQueryArgs,
      current =>
        updateProjectRows(current, String(args.projectId), row => ({
          ...row,
          leadId: args.leadId ?? undefined,
        })),
    );
    if (projectRow) {
      updateQuery(
        store,
        api.projects.queries.getByKey,
        { orgSlug, projectKey: projectRow.key },
        current => ({
          ...current,
          leadId: args.leadId ?? undefined,
          ...(args.leadId === null ? { lead: null } : {}),
        }),
      );
    }
  });
  const deleteProjectMutation = useMutation(
    api.projects.mutations.deleteProject,
  );
  const removeMemberMutation = useMutation(api.teams.mutations.removeMember);
  const changeVisibilityMutation = useMutation(
    api.teams.mutations.changeVisibility,
  ).withOptimisticUpdate((store, args) => {
    updateQuery(store, api.teams.queries.getByKey, teamQueryArgs, current => ({
      ...current,
      visibility: args.visibility,
    }));
  });

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
    return (
      <div className='bg-background h-full overflow-y-auto'>
        <div className='h-full'>
          {/* Header Skeleton – matches sticky header bar */}
          <div className='bg-background/95 supports-[backdrop-filter]:bg-background/60 flex flex-wrap items-center justify-between gap-y-0 border-b px-2 backdrop-blur'>
            <div className='flex h-8 items-center gap-2'>
              <Skeleton className='h-4 w-12' />
              <span className='text-muted-foreground text-sm'>/</span>
              <Skeleton className='h-4 w-16' />
            </div>
            <div className='flex items-center gap-2'>
              <Skeleton className='size-6 rounded-md' />
              <div className='bg-muted-foreground/20 h-4 w-px' />
              <Skeleton className='h-6 w-16 rounded-full' />
              <div className='bg-muted-foreground/20 h-4 w-px' />
              <Skeleton className='h-6 w-16' />
            </div>
          </div>

          {/* Main Content Skeleton */}
          <div className='py-3 sm:py-4'>
            {/* Header area — constrained */}
            <div className='mx-auto w-full max-w-5xl px-3 sm:px-4'>
              <div className='mb-2 space-y-2'>
                {/* Icon + Title */}
                <div className='flex items-center gap-2'>
                  <Skeleton className='size-6 rounded' />
                  <Skeleton className='h-9 w-1/2' />
                </div>
                {/* Description */}
                <Skeleton className='h-4 w-3/4' />
              </div>

              {/* Properties row */}
              <div className='mt-4 mb-2 flex flex-wrap items-center gap-2'>
                <Skeleton className='h-8 w-16 rounded-md' />
                <Skeleton className='h-8 w-12 rounded-md' />
                <Skeleton className='h-8 w-28 rounded-md' />
              </div>
            </div>

            {/* Tabs — header constrained, content full-width */}
            <div className='mt-6'>
              <div className='mx-auto w-full max-w-5xl px-3 sm:px-4'>
                <div className='flex gap-2 border-b pb-2'>
                  <Skeleton className='h-7 w-20' />
                  <Skeleton className='h-7 w-20' />
                  <Skeleton className='h-7 w-20' />
                </div>
              </div>
              {/* Content area — full width like kanban/table */}
              <div className='mt-4 divide-y px-3 sm:px-4'>
                {Array.from({ length: 4 }).map((_, i) => (
                  <div key={i} className='flex items-center gap-3 px-3 py-2'>
                    <Skeleton className='size-8 rounded-full' />
                    <div className='flex-1 space-y-1'>
                      <Skeleton className='h-4 w-28' />
                      <Skeleton className='h-3 w-40' />
                    </div>
                    <Skeleton className='h-4 w-14' />
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    );
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

  if (team && team._id !== initializedTeamId) {
    setInitializedTeamId(team._id);
    setNameValue(team.name);
    setDescriptionValue(team.description || '');
    setKeyValue(team.key);
  }

  if (!user) return null;

  const handleNameSave = async () => {
    if (!nameValue.trim() || !team) return;
    const nextName = nameValue.trim();
    setIsUpdating(true);
    setNameValue(nextName);
    setEditingName(false);
    await updateTeamMutation({
      teamId: team._id,
      data: { name: nextName },
    });
    setIsUpdating(false);
  };

  const handleDescriptionSave = async () => {
    if (!team) return;
    const nextDescription = descriptionValue.trim();
    setIsUpdating(true);
    setDescriptionValue(nextDescription);
    setEditingDescription(false);
    await updateTeamMutation({
      teamId: team._id,
      data: { description: nextDescription || undefined },
    });
    setIsUpdating(false);
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
    setIsUpdating(true);
    await updateTeamMutation({
      teamId: team._id,
      data: { icon: iconName ?? undefined },
    });
    setIsUpdating(false);
  };

  const handleColorChange = async (color: string) => {
    if (!team) return;
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

  const handleTeamDelete = async () => {
    if (!team || !canDeleteTeam) return;
    const ok = await confirm({
      title: 'Delete team',
      description:
        'This will permanently delete the team and cannot be undone.',
      confirmLabel: 'Delete',
      variant: 'destructive',
    });
    if (!ok) return;
    setIsUpdating(true);
    try {
      await deleteTeamMutation({
        teamId: team._id,
      });
      router.push(`/${orgSlug}/teams`);
    } finally {
      setIsUpdating(false);
    }
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
    issueId: string,
    stateId: string,
  ) => {
    if (!user?._id || !issueId || !stateId) return;
    setIsUpdatingIssues(true);
    await changeWorkflowStateMutation({
      issueId: issueId as Id<'issues'>,
      stateId: stateId as Id<'issueStates'>,
    });
    setIsUpdatingIssues(false);
  };

  const handleIssueDelete = async (issueId: string) => {
    const ok = await confirm({
      title: 'Delete issue',
      description:
        'This will permanently delete the issue and cannot be undone.',
      confirmLabel: 'Delete',
      variant: 'destructive',
    });
    if (!ok) return;
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
    const ok = await confirm({
      title: 'Delete project',
      description:
        'This will permanently delete the project and cannot be undone.',
      confirmLabel: 'Delete',
      variant: 'destructive',
    });
    if (!ok) return;
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
          <div className='bg-background/95 supports-[backdrop-filter]:bg-background/60 flex flex-wrap items-center justify-between gap-y-0 border-b px-2 backdrop-blur'>
            <div className='flex h-8 items-center gap-2'>
              <MobileNavTrigger />
              <Link
                href={`/${orgSlug}/teams`}
                className='text-muted-foreground hover:text-foreground text-sm transition-colors'
              >
                <span className='hidden sm:inline'>Teams</span>
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
              <div className='bg-muted-foreground/20 h-4 w-px' />
              <PermissionGate
                orgSlug={orgSlug}
                permission={PERMISSIONS.TEAM_DELETE}
                scope={permissionScope}
              >
                <Button
                  variant='ghost'
                  size='sm'
                  className='text-destructive hover:bg-destructive/10 hover:text-destructive h-6 gap-1 px-2'
                  disabled={!canDeleteTeam || isUpdating}
                  onClick={() => void handleTeamDelete()}
                >
                  <Trash2 className='size-3.5' />
                  <span className='hidden sm:inline'>Delete</span>
                </Button>
              </PermissionGate>
            </div>
          </div>

          {/* Main Content */}
          <div className='py-3 sm:py-4'>
            {/* Team Header */}
            <div className='mx-auto w-full max-w-5xl px-3 sm:px-4'>
              <div className='mb-2 space-y-2'>
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
                                    onClick={() =>
                                      handleColorChange(colorOption)
                                    }
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
                      onKeyDown={e => {
                        if (e.key === 'Enter') void handleNameSave();
                        if (e.key === 'Escape') {
                          setNameValue(displayName);
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
                          setNameValue(displayName);
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
                                    onClick={() =>
                                      handleColorChange(colorOption)
                                    }
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
                        setNameValue(displayName);
                        setEditingName(true);
                      }}
                    >
                      {displayName}
                    </span>
                  </h1>
                )}
              </div>

              {/* Description */}
              <div className='mb-2'>
                {editingDescription ? (
                  <div className='space-y-4'>
                    <RichEditor
                      value={descriptionValue}
                      onChange={setDescriptionValue}
                      placeholder='Add a description...'
                      mode='compact'
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
                          'prose prose-sm dark:prose-invert text-muted-foreground max-w-none transition-colors',
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

              {/* Properties */}
              <TooltipProvider>
                <div className='mt-4 mb-2 flex flex-wrap items-center gap-2'>
                  {/* Identifier */}
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <div className='text-muted-foreground hover:bg-muted/50 flex h-8 items-center gap-1.5 rounded-md border px-2.5 font-mono text-sm transition-colors'>
                        {team?.key}
                      </div>
                    </TooltipTrigger>
                    <TooltipContent side='bottom'>Identifier</TooltipContent>
                  </Tooltip>

                  {/* Members */}
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <div className='text-muted-foreground hover:bg-muted/50 flex h-8 items-center gap-1.5 rounded-md border px-2.5 text-sm transition-colors'>
                        <UsersRound className='size-3.5' />
                        <span>{teamMembers?.length ?? 0}</span>
                      </div>
                    </TooltipTrigger>
                    <TooltipContent side='bottom'>Members</TooltipContent>
                  </Tooltip>

                  {/* Created */}
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <div className='text-muted-foreground hover:bg-muted/50 flex h-8 items-center gap-1.5 rounded-md border px-2.5 text-sm transition-colors'>
                        <Clock className='size-3.5' />
                        <span>
                          {formatDateHuman(new Date(team?._creationTime || 0))}
                        </span>
                      </div>
                    </TooltipTrigger>
                    <TooltipContent side='bottom'>Created</TooltipContent>
                  </Tooltip>
                </div>
              </TooltipProvider>
            </div>
            {/* end max-w-5xl */}

            {/* Team Content Tabs */}
            <Tabs value={activeTab} onValueChange={setActiveTab}>
              <div className='mx-auto w-full max-w-5xl px-3 sm:px-4'>
                <div className='flex flex-wrap items-center justify-between gap-2'>
                  <div className='overflow-x-auto overflow-y-hidden'>
                    <TabsList>
                      <TabsTrigger value='issues'>
                        Issues
                        <span className='text-muted-foreground text-xs'>
                          {teamIssuesData?.total || 0}
                        </span>
                      </TabsTrigger>
                      <TabsTrigger value='members'>
                        Members
                        <span className='text-muted-foreground text-xs'>
                          {teamMembers?.length ?? 0}
                        </span>
                      </TabsTrigger>
                      <TabsTrigger value='projects'>
                        Projects
                        <span className='text-muted-foreground text-xs'>
                          {teamProjects.length}
                        </span>
                      </TabsTrigger>
                      <TabsTrigger value='documents'>Documents</TabsTrigger>
                      <TabsTrigger value='activity'>Activity</TabsTrigger>
                    </TabsList>
                  </div>

                  {/* Tab-specific controls — same row on desktop */}
                  {activeTab === 'members' && (
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
                      {canEdit && (
                        <Button
                          onClick={() => setShowAddMemberDialog(true)}
                          className='h-6 gap-1 text-xs'
                          variant='outline'
                          size='sm'
                        >
                          <Plus className='size-3' />
                          Add
                        </Button>
                      )}
                    </div>
                  )}
                  {activeTab === 'projects' && canEdit && (
                    <CreateProjectDialog
                      orgSlug={orgSlug}
                      defaultStates={{ teamId: team?._id }}
                      className='h-6 text-xs'
                    />
                  )}
                  {activeTab === 'issues' && (
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
                      {canEdit && (
                        <CreateIssueDialog
                          orgSlug={orgSlug}
                          defaultStates={{ teamId: team?._id }}
                          className='h-6 text-xs'
                        />
                      )}
                    </div>
                  )}
                </div>
              </div>

              {/* Members Tab */}
              <TabsContent value='members'>
                <div className='px-3 sm:px-4'>
                  <div className='rounded-lg border'>
                    <MembersList
                      members={filteredMembers}
                      onRemoveMember={canEdit ? handleRemoveMember : undefined}
                      removePending={isUpdating}
                      canEdit={canEdit}
                    />
                  </div>
                </div>
              </TabsContent>

              {/* Issues Tab */}
              <TabsContent value='issues'>
                {teamIssuesData === undefined ? (
                  issueViewMode === 'kanban' ? (
                    <KanbanSkeleton />
                  ) : (
                    <div className='px-3 sm:px-4'>
                      <div className='rounded-lg border p-4'>
                        <div className='space-y-3'>
                          {Array.from({ length: 5 }).map((_, i) => (
                            <div
                              key={i}
                              className='bg-muted/60 h-8 animate-pulse rounded'
                            />
                          ))}
                        </div>
                      </div>
                    </div>
                  )
                ) : (
                  <AnimatePresence mode='wait' initial={false}>
                    {issueViewMode === 'kanban' ? (
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
                          issues={teamIssuesData.issues}
                          states={states}
                          priorities={priorities}
                          teams={teams}
                          projects={projects}
                          currentUserId={user?._id || ''}
                          canChangeAll={canUpdateAssignmentStates}
                          onStateChange={(issueId, _assignmentId, stateId) => {
                            void handleAssignmentStateChange(issueId, stateId);
                          }}
                          onPriorityChange={handlePriorityChange}
                          onAssigneesChange={(issueId, ids) => {
                            void handleAssigneesChange(issueId, ids);
                          }}
                          onTeamChange={handleIssueTeamChange}
                          onProjectChange={handleIssueProjectChange}
                          onDelete={handleIssueDelete}
                          deletePending={isUpdatingIssues}
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
                        {teamIssuesData.issues.length > 0 ? (
                          <div className='rounded-lg border'>
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
                              onAssignmentStateChange={
                                handleAssignmentStateChange
                              }
                              isUpdatingAssignmentStates={isUpdatingIssues}
                              currentUserId={user?._id || ''}
                              canChangeAll={canUpdateAssignmentStates}
                              activeFilter='all'
                            />
                          </div>
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
                      </motion.div>
                    )}
                  </AnimatePresence>
                )}
              </TabsContent>

              {/* Projects Tab */}
              <TabsContent value='projects'>
                <div className='px-3 sm:px-4'>
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
                </div>
              </TabsContent>

              <TabsContent value='documents'>
                <div className='space-y-4 px-3 sm:px-4'>
                  <div className='rounded-lg border'>
                    {teamDocuments && teamDocuments.length > 0 ? (
                      <div className='divide-y'>
                        {teamDocuments.map(doc => (
                          <Link
                            key={doc._id}
                            href={`/${orgSlug}/documents/${doc._id}`}
                            className='hover:bg-muted/50 flex items-center gap-3 px-3 py-2 transition-colors'
                          >
                            <FileText className='text-muted-foreground size-4 flex-shrink-0' />
                            <div className='min-w-0 flex-1'>
                              <div className='truncate text-sm font-medium'>
                                {doc.title}
                              </div>
                              <div className='text-muted-foreground text-xs'>
                                {doc.author?.name || doc.author?.email}
                              </div>
                            </div>
                          </Link>
                        ))}
                      </div>
                    ) : (
                      <div className='flex items-center justify-center py-12'>
                        <div className='text-center'>
                          <div className='mb-4 flex justify-center'>
                            <FileText className='text-muted-foreground/50 h-16 w-16' />
                          </div>
                          <h3 className='mb-2 text-lg font-semibold'>
                            No documents found
                          </h3>
                          <p className='text-muted-foreground mb-6'>
                            This team doesn&apos;t have any documents yet.
                          </p>
                        </div>
                      </div>
                    )}
                  </div>
                  {team?._id && (
                    <LinkedDocuments
                      orgSlug={orgSlug}
                      mentionType='team'
                      entityId={team._id}
                    />
                  )}
                </div>
              </TabsContent>

              <TabsContent value='activity'>
                <div className='px-3 sm:px-4'>
                  {team?._id ? (
                    <TeamActivityFeed orgSlug={orgSlug} teamId={team._id} />
                  ) : null}
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
          teamId={team._id}
          existingMemberIds={new Set((teamMembers ?? []).map(m => m.userId))}
          onClose={() => setShowAddMemberDialog(false)}
        />
      )}
      <ConfirmDialog />
    </div>
  );
}
