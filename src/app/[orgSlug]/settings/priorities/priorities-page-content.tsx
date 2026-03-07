'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Plus } from 'lucide-react';
import { PrioritiesManagementDialog } from '@/components/organization/priorities-management-dialog';
import { useQuery, useMutation } from 'convex/react';
import { api } from '@/convex/_generated/api';
import { toast } from 'sonner';
import { getDynamicIcon } from '@/lib/dynamic-icons';
import { Id } from '@/convex/_generated/dataModel';

interface Priority {
  _id: Id<'issuePriorities'>;
  name: string;
  weight: number;
  color: string | null;
  icon: string | null;
}

interface PrioritiesPageContentProps {
  orgSlug: string;
}

export function PrioritiesPageContent({ orgSlug }: PrioritiesPageContentProps) {
  const priorities = useQuery(api.organizations.queries.listIssuePriorities, {
    orgSlug,
  });

  const createMutation = useMutation(
    api.organizations.mutations.createIssuePriority,
  );
  const updateMutation = useMutation(
    api.organizations.mutations.updateIssuePriority,
  );
  const resetMutation = useMutation(
    api.organizations.mutations.resetIssuePriorities,
  );

  const [dialogState, setDialogState] = useState<{
    isOpen: boolean;
    editingPriority?: Priority;
  }>({
    isOpen: false,
  });

  const handleAdd = () => {
    setDialogState({ isOpen: true, editingPriority: undefined });
  };

  const handleEdit = (priority: Priority) => {
    setDialogState({ isOpen: true, editingPriority: priority });
  };

  const handleSave = (data: Omit<Priority, '_id'>) => {
    if (dialogState.editingPriority) {
      void updateMutation({
        orgSlug,
        priorityId: dialogState.editingPriority._id,
        name: data.name,
        weight: data.weight,
        color: data.color ?? '#94a3b8',
        icon: data.icon ?? undefined,
      });
    } else {
      void createMutation({
        orgSlug,
        name: data.name,
        weight: data.weight,
        color: data.color ?? '#94a3b8',
        icon: data.icon ?? undefined,
      });
    }

    setDialogState({ isOpen: false });
  };

  const closeDialog = () => setDialogState({ isOpen: false });

  return (
    <div className='space-y-6 p-4'>
      {/* Header */}
      <div>
        <h1 className='text-base font-semibold'>Issue Priorities</h1>
        <p className='text-muted-foreground mt-0.5 text-xs'>
          Configure issue priority levels for your organization
        </p>
      </div>

      {/* Actions */}
      <div className='flex items-center justify-between'>
        <Button
          variant='outline'
          size='sm'
          onClick={async () => {
            await resetMutation({ orgSlug });
            toast.success('Priorities reset to defaults');
          }}
          className='h-7 text-xs'
        >
          Reset
        </Button>
        <Button size='sm' onClick={handleAdd} className='h-7 text-xs'>
          <Plus className='mr-1 size-3' />
          Add Priority
        </Button>
      </div>

      {/* Priority List */}
      <div className='grid grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5'>
        {priorities?.map(priority => (
          <button
            key={priority._id}
            className='bg-background hover:bg-muted/30 group flex w-full cursor-pointer items-center gap-2 rounded border px-2 py-1.5 text-left transition-colors'
            onClick={() => handleEdit(priority as Priority)}
          >
            {priority.icon ? (
              (() => {
                const IconComponent = getDynamicIcon(priority.icon) ?? null;
                return IconComponent ? (
                  <IconComponent
                    className='size-3 flex-shrink-0'
                    style={{ color: priority.color || '#94a3b8' }}
                  />
                ) : (
                  <span
                    className='size-2.5 flex-shrink-0 rounded-full'
                    style={{ backgroundColor: priority.color || '#94a3b8' }}
                  />
                );
              })()
            ) : (
              <span
                className='size-2.5 flex-shrink-0 rounded-full'
                style={{ backgroundColor: priority.color || '#94a3b8' }}
              />
            )}
            <span className='truncate text-sm font-medium'>
              {priority.name}
            </span>

            <span className='text-muted-foreground ml-auto text-xs'>
              {priority.weight}
            </span>
          </button>
        ))}
      </div>

      {dialogState.isOpen && (
        <PrioritiesManagementDialog
          priority={dialogState.editingPriority}
          existingPriorities={priorities as Priority[]}
          onClose={closeDialog}
          onSave={handleSave}
          orgSlug={orgSlug}
        />
      )}
    </div>
  );
}
