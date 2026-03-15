'use client';

import { useQuery, useMutation } from 'convex/react';
import { api } from '@/lib/convex';
import { useMemo } from 'react';
import { type ColumnDef } from '@tanstack/react-table';
import { Button } from '@/components/ui/button';
import { UserAvatar } from '@/components/user-avatar';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Plus,
  Mail,
  Trash2,
  MoreHorizontal,
  Send,
  ArrowUpDown,
  Clock,
} from 'lucide-react';
import { OrgRoleBadge } from '@/components/organization/role-badge';
import { RoleSelector } from '@/components/organization/role-selector';
import { InviteDialog } from '@/components/organization/invite-dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
import { formatDateHuman } from '@/lib/date';
import { useConfirm } from '@/hooks/use-confirm';
import { CustomRolesManager } from '@/components/organization/custom-roles-manager';
import { MembersDataTable } from '@/components/organization/members-data-table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { useState } from 'react';
import { useIsMobile } from '@/hooks/use-mobile';
import type { FunctionReturnType } from 'convex/server';

type MemberRow = FunctionReturnType<
  typeof api.organizations.queries.listMembersWithRoles
>[number];

type InviteRow = FunctionReturnType<
  typeof api.organizations.queries.listInvites
>[number];

function useMemberColumns(
  orgSlug: string,
  isAdmin: boolean,
  currentUserId: string,
  hasCustomRoles: boolean,
  isMobile: boolean,
): ColumnDef<MemberRow>[] {
  return useMemo(
    () => [
      {
        id: 'member',
        accessorFn: row => `${row.name ?? ''} ${row.email ?? ''}`,
        header: ({ column }) => (
          <button
            className='flex items-center gap-1'
            onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
          >
            Member
            <ArrowUpDown className='size-3' />
          </button>
        ),
        cell: ({ row }) => {
          const member = row.original;
          return (
            <div className='flex items-center gap-2'>
              <UserAvatar
                name={member.name}
                email={member.email}
                image={member.image}
                userId={member.userId}
                size='sm'
                className='size-6 shrink-0'
              />
              <div className='min-w-0'>
                <div className='flex items-center gap-1.5'>
                  <span className='truncate text-sm font-medium'>
                    {member.name}
                  </span>
                  {member.userId === currentUserId && (
                    <Badge
                      variant='secondary'
                      className='shrink-0 px-1 py-0 text-[10px]'
                    >
                      you
                    </Badge>
                  )}
                </div>
                <div className='text-muted-foreground flex items-center gap-1 text-xs'>
                  <Mail className='size-3 flex-shrink-0' />
                  <span className='truncate'>{member.email}</span>
                </div>
              </div>
            </div>
          );
        },
      },
      {
        id: 'role',
        accessorFn: row => row.role,
        header: 'Role',
        ...(!isMobile && { size: 160 }),
        cell: ({ row }) => {
          const member = row.original;
          return (
            <div className='flex flex-wrap items-center gap-1'>
              {isAdmin ? (
                <RoleSelector
                  orgSlug={orgSlug}
                  userId={member.userId}
                  currentRole={member.role as 'member' | 'admin'}
                />
              ) : (
                <OrgRoleBadge role={member.role} />
              )}
              {member.customRoles?.map(role => (
                <Badge key={role._id} variant='outline' className='text-xs'>
                  {role.name}
                </Badge>
              ))}
              {hasCustomRoles && isAdmin && (
                <CustomRolesManager
                  orgSlug={orgSlug}
                  userId={member.userId}
                  assignedRoles={member.customRoles}
                />
              )}
            </div>
          );
        },
      },
      ...(!isMobile
        ? [
            {
              id: 'joined',
              accessorFn: (row: MemberRow) => row._creationTime,
              size: 100,
              header: ({
                column,
              }: {
                column: {
                  toggleSorting: (desc: boolean) => void;
                  getIsSorted: () => false | 'asc' | 'desc';
                };
              }) => (
                <button
                  className='flex items-center gap-1'
                  onClick={() =>
                    column.toggleSorting(column.getIsSorted() === 'asc')
                  }
                >
                  Joined
                  <ArrowUpDown className='size-3' />
                </button>
              ),
              cell: ({ row }: { row: { original: MemberRow } }) => (
                <span className='text-muted-foreground text-xs'>
                  {formatDateHuman(new Date(row.original._creationTime))}
                </span>
              ),
            } satisfies ColumnDef<MemberRow>,
          ]
        : []),
      ...(isAdmin
        ? [
            {
              id: 'actions',
              size: 40,
              header: () => <span className='sr-only'>Actions</span>,
              cell: ({ row }: { row: { original: MemberRow } }) => {
                const member = row.original;
                if (member.userId === currentUserId) return null;
                return <MemberActions orgSlug={orgSlug} member={member} />;
              },
            } satisfies ColumnDef<MemberRow>,
          ]
        : []),
    ],
    [orgSlug, isAdmin, currentUserId, hasCustomRoles, isMobile],
  );
}

