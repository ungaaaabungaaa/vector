'use client';

import { useEffect, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Github, Menu, Shield } from 'lucide-react';
import { useAction, useQuery, api } from '@/lib/convex';
import { UserMenu } from '@/components/user-menu';
import { PlatformAdminSidebar } from './platform-admin-sidebar';
import { Sheet, SheetContent, SheetTitle } from '@/components/ui/sheet';
import { Skeleton } from '@/components/ui/skeleton';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { BarsSpinner } from '@/components/bars-spinner';

const PLATFORM_ADMIN_ROLE = 'platform_admin';

function IntegrationsPageSkeleton() {
  return (
    <div className='bg-secondary flex h-screen'>
      <aside className='hidden w-56 lg:block'>
        <div className='flex h-full flex-col'>
          <div className='flex-1 overflow-y-auto'>
            <div className='space-y-4 p-2 pt-0'>
              <Skeleton className='h-8 w-full rounded-md' />
              <div className='space-y-2'>
                <Skeleton className='h-4 w-28' />
                <Skeleton className='h-8 w-full rounded-md' />
                <Skeleton className='h-8 w-full rounded-md' />
                <Skeleton className='h-8 w-full rounded-md' />
              </div>
            </div>
          </div>
          <div className='border-border border-t p-2'>
            <div className='flex items-center gap-2 p-2'>
              <Skeleton className='size-8 rounded-full' />
              <Skeleton className='h-4 w-28' />
            </div>
          </div>
        </div>
      </aside>
      <main className='bg-background m-2 ml-0 flex-1 overflow-y-auto rounded-md border'>
        <div className='border-b'>
          <div className='flex items-center p-1 pl-8 lg:pl-1'>
            <Skeleton className='h-5 w-32' />
          </div>
        </div>
        <div className='space-y-4 p-3'>
          <Skeleton className='h-7 w-48' />
          <Skeleton className='h-4 w-80' />
          <Skeleton className='h-40 w-full rounded-md' />
        </div>
      </main>
    </div>
  );
}

