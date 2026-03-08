'use client';

import { useMemo, useState } from 'react';
import { useMutation, useQuery } from 'convex/react';
import { api } from '@/convex/_generated/api';
import { Button } from '@/components/ui/button';
import {
  ResponsiveDialog,
  ResponsiveDialogContent,
  ResponsiveDialogHeader,
  ResponsiveDialogTitle,
} from '@/components/ui/responsive-dialog';
import {
  Command,
  CommandInput,
  CommandList,
  CommandEmpty,
  CommandGroup,
  CommandItem,
} from '@/components/ui/command';
import { MoreHorizontal, Trash2, Users, Plus } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { motion, AnimatePresence } from 'motion/react';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from '@/components/ui/dropdown-menu';

import { FunctionReturnType } from 'convex/server';
import { Id } from '@/convex/_generated/dataModel';
import { useConfirm } from '@/hooks/use-confirm';
import { UserAvatar } from '@/components/user-avatar';

/**
 * Section component that renders the list of project members and allows adding/removing members.
 * Uses Convex queries and mutations.
 */
export function ProjectMembersSection({
  orgSlug,
  projectKey,
  canEdit = true,
  searchQuery,
}: {
  orgSlug: string;
  projectKey: string;
  canEdit?: boolean;
  searchQuery?: string;
}) {
  const [showAddMemberDialog, setShowAddMemberDialog] = useState(false);
  const [confirm, ConfirmDialog] = useConfirm();

  const project = useQuery(api.projects.queries.getByKey, {
    orgSlug,
    projectKey,
  });
  const projectId = project?._id;

  // Fetch members for this project
  const members =
    useQuery(
      api.projects.queries.listMembers,
      projectId ? { projectId } : 'skip',
    ) ?? [];

  // Fetch organization members for filtering
  const orgMembers =
    useQuery(api.organizations.queries.listMembers, {
      orgSlug,
    }) ?? [];

  const removeMemberMutation = useMutation(api.projects.mutations.removeMember);

  const handleRemoveMember = async (membershipId: Id<'projectMembers'>) => {
    const ok = await confirm({
      title: 'Remove member',
      description:
        'Remove this member from the project? They will lose access to project resources.',
      confirmLabel: 'Remove',
      variant: 'destructive',
    });
    if (!ok) return;
    void removeMemberMutation({ membershipId });
  };

  const filteredMembers = useMemo(() => {
    const q = searchQuery?.trim().toLowerCase();
    if (!q) return members ?? [];
    return (members ?? []).filter(m => {
      const name = m.user?.name?.toLowerCase() ?? '';
      const email = m.user?.email?.toLowerCase() ?? '';
      return name.includes(q) || email.includes(q);
    });
  }, [members, searchQuery]);

  if (members === undefined) {
    return (
      <div className='space-y-4'>
        <div className='mb-4 flex items-center justify-between'>
          <div className='flex items-center gap-2'>
            <Skeleton className='size-4 rounded' />
            <Skeleton className='h-5 w-24' />
          </div>
        </div>
        <div className='divide-y rounded-lg border'>
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className='flex items-center gap-3 px-3 py-2'>
              <Skeleton className='size-8 rounded-full' />
              <div className='min-w-0 flex-1 space-y-1'>
                <Skeleton className='h-4 w-28' />
                <Skeleton className='h-3 w-36' />
              </div>
              <Skeleton className='h-3 w-14' />
            </div>
          ))}
        </div>
      </div>
    );
  }

  const hasMembers = members.length > 0;

  return (
    <div className='space-y-4'>
      {hasMembers ? (
        <div className='rounded-lg border'>
          <MembersList
            members={filteredMembers}
            canEdit={canEdit}
            onRemoveMember={handleRemoveMember}
            removePending={false}
          />
          {canEdit && (
            <div className='border-t px-3 py-1.5'>
              <Button
                onClick={() => setShowAddMemberDialog(true)}
                className='h-6 gap-1 text-xs'
                variant='ghost'
                size='sm'
                disabled={
                  orgMembers.filter(
                    member =>
                      !members.some(
                        projectMember => projectMember.userId === member.userId,
                      ),
                  ).length === 0
                }
              >
                <Plus className='size-3' />
                Add member
              </Button>
            </div>
          )}
        </div>
      ) : (
        <div className='flex items-center justify-center py-12'>
          <div className='text-center'>
            <div className='mb-4 flex justify-center'>
              <Users className='text-muted-foreground/50 h-16 w-16' />
            </div>
            <h3 className='mb-2 text-lg font-semibold'>No members yet</h3>
            <p className='text-muted-foreground mb-6'>
              Add project members to get started.
            </p>
            {canEdit && (
              <Button
                onClick={() => setShowAddMemberDialog(true)}
                disabled={
                  orgMembers.filter(
                    member =>
                      !members.some(
                        projectMember => projectMember.userId === member.userId,
                      ),
                  ).length === 0
                }
                title={
                  orgMembers.filter(
                    member =>
                      !members.some(
                        projectMember => projectMember.userId === member.userId,
                      ),
                  ).length === 0
                    ? 'All organization members are already in this project'
                    : ''
                }
              >
                <Plus className='mr-2 size-3' />
                Add member
              </Button>
            )}
          </div>
        </div>
      )}

      {showAddMemberDialog && (
        <AddMemberDialog
          orgSlug={orgSlug}
          projectKey={projectKey}
          existingMemberIds={new Set(members.map(m => m.userId))}
          onClose={() => setShowAddMemberDialog(false)}
        />
      )}
      <ConfirmDialog />
    </div>
  );
}

