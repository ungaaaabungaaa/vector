'use client';

import { useState, useEffect } from 'react';
import { useQuery, useMutation } from 'convex/react';
import { api } from '@/lib/convex';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Plus } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { Id } from '../../../convex/_generated/dataModel';

// Simplified selector components for teams, leads, and status
import { TeamSelector } from '@/components/issues/issue-selectors';
import { StatusSelector } from '@/components/projects/project-selectors';
import { ProjectLeadSelector } from './project-lead-selector';
import {
  VisibilitySelector,
  type VisibilityState,
} from '@/components/ui/visibility-selector';

// ---------------------------------------------------------------------------
// 🧩 Internal content component (dialog body)
// ---------------------------------------------------------------------------
interface CreateProjectDialogContentProps {
  orgSlug: string;
  onClose: () => void;
  onSuccess?: (projectId: string) => void;
  defaultStates?: {
    teamId?: string;
    leadId?: string;
    statusId?: string;
    [key: string]: unknown;
  };
}

function CreateProjectDialogContent({
  orgSlug,
  onClose,
  onSuccess,
  defaultStates,
}: CreateProjectDialogContentProps) {
  const [name, setName] = useState('');
  const [key, setKey] = useState('');
  const [description, setDescription] = useState('');
  const [selectedTeam, setSelectedTeam] = useState<string>(
    defaultStates?.teamId || '',
  );
  const [selectedLead, setSelectedLead] = useState<string>(
    defaultStates?.leadId || '',
  );
  const [selectedStatus, setSelectedStatus] = useState<string>(
    defaultStates?.statusId || '',
  );
  const [selectedVisibility, setSelectedVisibility] =
    useState<VisibilityState>('organization');
  const [isLoading, setIsLoading] = useState(false);

  // Get teams
  const teamsData =
    useQuery(api.organizations.queries.listTeams, { orgSlug }) ?? [];
  const teams = teamsData.map(team => ({
    id: team._id,
    name: team.name,
    icon: team.icon,
    color: team.color,
    key: team.key,
  }));

  // Get project statuses from organization
  const statusesData =
    useQuery(api.organizations.queries.listProjectStatuses, { orgSlug }) ?? [];
  const statuses = statusesData.map(status => ({
    _id: status._id,
    name: status.name,
    type: status.type,
    icon: status.icon,
    color: status.color,
  }));

  // Auto-select default status (type "planned" or first)
  useEffect(() => {
    if (statuses.length > 0 && !selectedStatus) {
      const defaultStatus =
        statuses.find(s => s.type === 'planned') || statuses[0];
      setSelectedStatus(defaultStatus._id);
    }
  }, [statuses, selectedStatus]);

  const createMutation = useMutation(api.projects.mutations.create);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !key.trim()) return;

    setIsLoading(true);
    try {
      const result = await createMutation({
        orgSlug,
        data: {
          name: name.trim(),
          key: key.trim().toUpperCase(),
          description: description.trim() || undefined,
          leadId: selectedLead ? (selectedLead as Id<'users'>) : undefined,
          teamId: selectedTeam ? (selectedTeam as Id<'teams'>) : undefined,
          statusId: selectedStatus
            ? (selectedStatus as Id<'projectStatuses'>)
            : undefined,
          visibility: selectedVisibility,
        },
      });

      onSuccess?.(result.projectId);
      onClose();
    } catch (error) {
      console.error(error);
    } finally {
      setIsLoading(false);
    }
  };

  // Auto-generate key from name
  const handleNameChange = (value: string) => {
    setName(value);
    // Auto-generate key similar to team dialog
    setKey(
      value
        .replace(/\s+/g, '-') // replace spaces with hyphens
        .replace(/[^A-Z0-9-]/gi, '') // allow only alphanumeric and hyphens
        .slice(0, 20) // max 20 chars for projects
        .toUpperCase(), // projects use uppercase
    );
  };

  return (
    <Dialog open onOpenChange={(isOpen: boolean) => !isOpen && onClose()}>
      <DialogHeader className='sr-only'>
        <DialogTitle>Create Project</DialogTitle>
      </DialogHeader>
      <DialogContent showCloseButton={false} className='gap-2 p-2 sm:max-w-2xl'>
        <form onSubmit={handleSubmit} className='space-y-2'>
          {/* Project Name with inline selectors */}
          <div className='flex items-center gap-2'>
            <div className='relative flex-1'>
              <Input
                placeholder='Project name'
                value={name}
                onChange={e => handleNameChange(e.target.value)}
                className='pr-20 text-base'
                autoFocus
              />
              <span className='text-muted-foreground bg-background pointer-events-none absolute top-1/2 right-2 -translate-y-1/2 rounded px-2 py-0.5 text-xs'>
                Name
              </span>
            </div>

            {/* Inline selectors */}
            <TeamSelector
              teams={teams}
              selectedTeam={selectedTeam}
              onTeamSelect={setSelectedTeam}
              displayMode='iconWhenUnselected'
              // Matches the height of the input box on the left for visual alignment
              className='h-9'
              // (applies to all inline selectors below)
            />

            <ProjectLeadSelector
              orgSlug={orgSlug}
              selectedLead={selectedLead}
              onLeadSelect={setSelectedLead}
              displayMode='iconWhenUnselected'
              align='center'
              className='h-9'
            />

            <StatusSelector
              statuses={statuses}
              selectedStatus={selectedStatus}
              onStatusSelect={setSelectedStatus}
              displayMode='iconWhenUnselected'
              align='end'
              className='h-9'
            />

            <VisibilitySelector
              value={selectedVisibility}
              onValueChange={setSelectedVisibility}
              displayMode='iconWhenUnselected'
              className='h-9'
            />
          </div>

          {/* Project Key */}
          <div className='relative'>
            <Input
              placeholder='project-key'
              value={key}
              onChange={e => setKey(e.target.value.toUpperCase().slice(0, 20))}
              maxLength={20}
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
            {isLoading ? 'Creating…' : 'Create project'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ---------------------------------------------------------------------------
// 🖱️ Public wrapper — handles trigger button + open state
// ---------------------------------------------------------------------------
export interface CreateProjectDialogProps {
  /** Organization slug the project belongs to */
  orgSlug: string;
  /** Optional callback fired after the project is successfully created */
  onProjectCreated?: () => void;
  /** Visual style of trigger button */
  variant?: 'default' | 'floating';
  /** Additional classes for the trigger button */
  className?: string;
  /** Object for default values for selectors */
  defaultStates?: {
    teamId?: string;
    leadId?: string;
    statusId?: string;
    [key: string]: unknown;
  };
}

export function CreateProjectDialog({
  orgSlug,
  onProjectCreated,
  variant = 'default',
  className,
  defaultStates,
}: CreateProjectDialogProps) {
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  const handleSuccess = () => {
    onProjectCreated?.();
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
        <CreateProjectDialogContent
          orgSlug={orgSlug}
          onClose={() => setIsDialogOpen(false)}
          onSuccess={handleSuccess}
          defaultStates={defaultStates}
        />
      )}
    </>
  );
}
