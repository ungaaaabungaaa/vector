'use client';

import { Blocks, Github, ChevronRight } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { useQuery } from 'convex/react';
import { api } from '@/lib/convex';
import { useParams } from 'next/navigation';
import { notFound } from 'next/navigation';
import Link from 'next/link';

export default function IntegrationsPage() {
  const paramsObj = useParams();
  const orgSlug = paramsObj.orgSlug as string;

  const user = useQuery(api.users.currentUser);
  const members = useQuery(api.organizations.queries.listMembersWithRoles, {
    orgSlug,
  });
  const githubSettings = useQuery(api.github.queries.getOrgSettings, {
    orgSlug,
  });

  const userRole = members?.find(m => m.userId === user?._id)?.role || 'member';
  const isOwner = userRole === 'owner';
  const isAdmin = userRole === 'admin' || isOwner;

  if (user !== undefined && members !== undefined && !isAdmin) {
    notFound();
  }

  const hasWebhookSecret = Boolean(
    githubSettings?.effectiveAuth.hasWebhookSecret,
  );
  const hasReceivedWebhook = Boolean(
    githubSettings?.integration?.lastWebhookAt,
  );

  let badgeLabel: string;
  let badgeVariant: 'secondary' | 'outline';

  if (hasWebhookSecret && hasReceivedWebhook) {
    badgeLabel = 'Ready';
    badgeVariant = 'secondary';
  } else if (hasWebhookSecret) {
    badgeLabel = 'Awaiting delivery';
    badgeVariant = 'outline';
  } else {
    badgeLabel = 'Needs setup';
    badgeVariant = 'outline';
  }

  return (
    <div className='bg-background h-full'>
      <div className='border-b'>
        <div className='flex items-center p-1 pl-9 lg:pl-1'>
          <span className='flex items-center gap-1.5 px-3 text-xs font-medium'>
            <Blocks className='size-3.5' />
            Integrations
          </span>
        </div>
      </div>

      <div className='p-3'>
        <div className='space-y-1'>
          {githubSettings === undefined ? (
            <Skeleton className='h-14 w-full rounded-lg' />
          ) : (
            <Link
              href={`/${orgSlug}/settings/integrations/github`}
              className='hover:bg-muted/50 flex items-center gap-3 rounded-lg border px-3 py-2 transition-colors'
            >
              <div className='bg-muted flex size-8 shrink-0 items-center justify-center rounded-md'>
                <Github className='size-4' />
              </div>
              <div className='min-w-0 flex-1'>
                <div className='flex items-center gap-2'>
                  <span className='text-sm font-medium'>GitHub</span>
                  <Badge
                    variant={badgeVariant}
                    className='h-5 rounded-md px-1.5 text-[10px]'
                  >
                    {badgeLabel}
                  </Badge>
                </div>
                <p className='text-muted-foreground text-xs'>
                  Receive GitHub webhooks and link development to Vector issues
                </p>
              </div>
              <ChevronRight className='text-muted-foreground size-4 shrink-0' />
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}
