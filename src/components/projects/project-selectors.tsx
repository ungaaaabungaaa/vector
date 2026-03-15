'use client';

import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
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
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from '@/components/ui/dropdown-menu';
import { Badge } from '@/components/ui/badge';
import { UserAvatar } from '@/components/user-avatar';
import { Users, User, Circle, Check } from 'lucide-react';
import { cn } from '@/lib/utils';
import { getDynamicIcon, DynamicIcon } from '@/lib/dynamic-icons';

import { useAccess } from '@/components/ui/permission-aware';

// Type definitions matching issue selectors
export type Status = {
  _id: string;
  name: string;
  color?: string | null;
  icon?: string | null;
  type: string;
};

export type Team = {
  id: string;
  name: string;
  key: string;
  icon?: string | null;
  color?: string | null;
};

export type Member = {
  userId: string;
  name: string;
  email: string;
  image?: string | null;
};

// Display mode matching issue selectors
export type SelectorDisplayMode =
  | 'default' // icon + label
  | 'labelOnly' // label only (no icon)
  | 'iconOnly' // icon only (no label, always)
  | 'iconWhenUnselected'; // icon when unselected, icon+label once a value selected

function resolveVisibility(
  mode: SelectorDisplayMode | undefined,
  hasSelection: boolean,
): { showIcon: boolean; showLabel: boolean } {
  switch (mode) {
    case 'labelOnly':
      return { showIcon: false, showLabel: true };
    case 'iconOnly':
      return { showIcon: true, showLabel: false };
    case 'iconWhenUnselected':
      return { showIcon: true, showLabel: hasSelection };
    case 'default':
    default:
      return { showIcon: true, showLabel: true };
  }
}

// Status Selector Component - Updated to use Popover + Command
interface StatusSelectorProps {
  statuses: ReadonlyArray<Status>;
  selectedStatus: string;
  onStatusSelect: (statusId: string) => void;
  displayMode?: SelectorDisplayMode;
  trigger?: React.ReactNode;
  className?: string;
  /** Position of the popover relative to its trigger. */
  align?: 'start' | 'center' | 'end';
}

