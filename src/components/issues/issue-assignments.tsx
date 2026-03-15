'use client';

import { useState } from 'react';
import { useQuery, useMutation } from 'convex/react';
import { api } from '@/lib/convex';
import { Button } from '@/components/ui/button';
import {
  ResponsiveDialog,
  ResponsiveDialogContent,
  ResponsiveDialogHeader,
  ResponsiveDialogTitle,
} from '@/components/ui/responsive-dialog';
import { Plus, X, User } from 'lucide-react';
import { StateSelector, AssigneeSelector } from './issue-selectors';
import type { Member, State } from './issue-selectors';
import { Input } from '@/components/ui/input';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import { PERMISSIONS } from '@/convex/_shared/permissions';
import { useScopedPermission } from '@/hooks/use-permissions';
import { PermissionAware } from '@/components/ui/permission-aware';
import type { Id } from '../../../convex/_generated/dataModel';
import { UserAvatar } from '@/components/user-avatar';
import { FunctionReturnType } from 'convex/server';
import { Skeleton } from '@/components/ui/skeleton';
import {
  addIssueAssignmentRow,
  removeIssueAssignmentRow,
  updateIssueAssignmentRows,
  updateQuery,
} from '@/lib/optimistic-updates';

export interface IssueAssignmentsProps {
  orgSlug: string;
  issueId: Id<'issues'>;
  /**
   * The list of workflow states available within the organization. Accepts either
   * mutable or readonly arrays so callers don't need to cast or clone.
   */
  states: readonly State[] | State[];
  /**
   * Organization member list. Accepts either mutable or readonly arrays so callers
   * don't need to cast or clone.
   */
  members: readonly Member[] | Member[];
  defaultStateId?: Id<'issueStates'>;
}

function IssueAssignmentsSkeleton() {
  return (
    <div className='divide-y'>
      {Array.from({ length: 2 }).map((_, index) => (
        <div key={index} className='flex items-center gap-3 p-2'>
          <div className='flex min-w-0 flex-1 items-center gap-2'>
            <Skeleton className='h-6 w-6 rounded-full' />
            <Skeleton className='h-4 w-28' />
          </div>
          <Skeleton className='h-6 w-20 rounded-md' />
          <Skeleton className='h-6 w-6 rounded-sm' />
        </div>
      ))}
    </div>
  );
}

type IssueAssignment = FunctionReturnType<
  typeof api.issues.queries.getAssignments
>[number];

interface IssueAssignmentRowProps {
  assignment: IssueAssignment;
  orgSlug: string;
  states: readonly State[] | State[];
  members: readonly Member[] | Member[];
  assignedUserIds: readonly Id<'users'>[];
  currentUserId: string;
  canManage: boolean;
  onStateChange: (assignmentId: string, stateId: string) => void;
  onUpdateAssignee: (assignmentId: string, assigneeId: string) => void;
  onRemoveAssignment: (assignmentId: string) => void;
}

