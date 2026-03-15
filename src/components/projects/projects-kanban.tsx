'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { Circle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { DynamicIcon } from '@/lib/dynamic-icons';
import { UserAvatar } from '@/components/user-avatar';
import { formatDateHuman } from '@/lib/date';
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useSensor,
  useSensors,
  useDroppable,
  useDraggable,
  type DragStartEvent,
  type DragEndEvent,
} from '@dnd-kit/core';

import type { ProjectRowData } from './projects-table';
import type { Status } from './project-selectors';
import { StatusSelector } from './project-selectors';
import { ProjectLeadSelector } from './project-lead-selector';

const STATUS_ORDER = [
  'backlog',
  'planned',
  'in_progress',
  'completed',
  'canceled',
];

export interface ProjectsKanbanProps {
  orgSlug: string;
  projects: ReadonlyArray<ProjectRowData>;
  statuses: ReadonlyArray<Status>;
  onStatusChange: (projectId: string, statusId: string) => void;
  onLeadChange?: (projectId: string, leadId: string) => void;
}

export function ProjectsKanban({
  orgSlug,
  projects,
  statuses,
  onStatusChange,
  onLeadChange,
}: ProjectsKanbanProps) {
  const [activeId, setActiveId] = useState<string | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 8 },
    }),
  );
  const sortedStatuses = React.useMemo(
    () =>
      [...statuses].sort(
        (a, b) => STATUS_ORDER.indexOf(a.type) - STATUS_ORDER.indexOf(b.type),
      ),
    [statuses],
  );

  // Group projects by status
  const columns = React.useMemo(() => {
    return sortedStatuses.map(status => ({
      status,
      projects: projects.filter(p => p.statusId === status._id),
    }));
  }, [sortedStatuses, projects]);

  const activeProject = activeId
    ? (projects.find(p => p.id === activeId) ?? null)
    : null;

  function handleDragStart(event: DragStartEvent) {
    setActiveId(event.active.id as string);
  }

  function handleDragEnd(event: DragEndEvent) {
    setActiveId(null);
    const { active, over } = event;
    if (!over) return;

    const projectId = active.id as string;
    const targetStatusId = over.id as string;
    const project = projects.find(p => p.id === projectId);
    if (!project) return;

    const targetStatus = sortedStatuses.find(s => s._id === targetStatusId);
    if (!targetStatus || project.statusId === targetStatusId) return;

    onStatusChange(projectId, targetStatusId);
  }

  return (
    <DndContext
      sensors={sensors}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      <div className='flex h-full gap-3 overflow-x-auto p-3'>
        {columns.map(({ status, projects: columnProjects }) => (
          <KanbanColumn
            key={status._id}
            status={status}
            projects={columnProjects}
            orgSlug={orgSlug}
            activeId={activeId}
            statuses={statuses}
            onStatusChange={onStatusChange}
            onLeadChange={onLeadChange}
          />
        ))}
      </div>

      <DragOverlay
        dropAnimation={{
          duration: 200,
          easing: 'cubic-bezier(0.18, 0.67, 0.6, 1.22)',
        }}
      >
        {activeProject ? (
          <div className='animate-tilt w-72'>
            <ProjectCardContent
              project={activeProject}
              orgSlug={orgSlug}
              isDragging
            />
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}

function KanbanColumn({
  status,
  projects,
  orgSlug,
  activeId,
  statuses,
  onStatusChange,
  onLeadChange,
}: {
  status: Status;
  projects: ProjectRowData[];
  orgSlug: string;
  activeId: string | null;
  statuses: ReadonlyArray<Status>;
  onStatusChange: (projectId: string, statusId: string) => void;
  onLeadChange?: (projectId: string, leadId: string) => void;
}) {
  const { isOver, setNodeRef } = useDroppable({ id: status._id });
  const count = projects.length;

  return (
    <div
      ref={setNodeRef}
      className={cn(
        'flex w-72 flex-shrink-0 flex-col rounded-lg transition-colors',
        isOver && 'bg-muted/50',
      )}
    >
      {/* Column header */}
      <div className='mb-2 flex items-center gap-2 px-1'>
        <DynamicIcon
          name={status.icon}
          className='size-3.5'
          style={{ color: status.color || '#6b7280' }}
          fallback={Circle}
        />
        <span className='text-sm font-medium'>{status.name}</span>
        <span className='text-muted-foreground text-xs'>{count}</span>
      </div>

      {/* Column body */}
      <div className='min-h-[80px] flex-1 space-y-2 overflow-y-auto rounded-lg'>
        {projects.length === 0 ? (
          <div
            className={cn(
              'text-muted-foreground rounded-lg border border-dashed px-3 py-6 text-center text-xs',
              isOver && 'border-primary/50 bg-primary/5',
            )}
          >
            {isOver ? 'Drop here' : 'No projects'}
          </div>
        ) : (
          projects.map(project => (
            <ProjectCard
              key={project.id}
              project={project}
              orgSlug={orgSlug}
              isHidden={project.id === activeId}
              statuses={statuses}
              onStatusChange={onStatusChange}
              onLeadChange={onLeadChange}
            />
          ))
        )}
      </div>
    </div>
  );
}

function ProjectCard({
  project,
  orgSlug,
  isHidden,
  statuses,
  onStatusChange,
  onLeadChange,
}: {
  project: ProjectRowData;
  orgSlug: string;
  isHidden?: boolean;
  statuses: ReadonlyArray<Status>;
  onStatusChange: (projectId: string, statusId: string) => void;
  onLeadChange?: (projectId: string, leadId: string) => void;
}) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: project.id,
  });

  return (
    <div
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      className={cn(
        'transition-all duration-200',
        isHidden && 'scale-95 opacity-30',
      )}
    >
      <ProjectCardContent
        project={project}
        orgSlug={orgSlug}
        isDragging={isDragging}
        statuses={statuses}
        onStatusChange={onStatusChange}
        onLeadChange={onLeadChange}
      />
    </div>
  );
}

