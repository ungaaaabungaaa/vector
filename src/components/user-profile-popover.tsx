'use client';

import type { ReactNode } from 'react';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { UserAvatar } from '@/components/user-avatar';
import { Mail } from 'lucide-react';

interface UserProfilePopoverProps {
  name?: string | null;
  email?: string | null;
  image?: string | null;
  userId?: string | null;
  children: ReactNode;
  side?: 'top' | 'bottom' | 'left' | 'right';
  align?: 'start' | 'center' | 'end';
}

export function UserProfilePopover({
  name,
  email,
  image,
  userId,
  children,
  side = 'bottom',
  align = 'center',
}: UserProfilePopoverProps) {
  const displayName = name?.trim() || 'Unknown user';

  return (
    <Popover>
      <PopoverTrigger asChild>{children}</PopoverTrigger>
      <PopoverContent
        side={side}
        align={align}
        sideOffset={6}
        className='w-56 p-3'
      >
        <div className='flex items-center gap-2.5'>
          <UserAvatar
            name={name}
            email={email}
            image={image}
            userId={userId}
            size='lg'
            className='size-10 flex-shrink-0'
          />
          <div className='min-w-0 flex-1'>
            <p className='truncate text-sm font-medium'>{displayName}</p>
            {email && (
              <p className='text-muted-foreground flex items-center gap-1 truncate text-xs'>
                <Mail className='size-3 flex-shrink-0' />
                {email}
              </p>
            )}
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
