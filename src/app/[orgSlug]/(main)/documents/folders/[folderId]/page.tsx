'use client';

import React, { useState, useEffect } from 'react';
import { useQuery, useMutation } from 'convex/react';
import { api } from '@/convex/_generated/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { MobileNavTrigger } from '../../../layout';
import { CreateDocumentDialog } from '@/components/documents/create-document-dialog';
import { ScopedPermissionGate } from '@/hooks/use-permissions';
import { PERMISSIONS } from '@/convex/_shared/permissions';
import { formatDateHuman } from '@/lib/date';
import Link from 'next/link';
import { FileText, Trash2, Pencil, MoreHorizontal, Smile } from 'lucide-react';
import { DynamicIcon } from '@/lib/dynamic-icons';
import { IconPicker } from '@/components/ui/icon-picker';
import { Skeleton } from '@/components/ui/skeleton';
import { useConfirm } from '@/hooks/use-confirm';
import { toast } from 'sonner';
import type { Id } from '@/convex/_generated/dataModel';
import {
  PerspectiveBook,
  BookTitle,
  BookDescription,
} from '@/components/perspective-book';
import {
  ResponsiveDialog,
  ResponsiveDialogContent,
  ResponsiveDialogHeader,
  ResponsiveDialogTitle,
} from '@/components/ui/responsive-dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { ScrollArea } from '@/components/ui/scroll-area';

// ---------------------------------------------------------------------------
// Folder colors
// ---------------------------------------------------------------------------
const FOLDER_COLORS = [
  '#6366f1',
  '#8b5cf6',
  '#ec4899',
  '#f43f5e',
  '#f97316',
  '#eab308',
  '#22c55e',
  '#06b6d4',
  '#3b82f6',
  '#6b7280',
];

