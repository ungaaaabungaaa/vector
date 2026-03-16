'use client';

import { useEffect, useRef, useState, type ChangeEvent } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { useQuery, useMutation } from 'convex/react';
import { api } from '@/lib/convex';
import { authClient } from '@/lib/auth-client';
import { Button } from '@/components/ui/button';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { useFormSubmission } from '@/hooks/use-error-handling';
import { Skeleton } from '@/components/ui/skeleton';
import { UserAvatar } from '@/components/user-avatar';
import { Github } from 'lucide-react';
import { toast } from 'sonner';

const profileFormSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters.'),
});

type ProfileFormValues = z.infer<typeof profileFormSchema>;

export function ProfileForm() {
  const user = useQuery(api.users.currentUser);
  const updateProfile = useMutation(api.users.updateProfile);
  const generateProfileImageUploadUrl = useMutation(
    api.users.generateProfileImageUploadUrl,
  );
  const updateProfileImage = useMutation(api.users.updateProfileImage);
  const removeProfileImage = useMutation(api.users.removeProfileImage);
  const [isUploadingImage, setIsUploadingImage] = useState(false);
  const [isRemovingImage, setIsRemovingImage] = useState(false);
  const [previewImage, setPreviewImage] = useState<string | null | undefined>();
  const previewUrlRef = useRef<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { submit, isSubmitting, error } = useFormSubmission(updateProfile, {
    context: 'Profile update',
    successMessage: 'Profile updated successfully',
  });

  const form = useForm<ProfileFormValues>({
    resolver: zodResolver(profileFormSchema),
    values: {
      name: user?.name ?? '',
    },
    mode: 'onChange',
  });

  async function onSubmit(data: ProfileFormValues) {
    await submit(data);
  }

  useEffect(() => {
    return () => {
      if (previewUrlRef.current?.startsWith('blob:')) {
        URL.revokeObjectURL(previewUrlRef.current);
      }
    };
  }, []);

  async function handleImageChange(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) {
      return;
    }

    if (!file.type.startsWith('image/')) {
      toast.error('Choose an image file');
      e.target.value = '';
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      toast.error('Profile images must be 5 MB or smaller');
      e.target.value = '';
      return;
    }

    const objectUrl = URL.createObjectURL(file);
    if (previewUrlRef.current?.startsWith('blob:')) {
      URL.revokeObjectURL(previewUrlRef.current);
    }
    previewUrlRef.current = objectUrl;
    setPreviewImage(objectUrl);

    try {
      setIsUploadingImage(true);

      const uploadUrl = await generateProfileImageUploadUrl({});
      const uploadRes = await fetch(uploadUrl, {
        method: 'POST',
        headers: { 'Content-Type': file.type },
        body: file,
      });

      if (!uploadRes.ok) {
        throw new Error('Upload failed');
      }

      const { storageId } = await uploadRes.json();
      const result = await updateProfileImage({ storageId });

      if (previewUrlRef.current?.startsWith('blob:')) {
        URL.revokeObjectURL(previewUrlRef.current);
      }

      previewUrlRef.current = result.imageUrl;
      setPreviewImage(result.imageUrl);
    } catch (err) {
      if (previewUrlRef.current?.startsWith('blob:')) {
        URL.revokeObjectURL(previewUrlRef.current);
      }

      previewUrlRef.current = user?.image ?? null;
      setPreviewImage(undefined);
      toast.error((err as Error)?.message || 'Failed to upload profile image');
    } finally {
      e.target.value = '';
      setIsUploadingImage(false);
    }
  }

  async function handleRemoveImage() {
    try {
      setIsRemovingImage(true);
      await removeProfileImage({});

      if (previewUrlRef.current?.startsWith('blob:')) {
        URL.revokeObjectURL(previewUrlRef.current);
      }

      previewUrlRef.current = null;
      setPreviewImage(null);
    } catch (err) {
      toast.error((err as Error)?.message || 'Failed to remove profile image');
    } finally {
      setIsRemovingImage(false);
    }
  }

  if (!user) {
    return (
      <div className='space-y-6'>
        <div className='flex items-start gap-3 rounded-lg border p-3'>
          <Skeleton className='size-14 rounded-full' />
          <div className='min-w-0 flex-1 space-y-2'>
            <Skeleton className='h-4 w-20' />
            <Skeleton className='h-3 w-64' />
            <div className='flex gap-2'>
              <Skeleton className='h-8 w-24' />
              <Skeleton className='h-8 w-16' />
            </div>
          </div>
        </div>
        <div className='grid gap-6 sm:grid-cols-2'>
          <div className='space-y-2'>
            <Skeleton className='h-4 w-20' />
            <Skeleton className='h-10 w-full' />
            <Skeleton className='h-3 w-56' />
          </div>
        </div>
        <Skeleton className='h-9 w-28' />
      </div>
    );
  }

  const displayedImage =
    previewImage === undefined ? (user.image ?? null) : previewImage;
  const hasProfileImage =
    previewImage === undefined ? Boolean(user.image) : Boolean(previewImage);

  return (
    <div className='space-y-8'>
      <div className='flex items-start gap-3 rounded-lg border p-3'>
        <UserAvatar
          name={user.name}
          email={user.email}
          image={displayedImage}
          userId={user._id}
          size='lg'
          className='size-14'
        />
        <div className='min-w-0 flex-1'>
          <div className='text-sm font-medium'>Profile photo</div>
          <p className='text-muted-foreground mt-1 text-xs'>
            Upload an image or keep the generated avatar based on your email.
          </p>
          <div className='mt-3 flex flex-wrap items-center gap-2'>
            <Button
              type='button'
              variant='outline'
              size='sm'
              disabled={isUploadingImage}
              onClick={() => fileInputRef.current?.click()}
            >
              {isUploadingImage
                ? 'Uploading photo'
                : hasProfileImage
                  ? 'Change photo'
                  : 'Upload photo'}
            </Button>
            {hasProfileImage && (
              <Button
                type='button'
                variant='ghost'
                size='sm'
                disabled={isRemovingImage}
                onClick={handleRemoveImage}
              >
                {isRemovingImage ? 'Removing photo' : 'Remove photo'}
              </Button>
            )}
          </div>
          <input
            ref={fileInputRef}
            type='file'
            accept='image/*'
            className='hidden'
            onChange={handleImageChange}
          />
        </div>
      </div>

      <div className='grid gap-6 sm:grid-cols-2'>
        <div className='space-y-2'>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className='space-y-6'>
              <FormField
                control={form.control}
                name='name'
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className='text-sm font-medium'>
                      Full Name
                    </FormLabel>
                    <FormControl>
                      <Input placeholder='Your full name' {...field} />
                    </FormControl>
                    <FormMessage />
                    <p className='text-muted-foreground text-xs'>
                      This is how your name will appear to other users
                    </p>
                  </FormItem>
                )}
              />
              {error && (
                <div className='text-destructive text-sm'>
                  {error.userMessage}
                </div>
              )}
              <Button type='submit' disabled={isSubmitting}>
                {isSubmitting ? 'Updating...' : 'Update Profile'}
              </Button>
            </form>
          </Form>
        </div>
      </div>

      <GitHubConnectionSection />
    </div>
  );
}