function MemberActions({
  orgSlug,
  member,
}: {
  orgSlug: string;
  member: MemberRow;
}) {
  const removeMemberMutation = useMutation(
    api.organizations.mutations.removeMember,
  );
  const [confirm, ConfirmDialog] = useConfirm();

  return (
    <>
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
            onClick={async () => {
              const ok = await confirm({
                title: 'Remove member',
                description: `Remove ${member.name || member.email} from this organization? They will lose access to all resources.`,
                confirmLabel: 'Remove',
                variant: 'destructive',
              });
              if (!ok) return;
              void removeMemberMutation({
                orgSlug,
                userId: member.userId,
              });
            }}
          >
            <Trash2 className='size-4' />
            Remove Member
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <ConfirmDialog />
    </>
  );
}

function useInviteColumns(
  orgSlug: string,
  isMobile: boolean,
): ColumnDef<InviteRow>[] {
  return useMemo(
    () => [
      {
        id: 'invite',
        accessorFn: row => row.email,
        header: 'Invitee',
        cell: ({ row }) => {
          const invite = row.original;
          return (
            <div className='flex items-center gap-2'>
              <UserAvatar
                email={invite.email}
                size='sm'
                className='size-6 shrink-0 opacity-60'
              />
              <div className='min-w-0'>
                <span className='truncate text-sm font-medium'>
                  {invite.email}
                </span>
                <div className='text-muted-foreground flex items-center gap-1 text-xs'>
                  <Clock className='size-3 flex-shrink-0' />
                  Invitation pending
                </div>
              </div>
            </div>
          );
        },
      },
      {
        id: 'role',
        accessorFn: row => row.role,
        header: 'Role',
        cell: ({ row }) => (
          <OrgRoleBadge role={row.original.role || 'member'} />
        ),
      },
      ...(!isMobile
        ? [
            {
              id: 'sent',
              accessorFn: (row: InviteRow) => row._creationTime,
              header: 'Sent',
              cell: ({ row }: { row: { original: InviteRow } }) => (
                <span className='text-muted-foreground text-xs'>
                  {formatDateHuman(new Date(row.original._creationTime))}
                </span>
              ),
            } satisfies ColumnDef<InviteRow>,
          ]
        : []),
      {
        id: 'actions',
        header: () => <span className='sr-only'>Actions</span>,
        cell: ({ row }) => (
          <InviteActions orgSlug={orgSlug} invite={row.original} />
        ),
      },
    ],
    [orgSlug, isMobile],
  );
}

function InviteActions({
  orgSlug: _orgSlug,
  invite,
}: {
  orgSlug: string;
  invite: InviteRow;
}) {
  const revokeInviteMutation = useMutation(
    api.organizations.mutations.revokeInvite,
  );
  const resendInviteMutation = useMutation(
    api.organizations.mutations.resendInvite,
  );
  const [confirm, ConfirmDialog] = useConfirm();

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant='ghost'
            size='sm'
            className='h-6 w-6 p-0'
            aria-label='Open invite actions'
          >
            <MoreHorizontal className='size-4' />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align='end'>
          <DropdownMenuItem
            onClick={() => {
              void resendInviteMutation({
                token: invite._id,
              });
            }}
          >
            <Send className='size-4' />
            Resend Invitation
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            variant='destructive'
            onClick={async () => {
              const ok = await confirm({
                title: 'Revoke invitation',
                description: `Revoke the pending invitation for ${invite.email}?`,
                confirmLabel: 'Revoke',
                variant: 'destructive',
              });
              if (!ok) return;
              void revokeInviteMutation({
                inviteId: invite._id,
              });
            }}
          >
            <Trash2 className='size-4' />
            Revoke Invitation
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <ConfirmDialog />
    </>
  );
}

