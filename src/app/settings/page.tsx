'use client';

import { useQuery } from '@/lib/convex';
import { api } from '@/lib/convex';
import { User, Mail, Settings } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import Link from 'next/link';

export default function SettingsPage() {
  const user = useQuery(api.users.currentUser);

  if (user === undefined) {
    return (
      <div className='bg-background h-full'>
        <div className='border-b'>
          <div className='flex items-center p-1 pl-8 lg:pl-1'>
            <span className='flex items-center gap-1.5 px-3 text-xs font-medium'>
              <Settings className='size-3.5' />
              Settings
            </span>
          </div>
        </div>
        <div className='space-y-2 p-3'>
          {Array.from({ length: 2 }).map((_, i) => (
            <div
              key={i}
              className='flex items-center gap-3 rounded-md border px-3 py-2.5'
            >
              <Skeleton className='size-4 rounded' />
              <div className='space-y-1'>
                <Skeleton className='h-4 w-24' />
                <Skeleton className='h-3 w-48' />
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (user === null) {
    return null;
  }

  return (
    <div className='bg-background h-full'>
      <div className='border-b'>
        <div className='flex items-center p-1 pl-8 lg:pl-1'>
          <span className='flex items-center gap-1.5 px-3 text-xs font-medium'>
            <Settings className='size-3.5' />
            Settings
          </span>
        </div>
      </div>

      <div className='space-y-2 p-3'>
        <Link
          href='/settings/profile'
          className='hover:bg-muted/50 flex items-center gap-3 rounded-md border px-3 py-2.5 transition-colors'
        >
          <User className='text-muted-foreground size-4' />
          <div>
            <p className='text-sm font-medium'>Profile</p>
            <p className='text-muted-foreground text-xs'>
              Update your personal information
            </p>
          </div>
        </Link>

        <Link
          href='/settings/invites'
          className='hover:bg-muted/50 flex items-center gap-3 rounded-md border px-3 py-2.5 transition-colors'
        >
          <Mail className='text-muted-foreground size-4' />
          <div>
            <p className='text-sm font-medium'>Invitations</p>
            <p className='text-muted-foreground text-xs'>
              Manage organization invitations
            </p>
          </div>
        </Link>
      </div>
    </div>
  );
}