export function PlatformIntegrationsPage() {
  const router = useRouter();
  const pathname = usePathname();
  const [isMobileOpen, setIsMobileOpen] = useState(false);

  const userQuery = useQuery(api.users.currentUser);
  const user = userQuery.data;
  const configQuery = useQuery(
    api.platformAdmin.queries.getGitHubAppConfig,
    user?.role === PLATFORM_ADMIN_ROLE ? {} : 'skip',
  );

  const saveCredentials = useAction(
    api.platformAdmin.actions.saveGitHubAppCredentials,
  );

  const [appId, setAppId] = useState('');
  const [privateKey, setPrivateKey] = useState('');
  const [webhookSecret, setWebhookSecret] = useState('');
  const [savingCreds, setSavingCreds] = useState(false);

  // Auth guard
  useEffect(() => {
    if (userQuery.isPending) return;
    if (user === null) {
      router.replace(`/auth/login?redirectTo=${encodeURIComponent(pathname)}`);
      return;
    }
    if (user?.role !== PLATFORM_ADMIN_ROLE) {
      router.replace('/403');
    }
  }, [pathname, router, user, userQuery.isPending]);

  if (
    userQuery.isPending ||
    (user?.role === PLATFORM_ADMIN_ROLE && configQuery.isPending)
  ) {
    return <IntegrationsPageSkeleton />;
  }

  if (userQuery.isError || user?.role !== PLATFORM_ADMIN_ROLE) {
    return null;
  }

  const config = configQuery.data;

  const handleSaveCredentials = async () => {
    setSavingCreds(true);
    try {
      await saveCredentials({
        appId: appId.trim() || undefined,
        privateKey: privateKey.trim() || undefined,
        webhookSecret: webhookSecret.trim() || undefined,
      });
      setPrivateKey('');
      setWebhookSecret('');
      toast.success('GitHub App credentials saved');
    } catch (error) {
      console.error(error);
      toast.error('Failed to save credentials');
    } finally {
      setSavingCreds(false);
    }
  };

  return (
    <div className='bg-secondary flex h-screen'>
      <aside className='hidden w-56 lg:block'>
        <div className='flex h-full flex-col'>
          <div className='flex-1 overflow-y-auto'>
            <PlatformAdminSidebar />
          </div>
          <div className='border-border border-t p-2'>
            <UserMenu />
          </div>
        </div>
      </aside>

      <Sheet open={isMobileOpen} onOpenChange={setIsMobileOpen}>
        <SheetContent
          side='left'
          showCloseButton={false}
          className='bg-secondary w-56 p-0 sm:max-w-56'
        >
          <SheetTitle className='sr-only'>Platform admin navigation</SheetTitle>
          <div className='flex h-full flex-col'>
            <div className='flex-1 overflow-y-auto'>
              <PlatformAdminSidebar />
            </div>
            <div className='border-border border-t p-2'>
              <UserMenu />
            </div>
          </div>
        </SheetContent>
      </Sheet>

      <main className='bg-background relative m-2 ml-0 flex-1 overflow-y-auto rounded-md border'>
        <button
          onClick={() => setIsMobileOpen(true)}
          className='hover:bg-accent/80 absolute top-1.5 left-1.5 z-10 flex size-7 items-center justify-center rounded-md transition-colors lg:hidden'
          aria-label='Open platform admin menu'
        >
          <Menu className='text-muted-foreground size-4' />
        </button>

        <div className='border-b'>
          <div className='flex items-center p-1 pl-8 lg:pl-1'>
            <span className='flex items-center gap-1.5 px-3 text-xs font-medium'>
              <Shield className='size-3.5' />
              Platform Admin
            </span>
          </div>
        </div>

        <div className='space-y-4 p-3'>
          <div className='space-y-1'>
            <h1 className='text-lg font-semibold tracking-tight'>
              Integrations
            </h1>
            <p className='text-muted-foreground text-sm'>
              Platform-level GitHub auth is optional and currently separate from
              the workspace webhook integration flow.
            </p>
          </div>

          {/* WIP: this surface is for platform app credentials only. Workspace
              installation/token ownership lives in each workspace and new
              product flows should not assume platform-level GitHub connectivity. */}
          {/* GitHub App Credentials Card */}
          <div className='rounded-md border'>
            <div className='flex items-center justify-between border-b px-3 py-2'>
              <div className='flex items-center gap-2'>
                <Github className='size-4' />
                <span className='text-sm font-medium'>GitHub App / OAuth</span>
              </div>
              {config?.hasAppId && config?.hasPrivateKey ? (
                <Badge
                  variant='secondary'
                  className='h-5 rounded-md px-1.5 text-[10px]'
                >
                  Configured
                </Badge>
              ) : (
                <Badge
                  variant='outline'
                  className='h-5 rounded-md px-1.5 text-[10px]'
                >
                  Not configured
                </Badge>
              )}
            </div>

            <div className='space-y-3 p-3'>
              <p className='text-muted-foreground text-xs'>
                Optional legacy app credentials. Workspace GitHub delivery now
                lives in each workspace&apos;s webhook settings. Create a GitHub
                App under{' '}
                <span className='text-foreground font-medium'>
                  GitHub &rarr; Settings &rarr; Developer settings &rarr; GitHub
                  Apps
                </span>{' '}
                only if you need platform-level app auth later.
              </p>
              <div className='rounded-md border px-3 py-2 text-xs'>
                <p className='font-medium'>
                  Not required for workspace webhooks
                </p>
                <p className='text-muted-foreground mt-1'>
                  Workspace GitHub setup now uses per-workspace webhook URLs and
                  secrets. This admin surface is reserved for future app/OAuth
                  flows.
                </p>
              </div>

              <div className='grid gap-3'>
                <div className='space-y-1'>
                  <label className='text-xs font-medium'>App ID</label>
                  <Input
                    value={appId}
                    onChange={event => setAppId(event.target.value)}
                    placeholder={
                      config?.hasAppId ? '(configured)' : 'e.g. 123456'
                    }
                    className='h-8'
                    disabled={savingCreds}
                  />
                </div>

                <div className='space-y-1'>
                  <label className='text-xs font-medium'>Private Key</label>
                  <textarea
                    value={privateKey}
                    onChange={event => setPrivateKey(event.target.value)}
                    placeholder={
                      config?.hasPrivateKey
                        ? '(configured — paste to replace)'
                        : '-----BEGIN RSA PRIVATE KEY-----'
                    }
                    className='border-input bg-background h-20 w-full resize-none rounded-md border px-3 py-2 font-mono text-xs'
                    disabled={savingCreds}
                  />
                </div>

                <div className='space-y-1'>
                  <label className='text-xs font-medium'>Webhook Secret</label>
                  <Input
                    type='password'
                    value={webhookSecret}
                    onChange={event => setWebhookSecret(event.target.value)}
                    placeholder={
                      config?.hasWebhookSecret
                        ? '(configured — type to replace)'
                        : 'your-webhook-secret'
                    }
                    className='h-8'
                    disabled={savingCreds}
                  />
                </div>
              </div>

              <div className='flex items-center justify-end'>
                <Button
                  size='sm'
                  variant='outline'
                  disabled={
                    savingCreds ||
                    (!appId.trim() &&
                      !privateKey.trim() &&
                      !webhookSecret.trim())
                  }
                  onClick={() => void handleSaveCredentials()}
                >
                  {savingCreds ? <BarsSpinner size={10} /> : null}
                  Save
                </Button>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
