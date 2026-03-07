'use client';

import { Users } from 'lucide-react';
import { MembersList } from '@/components/organization';
import { useParams } from 'next/navigation';
import { useRequirePermission } from '@/hooks/use-permission-boundary';
import { PERMISSIONS } from '@/convex/_shared/permissions';

interface MembersSettingsPageProps {
  params: Promise<{ orgSlug: string }>;
}

export default function MembersSettingsPage({}: MembersSettingsPageProps) {
  const paramsObj = useParams();
  const orgSlug = paramsObj.orgSlug as string;

  // Require permission to manage members - will redirect to 403 if denied
  const { isLoading: permissionLoading } = useRequirePermission(
    orgSlug,
    PERMISSIONS.ORG_MANAGE_MEMBERS,
  );

  if (permissionLoading) {
    return (
      <div className='bg-background h-full'>
        <div className='border-b'>
          <div className='flex items-center p-1'>
            <span className='flex items-center gap-1.5 px-3 text-xs font-medium'>
              <Users className='size-3.5' />
              Members
            </span>
          </div>
        </div>
        <div className='text-muted-foreground p-3 text-sm'>Loading...</div>
      </div>
    );
  }

  return (
    <div className='bg-background h-full'>
      <div className='border-b'>
        <div className='flex items-center p-1'>
          <span className='flex items-center gap-1.5 px-3 text-xs font-medium'>
            <Users className='size-3.5' />
            Members & Access
          </span>
        </div>
      </div>

      <div className='p-3'>
        <MembersList orgSlug={orgSlug} />
      </div>
    </div>
  );
}
