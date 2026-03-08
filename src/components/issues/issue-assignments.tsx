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
import { PERMISSIONS } from '@/convex/_shared/permissions';
import { useScopedPermission } from '@/hooks/use-permissions';
import { PermissionAware } from '@/components/ui/permission-aware';
import type { Id } from '../../../convex/_generated/dataModel';
import { UserAvatar } from '@/components/user-avatar';
import { FunctionReturnType } from 'convex/server';
import { useOptimisticValue } from '@/hooks/use-optimistic';
import { Skeleton } from '@/components/ui/skeleton';

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
  const [displayAssigneeId, setOptimisticAssigneeId] = useOptimisticValue(
    assignment.assigneeId?.toString() || '',
  );

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
              ? userId => {
                  setOptimisticAssigneeId(userId);
                  onUpdateAssignee(assignment._id, userId);
                }
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
                    image={displayMember.image}
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
  const addAssigneeMutation = useMutation(api.issues.mutations.addAssignee);
  const changeAssignmentStateMutation = useMutation(
    api.issues.mutations.changeAssignmentState,
  );
  const updateAssignmentAssigneeMutation = useMutation(
    api.issues.mutations.updateAssignmentAssignee,
  );
  const deleteAssignmentMutation = useMutation(
    api.issues.mutations.deleteAssignment,
  );

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

  const handleAddAssignee = async (assigneeId: string) => {
    try {
      await addAssigneeMutation({
        issueId,
        assigneeId: assigneeId as Id<'users'>,
        stateId: defaultStateId || undefined,
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
        <ResponsiveDialog open={addDialogOpen} onOpenChange={setAddDialogOpen}>
          <ResponsiveDialogContent>
            <ResponsiveDialogHeader>
              <ResponsiveDialogTitle>Add Assignee</ResponsiveDialogTitle>
            </ResponsiveDialogHeader>
            <div className='space-y-4'>
              <div className='space-y-2'>
                <label className='text-sm font-medium'>Select assignee</label>
                <AssigneeSelector
                  members={availableMembers}
                  selectedAssignee=''
                  onAssigneeSelect={handleAddAssignee}
                  displayMode='labelOnly'
                />
              </div>
            </div>
          </ResponsiveDialogContent>
        </ResponsiveDialog>
      </PermissionAware>
    </div>
  );
}
