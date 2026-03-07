'use client';

import { useState } from 'react';
import { useQuery, useMutation } from 'convex/react';
import { api } from '@/lib/convex';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Plus, X, User } from 'lucide-react';
import { StateSelector, AssigneeSelector } from './issue-selectors';
import type { Member, State } from './issue-selectors';
import { PERMISSIONS } from '@/convex/_shared/permissions';
import { useScopedPermission } from '@/hooks/use-permissions';
import { PermissionAware } from '@/components/ui/permission-aware';
import type { Id } from '../../../convex/_generated/dataModel';

// Helper to derive initials from a name/email
function getAssigneeInitials(
  name?: string | null,
  email?: string | null,
): string {
  const displayName = name || email;
  if (!displayName) return '?';
  return displayName
    .split(' ')
    .map(part => part.charAt(0))
    .join('')
    .toUpperCase()
    .slice(0, 2);
}

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
  const assignments =
    useQuery(api.issues.queries.getAssignments, {
      issueId,
    }) ?? [];

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
    .map(a => a.assigneeId)
    .filter((id): id is Id<'users'> => !!id);

  let availableMembers = members.filter(
    m => !assignedUserIds.includes(m.userId as Id<'users'>),
  );

  // If the user cannot manage assignments, they may only assign themselves
  if (!canManage) {
    availableMembers = availableMembers.filter(m => m.userId === currentUserId);
  }

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
        <Button
          variant='outline'
          size='sm'
          onClick={() => setAddDialogOpen(true)}
          className='h-6 gap-1 text-xs'
          disabled={availableMembers.length === 0}
        >
          <Plus className='h-3 w-3' />
        </Button>
      </div>

      {/* Assignments list - matching issues table design */}
      <div className='divide-y'>
        {assignments.map(assignment => {
          // Check if current user can modify this assignment
          const isOwnAssignment = assignment.assigneeId === currentUserId;
          const canModifyAssignment = canManage || isOwnAssignment;

          return (
            <div
              key={assignment._id}
              className='hover:bg-muted/50 flex items-center gap-3 p-2 transition-colors'
            >
              {/* Assignee - clickable like issues table */}
              <div className='flex min-w-0 flex-1 items-center gap-2'>
                <AssigneeSelector
                  members={members.filter(
                    m =>
                      m.userId === assignment.assigneeId ||
                      !assignedUserIds.includes(m.userId as Id<'users'>),
                  )}
                  selectedAssignee={assignment.assigneeId?.toString() || ''}
                  onAssigneeSelect={
                    canModifyAssignment
                      ? userId => handleUpdateAssignee(assignment._id, userId)
                      : undefined
                  }
                  displayMode='labelOnly'
                  trigger={
                    <div className='hover:bg-muted/30 -m-1 flex cursor-pointer items-center gap-2 rounded-md p-1 transition-colors'>
                      {assignment.assigneeId && assignment.assignee ? (
                        <>
                          <Avatar className='h-6 w-6 flex-shrink-0'>
                            <AvatarFallback className='text-xs'>
                              {getAssigneeInitials(
                                assignment.assignee.name,
                                assignment.assignee.email,
                              )}
                            </AvatarFallback>
                          </Avatar>
                          <span className='truncate text-sm'>
                            {assignment.assignee.name ||
                              assignment.assignee.email}
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

              {/* State badge - clickable like issues table */}
              {isOwnAssignment ? (
                // User can always change their own assignment status
                <StateSelector
                  states={states}
                  selectedState={assignment.stateId?.toString() || ''}
                  onStateSelect={stateId =>
                    handleStateChange(assignment._id, stateId)
                  }
                  align='end'
                  className='border-none bg-transparent p-0 shadow-none'
                />
              ) : (
                // For other users' assignments, check if user has permission to manage assignments
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
                        ? stateId => handleStateChange(assignment._id, stateId)
                        : () => {}
                    }
                    align='end'
                    className='border-none bg-transparent p-0 shadow-none'
                  />
                </PermissionAware>
              )}

              {/* Remove button */}
              <Button
                variant='ghost'
                size='sm'
                onClick={() => handleRemoveAssignment(assignment._id)}
                disabled={!canModifyAssignment}
                className='text-muted-foreground hover:text-destructive h-6 w-6 flex-shrink-0 p-0'
              >
                <X className='h-3 w-3' />
              </Button>
            </div>
          );
        })}
      </div>

      {/* Empty state */}
      {assignments.length === 0 && (
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
        <Dialog open={addDialogOpen} onOpenChange={setAddDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add Assignee</DialogTitle>
            </DialogHeader>
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
          </DialogContent>
        </Dialog>
      </PermissionAware>
    </div>
  );
}