function IssueAssignmentRow({
  assignment,
  orgSlug,
  states,
  members,
  assignedUserIds,
  currentUserId,
  canManage,
  onStateChange,
  onUpdateAssignee,
  onRemoveAssignment,
}: IssueAssignmentRowProps) {
  const displayAssigneeId = assignment.assigneeId?.toString() || '';

  const isOwnAssignment = assignment.assigneeId === currentUserId;
  const canModifyAssignment = canManage || isOwnAssignment;
  const assignedUserIdsExcludingCurrent = assignedUserIds.filter(
    id => id !== assignment.assigneeId,
  );
  const availableMembers = members.filter(
    member =>
      member.userId === displayAssigneeId ||
      !assignedUserIdsExcludingCurrent.includes(member.userId as Id<'users'>),
  );
  const displayMember =
    members.find(member => member.userId === displayAssigneeId)?.user ||
    assignment.assignee;

  return (
    <div className='hover:bg-muted/50 flex items-center gap-3 p-2 transition-colors'>
      <div className='flex min-w-0 flex-1 items-center gap-2'>
        <AssigneeSelector
          members={availableMembers}
          selectedAssignee={displayAssigneeId}
          onAssigneeSelect={
            canModifyAssignment
              ? userId => onUpdateAssignee(assignment._id, userId)
              : undefined
          }
          displayMode='labelOnly'
          trigger={
            <div className='hover:bg-muted/30 -m-1 flex cursor-pointer items-center gap-2 rounded-md p-1 transition-colors'>
              {displayAssigneeId && displayMember ? (
                <>
                  <UserAvatar
                    name={displayMember.name}
                    email={displayMember.email}
                    image={
                      'image' in displayMember ? displayMember.image : undefined
                    }
                    userId={displayAssigneeId}
                    size='sm'
                    className='flex-shrink-0'
                  />
                  <span className='truncate text-sm'>
                    {displayMember.name || displayMember.email}
                  </span>
                </>
              ) : (
                <>
                  <div className='bg-muted flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full'>
                    <User className='text-muted-foreground h-3 w-3' />
                  </div>
                  <span className='text-muted-foreground text-sm'>
                    Unassigned
                  </span>
                </>
              )}
            </div>
          }
        />
        {assignment.note && (
          <span className='bg-muted text-muted-foreground inline-flex max-w-[120px] truncate rounded px-1.5 py-0.5 text-[10px] leading-tight'>
            {assignment.note}
          </span>
        )}
      </div>

      {isOwnAssignment ? (
        <StateSelector
          states={states}
          selectedState={assignment.stateId?.toString() || ''}
          onStateSelect={stateId => onStateChange(assignment._id, stateId)}
          align='end'
          className='border-none bg-transparent p-0 shadow-none'
        />
      ) : (
        <PermissionAware
          orgSlug={orgSlug}
          permission={PERMISSIONS.ISSUE_ASSIGNMENT_UPDATE}
          fallbackMessage="You don't have permission to change assignment status"
        >
          <StateSelector
            states={states}
            selectedState={assignment.stateId?.toString() || ''}
            onStateSelect={
              canManage
                ? stateId => onStateChange(assignment._id, stateId)
                : () => {}
            }
            align='end'
            className='border-none bg-transparent p-0 shadow-none'
          />
        </PermissionAware>
      )}

      <Button
        variant='ghost'
        size='sm'
        onClick={() => onRemoveAssignment(assignment._id)}
        disabled={!canModifyAssignment}
        className='text-muted-foreground hover:text-destructive h-6 w-6 flex-shrink-0 p-0'
      >
        <X className='h-3 w-3' />
      </Button>
    </div>
  );
}