function GitHubConnectionSection() {
  const githubConnection = useQuery(api.users.getGitHubConnection);
  const unlinkGitHub = useMutation(api.users.unlinkGitHubIdentity);
  const [isLinking, setIsLinking] = useState(false);
  const [isUnlinking, setIsUnlinking] = useState(false);

  const handleConnect = async () => {
    setIsLinking(true);
    try {
      await authClient.signIn.social({
        provider: 'github',
        callbackURL: '/settings/profile',
      });
    } catch {
      toast.error('Failed to start GitHub connection');
      setIsLinking(false);
    }
  };

  const handleDisconnect = async () => {
    setIsUnlinking(true);
    try {
      await unlinkGitHub({});
      toast.success('GitHub account disconnected');
    } catch {
      toast.error('Failed to disconnect GitHub');
    } finally {
      setIsUnlinking(false);
    }
  };

  if (githubConnection === undefined) {
    return (
      <div className='space-y-3'>
        <div className='text-sm font-medium'>Connected Accounts</div>
        <div className='flex items-center gap-3 rounded-lg border p-3'>
          <Skeleton className='size-8 rounded' />
          <Skeleton className='h-4 w-32' />
        </div>
      </div>
    );
  }

  return (
    <div className='space-y-3'>
      <div className='text-sm font-medium'>Connected Accounts</div>
      <div className='flex items-center justify-between rounded-lg border p-3'>
        <div className='flex items-center gap-3'>
          <div className='bg-secondary flex size-8 items-center justify-center rounded'>
            <Github className='size-4' />
          </div>
          <div>
            <div className='text-sm font-medium'>GitHub</div>
            {githubConnection?.connected ? (
              <p className='text-muted-foreground text-xs'>
                @{githubConnection.githubUsername}
              </p>
            ) : (
              <p className='text-muted-foreground text-xs'>
                Connect to auto-assign issues from PRs
              </p>
            )}
          </div>
        </div>
        {githubConnection?.connected ? (
          <Button
            variant='ghost'
            size='sm'
            disabled={isUnlinking}
            onClick={handleDisconnect}
          >
            {isUnlinking ? 'Disconnecting...' : 'Disconnect'}
          </Button>
        ) : (
          <Button
            variant='outline'
            size='sm'
            disabled={isLinking}
            onClick={handleConnect}
          >
            <Github className='mr-1.5 size-3.5' />
            {isLinking ? 'Connecting...' : 'Connect'}
          </Button>
        )}
      </div>
    </div>
  );
}
