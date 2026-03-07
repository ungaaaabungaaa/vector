'use client';

import { useState } from 'react';
import { useQuery, useMutation } from 'convex/react';
import { api } from '@/lib/convex';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Plus } from 'lucide-react';
import type { Id } from '@/convex/_generated/dataModel';
import { cn } from '@/lib/utils';

// Import the LeadSelector to maintain consistency
import { LeadSelector } from '@/components/projects/project-selectors';
import { Tooltip, TooltipContent, TooltipTrigger } from '../ui/tooltip';
import {
  VisibilitySelector,
  type VisibilityState,
} from '@/components/ui/visibility-selector';

// ---------------------------------------------------------------------------
// 🧩 Internal content component (dialog body)
// ---------------------------------------------------------------------------
interface CreateTeamDialogContentProps {
  orgSlug: string;
  onClose: () => void;
  onSuccess?: (teamId: string) => void;
  defaultStates?: {
    leadId?: string;
    [key: string]: unknown;
  };
}

function CreateTeamDialogContent({
  orgSlug,
  onClose,
  onSuccess,
  defaultStates,
}: CreateTeamDialogContentProps) {
  const [name, setName] = useState('');
  const [key, setKey] = useState('');
  const [description, setDescription] = useState('');
  const [selectedLead, setSelectedLead] = useState<string>(
    defaultStates?.leadId || '',
  );
  const [selectedVisibility, setSelectedVisibility] =
    useState<VisibilityState>('organization');
  const [isLoading, setIsLoading] = useState(false);

  // Get organization members for lead selection
  const orgMembersData =
    useQuery(api.organizations.queries.listMembers, { orgSlug }) ?? [];

  // Transform orgMembers to match the expected Member interface
  const orgMembers = orgMembersData.map(member => ({
    userId: member.userId,
    name: member.user?.name || 'Unknown User',
    email: member.user?.email || '',
  }));

  const createMutation = useMutation(api.teams.mutations.create);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !key.trim()) return;

    setIsLoading(true);
    createMutation({
      orgSlug,
      data: {
        name: name.trim(),
        key: key.trim().toUpperCase(),
        description: description.trim() || undefined,
        leadId: selectedLead ? (selectedLead as Id<'users'>) : undefined,
        visibility: selectedVisibility,
      },
    })
      .then(result => {
        onSuccess?.(result.teamId);
        onClose();
      })
      .catch(e => {
        console.error(e.message);
      })
      .finally(() => {
        setIsLoading(false);
      });
  };

  // Auto-generate key from name (alphanumeric, max 10 chars)
  const handleNameChange = (value: string) => {
    setName(value);
    setKey(
      value
        .replace(/\s+/g, '-') // replace spaces with hyphens
        .replace(/[^A-Z0-9-]/gi, '') // allow only alphanumeric and hyphens
        .slice(0, 10)
        .toUpperCase(),
    );
  };

  return (
    <Dialog open onOpenChange={(isOpen: boolean) => !isOpen && onClose()}>
      <DialogHeader className='sr-only'>
        <DialogTitle>Create Team</DialogTitle>
      </DialogHeader>
      <DialogContent showCloseButton={false} className='gap-2 p-2 sm:max-w-2xl'>
        <form onSubmit={handleSubmit} className='space-y-2'>
          {/* Team Name */}
          <div className='flex items-center gap-2'>
            <div className='relative flex-1'>
              <Input
                placeholder='Team name'
                value={name}
                onChange={e => handleNameChange(e.target.value)}
                className='pr-20 text-base'
                autoFocus
              />
              <span className='text-muted-foreground bg-background pointer-events-none absolute top-1/2 right-2 -translate-y-1/2 rounded px-2 py-0.5 text-xs'>
                Name
              </span>
            </div>

            <Tooltip delayDuration={0}>
              <TooltipTrigger asChild>
                <div>
                  <LeadSelector
                    members={orgMembers}
                    selectedLead={selectedLead}
                    onLeadSelect={setSelectedLead}
                    displayMode='iconWhenUnselected'
                  />
                </div>
              </TooltipTrigger>
              <TooltipContent side='top' align='center'>
                <span>Select a team lead</span>
              </TooltipContent>
            </Tooltip>

            <Tooltip delayDuration={0}>
              <TooltipTrigger asChild>
                <div>
                  <VisibilitySelector
                    value={selectedVisibility}
                    onValueChange={setSelectedVisibility}
                    displayMode='iconWhenUnselected'
                  />
                </div>
              </TooltipTrigger>
              <TooltipContent side='top' align='center'>
                <span>Set team visibility</span>
              </TooltipContent>
            </Tooltip>
          </div>

          {/* Team Key */}
          <div className='relative'>
            <Input
              placeholder='TEAM-KEY'
              value={key}
              onChange={e => setKey(e.target.value.toUpperCase().slice(0, 10))}
              maxLength={10}
              className='h-9 pr-20 text-base'
            />
            <span className='text-muted-foreground bg-background pointer-events-none absolute top-1/2 right-2 -translate-y-1/2 rounded px-2 py-0.5 text-xs'>
              Key
            </span>
          </div>

          {/* Description */}
          <div className='relative'>
            <Textarea
              placeholder='Add description...'
              value={description}
              onChange={e => setDescription(e.target.value)}
              className='border-input bg-background placeholder:text-muted-foreground focus-visible:ring-ring min-h-[120px] w-full resize-none rounded-md border px-3 py-2 pr-20 text-sm focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none'
            />
            <span className='text-muted-foreground bg-background pointer-events-none absolute right-2 bottom-2 rounded px-2 py-0.5 text-xs'>
              Description
            </span>
          </div>
        </form>

        <div className='flex w-full flex-row items-center justify-between gap-2'>
          <Button variant='ghost' size='sm' onClick={onClose}>
            Cancel
          </Button>
          <Button
            size='sm'
            disabled={!name.trim() || !key.trim() || isLoading}
            onClick={handleSubmit}
          >
            {isLoading ? 'Creating…' : 'Create team'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ---------------------------------------------------------------------------
// 🖱️ Public wrapper — handles trigger button + open state
// ---------------------------------------------------------------------------
export interface CreateTeamDialogProps {
  /** Organization slug the team belongs to */
  orgSlug: string;
  /** Optional callback fired after the team is successfully created */
  onTeamCreated?: () => void;
  /** Visual style of trigger button */
  variant?: 'default' | 'floating';
  /** Additional classes for the trigger button */
  className?: string;
  /** Object for default values for selectors */
  defaultStates?: {
    leadId?: string;
    [key: string]: unknown;
  };
}

export function CreateTeamDialog({
  orgSlug,
  onTeamCreated,
  variant = 'default',
  className,
  defaultStates,
}: CreateTeamDialogProps) {
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  const handleSuccess = () => {
    onTeamCreated?.();
    setIsDialogOpen(false);
  };

  const trigger =
    variant === 'floating' ? (
      <Button
        onClick={() => setIsDialogOpen(true)}
        className={cn(
          'h-12 w-12 rounded-full bg-blue-600 text-white shadow-lg transition-all hover:bg-blue-700 hover:shadow-xl',
          className,
        )}
        size='icon'
      >
        <Plus className='h-5 w-5' />
      </Button>
    ) : (
      <Button
        size='sm'
        onClick={() => setIsDialogOpen(true)}
        className={cn('gap-1 rounded-sm text-sm', className)}
        variant='outline'
      >
        <Plus className='size-4' />
      </Button>
    );

  return (
    <>
      {trigger}
      {isDialogOpen && (
        <CreateTeamDialogContent
          orgSlug={orgSlug}
          onClose={() => setIsDialogOpen(false)}
          onSuccess={handleSuccess}
          defaultStates={defaultStates}
        />
      )}
    </>
  );
}
