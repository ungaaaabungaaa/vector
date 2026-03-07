import { useState } from 'react';
import { useMutation, useQuery } from 'convex/react';
import { api } from '@/convex/_generated/api';
import { Button } from '@/components/ui/button';
import { Plus, Check } from 'lucide-react';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import { cn } from '@/lib/utils';
import { Id, Doc } from '@/convex/_generated/dataModel';

type CustomRole = Doc<'orgRoles'>;

interface CustomRolesManagerProps {
  orgSlug: string;
  userId: Id<'users'>;
  assignedRoles: CustomRole[];
  disabled?: boolean;
  className?: string;
  onRoleChange?: () => void;
}

export function CustomRolesManager({
  orgSlug,
  userId,
  assignedRoles,
  disabled = false,
  className,
  onRoleChange,
}: CustomRolesManagerProps) {
  const [open, setOpen] = useState(false);
  const [processingRoleId, setProcessingRoleId] =
    useState<Id<'orgRoles'> | null>(null);

  // Fetch all custom (non-system) roles for this organization
  const allRoles = useQuery(api.roles.index.list, { orgSlug });

  const assignMutation = useMutation(api.roles.index.assign);
  const removeAssignmentMutation = useMutation(
    api.roles.index.removeAssignment,
  );

  const handleToggleRole = async (
    roleId: Id<'orgRoles'>,
    isAssigned: boolean,
  ) => {
    setProcessingRoleId(roleId);
    try {
      if (isAssigned) {
        await removeAssignmentMutation({ orgSlug, roleId, userId });
      } else {
        await assignMutation({ orgSlug, roleId, userId });
      }
      onRoleChange?.();
    } finally {
      setProcessingRoleId(null);
    }
  };

  const customRoles = allRoles?.filter(r => !r.system) ?? [];
  const assignedRoleIds = new Set(assignedRoles.map(r => r._id));

  const isLoading = !!processingRoleId;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant='ghost'
          size='sm'
          className={cn(
            'h-6 px-2 text-xs font-medium',
            assignedRoles.length > 0
              ? 'bg-blue-50 text-blue-600'
              : 'text-muted-foreground',
            className,
          )}
          disabled={disabled || isLoading}
        >
          <Plus className='mr-1 size-3' />
          {assignedRoles.length > 0
            ? `${assignedRoles.length} role${assignedRoles.length === 1 ? '' : 's'}`
            : 'Roles'}
        </Button>
      </PopoverTrigger>
      <PopoverContent className='w-80 p-0' align='end'>
        <Command>
          <CommandInput placeholder='Search roles…' className='h-9' />
          <CommandList>
            <CommandEmpty>No custom roles found.</CommandEmpty>

            <CommandGroup>
              {customRoles.map(role => {
                const isAssigned = assignedRoleIds.has(role._id);
                const isProcessing = processingRoleId === role._id;

                return (
                  <CommandItem
                    key={role._id}
                    value={role.name}
                    onSelect={() =>
                      !disabled && handleToggleRole(role._id, isAssigned)
                    }
                    disabled={disabled || isProcessing}
                  >
                    <div className='flex w-full items-center gap-3'>
                      <div
                        className={cn(
                          'flex h-4 w-4 items-center justify-center rounded border',
                          isAssigned
                            ? 'border-blue-600 bg-blue-600'
                            : 'border-input',
                        )}
                      >
                        {isAssigned && <Check className='h-3 w-3 text-white' />}
                      </div>
                      <div className='flex-1'>
                        <div className='font-medium'>{role.name}</div>
                        {role.description && (
                          <div className='text-muted-foreground text-xs'>
                            {role.description}
                          </div>
                        )}
                      </div>
                    </div>
                  </CommandItem>
                );
              })}
            </CommandGroup>

            {/* No Custom Roles Message */}
            {customRoles.length === 0 && (
              <div className='text-muted-foreground p-4 text-center text-sm'>
                No custom roles have been created yet.
              </div>
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
