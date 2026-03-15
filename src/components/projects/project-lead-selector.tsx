'use client';

import { useState } from 'react';
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
import { UserAvatar } from '@/components/user-avatar';
import { cn } from '@/lib/utils';
import { Check, User } from 'lucide-react';
import { useQuery } from 'convex/react';
import { api } from '@/convex/_generated/api';
import type { FunctionReturnType } from 'convex/server';
import { useAccess } from '@/components/ui/permission-aware';

type ProjectMember = FunctionReturnType<
  typeof api.projects.queries.listMembers
>[number];
type OrgMember = {
  userId: string;
  name?: string;
  email?: string;
  image?: string;
};

interface ProjectLeadSelectorProps {
  orgSlug: string;
  projectKey?: string; // Optional - if provided, we're editing an existing project
  selectedLead: string;
  onLeadSelect: (leadId: string) => void;
  displayMode?: 'full' | 'iconOnly' | 'iconWhenUnselected';
  trigger?: React.ReactNode;
  className?: string;
  align?: 'start' | 'center' | 'end';
}

// Type guard to check if member is a project member (has .user)
function isProjectMember(
  member: ProjectMember | OrgMember,
): member is ProjectMember {
  return (member as ProjectMember).user !== undefined;
}

export function ProjectLeadSelector({
  orgSlug,
  projectKey,
  selectedLead,
  onLeadSelect,
  displayMode = 'full',
  trigger,
  className,
  align = 'start',
}: ProjectLeadSelectorProps) {
  const [open, setOpen] = useState(false);
  const displayLead = selectedLead;

  const { viewOnly } = useAccess();
  const currentUser = useQuery(api.users.getCurrentUser);
  const currentUserId = currentUser?._id;

  // Fetch organization members (for project creation)
  const orgMembers: OrgMember[] =
    useQuery(api.organizations.queries.listMembers, { orgSlug }) ?? [];
  const project = useQuery(
    api.projects.queries.getByKey,
    projectKey ? { orgSlug, projectKey } : 'skip',
  );

  // Fetch project members if projectKey and project ID are available
  const projectMembers: ProjectMember[] =
    useQuery(
      api.projects.queries.listMembers,
      projectKey && project?._id ? { projectId: project._id } : 'skip',
    ) ?? [];

  // For existing projects, we need to include the project lead even if they're not explicitly added as project members
  const members: (ProjectMember | OrgMember)[] = projectKey
    ? (() => {
        const leadId = project?.leadId;

        if (leadId && !projectMembers.some(m => m.userId === leadId)) {
          // Find the lead in org members and add them to the list
          const leadFromOrg = orgMembers.find(m => m.userId === leadId);
          if (leadFromOrg) {
            return [...projectMembers, leadFromOrg];
          }
        }

        return projectMembers;
      })()
    : orgMembers;

  // Sort members: current user first, then alphabetically by name
  const sortedMembers = [...members].sort((a, b) => {
    // Current user always comes first
    if (a.userId === currentUserId) return -1;
    if (b.userId === currentUserId) return 1;

    // Then sort by name
    const nameA = isProjectMember(a)
      ? a.user?.name || a.user?.email || ''
      : a.name || a.email || '';
    const nameB = isProjectMember(b)
      ? b.user?.name || b.user?.email || ''
      : b.name || b.email || '';
    return nameA.localeCompare(nameB);
  });

  const selectedLeadObj = sortedMembers.find(m => m.userId === displayLead);

  const hasSelection = displayLead !== '';
  const showIcon =
    displayMode === 'iconOnly' ||
    (displayMode === 'iconWhenUnselected' && !hasSelection);
  const showLabel =
    displayMode === 'full' ||
    (displayMode === 'iconWhenUnselected' && hasSelection);

  const defaultTrigger =
    displayLead && selectedLeadObj ? (
      <Button
        variant='outline'
        size='sm'
        className={cn('bg-muted/30 hover:bg-muted/50 h-8 gap-2', className)}
      >
        <UserAvatar
          name={
            isProjectMember(selectedLeadObj)
              ? selectedLeadObj.user?.name
              : selectedLeadObj.name
          }
          email={
            isProjectMember(selectedLeadObj)
              ? selectedLeadObj.user?.email
              : selectedLeadObj.email
          }
          image={
            isProjectMember(selectedLeadObj)
              ? selectedLeadObj.user?.image
              : selectedLeadObj.image
          }
          userId={selectedLeadObj.userId}
          size='sm'
          className='size-5'
        />
        {showLabel && selectedLeadObj && (
          <span className='text-sm'>
            {isProjectMember(selectedLeadObj)
              ? selectedLeadObj.user?.name || selectedLeadObj.user?.email
              : selectedLeadObj.name || selectedLeadObj.email}
          </span>
        )}
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
        {showIcon && <User className='text-muted-foreground h-3 w-3' />}
        {showLabel && <span className='text-sm'>Lead</span>}
      </Button>
    );

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>{trigger || defaultTrigger}</PopoverTrigger>
      <PopoverContent align={align} className='w-64 p-0'>
        <Command>
          <CommandInput
            placeholder={
              projectKey ? 'Search project members...' : 'Search members...'
            }
            className='h-9'
          />
          <CommandList>
            <CommandEmpty>
              {projectKey ? 'No project members found.' : 'No members found.'}
            </CommandEmpty>
            <CommandGroup>
              <CommandItem
                value=''
                onSelect={() => {
                  if (!viewOnly) {
                    onLeadSelect('');
                    setOpen(false);
                  }
                }}
                disabled={viewOnly}
              >
                <Check
                  className={cn(
                    'mr-2 h-4 w-4',
                    displayLead === '' ? 'opacity-100' : 'opacity-0',
                  )}
                />
                No lead
                {viewOnly && (
                  <span className='text-muted-foreground ml-auto text-xs'>
                    (view only)
                  </span>
                )}
              </CommandItem>
              {sortedMembers.map(member => (
                <CommandItem
                  key={member.userId}
                  value={
                    isProjectMember(member)
                      ? member.user?.name || member.user?.email
                      : member.name || member.email
                  }
                  onSelect={() => {
                    if (!viewOnly) {
                      onLeadSelect(member.userId);
                      setOpen(false);
                    }
                  }}
                  disabled={viewOnly}
                >
                  <Check
                    className={cn(
                      'mr-2 h-4 w-4',
                      displayLead === member.userId
                        ? 'opacity-100'
                        : 'opacity-0',
                    )}
                  />
                  <UserAvatar
                    name={
                      isProjectMember(member) ? member.user?.name : member.name
                    }
                    email={
                      isProjectMember(member)
                        ? member.user?.email
                        : member.email
                    }
                    image={
                      isProjectMember(member)
                        ? member.user?.image
                        : member.image
                    }
                    userId={member.userId}
                    size='sm'
                    className='mr-2 size-5'
                  />
                  <div className='flex flex-col'>
                    <span className='text-sm'>
                      {isProjectMember(member)
                        ? member.user?.name || member.user?.email
                        : member.name || member.email}
                      {member.userId === currentUserId && (
                        <span className='text-muted-foreground ml-1'>
                          (you)
                        </span>
                      )}
                    </span>
                    {(isProjectMember(member)
                      ? member.user?.name
                      : member.name) && (
                      <span className='text-muted-foreground text-xs'>
                        {isProjectMember(member)
                          ? member.user?.email
                          : member.email}
                      </span>
                    )}
                  </div>
                  {viewOnly && (
                    <span className='text-muted-foreground ml-auto text-xs'>
                      (view only)
                    </span>
                  )}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