function ProjectCardContent({
  project,
  orgSlug,
  isDragging,
  statuses,
  onStatusChange,
  onLeadChange,
}: {
  project: ProjectRowData;
  orgSlug: string;
  isDragging?: boolean;
  statuses?: ReadonlyArray<Status>;
  onStatusChange?: (projectId: string, statusId: string) => void;
  onLeadChange?: (projectId: string, leadId: string) => void;
}) {
  return (
    <div
      className={cn(
        'bg-card block rounded-lg border p-3 shadow-xs transition-colors',
        isDragging
          ? 'ring-primary/30 shadow-lg ring-2'
          : 'hover:border-border/80 hover:shadow-sm',
      )}
    >
      {/* Project key + icon */}
      <div className='mb-1.5 flex items-center gap-2'>
        {onStatusChange && statuses ? (
          <div onClick={e => e.stopPropagation()}>
            <StatusSelector
              statuses={statuses}
              selectedStatus={project.statusId || ''}
              onStatusSelect={sid => onStatusChange(project.id, sid)}
              displayMode='iconWhenUnselected'
              trigger={
                <div className='flex-shrink-0 cursor-pointer'>
                  <DynamicIcon
                    name={project.icon}
                    className='size-3'
                    style={{
                      color: project.icon
                        ? project.color || '#94a3b8'
                        : project.statusColor || '#94a3b8',
                    }}
                    fallback={Circle}
                  />
                </div>
              }
              className='border-none bg-transparent p-0 shadow-none'
            />
          </div>
        ) : (
          <DynamicIcon
            name={project.icon}
            className='size-3'
            style={{
              color: project.icon
                ? project.color || '#94a3b8'
                : project.statusColor || '#94a3b8',
            }}
            fallback={Circle}
          />
        )}
        <Link
          href={`/${orgSlug}/projects/${project.key}`}
          onClick={e => {
            if (isDragging) e.preventDefault();
          }}
          className='text-muted-foreground hover:text-foreground font-mono text-[11px] transition-colors'
        >
          {project.key}
        </Link>
      </div>

      {/* Name */}
      <Link
        href={`/${orgSlug}/projects/${project.key}`}
        onClick={e => {
          if (isDragging) e.preventDefault();
        }}
        className='hover:text-primary transition-colors'
      >
        <p className='line-clamp-2 text-sm leading-snug font-medium'>
          {project.name}
        </p>
      </Link>

      {project.description && (
        <p className='text-muted-foreground mt-1 line-clamp-2 text-xs'>
          {project.description}
        </p>
      )}

      {/* Bottom row: lead + date */}
      <div className='mt-2 flex items-center justify-between'>
        {onLeadChange ? (
          <div onClick={e => e.stopPropagation()}>
            <ProjectLeadSelector
              orgSlug={orgSlug}
              projectKey={project.key}
              selectedLead={project.leadId || ''}
              onLeadSelect={leadId => onLeadChange(project.id, leadId)}
              displayMode='iconOnly'
              className='border-none bg-transparent p-0 shadow-none'
            />
          </div>
        ) : project.leadName ? (
          <UserAvatar
            name={project.leadName}
            email={project.leadEmail}
            image={project.leadImage}
            size='sm'
            className='size-5'
          />
        ) : (
          <div />
        )}

        <span className='text-muted-foreground text-[11px]'>
          {formatDateHuman(project.updatedAt)}
        </span>
      </div>
    </div>
  );
}
