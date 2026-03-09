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
import {
  FileText,
  Trash2,
  ArrowLeft,
  Pencil,
  MoreHorizontal,
} from 'lucide-react';
import { DynamicIcon } from '@/lib/dynamic-icons';
import { PageSkeleton } from '@/components/ui/table-skeleton';
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
  folder: { _id: string; name: string; description?: string; color?: string };
  onClose: () => void;
}) {
  const [name, setName] = useState(folder.name);
  const [description, setDescription] = useState(folder.description || '');
  const [color, setColor] = useState(folder.color || FOLDER_COLORS[0]);
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
            <Input
              placeholder='Folder name'
              value={name}
              onChange={e => setName(e.target.value)}
              autoFocus
            />
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
      <PageSkeleton
        showTabs={true}
        tabCount={1}
        showCreateButton={true}
        tableRows={8}
        tableColumns={3}
      />
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
      <PageSkeleton
        showTabs={true}
        tabCount={1}
        showCreateButton={true}
        tableRows={8}
        tableColumns={3}
      />
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
    <div className='bg-background h-full overflow-y-auto'>
      <ConfirmDeleteDialog />
      {editing && (
        <EditFolderDialog
          folder={{
            _id: folder._id,
            name: folder.name,
            description: folder.description,
            color: folder.color,
          }}
          onClose={() => setEditing(false)}
        />
      )}

      {/* Header */}
      <div className='border-b'>
        <div className='flex items-center justify-between p-1'>
          <div className='flex items-center gap-1'>
            <MobileNavTrigger />
            <Link href={`/${orgSlug}/documents`}>
              <Button
                variant='ghost'
                size='sm'
                className='h-6 gap-1 px-2 text-xs'
              >
                <ArrowLeft className='size-3' />
                Documents
              </Button>
            </Link>
            <span
              className='inline-block size-2 rounded-full'
              style={{ backgroundColor: folder.color || '#6b7280' }}
            />
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
    </div>
  );
}
