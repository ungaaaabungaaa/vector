'use client';

import { useAction, useMutation, api } from '@/lib/convex';
import { useEffect, useMemo, useState } from 'react';
import {
  CheckCircle2,
  Github,
  KeyRound,
  RefreshCw,
  Shield,
  Webhook,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { BarsSpinner } from '@/components/bars-spinner';
import { formatDateHuman } from '@/lib/date';
import { toast } from 'sonner';
import type { Id } from '@/convex/_generated/dataModel';
import { useQuery } from 'convex/react';

export function GitHubIntegrationSettings({ orgSlug }: { orgSlug: string }) {
  const settings = useQuery(api.github.queries.getOrgSettings, { orgSlug });
  const saveInstallationConnection = useAction(
    api.github.actions.saveInstallationConnection,
  );
  const saveTokenFallback = useAction(api.github.actions.saveTokenFallback);
  const removeTokenFallback = useAction(api.github.actions.removeTokenFallback);
  const syncRepositories = useAction(api.github.actions.syncRepositories);
  const toggleRepositorySelection = useMutation(
    api.github.mutations.toggleRepositorySelection,
  );

  const [installationId, setInstallationId] = useState('');
  const [accountLogin, setAccountLogin] = useState('');
  const [accountType, setAccountType] = useState('');
  const [token, setToken] = useState('');
  const [repositoryFilter, setRepositoryFilter] = useState('');
  const [savingInstall, setSavingInstall] = useState(false);
  const [savingToken, setSavingToken] = useState(false);
  const [removingToken, setRemovingToken] = useState(false);
  const [syncingRepos, setSyncingRepos] = useState(false);
  const [busyRepositoryId, setBusyRepositoryId] = useState<string | null>(null);

  useEffect(() => {
    if (!settings?.integration) return;
    setInstallationId(
      settings.integration.installationId
        ? String(settings.integration.installationId)
        : '',
    );
    setAccountLogin(settings.integration.installationAccountLogin ?? '');
    setAccountType(settings.integration.installationAccountType ?? '');
  }, [settings?.integration]);

  const filteredRepositories = useMemo(() => {
    const query = repositoryFilter.trim().toLowerCase();
    if (!settings?.repositories) return [];
    if (!query) return settings.repositories;
    return settings.repositories.filter(repo =>
      repo.fullName.toLowerCase().includes(query),
    );
  }, [repositoryFilter, settings?.repositories]);

  const handleSaveInstallation = async () => {
    if (!settings?.canManage) return;
    const nextInstallationId = Number(installationId);
    if (!Number.isFinite(nextInstallationId) || nextInstallationId <= 0) {
      toast.error('Enter a valid GitHub installation ID');
      return;
    }

    setSavingInstall(true);
    try {
      await saveInstallationConnection({
        orgSlug,
        installationId: nextInstallationId,
        installationAccountLogin: accountLogin.trim() || undefined,
        installationAccountType: accountType.trim() || undefined,
      });
    } catch (error) {
      console.error(error);
      toast.error('Failed to save GitHub App installation');
    } finally {
      setSavingInstall(false);
    }
  };

  const handleSaveToken = async () => {
    if (!settings?.canManage || !token.trim()) return;
    setSavingToken(true);
    try {
      await saveTokenFallback({
        orgSlug,
        token: token.trim(),
      });
      setToken('');
    } catch (error) {
      console.error(error);
      toast.error('Failed to save GitHub token fallback');
    } finally {
      setSavingToken(false);
    }
  };

  const handleRemoveToken = async () => {
    if (!settings?.canManage) return;
    setRemovingToken(true);
    try {
      await removeTokenFallback({ orgSlug });
    } catch (error) {
      console.error(error);
      toast.error('Failed to remove GitHub token fallback');
    } finally {
      setRemovingToken(false);
    }
  };

  const handleSyncRepositories = async () => {
    if (!settings?.canManage) return;
    setSyncingRepos(true);
    try {
      await syncRepositories({ orgSlug });
    } catch (error) {
      console.error(error);
      toast.error('Failed to sync GitHub repositories');
    } finally {
      setSyncingRepos(false);
    }
  };

  const handleToggleRepository = async (
    repositoryId: string,
    selected: boolean,
  ) => {
    if (!settings?.canManage) return;
    setBusyRepositoryId(repositoryId);
    try {
      await toggleRepositorySelection({
        orgSlug,
        repositoryId: repositoryId as Id<'githubRepositories'>,
        selected,
      });
    } catch (error) {
      console.error(error);
      toast.error('Failed to update repository selection');
    } finally {
      setBusyRepositoryId(null);
    }
  };

  if (settings === undefined) {
    return (
      <div className='space-y-3 rounded-lg border p-3'>
        <div className='flex items-center gap-2'>
          <Skeleton className='size-5 rounded-md' />
          <Skeleton className='h-4 w-28' />
        </div>
        <Skeleton className='h-20 w-full rounded-lg' />
        <Skeleton className='h-28 w-full rounded-lg' />
      </div>
    );
  }

  return (
    <div className='space-y-3 rounded-lg border p-3'>
      <div className='flex items-center justify-between gap-3'>
        <div className='flex items-center gap-2'>
          <Github className='size-4' />
          <h3 className='text-sm font-medium'>GitHub</h3>
        </div>
        <div className='flex items-center gap-2'>
          {settings.integration?.installationId ? (
            <Badge
              variant='secondary'
              className='h-5 rounded-md px-1.5 text-[10px]'
            >
              App connected
            </Badge>
          ) : (
            <Badge
              variant='outline'
              className='h-5 rounded-md px-1.5 text-[10px]'
            >
              App not connected
            </Badge>
          )}
          {settings.integration?.hasTokenFallback ? (
            <Badge
              variant='outline'
              className='h-5 rounded-md px-1.5 text-[10px]'
            >
              Token saved
            </Badge>
          ) : null}
        </div>
      </div>

      <div className='grid gap-3 lg:grid-cols-2'>
        <div className='space-y-2 rounded-lg border p-3'>
          <div className='flex items-center gap-2'>
            <Shield className='text-muted-foreground size-3.5' />
            <span className='text-sm font-medium'>GitHub App</span>
          </div>
          <div className='grid gap-2'>
            <Input
              value={installationId}
              onChange={event => setInstallationId(event.target.value)}
              placeholder='Installation ID'
              className='h-8'
              disabled={!settings.canManage || savingInstall}
            />
            <Input
              value={accountLogin}
              onChange={event => setAccountLogin(event.target.value)}
              placeholder='Account login'
              className='h-8'
              disabled={!settings.canManage || savingInstall}
            />
            <Input
              value={accountType}
              onChange={event => setAccountType(event.target.value)}
              placeholder='Account type (User or Organization)'
              className='h-8'
              disabled={!settings.canManage || savingInstall}
            />
          </div>
          <div className='flex items-center justify-between gap-2'>
            <p className='text-muted-foreground text-xs'>
              Save the GitHub App installation metadata used for webhook and API
              sync.
            </p>
            <Button
              size='sm'
              variant='outline'
              disabled={!settings.canManage || savingInstall}
              onClick={() => void handleSaveInstallation()}
            >
              {savingInstall ? <BarsSpinner size={10} /> : null}
              Save
            </Button>
          </div>
        </div>

        <div className='space-y-2 rounded-lg border p-3'>
          <div className='flex items-center gap-2'>
            <KeyRound className='text-muted-foreground size-3.5' />
            <span className='text-sm font-medium'>Token Fallback</span>
          </div>
          <Input
            value={token}
            onChange={event => setToken(event.target.value)}
            placeholder='Paste GitHub token fallback'
            className='h-8'
            disabled={!settings.canManage || savingToken}
          />
          <div className='flex items-center justify-between gap-2'>
            <p className='text-muted-foreground text-xs'>
              Use this only when the GitHub App path is unavailable or still
              being wired.
            </p>
            <div className='flex items-center gap-2'>
              {settings.integration?.hasTokenFallback ? (
                <Button
                  size='sm'
                  variant='ghost'
                  disabled={!settings.canManage || removingToken}
                  onClick={() => void handleRemoveToken()}
                >
                  {removingToken ? <BarsSpinner size={10} /> : null}
                  Remove
                </Button>
              ) : null}
              <Button
                size='sm'
                variant='outline'
                disabled={!settings.canManage || savingToken || !token.trim()}
                onClick={() => void handleSaveToken()}
              >
                {savingToken ? <BarsSpinner size={10} /> : null}
                Save
              </Button>
            </div>
          </div>
        </div>
      </div>

      <div className='grid gap-2 lg:grid-cols-3'>
        <div className='rounded-lg border px-3 py-2'>
          <div className='text-muted-foreground mb-1 flex items-center gap-1.5 text-xs'>
            <Webhook className='size-3.5' />
            Webhook
          </div>
          <div className='text-sm font-medium'>
            {settings.integration?.lastWebhookEvent ?? 'No events yet'}
          </div>
          <div className='text-muted-foreground text-xs'>
            {settings.integration?.lastWebhookAt
              ? formatDateHuman(new Date(settings.integration.lastWebhookAt))
              : 'Waiting for first delivery'}
          </div>
        </div>
        <div className='rounded-lg border px-3 py-2'>
          <div className='text-muted-foreground mb-1 flex items-center gap-1.5 text-xs'>
            <RefreshCw className='size-3.5' />
            Reconcile
          </div>
          <div className='text-sm font-medium'>
            {settings.integration?.lastReconciledAt
              ? formatDateHuman(new Date(settings.integration.lastReconciledAt))
              : 'Never run'}
          </div>
          <div className='text-muted-foreground text-xs'>
            Recent-artifact sync runs every 10 minutes
          </div>
        </div>
        <div className='rounded-lg border px-3 py-2'>
          <div className='text-muted-foreground mb-1 flex items-center gap-1.5 text-xs'>
            <CheckCircle2 className='size-3.5' />
            Health
          </div>
          <div className='text-sm font-medium'>
            {settings.integration?.lastSyncFailureMessage
              ? 'Needs attention'
              : 'Healthy'}
          </div>
          <div className='text-muted-foreground text-xs'>
            {settings.integration?.lastSyncFailureMessage ??
              'No sync failures recorded'}
          </div>
        </div>
      </div>

      <div className='space-y-2 rounded-lg border p-3'>
        <div className='flex items-center justify-between gap-3'>
          <div>
            <div className='text-sm font-medium'>Repositories</div>
            <p className='text-muted-foreground text-xs'>
              Select the repositories Vector is allowed to scan and link.
            </p>
          </div>
          <Button
            size='sm'
            variant='outline'
            disabled={!settings.canManage || syncingRepos}
            onClick={() => void handleSyncRepositories()}
          >
            {syncingRepos ? <BarsSpinner size={10} /> : null}
            Sync repos
          </Button>
        </div>

        <Input
          value={repositoryFilter}
          onChange={event => setRepositoryFilter(event.target.value)}
          placeholder='Filter repositories...'
          className='h-8'
        />

        <div className='max-h-72 space-y-1 overflow-y-auto'>
          {filteredRepositories.length > 0 ? (
            filteredRepositories.map(repo => (
              <button
                key={repo._id}
                type='button'
                className='hover:bg-muted/50 flex w-full items-center gap-3 rounded-md border px-3 py-2 text-left transition-colors'
                disabled={!settings.canManage || busyRepositoryId === repo._id}
                onClick={() =>
                  void handleToggleRepository(repo._id, !repo.selected)
                }
              >
                <Checkbox
                  checked={repo.selected}
                  disabled={
                    !settings.canManage || busyRepositoryId === repo._id
                  }
                />
                <div className='min-w-0 flex-1'>
                  <div className='truncate text-sm font-medium'>
                    {repo.fullName}
                  </div>
                  <div className='text-muted-foreground flex items-center gap-2 text-xs'>
                    <span>{repo.private ? 'Private' : 'Public'}</span>
                    <span>
                      {repo.installationAccessible
                        ? 'Accessible'
                        : 'Unavailable'}
                    </span>
                    {repo.defaultBranch ? (
                      <span className='font-mono'>{repo.defaultBranch}</span>
                    ) : null}
                  </div>
                </div>
                {busyRepositoryId === repo._id ? (
                  <BarsSpinner size={10} />
                ) : null}
              </button>
            ))
          ) : (
            <div className='text-muted-foreground rounded-md border px-3 py-6 text-sm'>
              No repositories match this filter.
            </div>
          )}
        </div>
      </div>

      {!settings.canManage ? (
        <p className='text-muted-foreground text-xs'>
          You can view GitHub integration status here, but only organization
          settings managers can edit it.
        </p>
      ) : null}
    </div>
  );
}