export function MembersList({ orgSlug }: { orgSlug: string }) {
  const members = useQuery(api.organizations.queries.listMembersWithRoles, {
    orgSlug,
  });
  const invites = useQuery(api.organizations.queries.listInvites, { orgSlug });
  const currentUser = useQuery(api.users.getCurrentUser);
  const allRoles = useQuery(api.roles.index.list, { orgSlug });
  const [showInvite, setShowInvite] = useState(false);
  const isMobile = useIsMobile();

  const { isAdmin, currentUserId } = useMemo(() => {
    if (!currentUser || !members) {
      return { isAdmin: false, currentUserId: '' };
    }
    const currentMember = members.find(m => m.userId === currentUser._id);
    return {
      isAdmin:
        currentMember?.role === 'admin' || currentMember?.role === 'owner',
      currentUserId: currentUser._id,
    };
  }, [currentUser, members]);

  const hasCustomRoles = (allRoles?.filter(r => !r.system)?.length ?? 0) > 0;
  const memberColumns = useMemberColumns(
    orgSlug,
    isAdmin,
    currentUserId,
    hasCustomRoles,
    isMobile,
  );
  const inviteColumns = useInviteColumns(orgSlug, isMobile);

  if (members === undefined || currentUser === undefined) {
    return (
      <div className='flex flex-col gap-3'>
        <div className='flex items-center justify-between'>
          <Skeleton className='h-8 w-48' />
          <Skeleton className='h-8 w-20 rounded-md' />
        </div>
        <Skeleton className='h-8 w-full' />
        <div className='rounded-md border'>
          <div className='border-b px-3 py-2'>
            <div className='flex gap-4'>
              <Skeleton className='h-4 flex-[2]' />
              <Skeleton className='h-4 flex-1' />
              <Skeleton className='h-4 flex-1' />
              <Skeleton className='h-4 w-16' />
            </div>
          </div>
          {Array.from({ length: 4 }).map((_, i) => (
            <div
              key={i}
              className='flex items-center gap-3 border-b px-3 py-2 last:border-0'
            >
              <Skeleton className='size-6 rounded-full' />
              <div className='flex-1'>
                <Skeleton className='mb-1 h-4 w-28' />
                <Skeleton className='h-3 w-40' />
              </div>
              <Skeleton className='h-5 w-14 rounded-full' />
              <Skeleton className='h-4 w-16' />
              <Skeleton className='size-6 rounded-md' />
            </div>
          ))}
        </div>
      </div>
    );
  }

  const hasMembers = members && members.length > 0;
  const hasInvites = invites && invites.length > 0;
  const pendingCount = invites?.length ?? 0;

  if (!hasMembers && !hasInvites) {
    return (
      <div className='flex items-center justify-center py-12'>
        <div className='text-center'>
          <h3 className='mb-2 text-lg font-semibold'>No members yet</h3>
          <p className='text-muted-foreground mb-6 text-sm'>
            Get started by inviting your first team member.
          </p>
          {isAdmin && (
            <Button size='sm' onClick={() => setShowInvite(true)}>
              <Plus className='mr-1 size-3' />
              Invite Member
            </Button>
          )}
          {showInvite && (
            <InviteDialog
              orgSlug={orgSlug}
              onClose={() => setShowInvite(false)}
            />
          )}
        </div>
      </div>
    );
  }

  return (
    <div className='flex flex-col gap-4'>
      <div className='flex flex-wrap items-center justify-between gap-2'>
        <div className='min-w-0'>
          <h3 className='text-sm font-semibold'>People</h3>
          <p className='text-muted-foreground text-xs'>
            Manage members and invitations for your organization.
          </p>
        </div>
        {isAdmin && (
          <Button
            variant='outline'
            size='sm'
            className='shrink-0'
            onClick={() => setShowInvite(true)}
          >
            <Plus className='mr-1 size-3' />
            Invite
          </Button>
        )}
      </div>

      {isAdmin && hasInvites ? (
        <Tabs defaultValue='members'>
          <TabsList className='h-8'>
            <TabsTrigger value='members' className='text-xs'>
              Members
              <Badge
                variant='secondary'
                className='ml-1.5 px-1 py-0 text-[10px]'
              >
                {members.length}
              </Badge>
            </TabsTrigger>
            <TabsTrigger value='invites' className='text-xs'>
              Pending Invites
              <Badge
                variant='secondary'
                className='ml-1.5 px-1 py-0 text-[10px]'
              >
                {pendingCount}
              </Badge>
            </TabsTrigger>
          </TabsList>

          <TabsContent value='members' className='mt-3'>
            <MembersDataTable
              columns={memberColumns}
              data={members}
              searchPlaceholder='Filter members by name or email...'
            />
          </TabsContent>

          <TabsContent value='invites' className='mt-3'>
            <MembersDataTable
              columns={inviteColumns}
              data={invites ?? []}
              searchPlaceholder='Filter invitations by email...'
            />
          </TabsContent>
        </Tabs>
      ) : (
        <MembersDataTable
          columns={memberColumns}
          data={members}
          searchPlaceholder='Filter members by name or email...'
        />
      )}

      {showInvite && (
        <InviteDialog orgSlug={orgSlug} onClose={() => setShowInvite(false)} />
      )}
    </div>
  );
}