// ------------------------------
// Add Member Dialog
// ------------------------------
function AddMemberDialog({
  orgSlug,
  projectKey,
  existingMemberIds,
  onClose,
}: {
  orgSlug: string;
  projectKey: string;
  existingMemberIds: Set<string>;
  onClose: () => void;
}) {
  const [addingUserId, setAddingUserId] = useState<string | null>(null);

  const orgMembers =
    useQuery(api.organizations.queries.listMembers, {
      orgSlug,
    }) ?? [];

  const project = useQuery(api.projects.queries.getByKey, {
    orgSlug,
    projectKey,
  });
  const projectId = project?._id;

  const addMemberMutation = useMutation(api.projects.mutations.addMember);

  const availableMembers = orgMembers.filter(
    m => !existingMemberIds.has(m.userId),
  );

  const handleAdd = async (userId: string) => {
    if (!projectId) return;
    setAddingUserId(userId);
    try {
      await addMemberMutation({
        projectId,
        userId: userId as Id<'users'>,
        role: 'member',
      });
      onClose();
    } finally {
      setAddingUserId(null);
    }
  };

  return (
    <ResponsiveDialog
      open
      onOpenChange={(isOpen: boolean) => !isOpen && onClose()}
    >
      <ResponsiveDialogContent
        showCloseButton={false}
        className='gap-0 p-0 sm:max-w-sm'
      >
        <ResponsiveDialogHeader className='sr-only'>
          <ResponsiveDialogTitle>Add project member</ResponsiveDialogTitle>
        </ResponsiveDialogHeader>
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

// ------------------------------
// Members List Component
// ------------------------------
type ProjectMember = FunctionReturnType<
  typeof api.projects.queries.listMembers
>[number];

function MembersList({
  members,
  onRemoveMember,
  removePending,
  canEdit,
}: {
  members: ProjectMember[];
  onRemoveMember?: (membershipId: Id<'projectMembers'>) => void;
  removePending?: boolean;
  canEdit: boolean;
}) {
  const user = useQuery(api.users.currentUser);
  const currentUserId = user?._id;

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
            key={member.userId}
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
              <div className='text-sm font-medium'>
                {member.user?.name || 'Unknown User'}
              </div>
              <div className='text-muted-foreground text-xs'>
                {member.user?.email || ''}
              </div>
            </div>

            {/* Role */}
            <div className='flex-shrink-0 text-xs capitalize'>
              {member.role || 'member'}
            </div>

            {/* Actions */}
            {(() => {
              const totalMembers = members.length;
              const leadCount = members.filter(m => m.role === 'lead').length;
              const isSelf = member.userId === currentUserId;

              let canShow = false;

              if (canEdit && onRemoveMember) {
                if (!isSelf) {
                  canShow = true; // managing others
                } else {
                  if (totalMembers > 1) {
                    if (member.role === 'lead') {
                      canShow = leadCount > 1;
                    } else {
                      canShow = true;
                    }
                  }
                }
              }

              if (!canShow) return null;

              return (
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
                        onClick={() => onRemoveMember?.(member._id)}
                      >
                        <Trash2 className='mr-2 h-4 w-4' /> Remove from project
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              );
            })()}
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}
