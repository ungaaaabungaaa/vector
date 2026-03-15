'use client';

import { Building } from 'lucide-react';
import Image from 'next/image';
import {
  OrgLogoEditor,
  OrgNameEditor,
  OrgSlugEditor,
} from '@/components/organization';
import { GitHubIntegrationSettings } from '@/components/organization/github-integration-settings';
import { Skeleton } from '@/components/ui/skeleton';
import { api } from '@/lib/convex';
import { useQuery } from 'convex/react';
import { useParams } from 'next/navigation';
interface OrgSettingsPageClientProps {
  orgSlug: string;
}

export default function OrgSettingsPageClient({
  orgSlug,
}: OrgSettingsPageClientProps) {
  const params = useParams();
  const orgSlugParam = params.orgSlug as string;
  const org = useQuery(api.organizations.queries.getBySlug, {
    orgSlug: orgSlugParam,
  });
  const members = useQuery(api.organizations.queries.listMembersWithRoles, {
    orgSlug: orgSlugParam,
  });
  const user = useQuery(api.users.currentUser);

  const userRole = members?.find(m => m.userId === user?._id)?.role || 'member';
  const isOwner = userRole === 'owner';
  const isAdmin = userRole === 'admin' || isOwner;

  const header = (
    <div className='border-b'>
      <div className='flex items-center p-1 pl-9 lg:pl-1'>
        <span className='flex items-center gap-1.5 px-3 text-xs font-medium'>
          <Building className='size-3.5' />
          Organization
        </span>
      </div>
    </div>
  );

  if (org === undefined) {
    return (
      <div className='bg-background h-full'>
        {header}
        <div className='space-y-4 p-3'>
          <div className='grid gap-4 sm:grid-cols-2'>
            <div className='space-y-2'>
              <Skeleton className='h-4 w-32' />
              <Skeleton className='h-10 w-full' />
              <Skeleton className='h-3 w-56' />
            </div>
            <div className='space-y-2'>
              <Skeleton className='h-4 w-28' />
              <Skeleton className='h-10 w-full' />
              <Skeleton className='h-3 w-64' />
            </div>
            <div className='space-y-2'>
              <Skeleton className='h-4 w-28' />
              <Skeleton className='size-16 rounded border' />
              <Skeleton className='h-3 w-56' />
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (org === null) {
    return (
      <div className='bg-background h-full'>
        {header}
        <div className='text-muted-foreground p-3 text-sm'>
          Organization not found
        </div>
      </div>
    );
  }

  return (
    <div className='bg-background h-full'>
      {header}

      <div className='space-y-4 p-3'>
        <div className='grid gap-4 sm:grid-cols-2'>
          <div className='space-y-2'>
            <label className='text-sm font-medium'>Organization Name</label>
            {isAdmin ? (
              <OrgNameEditor orgSlug={orgSlug} initialValue={org.name} />
            ) : (
              <div className='rounded-md border px-3 py-2 text-sm'>
                {org.name}
              </div>
            )}
            <p className='text-muted-foreground text-xs'>
              This is your organization&apos;s display name
            </p>
          </div>

          <div className='space-y-2'>
            <label className='text-sm font-medium'>Organization Slug</label>
            {isAdmin ? (
              <OrgSlugEditor orgSlug={orgSlug} initialValue={orgSlug} />
            ) : (
              <div className='bg-muted rounded-md px-3 py-2 font-mono text-sm'>
                {orgSlug}
              </div>
            )}
            <p className='text-muted-foreground text-xs'>
              Used in your organization&apos;s URL (example.com/{orgSlug})
            </p>
          </div>

          <div className='space-y-2'>
            <label className='text-sm font-medium'>Organization Logo</label>
            {isAdmin ? (
              <OrgLogoEditor orgSlug={orgSlug} initialValue={org.logo} />
            ) : org.logo ? (
              <Image
                src={`/api/files/${org.logo}`}
                alt='Org logo'
                width={64}
                height={64}
                className='size-16 rounded border object-cover'
              />
            ) : (
              <div className='bg-muted text-muted-foreground flex size-16 items-center justify-center rounded border text-sm'>
                No logo
              </div>
            )}
            <p className='text-muted-foreground text-xs'>
              Upload a square image (PNG, JPG, or SVG). Max 1MB.
            </p>
          </div>
        </div>

        <GitHubIntegrationSettings orgSlug={orgSlug} />
      </div>
    </div>
  );
}
