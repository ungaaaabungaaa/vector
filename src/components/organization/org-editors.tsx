'use client';

import { useState, useEffect, useRef } from 'react';
import { useMutation, useQuery } from 'convex/react';
import { api } from '@/lib/convex';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Edit, Check, X, Loader2, AlertCircle } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

// Get the current origin from the browser
const getUrlOrigin = () => {
  if (typeof window !== 'undefined') {
    return window.location.origin;
  }
  return 'localhost:3000'; // fallback for SSR
};

interface EditorProps {
  orgSlug: string;
  initialValue: string;
}

// Edit organization NAME
export function OrgNameEditor({ orgSlug, initialValue }: EditorProps) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(initialValue);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();

  const mutation = useMutation(api.organizations.mutations.update);

  // Reset value when editing starts
  useEffect(() => {
    if (editing) {
      setValue(initialValue);
      setError(null);
      // Focus input after render
      setTimeout(() => inputRef.current?.focus(), 0);
    }
  }, [editing, initialValue]);

  const save = async () => {
    if (!value.trim()) {
      setError('Organization name cannot be empty');
      return;
    }

    try {
      setIsLoading(true);
      await mutation({
        orgSlug,
        data: { name: value.trim() },
      });
      setEditing(false);
      setError(null);
      router.refresh();
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error
          ? error.message
          : 'Failed to update organization name';
      setError(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  const cancel = () => {
    setValue(initialValue);
    setEditing(false);
    setError(null);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      void save();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      cancel();
    }
  };

  return (
    <div className='flex items-center gap-2'>
      {editing ? (
        <>
          <div className='flex-1'>
            <Input
              ref={inputRef}
              value={value}
              onChange={e => setValue(e.target.value)}
              onKeyDown={handleKeyDown}
              className={cn(
                'h-9',
                error && 'border-red-500 focus-visible:ring-red-500',
              )}
            />
            {error && (
              <div className='mt-1 flex items-center gap-1 text-xs text-red-600'>
                <AlertCircle className='h-3 w-3' />
                {error}
              </div>
            )}
          </div>
          <Button
            size='sm'
            onClick={save}
            disabled={isLoading}
            className='h-9 w-9 p-0'
          >
            {isLoading ? (
              <Loader2 className='h-4 w-4 animate-spin' />
            ) : (
              <Check className='h-4 w-4' />
            )}
          </Button>
          <Button
            size='sm'
            variant='ghost'
            onClick={cancel}
            disabled={
              !value.trim() || isLoading || value.trim() === initialValue
            }
            className='h-9 w-9 p-0'
          >
            {isLoading ? (
              <Loader2 className='h-4 w-4 animate-spin' />
            ) : (
              <X className='h-4 w-4' />
            )}
          </Button>
          <Button
            size='sm'
            variant='ghost'
            onClick={cancel}
            disabled={isLoading}
            className='h-9 w-9 p-0'
          >
            <X className='h-4 w-4' />
          </Button>
        </>
      ) : (
        <>
          <span className='flex-1 font-medium'>{initialValue}</span>
          <Button
            size='sm'
            variant='ghost'
            onClick={() => setEditing(true)}
            className='h-9 w-9 p-0'
          >
            <Edit className='h-4 w-4' />
          </Button>
        </>
      )}
    </div>
  );
}

// Edit organization SLUG
export function OrgSlugEditor({ orgSlug, initialValue }: EditorProps) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(initialValue);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();

  const mutation = useMutation(api.organizations.mutations.update);

  // Reset value when editing starts
  useEffect(() => {
    if (editing) {
      setValue(initialValue);
      setError(null);
      // Focus input after render
      setTimeout(() => inputRef.current?.focus(), 0);
    }
  }, [editing, initialValue]);

  const validateSlug = (slug: string): string | null => {
    if (!slug.trim()) return 'Slug cannot be empty';
    if (!/^[a-z0-9-]+$/.test(slug)) {
      return 'Slug can only contain lowercase letters, numbers, and hyphens';
    }
    if (slug.startsWith('-') || slug.endsWith('-')) {
      return 'Slug cannot start or end with a hyphen';
    }
    if (slug.includes('--')) {
      return 'Slug cannot contain consecutive hyphens';
    }
    return null;
  };

  const handleSave = async () => {
    const trimmedValue = value.trim();
    const validationError = validateSlug(trimmedValue);

    if (validationError) {
      setError(validationError);
      return;
    }

    if (trimmedValue === initialValue) {
      setEditing(false);
      return;
    }

    try {
      setIsLoading(true);
      const result = await mutation({ orgSlug, data: { slug: trimmedValue } });
      setEditing(false);
      setError(null);
      if (result?.success && trimmedValue !== orgSlug) {
        // Redirect to new slug path
        router.push(`/${trimmedValue}/settings`);
      } else {
        router.refresh();
      }
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error
          ? error.message
          : 'Failed to update organization slug';
      setError(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  const handleCancel = () => {
    setValue(initialValue);
    setError(null);
    setEditing(false);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let newValue = e.target.value.toLowerCase();
    // Auto-format: remove invalid characters and clean up hyphens
    newValue = newValue.replace(/[^a-z0-9-]/g, '').replace(/--+/g, '-');

    setValue(newValue);
    if (error) setError(null);
  };

  const urlOrigin = getUrlOrigin();

  if (!editing) {
    return (
      <div
        className='group bg-muted/30 hover:bg-muted/50 flex cursor-pointer items-center justify-between rounded-md border px-3 py-2 transition-colors'
        onClick={() => setEditing(true)}
        title='Click to edit'
      >
        <span className='truncate font-mono text-sm' title={initialValue}>
          {initialValue}
        </span>
      </div>
    );
  }

  return (
    <div className='space-y-2'>
      <div className='flex items-center gap-2'>
        <div className='bg-background flex items-center rounded-md border'>
          <span className='text-muted-foreground px-3 py-2 pr-0 text-sm'>
            {urlOrigin}/
          </span>
          <Input
            ref={inputRef}
            value={value}
            onChange={handleInputChange}
            className={cn(
              'h-9 border-0 pl-1 font-mono shadow-none focus-visible:ring-0',
              error && 'text-destructive',
            )}
            onKeyDown={e => {
              if (e.key === 'Enter') {
                e.preventDefault();
                void handleSave();
              } else if (e.key === 'Escape') {
                e.preventDefault();
                handleCancel();
              }
            }}
            disabled={isLoading}
            placeholder='my-org'
          />
        </div>
        <Button
          variant='default'
          size='sm'
          onClick={handleSave}
          disabled={!value.trim() || isLoading || value.trim() === initialValue}
          className='h-9 shrink-0'
        >
          {isLoading ? (
            <Loader2 className='size-3 animate-spin' />
          ) : (
            <Check className='size-3' />
          )}
        </Button>
        <Button
          variant='outline'
          size='sm'
          onClick={handleCancel}
          disabled={isLoading}
          className='h-9 shrink-0'
        >
          <X className='size-3' />
        </Button>
      </div>
      {error && (
        <div className='text-destructive flex items-center gap-1 text-xs'>
          <AlertCircle className='size-3' />
          {error}
        </div>
      )}
      {!error && value && value !== initialValue && (
        <div className='text-muted-foreground text-xs'>
          URL will be: {urlOrigin}/{value}
        </div>
      )}
    </div>
  );
}

// ------------------------------------------------------------------
//  Organization LOGO editor
// ------------------------------------------------------------------

interface LogoEditorProps {
  orgSlug: string;
  initialValue?: string | null;
}

export function OrgLogoEditor({ orgSlug, initialValue }: LogoEditorProps) {
  const [logoKey, setLogoKey] = useState<string | null>(initialValue ?? null);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const generateUploadUrl = useMutation(
    api.organizations.mutations.generateLogoUploadUrl,
  );
  const updateLogoWithStorageId = useMutation(
    api.organizations.mutations.updateLogoWithStorageId,
  );
  const getLogoUrl = useQuery(api.organizations.queries.getLogoUrl, {
    orgSlug,
  });

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      setUploading(true);

      // Step 1: Generate upload URL using Convex
      const uploadUrl = await generateUploadUrl({ orgSlug });

      // Step 2: Upload the file directly to Convex storage
      const uploadRes = await fetch(uploadUrl, {
        method: 'POST',
        headers: { 'Content-Type': file.type },
        body: file,
      });

      if (!uploadRes.ok) {
        throw new Error('Upload failed');
      }

      const { storageId } = await uploadRes.json();

      // Step 3: Update organization with storage ID
      await updateLogoWithStorageId({
        orgSlug,
        storageId,
      });

      setLogoKey(storageId);
    } catch (err) {
      console.error(err);
      toast.error((err as Error)?.message || 'Upload failed');
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = '';
      setUploading(false);
    }
  };

  return (
    <div className='flex items-center gap-4'>
      {/* Avatar preview */}
      {getLogoUrl ? (
        <img
          src={getLogoUrl}
          alt='Organization logo'
          className='size-16 rounded border object-cover'
        />
      ) : (
        <div className='bg-muted text-muted-foreground flex size-16 items-center justify-center rounded border text-sm'>
          No logo
        </div>
      )}

      {/* File input & button */}
      <div>
        <Button
          variant='outline'
          size='sm'
          disabled={uploading}
          onClick={() => fileInputRef.current?.click()}
        >
          {uploading ? (
            <Loader2 className='size-4 animate-spin' />
          ) : (
            <Edit className='size-4' />
          )}
          <span className='ml-2'>{logoKey ? 'Change' : 'Upload'}</span>
        </Button>
        <input
          ref={fileInputRef}
          type='file'
          accept='image/*'
          className='hidden'
          onChange={handleFileChange}
        />
      </div>
    </div>
  );
}
