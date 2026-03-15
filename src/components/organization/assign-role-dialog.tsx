'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  ResponsiveDialog,
  ResponsiveDialogContent,
  ResponsiveDialogHeader,
  ResponsiveDialogTitle,
} from '@/components/ui/responsive-dialog';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { UserAvatar } from '@/components/user-avatar';
import { useMutation, useQuery } from 'convex/react';
import { api } from '@/lib/convex';
import type { Id } from '@/convex/_generated/dataModel';
import type { OrganizationRoleId } from '@/lib/organization-role-types';

interface AssignRoleDialogProps {
  orgSlug: string;
  roleId: OrganizationRoleId | null;
  onClose: () => void;
  onSuccess: () => void;
}

export function AssignRoleDialog({
  orgSlug,
  roleId,
  onClose,
  onSuccess,
}: AssignRoleDialogProps) {
  const [selectedUserId, setSelectedUserId] = useState<Id<'users'> | null>(
    null,
  );

  const members =
    useQuery(api.organizations.queries.listMembers, { orgSlug }) || [];
  const assignMutation = useMutation(api.roles.index.assign);

  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedUserId) return;

    setIsSubmitting(true);
    try {
      await assignMutation({
        orgSlug,
        roleId: roleId as OrganizationRoleId,
        userId: selectedUserId,
      });
      onSuccess();
      onClose();
    } catch (error) {
      console.error('Failed to assign role:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <ResponsiveDialog
      open
      onOpenChange={(isOpen: boolean) => !isOpen && onClose()}
    >
      <ResponsiveDialogContent showCloseButton={false} className='max-w-lg'>
        <ResponsiveDialogHeader>
          <ResponsiveDialogTitle>Assign Role to Member</ResponsiveDialogTitle>
        </ResponsiveDialogHeader>

        <form onSubmit={handleSubmit} className='space-y-6'>
          <div className='space-y-4'>
            <div className='space-y-2'>
              <Label>Select Member</Label>
              <p className='text-muted-foreground text-sm'>
                Choose a member to assign this role to
              </p>
            </div>

            <div className='max-h-64 space-y-2 overflow-y-auto rounded-md border p-4'>
              {members.map(member => (
                <div
                  key={member.userId}
                  className={`hover:bg-muted flex cursor-pointer items-center justify-between rounded-md p-3 transition-colors ${
                    selectedUserId === member.userId ? 'bg-muted' : ''
                  }`}
                  onClick={() => setSelectedUserId(member.userId)}
                >
                  <div className='flex items-center gap-3'>
                    <UserAvatar
                      name={member.user?.name}
                      email={member.user?.email}
                      image={member.user?.image}
                      userId={member.userId}
                    />
                    <div>
                      <div className='text-sm font-medium'>
                        {member.user?.name}
                      </div>
                      <div className='text-muted-foreground text-xs'>
                        {member.user?.email}
                      </div>
                    </div>
                  </div>
                  <div className='flex items-center gap-2'>
                    <Badge variant='outline' className='text-xs'>
                      {member.role}
                    </Badge>
                    {selectedUserId === member.userId && (
                      <div className='bg-primary size-4 rounded-full'></div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Actions */}
          <div className='flex justify-between'>
            <Button type='button' variant='ghost' onClick={onClose}>
              Cancel
            </Button>
            <Button type='submit' disabled={!selectedUserId || isSubmitting}>
              {isSubmitting ? 'Assigning...' : 'Assign Role'}
            </Button>
          </div>
        </form>
      </ResponsiveDialogContent>
    </ResponsiveDialog>
  );
}
