import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { X } from 'lucide-react';
import { useMutation } from 'convex/react';
import { api } from '@/lib/convex';
import { useState } from 'react';
import type { Id, Doc } from '@/convex/_generated/dataModel';

interface CustomRolesDisplayProps {
  orgSlug: string;
  userId: Id<'users'>;
  roles: Doc<'orgRoles'>[];
  isAdmin: boolean;
  onRoleRemoved?: () => void;
}

export function CustomRolesDisplay({
  orgSlug,
  userId,
  roles,
  isAdmin,
  onRoleRemoved,
}: CustomRolesDisplayProps) {
  const [removingRoleId, setRemovingRoleId] = useState<Id<'orgRoles'> | null>(
    null,
  );

  const removeRoleMutation = useMutation(api.roles.index.removeAssignment);

  const handleRemoveRole = async (roleId: Id<'orgRoles'>) => {
    setRemovingRoleId(roleId);
    try {
      await removeRoleMutation({ orgSlug, roleId, userId });
      onRoleRemoved?.();
    } catch (error) {
      console.error('Failed to remove role:', error);
    } finally {
      setRemovingRoleId(null);
    }
  };

  if (roles.length === 0) {
    return (
      <span className='text-muted-foreground text-xs italic'>
        No custom roles
      </span>
    );
  }

  return (
    <div className='flex flex-wrap gap-1'>
      {roles.map(role => (
        <Badge
          key={role._id}
          variant='secondary'
          className='flex items-center gap-1 text-xs'
          title={role.description || undefined}
        >
          {role.name}
          {isAdmin && (
            <Button
              variant='ghost'
              size='sm'
              className='hover:bg-destructive hover:text-destructive-foreground ml-1 h-3 w-3 p-0'
              onClick={() => handleRemoveRole(role._id)}
              disabled={removingRoleId === role._id}
              aria-label={`Remove ${role.name} role`}
            >
              <X className='h-2 w-2' />
            </Button>
          )}
        </Badge>
      ))}
    </div>
  );
}