// ---------------------------------------------------------------------------
// Edit Folder Dialog
// ---------------------------------------------------------------------------
function EditFolderDialog({
  folder,
  onClose,
}: {
  folder: {
    _id: string;
    name: string;
    description?: string;
    color?: string;
    icon?: string;
  };
  onClose: () => void;
}) {
  const [name, setName] = useState(folder.name);
  const [description, setDescription] = useState(folder.description || '');
  const [color, setColor] = useState(folder.color || FOLDER_COLORS[0]);
  const [icon, setIcon] = useState<string | null>(folder.icon || null);
  const [isLoading, setIsLoading] = useState(false);
  const updateMutation = useMutation(
    api.documents.folderMutations.updateFolder,
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    setIsLoading(true);
    try {
      await updateMutation({
        folderId: folder._id as Id<'documentFolders'>,
        data: {
          name: name.trim(),
          description: description.trim() || null,
          color,
          icon: icon || null,
        },
      });
      toast.success('Folder updated');
      onClose();
    } catch {
      toast.error('Failed to update folder');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <ResponsiveDialog open onOpenChange={open => !open && onClose()}>
      <ResponsiveDialogContent className='sm:max-w-md'>
        <ResponsiveDialogHeader>
          <ResponsiveDialogTitle>Edit folder</ResponsiveDialogTitle>
        </ResponsiveDialogHeader>
        <form onSubmit={handleSubmit} className='space-y-4'>
          <div className='space-y-2'>
            <div className='flex items-center gap-2'>
              <IconPicker
                value={icon}
                onValueChange={setIcon}
                trigger={
                  <button
                    type='button'
                    className='border-border hover:bg-muted flex size-9 shrink-0 items-center justify-center rounded-md border transition-colors'
                  >
                    {icon ? (
                      <DynamicIcon
                        name={icon}
                        className='size-4'
                        style={{ color: color }}
                      />
                    ) : (
                      <Smile className='text-muted-foreground/50 size-4' />
                    )}
                  </button>
                }
              />
              <Input
                placeholder='Folder name'
                value={name}
                onChange={e => setName(e.target.value)}
                autoFocus
              />
            </div>
            <Input
              placeholder='Description (optional)'
              value={description}
              onChange={e => setDescription(e.target.value)}
            />
          </div>
          <div className='flex flex-wrap gap-2'>
            {FOLDER_COLORS.map(c => (
              <button
                key={c}
                type='button'
                className='size-6 rounded-full border-2 transition-transform hover:scale-110'
                style={{
                  backgroundColor: c,
                  borderColor: color === c ? 'white' : 'transparent',
                  boxShadow: color === c ? `0 0 0 2px ${c}` : 'none',
                }}
                onClick={() => setColor(c)}
              />
            ))}
          </div>
          <div className='flex justify-end gap-2'>
            <Button type='button' variant='ghost' size='sm' onClick={onClose}>
              Cancel
            </Button>
            <Button
              type='submit'
              size='sm'
              disabled={!name.trim() || isLoading}
            >
              {isLoading ? 'Saving...' : 'Save'}
            </Button>
          </div>
        </form>
      </ResponsiveDialogContent>
    </ResponsiveDialog>
  );
}

// ---------------------------------------------------------------------------
// Folder Detail Page
// ---------------------------------------------------------------------------

interface FolderDetailPageProps {
  params: Promise<{ orgSlug: string; folderId: string }>;
}

export default function FolderDetailPage({ params }: FolderDetailPageProps) {
  const [resolvedParams, setResolvedParams] = useState<{
    orgSlug: string;
    folderId: string;
  } | null>(null);

  useEffect(() => {
    void params.then(setResolvedParams);
  }, [params]);

  if (!resolvedParams) {
    return (
      <div className='bg-background h-full'>
        <div className='border-b'>
          <div className='flex items-center justify-between p-1'>
            <div className='flex items-center gap-1'>
              <Skeleton className='h-6 w-20' />
              <Skeleton className='size-2 rounded-full' />
              <Skeleton className='h-4 w-24' />
            </div>
            <Skeleton className='h-6 w-24' />
          </div>
        </div>
        <div className='border-b px-4 py-6'>
          <div className='flex items-start gap-6'>
            <Skeleton className='h-24 w-20 rounded-lg' />
            <div className='flex-1 space-y-2 pt-2'>
              <Skeleton className='h-6 w-1/3' />
              <Skeleton className='h-4 w-2/3' />
            </div>
          </div>
        </div>
        <div className='divide-y'>
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className='flex items-center gap-2 px-3 py-2'>
              <Skeleton className='size-4 rounded' />
              <div className='min-w-0 flex-1 space-y-1'>
                <Skeleton className='h-4 w-1/3' />
                <Skeleton className='h-3 w-1/2' />
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return <FolderContent {...resolvedParams} />;
}

function FolderContent({
  orgSlug,
  folderId,
}: {
  orgSlug: string;
  folderId: string;
}) {
  const [editing, setEditing] = useState(false);
  const [confirmDelete, ConfirmDeleteDialog] = useConfirm();

  const folders = useQuery(api.documents.folderQueries.listFolders, {
    orgSlug,
  });
  const folder = folders?.find(f => f._id === folderId);

  const documents = useQuery(api.documents.queries.list, {
    orgSlug,
    folderId: folderId as Id<'documentFolders'>,
  });

  const removeMutation = useMutation(api.documents.mutations.remove);
  const updateDocMutation = useMutation(api.documents.mutations.update);
  const removeFolderMutation = useMutation(
    api.documents.folderMutations.removeFolder,
  );

  if (documents === undefined || folders === undefined) {
    return (
      <div className='bg-background h-full'>
        <div className='border-b'>
          <div className='flex items-center justify-between p-1'>
            <div className='flex items-center gap-1'>
              <Skeleton className='h-6 w-20' />
              <Skeleton className='size-2 rounded-full' />
              <Skeleton className='h-4 w-24' />
            </div>
            <Skeleton className='h-6 w-24' />
          </div>
        </div>
        <div className='border-b px-4 py-6'>
          <div className='flex items-start gap-6'>
            <Skeleton className='h-24 w-20 rounded-lg' />
            <div className='flex-1 space-y-2 pt-2'>
              <Skeleton className='h-6 w-1/3' />
              <Skeleton className='h-4 w-2/3' />
            </div>
          </div>
        </div>
        <div className='divide-y'>
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className='flex items-center gap-2 px-3 py-2'>
              <Skeleton className='size-4 rounded' />
              <div className='min-w-0 flex-1 space-y-1'>
                <Skeleton className='h-4 w-1/3' />
                <Skeleton className='h-3 w-1/2' />
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (!folder) {
    return (
      <div className='flex h-full items-center justify-center'>
        <div className='text-center'>
          <FileText className='text-muted-foreground mx-auto mb-4 size-12' />
          <h2 className='text-lg font-medium'>Folder not found</h2>
          <Link
            href={`/${orgSlug}/documents`}
            className='text-primary mt-2 inline-block text-sm hover:underline'
          >
            Back to documents
          </Link>
        </div>
      </div>
    );
  }

  const handleDeleteDoc = async (documentId: string) => {
    const confirmed = await confirmDelete({
      title: 'Delete document',
      description:
        'Are you sure you want to delete this document? This action cannot be undone.',
    });
    if (!confirmed) return;
    try {
      await removeMutation({ documentId: documentId as Id<'documents'> });
      toast.success('Document deleted');
    } catch {
      toast.error('Failed to delete document');
    }
  };

  const handleRemoveFromFolder = (docId: string) => {
    void updateDocMutation({
      documentId: docId as Id<'documents'>,
      data: { folderId: null },
    });
    toast.success('Removed from folder');
  };

  const handleDeleteFolder = async () => {
    const confirmed = await confirmDelete({
      title: 'Delete folder',
      description:
        'Documents inside will be moved out, not deleted. This cannot be undone.',
    });
    if (!confirmed) return;
    try {
      await removeFolderMutation({
        folderId: folderId as Id<'documentFolders'>,
      });
      toast.success('Folder deleted');
      window.location.href = `/${orgSlug}/documents`;
    } catch {
      toast.error('Failed to delete folder');
    }
  };

  return (
    <ScrollArea
      className='bg-background h-full'
      viewportClassName='overscroll-contain'
      maskHeight={0}
    >
      <ConfirmDeleteDialog />
      {editing && (
        <EditFolderDialog
          folder={{
            _id: folder._id,
            name: folder.name,
            description: folder.description,
            color: folder.color,
            icon: folder.icon,
          }}
          onClose={() => setEditing(false)}
        />
      )}

      {/* Header */}
      <div className='border-b'>
        <div className='flex items-center justify-between p-1'>
          <div className='flex items-center gap-1'>
            <MobileNavTrigger />
            <Link
              href={`/${orgSlug}/documents`}
              className='text-muted-foreground hover:text-foreground text-xs transition-colors'
            >
              Documents
            </Link>
            {folder.icon ? (
              <DynamicIcon
                name={folder.icon}
                className='size-3'
                style={{ color: folder.color || '#6b7280' }}
              />
            ) : (
              <span
                className='inline-block size-2 rounded-full'
                style={{ backgroundColor: folder.color || '#6b7280' }}
              />
            )}
            <span className='text-sm font-medium'>{folder.name}</span>
            <span className='text-muted-foreground text-xs'>
              {documents.length}
            </span>
          </div>
          <div className='flex items-center gap-1'>
            <ScopedPermissionGate
              scope={{ orgSlug }}
              permission={PERMISSIONS.DOCUMENT_CREATE}
            >
              <CreateDocumentDialog
                orgSlug={orgSlug}
                onDocumentCreated={() => {}}
                className='h-6'
                defaultStates={{ folderId }}
              />
            </ScopedPermissionGate>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant='ghost' size='sm' className='h-6 w-6 p-0'>
                  <MoreHorizontal className='size-3.5' />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align='end'>
                <DropdownMenuItem onClick={() => setEditing(true)}>
                  <Pencil className='size-4' />
                  Edit folder
                </DropdownMenuItem>
                <DropdownMenuItem
                  variant='destructive'
                  onClick={handleDeleteFolder}
                >
                  <Trash2 className='size-4' />
                  Delete folder
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </div>

      {/* Folder book hero */}
      <div className='border-b px-4 py-6'>
        <div className='flex items-start gap-6'>
          <PerspectiveBook size='sm' className='text-white'>
            <div
              className='absolute inset-0 rounded-[inherit]'
              style={{ backgroundColor: folder.color || '#6366f1' }}
            />
            <div className='relative z-10'>
              {folder.icon ? (
                <DynamicIcon
                  name={folder.icon}
                  className='mb-1 size-4 opacity-80'
                />
              ) : null}
              <BookTitle className='text-sm'>{folder.name}</BookTitle>
              {folder.description && (
                <BookDescription>{folder.description}</BookDescription>
              )}
              <p className='mt-1 text-[10px] opacity-60'>
                {documents.length} {documents.length === 1 ? 'doc' : 'docs'}
              </p>
            </div>
          </PerspectiveBook>
          <div className='flex min-w-0 flex-1 flex-col gap-1 pt-2'>
            <h1 className='text-xl font-semibold'>{folder.name}</h1>
            {folder.description && (
              <p className='text-muted-foreground text-sm'>
                {folder.description}
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Document list */}
      {documents.length === 0 ? (
        <div className='text-muted-foreground px-3 py-8 text-center text-sm'>
          No documents in this folder yet.
        </div>
      ) : (
        <div className='divide-y'>
          {documents.map(doc => (
            <div
              key={doc._id}
              className='hover:bg-muted/50 flex items-center gap-2 px-3 py-2 transition-colors'
            >
              {doc.icon ? (
                <DynamicIcon
                  name={doc.icon}
                  fallback={FileText}
                  className='size-4 flex-shrink-0'
                  style={{ color: doc.color || undefined }}
                />
              ) : (
                <FileText className='text-muted-foreground size-4 flex-shrink-0' />
              )}
              <Link
                href={`/${orgSlug}/documents/${doc._id}`}
                className='min-w-0 flex-1'
              >
                <div className='truncate text-sm font-medium'>{doc.title}</div>
                <div className='text-muted-foreground truncate text-xs'>
                  {[
                    doc.team?.name,
                    doc.project?.name,
                    doc.author?.name || doc.author?.email,
                    formatDateHuman(
                      new Date(doc.lastEditedAt || doc._creationTime),
                    ),
                  ]
                    .filter(Boolean)
                    .join(' · ')}
                </div>
              </Link>
              <div>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant='ghost'
                      size='sm'
                      className='text-muted-foreground h-7 w-7 flex-shrink-0 p-0'
                    >
                      <MoreHorizontal className='size-3.5' />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align='end' className='w-48'>
                    <DropdownMenuItem
                      onClick={() => handleRemoveFromFolder(doc._id)}
                    >
                      Remove from folder
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      variant='destructive'
                      onClick={() => handleDeleteDoc(doc._id)}
                    >
                      <Trash2 className='size-4' />
                      Delete
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </div>
          ))}
        </div>
      )}
    </ScrollArea>
  );
}
