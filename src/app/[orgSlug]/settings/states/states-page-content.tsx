'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Settings2, Plus, Clock, Pencil } from 'lucide-react';
import {
  StatesManagementDialog,
  StatesManagementPopover,
} from '@/components/organization';
import {
  PrioritiesManagementDialog,
  PrioritiesManagementPopover,
} from '@/components/organization';
import { useQuery, useMutation } from 'convex/react';
import { api } from '@/convex/_generated/api';
import { toast } from 'sonner';
import { getDynamicIcon } from '@/lib/dynamic-icons';
import { Id } from '@/convex/_generated/dataModel';
import { ISSUE_STATE_DEFAULTS, PROJECT_STATUS_DEFAULTS } from '@/lib/defaults';

type IssueStateType = 'backlog' | 'todo' | 'in_progress' | 'done' | 'canceled';
type ProjectStatusType =
  | 'backlog'
  | 'planned'
  | 'in_progress'
  | 'completed'
  | 'canceled';

interface IssueState {
  _id: Id<'issueStates'>;
  name: string;
  position: number;
  color: string | null;
  icon: string | null;
  type: IssueStateType;
}

interface ProjectStatus {
  _id: Id<'projectStatuses'>;
  name: string;
  position: number;
  color: string | null;
  icon: string | null;
  type: ProjectStatusType;
}

interface Priority {
  _id: Id<'issuePriorities'>;
  name: string;
  weight: number;
  color: string | null;
  icon: string | null;
}

interface StatesPageContentProps {
  orgSlug: string;
}

// Helper function to get type label from enum value
const getTypeLabel = (type: string) => {
  // Convert snake_case to Title Case
  return type
    .split('_')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
};

// Group states by type
const groupStatesByType = <T extends { type: string }>(
  states: readonly T[],
  isIssue: boolean,
) => {
  const types = isIssue
    ? ISSUE_STATE_DEFAULTS.map(s => s.type)
    : PROJECT_STATUS_DEFAULTS.map(s => s.type);
  return types.map(type => ({
    type,
    label: getTypeLabel(type),
    states: states.filter(state => state.type === type),
  }));
};

