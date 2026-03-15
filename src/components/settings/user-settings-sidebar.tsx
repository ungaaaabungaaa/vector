'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { User, Mail, Bell, Settings, type LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useQuery } from '@/lib/convex';
import { api } from '@/lib/convex';

interface SettingsNavItem {
  label: string;
  href: string;
  icon: LucideIcon;
  description: string;
}

export function UserSettingsSidebar() {
  const pathname = usePathname();
  const userOrgsQuery = useQuery(api.users.getOrganizations);

  const settingsItems: SettingsNavItem[] = [
    {
      label: 'General',
      href: '/settings',
      icon: Settings,
      description: 'Account settings and preferences',
    },
    {
      label: 'Profile',
      href: '/settings/profile',
      icon: User,
      description: 'Personal information and preferences',
    },
    {
      label: 'Invites',
      href: '/settings/invites',
      icon: Mail,
      description: 'Pending organization invitations',
    },
    {
      label: 'Notifications',
      href: '/settings/notifications',
      icon: Bell,
      description: 'Notification preferences and push devices',
    },
  ];

  const firstOrg = userOrgsQuery.data?.[0];

  return (
    <nav className='space-y-1 p-2 pt-0'>
      {firstOrg && (
        <Link
          href={`/${firstOrg.slug}/issues`}
          className='text-muted-foreground hover:text-foreground hover:bg-foreground/5 mb-2 flex h-8 items-center gap-2 rounded-md px-2 text-sm font-medium transition-colors'
        >
          <span className='truncate'>{firstOrg.name}</span>
        </Link>
      )}

      <div className='pb-2'>
        <h2 className='text-muted-foreground text-xs font-medium tracking-wider uppercase'>
          User Settings
        </h2>
      </div>

      {settingsItems.map(item => {
        const isActive =
          pathname === item.href ||
          (item.href !== '/settings' && pathname.startsWith(item.href));

        return (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              'group flex items-center gap-2 rounded-md px-3 py-1.5 text-sm font-medium transition-colors',
              'hover:bg-foreground/5 hover:text-foreground',
              isActive
                ? 'bg-foreground/5 text-foreground'
                : 'text-muted-foreground',
            )}
          >
            <item.icon className='size-4 shrink-0' />
            <span className='truncate'>{item.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
