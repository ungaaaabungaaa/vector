'use client';

import { useEffect, useMemo, useState, type ReactNode } from 'react';
import {
  Check,
  ChevronRight,
  Copy,
  Github,
  RefreshCw,
  Shield,
  Webhook,
} from 'lucide-react';
import { useAction, api } from '@/lib/convex';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
import { useQuery } from 'convex/react';
import { formatDateHuman } from '@/lib/date';
import { toast } from 'sonner';

const REQUIRED_EVENTS = ['push', 'pull_request', 'issues'] as const;

function IntegrationRow({
  icon,
  label,
  value,
  meta,
  action,
}: {
  icon: ReactNode;
  label: string;
  value: ReactNode;
  meta?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className='flex items-center gap-3 px-3 py-2'>
      <div className='bg-muted flex size-8 shrink-0 items-center justify-center rounded-md'>
        {icon}
      </div>
      <div className='min-w-0 flex-1'>
        <div className='text-sm font-medium'>{label}</div>
        <div className='text-muted-foreground text-xs'>{value}</div>
        {meta ? <div className='mt-1'>{meta}</div> : null}
      </div>
      {action ? <div className='shrink-0'>{action}</div> : null}
    </div>
  );
}

export function GitHubIntegrationSettings({ orgSlug }: { orgSlug: string }) {
  const settings = useQuery(api.github.queries.getOrgSettings, { orgSlug });
  const rotateWebhookSecret = useAction(api.github.actions.rotateWebhookSecret);

  const [copiedField, setCopiedField] = useState<'url' | 'secret' | null>(null);
  const [revealedSecret, setRevealedSecret] = useState('');
  const [isRotatingSecret, setIsRotatingSecret] = useState(false);

  useEffect(() => {
    if (!copiedField) return;

    const timeout = window.setTimeout(() => setCopiedField(null), 1500);
    return () => window.clearTimeout(timeout);
  }, [copiedField]);

  const webhookUrl = useMemo(() => {
    const configuredBaseUrl =
      process.env.NEXT_PUBLIC_CONVEX_SITE_URL ??
      process.env.NEXT_PUBLIC_CONVEX_URL;
    const baseUrl =
      configuredBaseUrl ||
      (typeof window !== 'undefined' ? window.location.origin : '');

    return `${baseUrl.replace(/\/$/, '')}/webhooks/github?org=${encodeURIComponent(
      orgSlug,
    )}`;
  }, [orgSlug]);

  const handleCopy = async (field: 'url' | 'secret', value: string) => {
    try {
      await navigator.clipboard.writeText(value);
      setCopiedField(field);
      toast.success(
        field === 'url' ? 'Webhook URL copied' : 'Webhook secret copied',
      );
    } catch (error) {
      console.error(error);
      toast.error(
        field === 'url'
          ? 'Failed to copy webhook URL'
          : 'Failed to copy webhook secret',
      );
    }
  };

  const handleRotateSecret = async () => {
    if (!settings?.canManage) return;

    setIsRotatingSecret(true);
    try {
      const result = await rotateWebhookSecret({ orgSlug });
      setRevealedSecret(result.webhookSecret);
      toast.success('Workspace webhook secret generated');
    } catch (error) {
      console.error(error);
      toast.error('Failed to generate webhook secret');
    } finally {
      setIsRotatingSecret(false);
    }
  };

  if (settings === undefined) {
    return (
      <div className='space-y-3'>
        <div className='rounded-xl border'>
          <div className='flex items-start gap-3 px-4 py-4'>
            <Skeleton className='size-10 rounded-xl' />
            <div className='min-w-0 flex-1 space-y-2'>
              <Skeleton className='h-4 w-28' />
              <Skeleton className='h-4 w-72' />
            </div>
          </div>
        </div>
        <Skeleton className='h-56 w-full rounded-xl' />
      </div>
    );
  }

  const hasWebhookSecret = settings.effectiveAuth.hasWebhookSecret;
  const hasApiAccess = settings.effectiveAuth.hasUsableAuth;
  const repositoryCount = settings.repositories.length;
  const lastWebhookAt = settings.integration?.lastWebhookAt ?? null;
  const secretFingerprint =
    settings.integration?.webhookSecretFingerprint ?? 'Not generated yet';
  const webhookStatus = !hasWebhookSecret
    ? {
        label: 'Needs setup',
        variant: 'outline' as const,
        activity: 'Generate a secret and send a GitHub test delivery.',
      }
    : !lastWebhookAt
      ? {
          label: 'Awaiting delivery',
          variant: 'outline' as const,
          activity:
            'Configured, but no GitHub deliveries have been received yet.',
        }
      : {
          label: 'Connected',
          variant: 'secondary' as const,
          activity: `Last delivery ${formatDateHuman(new Date(lastWebhookAt))}`,
        };

  return (
    <div className='space-y-3'>
      <div className='rounded-xl border'>
        <div className='flex items-start gap-3 px-4 py-4'>
          <div className='bg-muted flex size-10 shrink-0 items-center justify-center rounded-xl'>
            <Github className='size-5' />
          </div>
          <div className='min-w-0 flex-1'>
            <div className='flex flex-wrap items-center gap-2'>
              <h2 className='text-sm font-semibold'>GitHub</h2>
              <Badge
                variant={webhookStatus.variant}
                className='h-5 rounded-md px-1.5 text-[10px]'
              >
                {webhookStatus.label}
              </Badge>
              {hasApiAccess ? (
                <Badge
                  variant='outline'
                  className='h-5 rounded-md px-1.5 text-[10px]'
                >
                  API access enabled
                </Badge>
              ) : null}
            </div>
            <p className='text-muted-foreground mt-1 text-sm leading-5'>
              Workspace-scoped webhook ingestion for pull requests, issues, and
              commits. Each workspace has its own endpoint URL and secret.
            </p>
            <div className='text-muted-foreground mt-2 flex flex-wrap items-center gap-4 text-xs'>
              <span>{repositoryCount} repositories seen</span>
              <span>{webhookStatus.activity}</span>
            </div>
          </div>
        </div>
      </div>

      <div className='overflow-hidden rounded-xl border'>
        <IntegrationRow
          icon={<Webhook className='text-muted-foreground size-4' />}
          label='Webhook endpoint'
          value='Copy this full Convex URL into the GitHub webhook configuration for this workspace.'
          meta={
            <Input
              value={webhookUrl}
              readOnly
              className='h-8 font-mono text-xs'
            />
          }
          action={
            <Button
              size='sm'
              variant='outline'
              onClick={() => void handleCopy('url', webhookUrl)}
            >
              {copiedField === 'url' ? (
                <Check className='size-3.5' />
              ) : (
                <Copy className='size-3.5' />
              )}
              {copiedField === 'url' ? 'Copied' : 'Copy'}
            </Button>
          }
        />

        <Separator />

        <IntegrationRow
          icon={<Shield className='text-muted-foreground size-4' />}
          label='Webhook secret'
          value={
            hasWebhookSecret
              ? `Configured (${secretFingerprint})`
              : 'Generate a workspace secret, then paste it into GitHub.'
          }
          meta={
            <Input
              value={
                revealedSecret ||
                (hasWebhookSecret
                  ? 'Generated and stored securely. Regenerate to reveal a new value.'
                  : 'No workspace webhook secret has been generated yet.')
              }
              readOnly
              className='h-8 font-mono text-xs'
            />
          }
          action={
            <div className='flex items-center gap-2'>
              {revealedSecret ? (
                <Button
                  size='sm'
                  variant='outline'
                  onClick={() => void handleCopy('secret', revealedSecret)}
                >
                  {copiedField === 'secret' ? (
                    <Check className='size-3.5' />
                  ) : (
                    <Copy className='size-3.5' />
                  )}
                  {copiedField === 'secret' ? 'Copied' : 'Copy'}
                </Button>
              ) : null}
              {settings.canManage ? (
                <Button
                  size='sm'
                  variant='outline'
                  disabled={isRotatingSecret}
                  onClick={() => void handleRotateSecret()}
                >
                  <RefreshCw
                    className={`size-3.5 ${isRotatingSecret ? 'animate-spin' : ''}`}
                  />
                  {hasWebhookSecret ? 'Regenerate' : 'Generate'}
                </Button>
              ) : (
                <Badge
                  variant='outline'
                  className='h-5 rounded-md px-1.5 text-[10px]'
                >
                  View only
                </Badge>
              )}
            </div>
          }
        />

        <Separator />

        <IntegrationRow
          icon={<Github className='text-muted-foreground size-4' />}
          label='Tracked events'
          value='Subscribe GitHub to these webhook events for this workspace.'
          meta={
            <div className='flex flex-wrap gap-1'>
              {REQUIRED_EVENTS.map(event => (
                <Badge
                  key={event}
                  variant='outline'
                  className='h-5 rounded-md px-1.5 font-mono text-[10px]'
                >
                  {event}
                </Badge>
              ))}
            </div>
          }
          action={<ChevronRight className='text-muted-foreground size-4' />}
        />
      </div>
    </div>
  );
}
