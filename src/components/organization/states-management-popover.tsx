'use client';

import { useState } from 'react';
import { useMutation } from 'convex/react';
import { api } from '@/convex/_generated/api';
import { Input } from '@/components/ui/input';
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
import { Check, SquareDashed } from 'lucide-react';
import { cn } from '@/lib/utils';
import { IconPicker } from '@/components/ui/icon-picker';
import { getDynamicIcon } from '@/lib/dynamic-icons';
import { Id } from '@/convex/_generated/dataModel';

interface StateData {
  id?: Id<'issueStates'> | Id<'projectStatuses'>;
  name: string;
  position: number;
  color: string | null;
  icon: string | null;
  type: string;
}

interface StatesManagementPopoverProps {
  type: 'issue' | 'project';
  state?: StateData;
  existingStates: StateData[];
  onClose: () => void;
  onSave: (state: Omit<StateData, 'id'>) => void;
  orgSlug?: string;
  children: React.ReactNode;
}

const DEFAULT_COLORS = [
  '#94a3b8', // slate-400
  '#3b82f6', // blue-500
  '#10b981', // emerald-500
  '#f59e0b', // amber-500
  '#ef4444', // red-500
  '#8b5cf6', // violet-500
  '#06b6d4', // cyan-500
  '#6b7280', // gray-500
];

// Linear-inspired state types
const ISSUE_STATE_TYPES = [
  { value: 'backlog', label: 'Backlog', description: 'Not yet started' },
  { value: 'todo', label: 'To Do', description: 'Ready to be worked on' },
  {
    value: 'in_progress',
    label: 'In Progress',
    description: 'Currently being worked on',
  },
  { value: 'done', label: 'Done', description: 'Completed work' },
  {
    value: 'canceled',
    label: 'Canceled',
    description: 'Work that was canceled',
  },
];

const PROJECT_STATUS_TYPES = [
  { value: 'backlog', label: 'Backlog', description: 'Ideas and future work' },
  { value: 'planned', label: 'Planned', description: 'Scheduled for future' },
  {
    value: 'in_progress',
    label: 'In Progress',
    description: 'Active development',
  },
  {
    value: 'completed',
    label: 'Completed',
    description: 'Successfully finished',
  },
  { value: 'canceled', label: 'Canceled', description: 'Project was canceled' },
];

// Selector components similar to issue-selectors
interface TypeSelectorProps {
  typeOptions: Array<{ value: string; label: string; description: string }>;
  selectedType: string;
  onTypeSelect: (type: string) => void;
}

