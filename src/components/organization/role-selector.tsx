'use client';

import { useState } from 'react';
import { OrgRoleBadge } from '@/components/organization/role-badge';
import { useMutation } from 'convex/react';
import { api } from '@/lib/convex';
import { cn } from '@/lib/utils';
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
import { Check } from 'lucide-react';
import { useRouter } from 'next/navigation';

import type { Id } from '../../../convex/_generated/dataModel';

const ROLE_OPTIONS = [
  { value: 'member', label: 'Member' },
  { value: 'admin', label: 'Admin' },
] as const;

type RoleValue = (typeof ROLE_OPTIONS)[number]['value'];

interface RoleSelectorProps {
  orgSlug: string;
  userId: string;
  currentRole: RoleValue;
  disabled?: boolean;
  className?: string;
}

export function RoleSelector({
  orgSlug,
  userId,
  currentRole,
  disabled = false,
  className,
}: RoleSelectorProps) {
  const [open, setOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const router = useRouter();
  const mutation = useMutation(api.organizations.mutations.updateMemberRole);

  const handleSelect = async (role: RoleValue) => {
    if (role === currentRole) return;

    try {
      setIsLoading(true);
      await mutation({
        orgSlug,
        userId: userId as Id<'users'>,
        role,
      });
      router.refresh();
      setOpen(false);
    } catch (error) {
      console.error('Failed to update role:', error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          disabled={disabled || isLoading}
          className={cn('cursor-pointer', className)}
        >
          <OrgRoleBadge role={currentRole} />
        </button>
      </PopoverTrigger>
      <PopoverContent className='w-48 p-0' align='start'>
        <Command>
          <CommandInput placeholder='Search role...' className='h-9' />
          <CommandList>
            <CommandEmpty>No roles found.</CommandEmpty>
            <CommandGroup>
              {ROLE_OPTIONS.map(opt => (
                <CommandItem
                  key={opt.value}
                  value={opt.label}
                  onSelect={() => handleSelect(opt.value)}
                >
                  <Check
                    className={cn(
                      'mr-2 h-4 w-4',
                      currentRole === opt.value ? 'opacity-100' : 'opacity-0',
                    )}
                  />
                  {opt.label}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
