'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  type LucideIcon,
  CheckSquare,
  FileText,
  FolderOpen,
  Circle,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { CreateIssueDialog } from '@/components/issues/create-issue-dialog';
import { CreateTeamButton } from '@/components/teams/create-team-button';
import { CreateProjectButton } from '@/components/projects/create-project-button';
import { ScopedPermissionGate } from '@/hooks/use-permissions';
import { PERMISSIONS } from '@/convex/_shared/permissions';
import { useQuery } from 'convex/react';
import { api } from '@/lib/convex';
import { withIds } from '@/lib/convex-helpers';
import type { ReactNode } from 'react';
import { DynamicIcon } from '@/lib/dynamic-icons';
import { CreateDocumentDialog } from '@/components/documents/create-document-dialog';

interface NavItem {
  label: string;
  href: string;
  icon: LucideIcon;
  /** Optional create button element shown at the end of the row */
  createElement?: ReactNode;
}

interface OrgSidebarProps {
  orgSlug: string;
  onNavigate?: () => void;
}

export function OrgSidebar({ orgSlug, onNavigate }: OrgSidebarProps) {
  const pathname = usePathname();

  // Fetch user's teams and projects
  const userTeamsData = useQuery(api.organizations.queries.listTeams, {
    orgSlug: orgSlug,
  });

  const userProjectsData = useQuery(api.organizations.queries.listProjects, {
    orgSlug: orgSlug,
  });

  // Transform data to maintain frontend compatibility
  const userTeams = userTeamsData ? withIds(userTeamsData) : [];
  const userProjects = userProjectsData ? withIds(userProjectsData) : [];

  const userDocumentsData = useQuery(api.documents.queries.list, {
    orgSlug: orgSlug,
  });
  const userDocuments = userDocumentsData ?? [];

  const navItems: NavItem[] = [
    {
      label: 'My Issues',
      href: `/${orgSlug}/issues?assignee=me`,
      icon: CheckSquare,
      createElement: (
        <ScopedPermissionGate
          scope={{ orgSlug }}
          permission={PERMISSIONS.ISSUE_CREATE}
        >
          <CreateIssueDialog
            orgSlug={orgSlug}
            variant='default'
            className='h-6 w-6 p-0'
          />
        </ScopedPermissionGate>
      ),
    },
  ];

  return (
    <>
      <nav className='space-y-4 p-2 pt-0'>
        {/* Main navigation items */}
        <div className='space-y-1'>
          {navItems.map(item => {
            const isActive =
              pathname === item.href || pathname.startsWith(item.href + '/');

            return (
              <div
                key={item.href}
                className={cn(
                  'group flex h-8 items-center justify-between gap-2 rounded-md px-2 py-1 pr-1 text-sm font-medium transition-colors',
                  'hover:bg-foreground/5 text-foreground',
                  {
                    'bg-foreground/5': isActive,
                  },
                )}
              >
                {/* Clickable area */}
                <Link
                  href={item.href}
                  className='flex flex-1 items-center gap-2 outline-none'
                  onClick={onNavigate}
                >
                  <item.icon className='size-4' />
                  <span>{item.label}</span>
                </Link>

                {/* Create button (if any) */}
                {item.createElement && (
                  <div
                    className='flex-shrink-0'
                    onClick={e => {
                      // Prevent row hover click-through
                      e.stopPropagation();
                    }}
                  >
                    {item.createElement}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Teams Section */}
        <div className='space-y-2'>
          <div className='flex items-center justify-between px-2'>
            <span className='text-muted-foreground text-xs font-normal tracking-wider uppercase'>
              My Teams
            </span>
            <div className='flex items-center gap-1'>
              <Link
                href={`/${orgSlug}/teams`}
                className='text-muted-foreground hover:text-foreground text-xs transition-colors'
              >
                View All
              </Link>
              <CreateTeamButton
                orgSlug={orgSlug}
                size='sm'
                className='h-5 w-5'
              />
            </div>
          </div>

          <div className='space-y-1'>
            {userTeams.length > 0 ? (
              userTeams.slice(0, 3).map(team => {
                const teamHref = `/${orgSlug}/teams/${team.key}`;
                const isActive =
                  pathname === teamHref || pathname.startsWith(teamHref + '/');

                return (
                  <Link
                    key={team.id}
                    href={teamHref}
                    onClick={onNavigate}
                    className={cn(
                      'flex items-center gap-2 rounded-md px-2 py-1.5 text-sm font-medium transition-colors',
                      'hover:bg-foreground/5 text-foreground',
                      {
                        'bg-foreground/5': isActive,
                      },
                    )}
                  >
                    <DynamicIcon
                      name={team.icon}
                      fallback={Circle}
                      className='size-3 flex-shrink-0'
                      style={{ color: team.color || '#6b7280' }}
                    />
                    <span className='truncate'>{team.name}</span>
                  </Link>
                );
              })
            ) : (
              <div className='text-muted-foreground px-2 py-1.5 text-xs'>
                No teams yet
              </div>
            )}

            {userTeams.length > 3 && (
              <div className='text-muted-foreground px-2 py-1.5 text-xs'>
                +{userTeams.length - 3} more teams
              </div>
            )}
          </div>
        </div>

        {/* Projects Section */}
        <div className='space-y-2'>
          <div className='flex items-center justify-between px-2'>
            <span className='text-muted-foreground text-xs font-normal tracking-wider uppercase'>
              My Projects
            </span>
            <div className='flex items-center gap-1'>
              <Link
                href={`/${orgSlug}/projects`}
                className='text-muted-foreground hover:text-foreground text-xs transition-colors'
              >
                View All
              </Link>
              <CreateProjectButton
                orgSlug={orgSlug}
                size='sm'
                className='h-5 w-5'
              />
            </div>
          </div>

          <div className='space-y-1'>
            {userProjects.length > 0 ? (
              userProjects.slice(0, 3).map(project => {
                const projectHref = `/${orgSlug}/projects/${project.key}`;
                const isActive =
                  pathname === projectHref ||
                  pathname.startsWith(projectHref + '/');

                return (
                  <Link
                    key={project.id}
                    href={projectHref}
                    onClick={onNavigate}
                    className={cn(
                      'flex items-center gap-2 rounded-md px-2 py-1.5 text-sm font-medium transition-colors',
                      'hover:bg-foreground/5 text-foreground',
                      {
                        'bg-foreground/5': isActive,
                      },
                    )}
                  >
                    <DynamicIcon
                      name={project.icon || project.statusIcon}
                      fallback={FolderOpen}
                      className='size-3 flex-shrink-0'
                      style={{
                        color:
                          project.color || project.statusColor || '#6b7280',
                      }}
                    />
                    <span className='flex-1 truncate'>{project.name}</span>
                    {/* Status icon on the right */}
                    {project.statusIcon && (
                      <DynamicIcon
                        name={project.statusIcon}
                        className='ml-auto size-3 flex-shrink-0'
                        style={{ color: project.statusColor || '#6b7280' }}
                      />
                    )}
                  </Link>
                );
              })
            ) : (
              <div className='text-muted-foreground px-2 py-1.5 text-xs'>
                No projects yet
              </div>
            )}

            {userProjects.length > 3 && (
              <div className='text-muted-foreground px-2 py-1.5 text-xs'>
                +{userProjects.length - 3} more projects
              </div>
            )}
          </div>
        </div>

        {/* Documents Section */}
        <div className='space-y-2'>
          <div className='flex items-center justify-between px-2'>
            <span className='text-muted-foreground text-xs font-normal tracking-wider uppercase'>
              Documents
            </span>
            <div className='flex items-center gap-1'>
              <Link
                href={`/${orgSlug}/documents`}
                className='text-muted-foreground hover:text-foreground text-xs transition-colors'
              >
                View All
              </Link>
              <CreateDocumentDialog orgSlug={orgSlug} className='h-5 w-5' />
            </div>
          </div>

          <div className='space-y-1'>
            {userDocuments.length > 0 ? (
              userDocuments.slice(0, 3).map(doc => {
                const docHref = `/${orgSlug}/documents/${doc._id}`;
                const isActive =
                  pathname === docHref || pathname.startsWith(docHref + '/');

                return (
                  <Link
                    key={doc._id}
                    href={docHref}
                    onClick={onNavigate}
                    className={cn(
                      'flex items-center gap-2 rounded-md px-2 py-1.5 text-sm font-medium transition-colors',
                      'hover:bg-foreground/5 text-foreground',
                      {
                        'bg-foreground/5': isActive,
                      },
                    )}
                  >
                    {doc.icon ? (
                      <DynamicIcon
                        name={doc.icon}
                        fallback={FileText}
                        className='size-3 flex-shrink-0'
                        style={{ color: doc.color || '#6b7280' }}
                      />
                    ) : (
                      <FileText
                        className='size-3 flex-shrink-0'
                        style={{ color: doc.color || '#6b7280' }}
                      />
                    )}
                    <span className='truncate'>{doc.title}</span>
                  </Link>
                );
              })
            ) : (
              <div className='text-muted-foreground px-2 py-1.5 text-xs'>
                No documents yet
              </div>
            )}

            {userDocuments.length > 3 && (
              <div className='text-muted-foreground px-2 py-1.5 text-xs'>
                +{userDocuments.length - 3} more documents
              </div>
            )}
          </div>
        </div>
      </nav>
    </>
  );
}
