'use client';

import { useEffect, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Github, KeyRound, Menu, Shield } from 'lucide-react';
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
  const saveConnection = useAction(
    api.platformAdmin.actions.saveGitHubAppConnection,
  );
  const saveToken = useAction(api.platformAdmin.actions.saveGitHubAppToken);
  const removeToken = useAction(api.platformAdmin.actions.removeGitHubAppToken);

  const [appId, setAppId] = useState('');
  const [privateKey, setPrivateKey] = useState('');
  const [webhookSecret, setWebhookSecret] = useState('');
  const [savingCreds, setSavingCreds] = useState(false);
  const [installationId, setInstallationId] = useState('');
  const [accountLogin, setAccountLogin] = useState('');
  const [accountType, setAccountType] = useState('');
  const [token, setToken] = useState('');
  const [savingInstall, setSavingInstall] = useState(false);
  const [savingToken, setSavingToken] = useState(false);
  const [removingToken, setRemovingToken] = useState(false);

  useEffect(() => {
    if (!configQuery.data) return;
    setInstallationId(
      configQuery.data.installationId
        ? String(configQuery.data.installationId)
        : '',
    );
    setAccountLogin(configQuery.data.accountLogin ?? '');
    setAccountType(configQuery.data.accountType ?? '');
  }, [configQuery.data]);

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

  const handleSaveInstallation = async () => {
    const nextInstallationId = Number(installationId);
    if (!Number.isFinite(nextInstallationId) || nextInstallationId <= 0) {
      toast.error('Enter a valid GitHub App installation ID');
      return;
    }

    setSavingInstall(true);
    try {
      await saveConnection({
        installationId: nextInstallationId,
        accountLogin: accountLogin.trim() || undefined,
        accountType: accountType.trim() || undefined,
      });
      toast.success('GitHub App connection saved');
    } catch (error) {
      console.error(error);
      toast.error('Failed to save GitHub App connection');
    } finally {
      setSavingInstall(false);
    }
  };

  const handleSaveToken = async () => {
    if (!token.trim()) return;
    setSavingToken(true);
    try {
      await saveToken({ token: token.trim() });
      setToken('');
      toast.success('GitHub token saved');
    } catch (error) {
      console.error(error);
      toast.error('Failed to save GitHub token');
    } finally {
      setSavingToken(false);
    }
  };

  const handleRemoveToken = async () => {
    setRemovingToken(true);
    try {
      await removeToken({});
      toast.success('GitHub token removed');
    } catch (error) {
      console.error(error);
      toast.error('Failed to remove GitHub token');
    } finally {
      setRemovingToken(false);
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
              Configure platform-wide integrations. These credentials are shared
              across all workspaces.
            </p>
          </div>

          {/* GitHub App Credentials Card */}
          <div className='rounded-md border'>
            <div className='flex items-center justify-between border-b px-3 py-2'>
              <div className='flex items-center gap-2'>
                <Github className='size-4' />
                <span className='text-sm font-medium'>
                  GitHub App Credentials
                </span>
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
                Create a GitHub App under{' '}
                <span className='text-foreground font-medium'>
                  GitHub &rarr; Settings &rarr; Developer settings &rarr; GitHub
                  Apps
                </span>
                . Falls back to environment variables if not configured here.
              </p>

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

          {/* Installation Card */}
          <div className='rounded-md border'>
            <div className='flex items-center justify-between border-b px-3 py-2'>
              <div className='flex items-center gap-2'>
                <Github className='size-4' />
                <span className='text-sm font-medium'>App Installation</span>
              </div>
              {config?.installationId ? (
                <Badge
                  variant='secondary'
                  className='h-5 rounded-md px-1.5 text-[10px]'
                >
                  Connected
                </Badge>
              ) : (
                <Badge
                  variant='outline'
                  className='h-5 rounded-md px-1.5 text-[10px]'
                >
                  Not connected
                </Badge>
              )}
            </div>

            <div className='space-y-3 p-3'>
              <p className='text-muted-foreground text-xs'>
                Install your GitHub App on the target account, then enter the
                installation details.
              </p>

              <div className='grid gap-3'>
                <div className='space-y-1'>
                  <label className='text-xs font-medium'>Installation ID</label>
                  <Input
                    value={installationId}
                    onChange={event => setInstallationId(event.target.value)}
                    placeholder='e.g. 12345678'
                    className='h-8'
                    disabled={savingInstall}
                  />
                  <p className='text-muted-foreground text-[11px]'>
                    The numeric ID from the installation URL.
                  </p>
                </div>

                <div className='space-y-1'>
                  <label className='text-xs font-medium'>Installed on</label>
                  <div className='flex gap-2'>
                    <Input
                      value={accountLogin}
                      onChange={event => setAccountLogin(event.target.value)}
                      placeholder='e.g. my-org'
                      className='h-8 flex-1'
                      disabled={savingInstall}
                    />
                    <select
                      value={accountType}
                      onChange={event => setAccountType(event.target.value)}
                      className='border-input bg-background h-8 rounded-md border px-2 text-xs'
                      disabled={savingInstall}
                    >
                      <option value=''>Type</option>
                      <option value='Organization'>Organization</option>
                      <option value='User'>User</option>
                    </select>
                  </div>
                </div>
              </div>

              <div className='flex items-center justify-end'>
                <Button
                  size='sm'
                  variant='outline'
                  disabled={savingInstall || !installationId.trim()}
                  onClick={() => void handleSaveInstallation()}
                >
                  {savingInstall ? <BarsSpinner size={10} /> : null}
                  Save
                </Button>
              </div>
            </div>
          </div>

          {/* Token Fallback Card */}
          <div className='rounded-md border'>
            <div className='flex items-center justify-between border-b px-3 py-2'>
              <div className='flex items-center gap-2'>
                <KeyRound className='size-4' />
                <span className='text-sm font-medium'>Token Fallback</span>
              </div>
              {config?.hasToken ? (
                <Badge
                  variant='outline'
                  className='h-5 rounded-md px-1.5 text-[10px]'
                >
                  Token saved
                </Badge>
              ) : null}
            </div>

            <div className='space-y-3 p-3'>
              <p className='text-muted-foreground text-xs'>
                Optional personal access token used as a fallback when the
                GitHub App path is unavailable. Requires{' '}
                <span className='text-foreground font-medium'>repo</span> scope.
              </p>
              <Input
                value={token}
                onChange={event => setToken(event.target.value)}
                placeholder='ghp_...'
                className='h-8 font-mono'
                disabled={savingToken}
              />
              <div className='flex items-center justify-end gap-2'>
                {config?.hasToken ? (
                  <Button
                    size='sm'
                    variant='ghost'
                    disabled={removingToken}
                    onClick={() => void handleRemoveToken()}
                  >
                    {removingToken ? <BarsSpinner size={10} /> : null}
                    Remove
                  </Button>
                ) : null}
                <Button
                  size='sm'
                  variant='outline'
                  disabled={savingToken || !token.trim()}
                  onClick={() => void handleSaveToken()}
                >
                  {savingToken ? <BarsSpinner size={10} /> : null}
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
