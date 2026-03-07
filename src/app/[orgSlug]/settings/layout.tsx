'use client';

import {
  OrgSettingsSidebar,
  OrgOptionsDropdown,
} from '@/components/organization';
import { useQuery } from 'convex/react';
import { api } from '@/lib/convex';
import { useParams } from 'next/navigation';
import { Doc } from '@/convex/_generated/dataModel';

interface OrgSettingsLayoutProps {
  children: React.ReactNode;
}

export default function OrgSettingsLayout({
  children,
}: OrgSettingsLayoutProps) {
  const params = useParams();
  const orgSlug = params.orgSlug as string;
  const user = useQuery(api.users.currentUser);
  const members = useQuery(api.organizations.queries.listMembersWithRoles, {
    orgSlug,
  });
  const organization = useQuery(api.organizations.queries.getBySlug, {
    orgSlug,
  });
  const userOrganizations = useQuery(api.users.getOrganizations);
  const userRole = members?.find(m => m.userId === user?._id)?.role || 'member';

  const organizations =
    userOrganizations?.filter(
      (org): org is Doc<'organizations'> => org !== null,
    ) || [];

  return (
    <div className='bg-secondary flex h-screen'>
      {/* Settings Sidebar */}
      <aside className='hidden w-56 lg:block'>
        <div className='flex h-full flex-col'>
          {/* Organization Options Dropdown */}
          <div className='p-2'>
            <OrgOptionsDropdown
              currentOrgSlug={orgSlug}
              currentOrgName={organization?.name ?? 'Organization'}
              currentOrgLogo={organization?.logo}
              organizations={organizations}
            />
          </div>

          {/* Settings Navigation */}
          <div className='flex-1 overflow-y-auto'>
            <OrgSettingsSidebar orgSlug={orgSlug} userRole={userRole} />
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className='bg-background m-2 ml-0 flex-1 overflow-y-auto rounded-md border'>
        {children}
      </main>
    </div>
  );
}
