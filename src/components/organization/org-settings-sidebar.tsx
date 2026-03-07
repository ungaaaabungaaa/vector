'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  Building,
  Users,
  Settings2,
  Shield,
  type LucideIcon,
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface SettingsNavItem {
  label: string;
  href: string;
  icon: LucideIcon;
  description: string;
  requiresAdmin?: boolean;
  requiresOwner?: boolean;
}

interface OrgSettingsSidebarProps {
  orgSlug: string;
  userRole: string;
}

export function OrgSettingsSidebar({
  orgSlug,
  userRole,
}: OrgSettingsSidebarProps) {
  const pathname = usePathname();

  const isAdmin = userRole === 'admin' || userRole === 'owner';
  const isOwner = userRole === 'owner';

  const settingsItems: SettingsNavItem[] = [
    {
      label: 'General',
      href: `/${orgSlug}/settings`,
      icon: Building,
      description: 'Organization info and branding',
    },
    {
      label: 'Members',
      href: `/${orgSlug}/settings/members`,
      icon: Users,
      description: 'Manage team members and roles',
      requiresAdmin: true,
    },
    {
      label: 'Roles',
      href: `/${orgSlug}/settings/roles`,
      icon: Shield,
      description: 'Manage custom roles and permissions',
      requiresAdmin: true,
    },
    {
      label: 'States',
      href: `/${orgSlug}/settings/states`,
      icon: Settings2,
      description: 'Configure issue and project states',
      requiresAdmin: true,
    },
  ];

  // Filter items based on user permissions
  const visibleItems = settingsItems.filter(item => {
    if (item.requiresOwner && !isOwner) return false;
    if (item.requiresAdmin && !isAdmin) return false;
    return true;
  });

  return (
    <nav className='space-y-1 p-2 pt-0'>
      <div className='pb-2'>
        <h2 className='text-muted-foreground text-xs font-medium tracking-wider uppercase'>
          Organization Settings
        </h2>
      </div>

      {visibleItems.map(item => {
        const isActive =
          pathname === item.href ||
          (item.href !== `/${orgSlug}/settings` &&
            pathname.startsWith(item.href));

        return (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              'group flex items-center gap-2 rounded-md px-3 py-1.5 text-sm font-medium transition-colors',
              'hover:bg-foreground/10 hover:text-foreground',
              isActive
                ? 'bg-foreground/10 text-foreground'
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