export function IssueAssignments({
  orgSlug,
  issueId,
  states,
  members,
  defaultStateId,
}: IssueAssignmentsProps) {
  const [addDialogOpen, setAddDialogOpen] = useState(false);

  // Current user info
  const currentUser = useQuery(api.users.currentUser);
  const currentUserId = currentUser?._id || '';

  // Permission check (manage assignments)
  const { hasPermission: canManage } = useScopedPermission(
    { orgSlug },
    PERMISSIONS.ISSUE_ASSIGN,
  );

  // Fetch assignments for this issue
  const assignments = useQuery(api.issues.queries.getAssignments, {
    issueId,
  });
  const isAssignmentsLoading = assignments === undefined;
  const assignmentList = assignments ?? [];

  // Mutations
  const addAssigneeMutation = useMutation(
    api.issues.mutations.addAssignee,
  ).withOptimisticUpdate((store, args) => {
    const nextState =
      states.find(state => String(state._id) === String(args.stateId)) ??
      states.find(state => String(state._id) === String(defaultStateId)) ??
      states[0] ??
      null;
    const optimisticAssignment: IssueAssignment = {
      _id: `optimistic-${args.issueId}-${args.assigneeId}` as Id<'issueAssignees'>,
      _creationTime: 0,
      issueId,
      assigneeId: args.assigneeId,
      stateId: nextState?._id,
      note: args.note,
      assignee: null,
      state: nextState
        ? {
            _id: nextState._id,
            _creationTime: nextState._creationTime ?? 0,
            organizationId: nextState.organizationId,
            name: nextState.name,
            type: nextState.type,
            color: nextState.color,
            icon: nextState.icon,
            position: nextState.position,
          }
        : null,
    };
    updateQuery(
      store,
      api.issues.queries.getAssignments,
      { issueId },
      current => addIssueAssignmentRow(current, optimisticAssignment),
    );
  });
  const changeAssignmentStateMutation = useMutation(
    api.issues.mutations.changeAssignmentState,
  ).withOptimisticUpdate((store, args) => {
    const nextState = states.find(
      state => String(state._id) === String(args.stateId),
    );
    updateQuery(
      store,
      api.issues.queries.getAssignments,
      { issueId },
      current =>
        updateIssueAssignmentRows(current, String(args.assignmentId), row => ({
          ...row,
          stateId: args.stateId,
          state: nextState
            ? {
                _id: nextState._id,
                _creationTime:
                  row.state?._creationTime ?? nextState._creationTime ?? 0,
                organizationId: nextState.organizationId,
                name: nextState.name,
                type: nextState.type,
                color: nextState.color,
                icon: nextState.icon,
                position: nextState.position,
              }
            : null,
        })),
    );
  });
  const updateAssignmentAssigneeMutation = useMutation(
    api.issues.mutations.updateAssignmentAssignee,
  ).withOptimisticUpdate((store, args) => {
    updateQuery(
      store,
      api.issues.queries.getAssignments,
      { issueId },
      current =>
        updateIssueAssignmentRows(current, String(args.assignmentId), row => ({
          ...row,
          assigneeId: args.assigneeId,
          assignee: null,
        })),
    );
  });
  const deleteAssignmentMutation = useMutation(
    api.issues.mutations.deleteAssignment,
  ).withOptimisticUpdate((store, args) => {
    updateQuery(
      store,
      api.issues.queries.getAssignments,
      { issueId },
      current => removeIssueAssignmentRow(current, String(args.assignmentId)),
    );
  });

  // Helper to filter members so the same user cannot be assigned twice
  const assignedUserIds = assignments
    ? assignments.map(a => a.assigneeId).filter((id): id is Id<'users'> => !!id)
    : [];

  let availableMembers = members.filter(
    m => !assignedUserIds.includes(m.userId as Id<'users'>),
  );

  // If the user cannot manage assignments, they may only assign themselves
  if (!canManage) {
    availableMembers = availableMembers.filter(m => m.userId === currentUserId);
  }

  const handleUnassignAll = async () => {
    try {
      await Promise.all(
        assignmentList.map(assignment =>
          deleteAssignmentMutation({
            assignmentId: assignment._id as Id<'issueAssignees'>,
          }),
        ),
      );
    } catch (error) {
      console.error('Failed to unassign all assignees:', error);
    }
  };

  const handleAddAssignee = async (assigneeId: string, note?: string) => {
    try {
      await addAssigneeMutation({
        issueId,
        assigneeId: assigneeId as Id<'users'>,
        stateId: defaultStateId || undefined,
        note: note?.trim() || undefined,
      });
      setAddDialogOpen(false);
    } catch (error) {
      console.error('Failed to add assignee:', error);
    }
  };

  const handleStateChange = async (assignmentId: string, stateId: string) => {
    try {
      await changeAssignmentStateMutation({
        assignmentId: assignmentId as Id<'issueAssignees'>,
        stateId: stateId as Id<'issueStates'>,
      });
    } catch (error) {
      console.error('Failed to change state:', error);
    }
  };

  const handleRemoveAssignment = async (assignmentId: string) => {
    try {
      await deleteAssignmentMutation({
        assignmentId: assignmentId as Id<'issueAssignees'>,
      });
    } catch (error) {
      console.error('Failed to remove assignment:', error);
    }
  };

  const handleUpdateAssignee = async (
    assignmentId: string,
    assigneeId: string,
  ) => {
    try {
      await updateAssignmentAssigneeMutation({
        assignmentId: assignmentId as Id<'issueAssignees'>,
        assigneeId: assigneeId as Id<'users'>,
      });
    } catch (error) {
      console.error('Failed to update assignee:', error);
    }
  };

  return (
    <div>
      <div className='flex items-center justify-between border-b px-1 py-1 pl-2'>
        <h4 className='text-sm'>Assignees</h4>
        <div className='flex items-center gap-1'>
          {assignmentList.length > 0 && (
            <Button
              variant='ghost'
              size='sm'
              onClick={() => void handleUnassignAll()}
              className='h-6 gap-1 px-2 text-xs'
              disabled={!canManage || isAssignmentsLoading}
            >
              <X className='h-3 w-3' />
              <span>Unassign all</span>
            </Button>
          )}
          <Button
            variant='outline'
            size='sm'
            onClick={() => setAddDialogOpen(true)}
            className='h-6 gap-1 text-xs'
            disabled={availableMembers.length === 0 || isAssignmentsLoading}
          >
            <Plus className='h-3 w-3' />
          </Button>
        </div>
      </div>

      {isAssignmentsLoading ? (
        <IssueAssignmentsSkeleton />
      ) : (
        <div className='divide-y'>
          {assignmentList.map(assignment => {
            return (
              <IssueAssignmentRow
                key={assignment._id}
                assignment={assignment}
                orgSlug={orgSlug}
                states={states}
                members={members}
                assignedUserIds={assignedUserIds}
                currentUserId={currentUserId}
                canManage={canManage}
                onStateChange={handleStateChange}
                onUpdateAssignee={handleUpdateAssignee}
                onRemoveAssignment={handleRemoveAssignment}
              />
            );
          })}
        </div>
      )}

      {/* Empty state */}
      {!isAssignmentsLoading && assignmentList.length === 0 && (
        <div className='flex items-center justify-center py-8'>
          <div className='text-center'>
            <div className='mb-2 flex justify-center'>
              <User className='text-muted-foreground/50 h-8 w-8' />
            </div>
            <p className='text-muted-foreground text-sm'>No assignees</p>
            <p className='text-muted-foreground/70 text-xs'>
              Add assignees to track who is working on this issue
            </p>
          </div>
        </div>
      )}

      {/* Add assignee dialog */}
      <PermissionAware
        orgSlug={orgSlug}
        permission={PERMISSIONS.ISSUE_ASSIGN}
        fallbackMessage="You don't have permission to add assignees"
      >
        <AddAssigneeDialog
          open={addDialogOpen}
          onOpenChange={setAddDialogOpen}
          members={availableMembers}
          onAdd={handleAddAssignee}
        />
      </PermissionAware>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Compact add-assignee dialog (Vector design pattern)
// ---------------------------------------------------------------------------

interface AddAssigneeDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  members: readonly Member[] | Member[];
  onAdd: (assigneeId: string, note?: string) => void;
}

function AddAssigneeDialog({
  open,
  onOpenChange,
  members,
  onAdd,
}: AddAssigneeDialogProps) {
  const [selectedMemberId, setSelectedMemberId] = useState<string | null>(null);
  const [note, setNote] = useState('');

  const handleSelect = (userId: string) => {
    setSelectedMemberId(userId);
  };

  const handleSubmit = () => {
    if (!selectedMemberId) return;
    onAdd(selectedMemberId, note);
    setSelectedMemberId(null);
    setNote('');
  };

  const handleClose = () => {
    onOpenChange(false);
    setSelectedMemberId(null);
    setNote('');
  };

  const selectedMember = members.find(m => m.userId === selectedMemberId);

  return (
    <ResponsiveDialog open={open} onOpenChange={v => !v && handleClose()}>
      <ResponsiveDialogHeader className='sr-only'>
        <ResponsiveDialogTitle>Add Assignee</ResponsiveDialogTitle>
      </ResponsiveDialogHeader>
      <ResponsiveDialogContent
        showCloseButton={false}
        className='gap-2 p-2 sm:max-w-md'
      >
        {!selectedMemberId ? (
          <Command className='border-none shadow-none'>
            <CommandInput placeholder='Search members…' autoFocus />
            <CommandList className='max-h-[240px]'>
              <CommandEmpty>No members available</CommandEmpty>
              <CommandGroup>
                {members.map(member => (
                  <CommandItem
                    key={member.userId}
                    value={`${member.user?.name ?? ''} ${member.user?.email ?? ''}`}
                    onSelect={() => handleSelect(member.userId)}
                    className='flex items-center gap-2 px-2 py-1.5'
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
                  </CommandItem>
                ))}
              </CommandGroup>
            </CommandList>
          </Command>
        ) : (
          <div className='space-y-2'>
            {/* Selected member preview */}
            <div className='flex items-center gap-2 px-1'>
              <UserAvatar
                name={selectedMember?.user?.name}
                email={selectedMember?.user?.email}
                image={selectedMember?.user?.image}
                userId={selectedMemberId}
                size='sm'
              />
              <div className='min-w-0 flex-1'>
                <span className='text-sm font-medium'>
                  {selectedMember?.user?.name ?? 'Unknown'}
                </span>
              </div>
              <Button
                variant='ghost'
                size='sm'
                className='h-6 w-6 p-0'
                onClick={() => setSelectedMemberId(null)}
              >
                <X className='h-3 w-3' />
              </Button>
            </div>

            {/* Optional note */}
            <div className='relative'>
              <Input
                placeholder='Add a note (optional)'
                value={note}
                onChange={e => setNote(e.target.value)}
                className='h-8 text-sm'
                autoFocus
                onKeyDown={e => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleSubmit();
                  }
                }}
              />
            </div>
          </div>
        )}

        <div className='flex w-full flex-row items-center justify-between gap-2'>
          <Button variant='ghost' size='sm' onClick={handleClose}>
            Cancel
          </Button>
          {selectedMemberId && (
            <Button size='sm' onClick={handleSubmit}>
              Add assignee
            </Button>
          )}
        </div>
      </ResponsiveDialogContent>
    </ResponsiveDialog>
  );
}