export function StatesPageContent({ orgSlug }: StatesPageContentProps) {
  const issueStates = useQuery(api.organizations.queries.listIssueStates, {
    orgSlug,
  });
  const projectStatuses = useQuery(
    api.organizations.queries.listProjectStatuses,
    {
      orgSlug,
    },
  );
  const priorities = useQuery(api.organizations.queries.listIssuePriorities, {
    orgSlug,
  });

  const createIssueState = useMutation(
    api.organizations.mutations.createIssueState,
  );
  const updateIssueState = useMutation(
    api.organizations.mutations.updateIssueState,
  );
  const createProjectStatus = useMutation(
    api.organizations.mutations.createProjectStatus,
  );
  const updateProjectStatus = useMutation(
    api.organizations.mutations.updateProjectStatus,
  );
  const resetIssueMutation = useMutation(
    api.organizations.mutations.resetIssueStates,
  );
  const resetStatusMutation = useMutation(
    api.organizations.mutations.resetProjectStatuses,
  );
  const createPriority = useMutation(
    api.organizations.mutations.createIssuePriority,
  );
  const updatePriority = useMutation(
    api.organizations.mutations.updateIssuePriority,
  );
  const resetPriorities = useMutation(
    api.organizations.mutations.resetIssuePriorities,
  );

  const [dialogState, setDialogState] = useState<{
    isOpen: boolean;
    type: 'issue' | 'project';
    editingState?: IssueState | ProjectStatus;
  }>({
    isOpen: false,
    type: 'issue',
  });

  const [priorityDialogState, setPriorityDialogState] = useState<{
    isOpen: boolean;
    editingPriority?: Priority;
  }>({
    isOpen: false,
  });

  const handleAddState = (type: 'issue' | 'project') => {
    setDialogState({
      isOpen: true,
      type,
      editingState: undefined,
    });
  };

  const handleSaveIssueState = (
    newStateData: Omit<IssueState, '_id'>,
    editingState?: IssueState,
  ) => {
    const isEditing = !!editingState;

    if (isEditing) {
      void updateIssueState({
        orgSlug,
        stateId: editingState._id,
        name: newStateData.name,
        position: newStateData.position,
        color: newStateData.color ?? '#94a3b8',
        icon: newStateData.icon ?? undefined,
        type: newStateData.type,
      });
    } else {
      void createIssueState({
        orgSlug,
        name: newStateData.name,
        position: newStateData.position,
        color: newStateData.color ?? '#94a3b8',
        icon: newStateData.icon ?? undefined,
        type: newStateData.type,
      });
    }
  };

  const handleSaveProjectStatus = (
    newStatusData: Omit<ProjectStatus, '_id'>,
    editingStatus?: ProjectStatus,
  ) => {
    const isEditing = !!editingStatus;

    if (isEditing) {
      void updateProjectStatus({
        orgSlug,
        statusId: editingStatus._id,
        name: newStatusData.name,
        position: newStatusData.position,
        color: newStatusData.color ?? '#94a3b8',
        icon: newStatusData.icon ?? undefined,
        type: newStatusData.type,
      });
    } else {
      void createProjectStatus({
        orgSlug,
        name: newStatusData.name,
        position: newStatusData.position,
        color: newStatusData.color ?? '#94a3b8',
        icon: newStatusData.icon ?? undefined,
        type: newStatusData.type,
      });
    }
  };

  const closeDialog = () => {
    setDialogState({ isOpen: false, type: 'issue' });
  };

  const handleAddPriority = () => {
    setPriorityDialogState({ isOpen: true });
  };

  const handleSavePriority = (data: Omit<Priority, '_id'>) => {
    if (priorityDialogState.editingPriority) {
      void updatePriority({
        orgSlug,
        priorityId: priorityDialogState.editingPriority._id,
        name: data.name,
        weight: data.weight,
        color: data.color ?? '#94a3b8',
        icon: data.icon ?? undefined,
      });
    } else {
      void createPriority({
        orgSlug,
        name: data.name,
        weight: data.weight,
        color: data.color ?? '#94a3b8',
        icon: data.icon ?? undefined,
      });
    }

    setPriorityDialogState({ isOpen: false });
  };

  const closePriorityDialog = () => setPriorityDialogState({ isOpen: false });

  const issueGroups = groupStatesByType(
    (issueStates as IssueState[]) ?? [],
    true,
  );
  const projectGroups = groupStatesByType(
    (projectStatuses as ProjectStatus[]) ?? [],
    false,
  );

  return (
    <div className='p-4'>
      {/* Issue States Section */}
      <div className='space-y-4'>
        <div className='flex items-center justify-between'>
          <div className='flex items-center gap-2'>
            <Settings2 className='text-muted-foreground size-5' />
            <h2 className='text-lg font-semibold'>Issue States</h2>
          </div>
          <div className='flex gap-2'>
            <Button
              variant='outline'
              size='sm'
              onClick={async () => {
                await resetIssueMutation({ orgSlug });
                toast.success('Issue states reset to defaults');
              }}
              className='h-7 text-xs'
            >
              Reset
            </Button>
            <Button
              size='sm'
              onClick={() => handleAddState('issue')}
              className='h-7 text-xs'
            >
              <Plus className='mr-1 size-3' />
              Add State
            </Button>
          </div>
        </div>

        <div className='grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5'>
          {issueGroups.map(group => (
            <div key={group.type} className='space-y-1'>
              <div>
                <h3 className='text-foreground text-sm font-medium'>
                  {group.label}
                </h3>
              </div>

              <div className='space-y-1'>
                {group.states.map(state => (
                  <StatesManagementPopover
                    key={state._id}
                    type='issue'
                    state={state}
                    existingStates={(issueStates as IssueState[]) ?? []}
                    orgSlug={orgSlug}
                    onClose={() => {}}
                    onSave={data =>
                      handleSaveIssueState(
                        data as Omit<IssueState, '_id'>,
                        state as IssueState,
                      )
                    }
                  >
                    <button className='bg-background hover:bg-muted/30 group flex w-full cursor-pointer items-center gap-2 rounded border px-2 py-1.5 text-left transition-colors'>
                      {state.icon ? (
                        (() => {
                          const IconComponent =
                            getDynamicIcon(state.icon) ?? null;
                          return IconComponent ? (
                            <IconComponent
                              className='size-3 flex-shrink-0'
                              style={{ color: state.color || '#94a3b8' }}
                            />
                          ) : (
                            <div
                              className='size-2.5 flex-shrink-0 rounded-full'
                              style={{
                                backgroundColor: state.color || '#94a3b8',
                              }}
                            />
                          );
                        })()
                      ) : (
                        <div
                          className='size-2.5 flex-shrink-0 rounded-full'
                          style={{ backgroundColor: state.color || '#94a3b8' }}
                        />
                      )}
                      <span className='flex-1 truncate text-xs font-medium'>
                        {state.name}
                      </span>
                      <Pencil className='text-muted-foreground group-hover:text-foreground size-3 opacity-0 transition-colors group-hover:opacity-100' />
                    </button>
                  </StatesManagementPopover>
                ))}
                {group.states.length === 0 && (
                  <div className='text-muted-foreground px-2 py-1.5 text-xs italic'>
                    No states configured
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Project Statuses Section */}
      <div className='mt-20 space-y-4'>
        <div className='flex items-center justify-between'>
          <div className='flex items-center gap-2'>
            <Clock className='text-muted-foreground size-5' />
            <h2 className='text-lg font-semibold'>Project Statuses</h2>
          </div>
          <div className='flex gap-2'>
            <Button
              variant='outline'
              size='sm'
              onClick={async () => {
                await resetStatusMutation({ orgSlug });
                toast.success('Project statuses reset to defaults');
              }}
              className='h-7 text-xs'
            >
              Reset
            </Button>
            <Button
              size='sm'
              onClick={() => handleAddState('project')}
              className='h-7 text-xs'
            >
              <Plus className='mr-1 size-3' />
              Add Status
            </Button>
          </div>
        </div>

        <div className='grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5'>
          {projectGroups.map(group => (
            <div key={group.type} className='space-y-1'>
              <div>
                <h3 className='text-foreground text-sm font-medium'>
                  {group.label}
                </h3>
              </div>

              <div className='space-y-1'>
                {group.states.map(status => (
                  <StatesManagementPopover
                    key={status._id}
                    type='project'
                    state={status}
                    existingStates={(projectStatuses as ProjectStatus[]) ?? []}
                    orgSlug={orgSlug}
                    onClose={() => {}}
                    onSave={data =>
                      handleSaveProjectStatus(
                        data as Omit<ProjectStatus, '_id'>,
                        status as ProjectStatus,
                      )
                    }
                  >
                    <button className='bg-background hover:bg-muted/30 group flex w-full cursor-pointer items-center gap-2 rounded border px-2 py-1.5 text-left transition-colors'>
                      {status.icon ? (
                        (() => {
                          const IconComponent =
                            getDynamicIcon(status.icon) ?? null;
                          return IconComponent ? (
                            <IconComponent
                              className='size-3 flex-shrink-0'
                              style={{ color: status.color || '#94a3b8' }}
                            />
                          ) : (
                            <div
                              className='size-2.5 flex-shrink-0 rounded-full'
                              style={{
                                backgroundColor: status.color || '#94a3b8',
                              }}
                            />
                          );
                        })()
                      ) : (
                        <div
                          className='size-2.5 flex-shrink-0 rounded-full'
                          style={{ backgroundColor: status.color || '#94a3b8' }}
                        />
                      )}
                      <span className='flex-1 truncate text-xs font-medium'>
                        {status.name}
                      </span>
                      <Pencil className='text-muted-foreground group-hover:text-foreground size-3 opacity-0 transition-colors group-hover:opacity-100' />
                    </button>
                  </StatesManagementPopover>
                ))}
                {group.states.length === 0 && (
                  <div className='text-muted-foreground px-2 py-1.5 text-xs italic'>
                    No statuses configured
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Issue Priorities Section */}
      <div className='mt-20 space-y-4'>
        <div className='flex items-center justify-between'>
          <div className='flex items-center gap-2'>
            <Settings2 className='text-muted-foreground size-5' />
            <h2 className='text-lg font-semibold'>Issue Priorities</h2>
          </div>
          <div className='flex gap-2'>
            <Button
              variant='outline'
              size='sm'
              onClick={async () => {
                await resetPriorities({ orgSlug });
                toast.success('Priorities reset to defaults');
              }}
              className='h-7 text-xs'
            >
              Reset
            </Button>
            <Button
              size='sm'
              onClick={handleAddPriority}
              className='h-7 text-xs'
            >
              <Plus className='mr-1 size-3' />
              Add Priority
            </Button>
          </div>
        </div>

        <div className='grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5'>
          {priorities?.map(priority => (
            <PrioritiesManagementPopover
              key={priority._id}
              priority={priority as Priority}
              existingPriorities={(priorities as Priority[]) ?? []}
              orgSlug={orgSlug}
              onClose={() => {}}
              onSave={data => handleSavePriority(data)}
            >
              <button className='bg-background hover:bg-muted/30 group flex w-full cursor-pointer items-center gap-2 rounded border px-2 py-1.5 text-left transition-colors'>
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
            </PrioritiesManagementPopover>
          ))}
          {priorities?.length === 0 && (
            <div className='text-muted-foreground px-2 py-1.5 text-xs italic'>
              No priorities configured
            </div>
          )}
        </div>
      </div>

      {dialogState.isOpen && (
        <StatesManagementDialog
          type={dialogState.type}
          state={dialogState.editingState}
          existingStates={
            ((dialogState.type === 'issue' ? issueStates : projectStatuses) as (
              | IssueState
              | ProjectStatus
            )[]) ?? []
          }
          orgSlug={orgSlug}
          onClose={closeDialog}
          onSave={data => {
            if (dialogState.type === 'issue') {
              handleSaveIssueState(data as Omit<IssueState, '_id'>);
            } else {
              handleSaveProjectStatus(data as Omit<ProjectStatus, '_id'>);
            }
            closeDialog();
          }}
        />
      )}

      {/* Priorities Dialog */}
      {priorityDialogState.isOpen && (
        <PrioritiesManagementDialog
          priority={priorityDialogState.editingPriority}
          existingPriorities={(priorities as Priority[]) ?? []}
          onClose={closePriorityDialog}
          onSave={handleSavePriority}
          orgSlug={orgSlug}
        />
      )}
    </div>
  );
}