function TypeSelector({
  typeOptions,
  selectedType,
  onTypeSelect,
}: TypeSelectorProps) {
  const [open, setOpen] = useState(false);
  const selectedTypeInfo = typeOptions.find(t => t.value === selectedType);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant='outline'
          size='sm'
          className='bg-muted/30 hover:bg-muted/50 h-8 gap-2'
        >
          {selectedTypeInfo ? selectedTypeInfo.label : 'Type'}
        </Button>
      </PopoverTrigger>
      <PopoverContent align='start' className='w-64 p-0'>
        <Command>
          <CommandInput placeholder='Search type...' className='h-9' />
          <CommandList>
            <CommandEmpty>No type found.</CommandEmpty>
            <CommandGroup>
              {typeOptions.map(option => (
                <CommandItem
                  key={option.value}
                  value={option.value}
                  onSelect={currentValue => {
                    onTypeSelect(currentValue);
                    setOpen(false);
                  }}
                >
                  <Check
                    className={cn(
                      'mr-2 h-4 w-4',
                      selectedType === option.value
                        ? 'opacity-100'
                        : 'opacity-0',
                    )}
                  />
                  {option.label}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

interface ColorSelectorProps {
  colors: string[];
  selectedColor: string;
  onColorSelect: (color: string) => void;
}

function ColorSelector({
  colors,
  selectedColor,
  onColorSelect,
}: ColorSelectorProps) {
  const [open, setOpen] = useState(false);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant='outline'
          size='sm'
          className='bg-muted/30 hover:bg-muted/50 h-8 gap-2'
        >
          <div
            className='h-3 w-3 rounded-full'
            style={{ backgroundColor: selectedColor }}
          />
          Color
        </Button>
      </PopoverTrigger>
      <PopoverContent align='start' className='w-48 p-3'>
        <div className='flex flex-wrap gap-2'>
          {colors.map(colorOption => (
            <button
              key={colorOption}
              type='button'
              className={`size-8 rounded-md border-2 transition-all ${
                selectedColor === colorOption
                  ? 'border-foreground scale-110'
                  : 'border-border hover:scale-105'
              }`}
              style={{ backgroundColor: colorOption }}
              onClick={() => {
                onColorSelect(colorOption);
                setOpen(false);
              }}
            />
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}

export function StatesManagementPopover({
  type,
  state,
  existingStates,
  onSave,
  orgSlug,
  children,
}: StatesManagementPopoverProps) {
  const deleteIssueState = useMutation(
    api.organizations.mutations.deleteIssueState,
  );
  const deleteProjectStatus = useMutation(
    api.organizations.mutations.deleteProjectStatus,
  );
  const [isDeleting, setIsDeleting] = useState(false);

  const [name, setName] = useState(state?.name || '');
  const [color, setColor] = useState(state?.color || DEFAULT_COLORS[0]);
  const [icon, setIcon] = useState(state?.icon || null);
  const [stateType, setStateType] = useState(
    state?.type || (type === 'issue' ? 'todo' : 'planned'),
  );
  const [open, setOpen] = useState(false);

  const isEditing = !!state;

  const typeOptions =
    type === 'issue' ? ISSUE_STATE_TYPES : PROJECT_STATUS_TYPES;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    // Calculate position for new states (at the end)
    const maxPosition = Math.max(-1, ...existingStates.map(s => s.position));
    const position = isEditing ? state.position : maxPosition + 1;

    onSave({
      name: name.trim(),
      position,
      color,
      icon,
      type: stateType,
    });
    setOpen(false);
  };

  const handleDelete = async () => {
    if (!state?.id || !orgSlug) return;
    if (
      !confirm('Are you sure you want to delete this? This cannot be undone.')
    )
      return;

    setIsDeleting(true);
    try {
      if (type === 'issue') {
        await deleteIssueState({
          orgSlug,
          stateId: state.id as Id<'issueStates'>,
        });
      } else {
        await deleteProjectStatus({
          orgSlug,
          statusId: state.id as Id<'projectStatuses'>,
        });
      }
      setOpen(false);
    } catch (error) {
      console.error('Failed to delete state/status:', error);
    } finally {
      setIsDeleting(false);
    }
  };

  const IconComponent = icon
    ? getDynamicIcon(icon) || SquareDashed
    : SquareDashed;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>{children}</PopoverTrigger>
      <PopoverContent className='w-80 p-2' align='start'>
        <div className='space-y-4'>
          {/* Properties */}
          <div className='flex justify-between gap-2'>
            <TypeSelector
              typeOptions={typeOptions}
              selectedType={stateType}
              onTypeSelect={setStateType}
            />
            <div className='flex gap-2'>
              <IconPicker
                value={icon}
                onValueChange={setIcon}
                placeholder='Select an icon...'
                trigger={
                  <Button variant='outline' size='sm' className='h-8 gap-2'>
                    <IconComponent
                      className='size-4'
                      style={{ color: color || '#94a3b8' }}
                    />
                  </Button>
                }
              />

              <ColorSelector
                colors={DEFAULT_COLORS}
                selectedColor={color}
                onColorSelect={setColor}
              />
            </div>
          </div>

          <form onSubmit={handleSubmit} className='space-y-3'>
            {/* Name */}
            <Input
              placeholder={`${type === 'issue' ? 'State' : 'Status'} name`}
              value={name}
              onChange={e => setName(e.target.value)}
              className='text-base'
              autoFocus
            />

            {/* Bottom action row */}
            <div className='flex w-full flex-row items-center justify-between gap-2'>
              {isEditing && (
                <Button
                  type='button'
                  variant='destructive'
                  size='sm'
                  onClick={handleDelete}
                  disabled={isDeleting}
                >
                  {isDeleting ? 'Deleting...' : 'Delete'}
                </Button>
              )}
              <div className='ml-auto flex gap-2'>
                <Button
                  type='button'
                  variant='ghost'
                  size='sm'
                  onClick={() => setOpen(false)}
                >
                  Cancel
                </Button>
                <Button
                  size='sm'
                  onClick={handleSubmit}
                  disabled={!name.trim()}
                >
                  {isEditing
                    ? 'Save Changes'
                    : `Add ${type === 'issue' ? 'State' : 'Status'}`}
                </Button>
              </div>
            </div>
          </form>
        </div>
      </PopoverContent>
    </Popover>
  );
}
