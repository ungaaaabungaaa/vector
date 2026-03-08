'use client';

import { useMemo, useState } from 'react';
import { ChevronsUpDown } from 'lucide-react';
import { useAccess } from '@/components/ui/permission-aware';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import {
  AVAILABLE_ICONS,
  DynamicIcon,
  findAvailableIcon,
  ICON_LIBRARY_LABELS,
  type AvailableIconDefinition,
  type IconLibrary,
} from '@/lib/dynamic-icons';
import { cn } from '@/lib/utils';

export type AvailableIconName = AvailableIconDefinition['value'];

const LIBRARY_FILTERS: Array<'all' | IconLibrary> = [
  'all',
  'lucide',
  'phosphor',
  'tabler',
  'remix',
  'font-awesome',
];

interface IconPickerProps {
  value?: string | null;
  onValueChange: (iconName: string | null) => void;
  placeholder?: string;
  className?: string;
  trigger?: React.ReactElement;
}

export function IconPicker({
  value,
  onValueChange,
  placeholder = 'Select icon...',
  className,
  trigger,
}: IconPickerProps) {
  const [open, setOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeLibrary, setActiveLibrary] = useState<'all' | IconLibrary>(
    'all',
  );
  const { viewOnly } = useAccess();

  const selectedIcon = findAvailableIcon(value);
  const normalizedQuery = searchQuery.trim().toLowerCase();

  const filteredIcons = useMemo(
    () =>
      AVAILABLE_ICONS.filter(icon => {
        const matchesLibrary =
          activeLibrary === 'all' || icon.library === activeLibrary;
        if (!matchesLibrary) return false;
        if (!normalizedQuery) return true;

        return [
          icon.label,
          icon.name,
          icon.category,
          icon.libraryLabel,
          ...icon.keywords,
        ].some(field => field.toLowerCase().includes(normalizedQuery));
      }),
    [activeLibrary, normalizedQuery],
  );

  const groupedIcons = useMemo(() => {
    return filteredIcons.reduce(
      (acc, icon) => {
        const sectionKey =
          activeLibrary === 'all'
            ? `${icon.libraryLabel} icons`
            : icon.category;

        if (!acc[sectionKey]) {
          acc[sectionKey] = [];
        }
        acc[sectionKey].push(icon);
        return acc;
      },
      {} as Record<string, AvailableIconDefinition[]>,
    );
  }, [activeLibrary, filteredIcons]);

  return (
    <Popover modal open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        {trigger ?? (
          <Button
            variant='outline'
            role='combobox'
            aria-expanded={open}
            className={cn('h-9 w-full justify-between gap-2', className)}
          >
            <div className='flex min-w-0 items-center gap-2'>
              {value ? <DynamicIcon name={value} className='size-4' /> : null}
              <span className='truncate'>
                {selectedIcon ? selectedIcon.label : value || placeholder}
              </span>
            </div>
            <ChevronsUpDown className='size-4 shrink-0 opacity-50' />
          </Button>
        )}
      </PopoverTrigger>
      <PopoverContent
        side='bottom'
        align='start'
        className='w-96 p-0 sm:w-[28rem]'
      >
        <div className='bg-background sticky top-0 z-10 border-b p-3'>
          <Input
            placeholder='Search icons, categories, or libraries...'
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className='h-8'
          />
          <div className='mt-2 flex flex-wrap gap-1'>
            {LIBRARY_FILTERS.map(library => {
              const isActive = activeLibrary === library;
              const label =
                library === 'all' ? 'All' : ICON_LIBRARY_LABELS[library];

              return (
                <button
                  key={library}
                  type='button'
                  onClick={() => setActiveLibrary(library)}
                  className={cn(
                    'text-muted-foreground hover:bg-muted/60 h-7 rounded-md border px-2 text-xs transition-colors',
                    isActive && 'border-primary bg-primary/10 text-foreground',
                  )}
                >
                  {label}
                </button>
              );
            })}
          </div>
        </div>

        <div className='max-h-[420px] overflow-y-auto'>
          <div className='border-b p-3'>
            <div className='text-muted-foreground mb-2 flex items-center justify-between text-[11px] font-medium tracking-[0.12em] uppercase'>
              <span>Clear Selection</span>
              {viewOnly ? <span>(view only)</span> : null}
            </div>
            <button
              type='button'
              onClick={() => {
                if (!viewOnly) {
                  onValueChange(null);
                  setOpen(false);
                }
              }}
              disabled={viewOnly}
              className={cn(
                'hover:bg-muted/50 flex h-8 w-full items-center justify-start rounded-md border border-dashed px-2 text-left text-sm transition-colors',
                value === null
                  ? 'border-primary bg-primary/10 text-primary'
                  : 'border-border',
                viewOnly && 'cursor-not-allowed opacity-50',
              )}
            >
              No icon
            </button>
          </div>

          {Object.entries(groupedIcons).map(([section, icons]) => (
            <div key={section} className='border-b p-3 last:border-b-0'>
              <div className='text-muted-foreground mb-3 flex items-center justify-between text-[11px] font-medium tracking-[0.12em] uppercase'>
                <span>{section}</span>
                {activeLibrary === 'all' ? (
                  <span>{icons.length}</span>
                ) : viewOnly ? (
                  <span>(view only)</span>
                ) : null}
              </div>
              <div className='grid grid-cols-8 gap-1'>
                {icons.map(icon => {
                  const isSelected = value === icon.value;

                  return (
                    <button
                      key={icon.value}
                      type='button'
                      onClick={() => {
                        if (!viewOnly) {
                          onValueChange(icon.value);
                          setOpen(false);
                        }
                      }}
                      disabled={viewOnly}
                      aria-label={`${icon.label} from ${icon.libraryLabel}`}
                      className={cn(
                        'hover:bg-muted/50 flex size-8 items-center justify-center rounded-md border transition-colors',
                        isSelected
                          ? 'border-primary bg-primary/10 text-primary'
                          : 'border-border',
                        viewOnly && 'cursor-not-allowed opacity-50',
                      )}
                      title={`${icon.label} · ${icon.libraryLabel}${viewOnly ? ' (view only)' : ''}`}
                    >
                      <DynamicIcon name={icon.value} className='size-4' />
                    </button>
                  );
                })}
              </div>
            </div>
          ))}

          {filteredIcons.length === 0 ? (
            <div className='text-muted-foreground p-8 text-center text-sm'>
              No icons found matching &quot;{searchQuery}&quot;
            </div>
          ) : null}
        </div>
      </PopoverContent>
    </Popover>
  );
}
