'use client';

import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { MoreHorizontal } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { AssignRoleDialog } from '@/components/organization/assign-role-dialog';
import { useMutation, useQuery } from 'convex/react';
import { api } from '@/convex/_generated/api';
import { toast } from 'sonner';
import { useState } from 'react';
import type { Id, Doc } from '@/convex/_generated/dataModel';

interface MembersSettingsPageClientProps {
  orgSlug: string;
}

export default function MembersSettingsPageClient({
  orgSlug,
}: MembersSettingsPageClientProps) {
  const members = useQuery(api.organizations.queries.listMembersWithRoles, {
    orgSlug,
  });
  const removeMember = useMutation(api.organizations.mutations.removeMember);
  const [selectedMember, setSelectedMember] = useState<Doc<'members'> | null>(
    null,
  );

  const onRemoveMember = async (userId: Id<'users'>) => {
    try {
      await removeMember({ orgSlug, userId });
      toast.success('Member removed from organization');
    } catch {
      toast.error('Failed to remove member');
    }
  };

  if (!members) {
    return <div>Loading...</div>;
  }

  return (
    <div className='space-y-4'>
      <div className='flex items-center justify-between'>
        <div>
          <h2 className='text-3xl font-bold'>Members</h2>
          <p className='text-muted-foreground'>
            Manage your organization members and their roles.
          </p>
        </div>
      </div>

      <div className='rounded-md border'>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Member</TableHead>
              <TableHead>Roles</TableHead>
              <TableHead className='w-[100px]'>Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {members.map(member => (
              <TableRow key={member.userId}>
                <TableCell>
                  <div className='flex items-center space-x-2'>
                    <Avatar className='h-8 w-8'>
                      <AvatarImage src={member.image || ''} />
                      <AvatarFallback>
                        {member.name?.charAt(0) || 'U'}
                      </AvatarFallback>
                    </Avatar>
                    <div>
                      <div className='font-medium'>{member.name}</div>
                      <div className='text-muted-foreground text-sm'>
                        {member.email}
                      </div>
                    </div>
                  </div>
                </TableCell>
                <TableCell>
                  <div className='flex flex-wrap gap-1'>
                    {/* Built-in role */}
                    <Badge variant='secondary'>{member.role}</Badge>
                    {/* Custom roles */}
                    {member.customRoles?.map(role => (
                      <Badge key={role.name} variant='outline'>
                        {role.name}
                      </Badge>
                    ))}
                  </div>
                </TableCell>
                <TableCell>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant='ghost' className='h-8 w-8 p-0'>
                        <MoreHorizontal className='h-4 w-4' />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align='end'>
                      <DropdownMenuItem
                        onClick={() => setSelectedMember(member)}
                      >
                        Assign Role
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem
                        onClick={() => onRemoveMember(member.userId)}
                        className='text-red-600'
                      >
                        Remove Member
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>

                  <Dialog
                    open={selectedMember?.userId === member.userId}
                    onOpenChange={open => !open && setSelectedMember(null)}
                  >
                    <DialogContent>
                      <DialogHeader>
                        <DialogTitle>Assign Role</DialogTitle>
                      </DialogHeader>
                      <AssignRoleDialog
                        orgSlug={orgSlug}
                        roleId={member.customRoles?.[0]?._id || null}
                        onClose={() => setSelectedMember(null)}
                        onSuccess={() => {
                          toast.success('Role assigned');
                        }}
                      />
                    </DialogContent>
                  </Dialog>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
