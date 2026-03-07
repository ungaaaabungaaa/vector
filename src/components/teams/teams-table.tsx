'use client';

import Link from 'next/link';
import { Users, MoreHorizontal, Trash2 } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from '@/components/ui/dropdown-menu';
import { formatDateHuman } from '@/lib/date';
import { useMutation } from 'convex/react';
import { api } from '@/lib/convex';
import { getDynamicIcon } from '@/lib/dynamic-icons';
import { IconPicker } from '@/components/ui/icon-picker';
import { Id } from '@/convex/_generated/dataModel';

// Permission system
import { PermissionAware } from '@/components/ui/permission-aware';
import { PERMISSIONS } from '@/convex/_shared/permissions';

interface Team {
  id: string;
  name: string;
  description?: string | null;
  key: string;
  icon?: string | null;
  color?: string | null;
  createdAt?: Date | string;
  lead?: {
    _id: string;
    name?: string | null;
    email?: string | null;
  } | null;
  memberCount?: number;
}

interface TeamsTableProps {
  orgSlug: string;
  teams: Team[];
  onDelete?: (teamId: string) => void;
  deletePending?: boolean;
}

export function TeamsTable({
  orgSlug,
  teams,
  onDelete,
  deletePending = false,
}: TeamsTableProps) {
  const updateIconMutation = useMutation(api.teams.mutations.update);

  const handleIconChange = (teamId: string, iconName: string | null) => {
    void updateIconMutation({
      teamId: teamId as Id<'teams'>,
      data: { icon: iconName || undefined },
    });
  };

  const getInitials = (
    name: string | null | undefined,
    email: string | null | undefined,
  ): string => {
    const displayName = name || email;
    if (!displayName) return '?';
    return displayName
      .split(' ')
      .map(part => part.charAt(0))
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  if (teams.length === 0) {
    return (
      <div className='text-muted-foreground flex items-center justify-center py-12 text-sm'>
        No teams found
      </div>
    );
  }

  return (
    <div className='divide-y'>
      <AnimatePresence initial={false}>
        {teams.map(team => {
          // Team icon / color
          const TeamIcon = team.icon
            ? getDynamicIcon(team.icon) || Users
            : Users;
          const teamColor = team.color || '#94a3b8';

          return (
            <motion.div
              layout
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 8 }}
              transition={{ duration: 0.2 }}
              key={team.id}
              className='hover:bg-muted/50 flex items-center gap-3 px-3 py-2 transition-colors'
            >
              {/* Team Icon Picker */}
              <PermissionAware
                orgSlug={orgSlug}
                permission={PERMISSIONS.TEAM_EDIT}
                fallbackMessage="You don't have permission to change team icon"
              >
                <IconPicker
                  value={team.icon || null}
                  onValueChange={icon => handleIconChange(team.id, icon)}
                  trigger={
                    <div className='flex-shrink-0 cursor-pointer'>
                      <TeamIcon
                        className='size-4'
                        style={{ color: teamColor }}
                      />
                    </div>
                  }
                  className='border-none bg-transparent p-0 shadow-none'
                />
              </PermissionAware>

              {/* Team Key Badge */}
              <Badge
                variant='secondary'
                className='flex-shrink-0 font-mono text-xs'
              >
                {team.key}
              </Badge>

              {/* Title with Description */}
              <Link
                href={`/${orgSlug}/teams/${team.key}`}
                className='hover:text-primary flex min-w-0 flex-1 items-center gap-2 transition-colors'
              >
                <span className='block truncate text-sm font-medium'>
                  {team.name}
                </span>
                {team.description && (
                  <>
                    <div className='bg-muted h-4 w-px' />
                    <p className='text-muted-foreground max-w-xs truncate text-xs'>
                      {team.description}
                    </p>
                  </>
                )}
              </Link>

              {/* Team Lead */}
              <div className='flex-shrink-0'>
                {team.lead ? (
                  <Avatar className='size-5'>
                    <AvatarFallback className='text-xs'>
                      {getInitials(team.lead.name, team.lead.email)}
                    </AvatarFallback>
                  </Avatar>
                ) : (
                  <div className='text-muted-foreground flex size-5 items-center justify-center'>
                    <Users className='size-3' />
                  </div>
                )}
              </div>

              {/* Member Count */}
              <div className='text-muted-foreground flex-shrink-0 text-xs'>
                <span>{team.memberCount || 0} members</span>
              </div>

              {/* Created Date */}
              <div className='text-muted-foreground flex-shrink-0 text-xs'>
                <span>
                  Created{' '}
                  {team.createdAt ? formatDateHuman(team.createdAt) : '—'}
                </span>
              </div>

              {/* Actions */}
              <div className='flex-shrink-0'>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant='ghost'
                      size='sm'
                      className='h-6 w-6 p-0'
                      aria-label='Open team actions'
                    >
                      <MoreHorizontal className='size-4' />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align='end'>
                    {onDelete && (
                      <DropdownMenuItem
                        variant='destructive'
                        disabled={deletePending}
                        onClick={() => {
                          if (
                            confirm(
                              'Delete this team? This action cannot be undone.',
                            )
                          ) {
                            onDelete(team.id);
                          }
                        }}
                      >
                        <Trash2 className='mr-2 h-4 w-4' />
                        Delete team
                      </DropdownMenuItem>
                    )}
                    <DropdownMenuItem asChild>
                      <Link href={`/${orgSlug}/teams/${team.key}`}>
                        View team
                      </Link>
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>
  );
}
