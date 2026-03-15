'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Shield, Palette } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useQuery } from '@/lib/convex';
import { api } from '@/lib/convex';

export function PlatformAdminSidebar() {
  const pathname = usePathname();
  const organizationsQuery = useQuery(api.users.getOrganizations);
  const firstOrganization = organizationsQuery.data?.[0];

  return (
    <nav className='space-y-1 p-2 pt-0'>
      {firstOrganization && (
        <Link
          href={`/${firstOrganization.slug}/issues`}
          className='text-muted-foreground hover:text-foreground hover:bg-foreground/5 mb-2 flex h-8 items-center gap-2 rounded-md px-2 text-sm font-medium transition-colors'
        >
          <span className='truncate'>{firstOrganization.name}</span>
        </Link>
      )}

      <div className='pb-2'>
        <h2 className='text-muted-foreground text-xs font-medium tracking-wider uppercase'>
          Platform Admin
        </h2>
      </div>

      <Link
        href='/admin'
        className={cn(
          'group flex items-center gap-2 rounded-md px-3 py-1.5 text-sm font-medium transition-colors',
          'hover:bg-foreground/5 hover:text-foreground',
          pathname === '/admin'
            ? 'bg-foreground/5 text-foreground'
            : 'text-muted-foreground',
        )}
      >
        <Shield className='size-4 shrink-0' />
        <span className='truncate'>Signup Access</span>
      </Link>

      <Link
        href='/admin/branding'
        className={cn(
          'group flex items-center gap-2 rounded-md px-3 py-1.5 text-sm font-medium transition-colors',
          'hover:bg-foreground/5 hover:text-foreground',
          pathname === '/admin/branding'
            ? 'bg-foreground/5 text-foreground'
            : 'text-muted-foreground',
        )}
      >
        <Palette className='size-4 shrink-0' />
        <span className='truncate'>Branding</span>
      </Link>
    </nav>
  );
}
