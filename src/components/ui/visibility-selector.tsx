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
import { cn } from '@/lib/utils';
import { Building, Check, Globe, Lock } from 'lucide-react';
import { useAccess } from '@/components/ui/permission-aware';

// Visibility options - matching convex schema exactly
export type VisibilityOption = 'public' | 'organization' | 'private';

// Export alias for backward compatibility
export type VisibilityState = VisibilityOption;

// Display modes for controlling visibility of icon and label - matching other selectors
export type SelectorDisplayMode =
  | 'default' // icon + label
  | 'labelOnly' // label only (no icon)
  | 'iconOnly' // icon only (no label, always)
  | 'iconWhenUnselected'; // icon when unselected, icon+label once a value selected

// Helper function to resolve what to show based on display mode and selection state
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

// Wrapper component to apply color to Lucide icons
const ColoredIcon = ({
  icon: Icon,
  color,
  className,
}: {
  icon: React.ComponentType<{ className?: string }>;
  color: string;
  className?: string;
}) => (
  <div
    className={className}
    style={
      {
        '--icon-color': color,
        color: color,
      } as React.CSSProperties
    }
  >
    <Icon className='h-4 w-4 text-inherit' />
  </div>
);

interface VisibilityConfig {
  value: VisibilityOption;
  label: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  color: string;
}

const VISIBILITY_OPTIONS: VisibilityConfig[] = [
  {
    value: 'public',
    label: 'Public',
    description: 'Anyone can see this',
    icon: Globe,
    color: '#10b981', // Emerald green
  },
  {
    value: 'organization',
    label: 'Organization',
    description: 'Only organization members can see this',
    icon: Building,
    color: '#3b82f6', // Blue
  },
  {
    value: 'private',
    label: 'Private',
    description: 'Only you and people you share with can see this',
    icon: Lock,
    color: '#8b5cf6', // Purple
  },
];

interface VisibilitySelectorProps {
  value: VisibilityOption;
  onValueChange: (value: VisibilityOption) => void;
  displayMode?: SelectorDisplayMode;
  trigger?: React.ReactElement;
  className?: string;
  align?: 'start' | 'center' | 'end';
}

export function VisibilitySelector({
  value,
  onValueChange,
  displayMode,
  trigger,
  className,
  align = 'start',
}: VisibilitySelectorProps) {
  const [open, setOpen] = useState(false);
  const { viewOnly } = useAccess();

  const hasSelection = Boolean(value);
  const { showIcon, showLabel } = resolveVisibility(displayMode, hasSelection);

  // Get selected visibility data
  const selectedOption = VISIBILITY_OPTIONS.find(
    option => option.value === value,
  );
  const currentColor = selectedOption?.color || '#3b82f6';
  const currentName = selectedOption?.label || 'Organization';
  const CurrentIcon = selectedOption?.icon || Building;

  const DefaultBtn = (
    <Button
      variant='outline'
      size='sm'
      className={cn('bg-muted/30 hover:bg-muted/50 h-8 gap-2', className)}
      disabled={viewOnly}
    >
      {showIcon && CurrentIcon && (
        <ColoredIcon
          icon={CurrentIcon}
          color={currentColor}
          className='h-4 w-4'
        />
      )}
      {showLabel && currentName}
    </Button>
  );

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>{trigger ?? DefaultBtn}</PopoverTrigger>
      <PopoverContent align={align} className='w-64 p-0'>
        <Command>
          <CommandInput placeholder='Search visibility...' className='h-9' />
          <CommandList>
            <CommandEmpty>No visibility option found.</CommandEmpty>
            <CommandGroup>
              {VISIBILITY_OPTIONS.map(option => {
                const OptionIcon = option.icon;

                return (
                  <CommandItem
                    key={option.value}
                    value={option.label}
                    onSelect={() => {
                      if (!viewOnly) {
                        onValueChange(option.value);
                        setOpen(false);
                      }
                    }}
                    disabled={viewOnly}
                    className='cursor-pointer'
                  >
                    <Check
                      className={cn(
                        'mr-2 h-4 w-4',
                        value === option.value ? 'opacity-100' : 'opacity-0',
                      )}
                    />
                    <ColoredIcon
                      icon={OptionIcon}
                      color={option.color}
                      className='mr-2 h-4 w-4'
                    />
                    <div className='flex-1'>
                      <div className='font-medium'>{option.label}</div>
                      <div className='text-muted-foreground text-xs'>
                        {option.description}
                      </div>
                    </div>
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