export function StatusSelector({
  statuses,
  selectedStatus,
  onStatusSelect,
  displayMode,
  trigger,
  className,
  align = 'start',
}: StatusSelectorProps) {
  const [open, setOpen] = useState(false);
  const { viewOnly } = useAccess();
  const displayStatus = selectedStatus;

  const hasSelection = displayStatus !== '';
  const { showIcon, showLabel } = resolveVisibility(displayMode, hasSelection);

  // Get selected status data
  const selectedStatusObj = statuses.find(s => s._id === displayStatus);
  const currentColor = selectedStatusObj?.color || '#94a3b8'; // Default grey
  const currentName = selectedStatusObj?.name || 'Status';
  const currentIconName = selectedStatusObj?.icon;

  const DefaultBtn = (
    <Button
      variant='outline'
      size='sm'
      className={cn('bg-muted/30 hover:bg-muted/50 h-8 gap-2', className)}
    >
      {showIcon &&
        (displayStatus ? (
          <DynamicIcon
            name={currentIconName}
            fallback={Circle}
            className='h-3 w-3'
            style={{ color: currentColor }}
          />
        ) : (
          <Circle className='h-3 w-3' />
        ))}
      {showLabel && currentName}
    </Button>
  );

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>{trigger ?? DefaultBtn}</PopoverTrigger>
      <PopoverContent align={align} className='w-64 p-0'>
        <Command>
          <CommandInput placeholder='Search status...' className='h-9' />
          <CommandList>
            <CommandEmpty>No status found.</CommandEmpty>
            <CommandGroup>
              {statuses.map(status => {
                const Icon = status.icon
                  ? getDynamicIcon(status.icon) || Circle
                  : Circle;
                return (
                  <CommandItem
                    key={status._id}
                    value={status.name}
                    onSelect={() => {
                      if (!viewOnly) {
                        onStatusSelect(status._id);
                        setOpen(false);
                      }
                    }}
                    disabled={viewOnly}
                  >
                    <Check
                      className={cn(
                        'mr-2 h-4 w-4',
                        displayStatus === status._id
                          ? 'opacity-100'
                          : 'opacity-0',
                      )}
                    />

                    <Icon
                      className='mr-2 h-3 w-3'
                      style={{ color: status.color || '#94a3b8' }}
                    />
                    {status.name}
                    {viewOnly && (
                      <span className='text-muted-foreground ml-auto text-xs'>
                        (view only)
                      </span>
                    )}
                  </CommandItem>
                );
              })}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

// Team Selector Component
interface TeamSelectorProps {
  teams: ReadonlyArray<Team>;
  selectedTeam: string;
  onTeamSelect: (teamId: string) => void;
  displayMode?: 'full' | 'iconOnly' | 'iconWhenUnselected';
  className?: string;
}

function _DeprecatedTeamSelector({
  teams,
  selectedTeam,
  onTeamSelect,
  displayMode = 'full',
  className,
}: TeamSelectorProps) {
  const open = false;

  const setOpen = (_unused: boolean) => {};

  const selectedTeamObj = teams.find(t => t.id === selectedTeam);

  if (displayMode === 'iconWhenUnselected' && !selectedTeam) {
    return (
      <DropdownMenu open={open} onOpenChange={setOpen}>
        <DropdownMenuTrigger asChild>
          <Button
            variant='outline'
            size='sm'
            className={cn(
              'bg-muted/30 hover:bg-muted/50 h-8 w-8 p-0',
              className,
            )}
          >
            <Users className='text-muted-foreground h-3 w-3' />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align='start' className='w-48'>
          <DropdownMenuItem
            onClick={() => {
              onTeamSelect('');
              setOpen(false);
            }}
            className='flex items-center gap-2'
          >
            <Users className='text-muted-foreground size-4' />
            No team
          </DropdownMenuItem>
          {teams.map(team => (
            <DropdownMenuItem
              key={team.id}
              onClick={() => {
                onTeamSelect(team.id);
                setOpen(false);
              }}
              className='flex items-center gap-2'
            >
              <Users className='size-4' />
              {team.name}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
    );
  }

  if (selectedTeamObj) {
    return (
      <Badge variant='secondary' className='text-xs'>
        {selectedTeamObj.key}
      </Badge>
    );
  }

  return null;
}

// Lead/Assignee Selector Component - DEPRECATED: Use ProjectLeadSelector instead
interface LeadSelectorProps {
  members: ReadonlyArray<Member>;
  selectedLead: string;
  onLeadSelect: (leadId: string) => void;
  displayMode?: 'full' | 'iconOnly' | 'iconWhenUnselected';
  trigger?: React.ReactNode;
  className?: string;
}

/**
 * @deprecated Use ProjectLeadSelector from './project-lead-selector' instead
 */
export function LeadSelector({
  members,
  selectedLead,
  onLeadSelect,
  displayMode = 'full',
  trigger,
  className,
}: LeadSelectorProps) {
  const [open, setOpen] = useState(false);

  const selectedLeadObj = members.find(m => m.userId === selectedLead);

  const defaultTrigger = selectedLead ? (
    <Button
      variant='outline'
      size='sm'
      className={cn('bg-muted/30 hover:bg-muted/50 h-8 gap-2', className)}
    >
      <UserAvatar
        name={selectedLeadObj?.name}
        email={selectedLeadObj?.email}
        image={selectedLeadObj?.image}
        userId={selectedLeadObj?.userId}
        size='sm'
        className='size-5'
      />
      <span className='text-sm'>{selectedLeadObj?.name}</span>
    </Button>
  ) : displayMode === 'iconWhenUnselected' ? (
    <Button
      variant='outline'
      size='sm'
      className={cn('bg-muted/30 hover:bg-muted/50 h-8 w-8 p-0', className)}
    >
      <User className='text-muted-foreground h-3 w-3' />
    </Button>
  ) : (
    <Button
      variant='outline'
      size='sm'
      className={cn('bg-muted/30 hover:bg-muted/50 h-8 gap-2', className)}
    >
      <User className='text-muted-foreground h-3 w-3' />
      <span className='text-sm'>Lead</span>
    </Button>
  );

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>
        {trigger || defaultTrigger}
      </DropdownMenuTrigger>
      <DropdownMenuContent align='start' className='w-48'>
        <DropdownMenuItem
          onClick={() => {
            onLeadSelect('');
            setOpen(false);
          }}
          className='flex items-center gap-2'
        >
          <User className='text-muted-foreground size-4' />
          No lead
        </DropdownMenuItem>
        {members.map(member => (
          <DropdownMenuItem
            key={member.userId}
            onClick={() => {
              onLeadSelect(member.userId);
              setOpen(false);
            }}
            className='flex items-center gap-2'
          >
            <UserAvatar
              name={member.name}
              email={member.email}
              image={member.image}
              userId={member.userId}
              size='sm'
              className='size-5'
            />
            {member.name}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
