'use client';

import Link from 'next/link';
import { Users, MoreHorizontal, Trash2 } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from '@/components/ui/dropdown-menu';
import { formatDateHuman } from '@/lib/date';
import { useMutation } from 'convex/react';
import { useConfirm } from '@/hooks/use-confirm';
import { api } from '@/lib/convex';
import { getDynamicIcon } from '@/lib/dynamic-icons';
import { IconPicker } from '@/components/ui/icon-picker';
import { Id } from '@/convex/_generated/dataModel';

// Permission system
import { PermissionAware } from '@/components/ui/permission-aware';
import { PERMISSIONS } from '@/convex/_shared/permissions';
import { UserAvatar } from '@/components/user-avatar';

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
  canCreate?: boolean;
}

export function TeamsTable({
  orgSlug,
  teams,
  onDelete,
  deletePending = false,
  canCreate,
}: TeamsTableProps) {
  const updateIconMutation = useMutation(api.teams.mutations.update);
  const [confirm, ConfirmDialog] = useConfirm();

  const handleIconChange = (teamId: string, iconName: string | null) => {
    void updateIconMutation({
      teamId: teamId as Id<'teams'>,
      data: { icon: iconName || undefined },
    });
  };

  if (teams.length === 0) {
    return (
      <div className='text-muted-foreground flex flex-col items-center justify-center gap-1 py-12 text-sm'>
        <span>
          {canCreate === false
            ? "You haven't been added to any teams yet."
            : 'No teams found'}
        </span>
        {canCreate === false && (
          <span className='text-xs'>
            Ask an admin to add you to a team to get started.
          </span>
        )}
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
                    <div className='bg-muted hidden h-4 w-px sm:block' />
                    <p className='text-muted-foreground hidden max-w-xs truncate text-xs sm:block'>
                      {team.description}
                    </p>
                  </>
                )}
              </Link>

              {/* Team Lead */}
              <div className='flex-shrink-0'>
                {team.lead ? (
                  <UserAvatar
                    name={team.lead.name}
                    email={team.lead.email}
                    userId={team.lead._id}
                    size='sm'
                    className='size-5'
                  />
                ) : (
                  <div className='text-muted-foreground flex size-5 items-center justify-center'>
                    <Users className='size-3' />
                  </div>
                )}
              </div>

              {/* Member Count */}
              <div className='text-muted-foreground flex-shrink-0 text-xs'>
                <span>{team.memberCount || 0}</span>
                <span className='hidden sm:inline'> members</span>
              </div>

              {/* Created Date - hidden on mobile */}
              <div className='text-muted-foreground hidden flex-shrink-0 text-xs md:block'>
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
                        onClick={async () => {
                          const ok = await confirm({
                            title: 'Delete team',
                            description:
                              'This will permanently delete the team and cannot be undone.',
                            confirmLabel: 'Delete',
                            variant: 'destructive',
                          });
                          if (ok) onDelete(team.id);
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
      <ConfirmDialog />
    </div>
  );
}
