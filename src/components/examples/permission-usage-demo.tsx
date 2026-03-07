'use client';

import React from 'react';
import { useParams } from 'next/navigation';
import {
  PermissionAwareButton,
  PermissionAwareField,
  PermissionGate,
  usePermissionCheck,
} from '@/components/ui/permission-aware';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { PERMISSIONS } from '@/convex/_shared/permissions';
import { Edit, Trash, Plus } from 'lucide-react';
import type { Id } from '@/convex/_generated/dataModel';

/**
 * Example component demonstrating proper usage of the permission system
 * This shows all the patterns the user requested
 */
export function PermissionUsageDemo() {
  const params = useParams();
  const orgSlug = params.orgSlug as string;

  // The simple permission checker function the user requested
  const { isAllowed: canEditIssues, isLoading } = usePermissionCheck(
    orgSlug,
    PERMISSIONS.ISSUE_EDIT,
  );

  const { isAllowed: canCreateProjects } = usePermissionCheck(
    orgSlug,
    PERMISSIONS.PROJECT_CREATE,
  );

  const { isAllowed: canManageTeams } = usePermissionCheck(
    orgSlug,
    PERMISSIONS.TEAM_EDIT,
  );

  return (
    <div className='space-y-8 p-6'>
      <div className='space-y-4'>
        <h2 className='text-2xl font-semibold'>Permission System Demo</h2>
        <p className='text-muted-foreground'>
          This demonstrates the comprehensive permission handling system with
          UI-level controls.
        </p>
      </div>

      {/* Simple Permission Checking */}
      <div className='space-y-4'>
        <h3 className='text-lg font-semibold'>Simple Permission Checking</h3>
        <div className='space-y-2'>
          <p>
            Can edit issues:{' '}
            {isLoading ? 'Loading...' : canEditIssues ? '✅ Yes' : '❌ No'}
          </p>
          <p>Can create projects: {canCreateProjects ? '✅ Yes' : '❌ No'}</p>
          <p>Can manage teams: {canManageTeams ? '✅ Yes' : '❌ No'}</p>
        </div>
      </div>

      {/* Permission-Aware Buttons */}
      <div className='space-y-4'>
        <h3 className='text-lg font-semibold'>Permission-Aware Buttons</h3>
        <div className='flex gap-2'>
          <PermissionAwareButton
            orgSlug={orgSlug}
            permission={PERMISSIONS.ISSUE_EDIT}
            onClick={() => console.log('Edit issue')}
            fallbackMessage='You need edit permissions to modify issues'
          >
            <Edit className='mr-2 size-4' />
            Edit Issue
          </PermissionAwareButton>

          <PermissionAwareButton
            orgSlug={orgSlug}
            permission={PERMISSIONS.ISSUE_DELETE}
            onClick={() => console.log('Delete issue')}
            variant='destructive'
            fallbackMessage='You need delete permissions to remove issues'
          >
            <Trash className='mr-2 size-4' />
            Delete Issue
          </PermissionAwareButton>

          <PermissionAwareButton
            orgSlug={orgSlug}
            permission={PERMISSIONS.PROJECT_CREATE}
            onClick={() => console.log('Create project')}
            fallbackMessage='You need create permissions to add new projects'
          >
            <Plus className='mr-2 size-4' />
            Create Project
          </PermissionAwareButton>
        </div>
      </div>

      {/* Permission-Aware Form Fields */}
      <div className='space-y-4'>
        <h3 className='text-lg font-semibold'>Permission-Aware Form Fields</h3>
        <div className='max-w-md space-y-4'>
          <PermissionAwareField
            orgSlug={orgSlug}
            permission={PERMISSIONS.ISSUE_EDIT}
            fallbackMessage='You cannot edit issue titles'
          >
            <Label htmlFor='title'>Issue Title</Label>
            <Input id='title' placeholder='Enter issue title...' />
          </PermissionAwareField>

          <PermissionAwareField
            orgSlug={orgSlug}
            permission={PERMISSIONS.ISSUE_ASSIGN}
            fallbackMessage='You cannot assign issues to team members'
          >
            <Label htmlFor='assignee'>Assignee</Label>
            <Input id='assignee' placeholder='Select assignee...' />
          </PermissionAwareField>
        </div>
      </div>

      {/* Conditional Content Rendering */}
      <div className='space-y-4'>
        <h3 className='text-lg font-semibold'>
          Conditional Content with Permission Gates
        </h3>

        <PermissionGate
          orgSlug={orgSlug}
          permission={PERMISSIONS.ORG_MANAGE_SETTINGS}
          fallback={
            <div className='bg-muted/50 rounded-lg border p-4'>
              <p className='text-muted-foreground'>
                🔒 Organization settings are only visible to administrators
              </p>
            </div>
          }
        >
          <div className='rounded-lg border bg-green-50 p-4 dark:bg-green-900/20'>
            <h4 className='font-semibold'>Organization Settings</h4>
            <p className='text-muted-foreground text-sm'>
              You have access to organization management features.
            </p>
            <Button className='mt-2' size='sm'>
              Manage Organization
            </Button>
          </div>
        </PermissionGate>

        <PermissionGate
          orgSlug={orgSlug}
          permission={PERMISSIONS.TEAM_CREATE}
          fallback={
            <div className='bg-muted/50 rounded-lg border p-4'>
              <p className='text-muted-foreground'>
                🔒 Team creation is restricted to team leads and administrators
              </p>
            </div>
          }
        >
          <div className='rounded-lg border bg-blue-50 p-4 dark:bg-blue-900/20'>
            <h4 className='font-semibold'>Team Management</h4>
            <p className='text-muted-foreground text-sm'>
              You can create and manage teams in this organization.
            </p>
            <Button className='mt-2' size='sm'>
              Create New Team
            </Button>
          </div>
        </PermissionGate>
      </div>

      {/* Demonstrating Scoped Permissions */}
      <div className='space-y-4'>
        <h3 className='text-lg font-semibold'>
          Scoped Permissions (Team/Project Level)
        </h3>
        <div className='grid gap-4'>
          <PermissionAwareButton
            orgSlug={orgSlug}
            permission={PERMISSIONS.ISSUE_EDIT}
            scope={{
              orgSlug,
              teamId: 'example-team-id' as Id<'teams'>,
            }}
            onClick={() => console.log('Edit team issue')}
            fallbackMessage='You cannot edit issues in this specific team'
          >
            Edit Team Issue
          </PermissionAwareButton>

          <PermissionAwareButton
            orgSlug={orgSlug}
            permission={PERMISSIONS.PROJECT_EDIT}
            scope={{
              orgSlug,
              projectId: 'example-project-id' as Id<'projects'>,
            }}
            onClick={() => console.log('Edit project')}
            fallbackMessage='You cannot edit this specific project'
          >
            Edit Project Settings
          </PermissionAwareButton>
        </div>
      </div>

      {/* Best Practices Summary */}
      <div className='space-y-4'>
        <h3 className='text-lg font-semibold'>Best Practices Summary</h3>
        <div className='bg-muted space-y-2 rounded-lg p-4 text-sm'>
          <p>
            <strong>✅ DO:</strong> Use `usePermissionCheck` for simple boolean
            permission checks in components
          </p>
          <p>
            <strong>✅ DO:</strong> Use `PermissionAwareButton` for actions that
            require permissions
          </p>
          <p>
            <strong>✅ DO:</strong> Use `PermissionAwareField` for form inputs
            that should be disabled
          </p>
          <p>
            <strong>✅ DO:</strong> Use `PermissionGate` to conditionally
            show/hide entire sections
          </p>
          <p>
            <strong>✅ DO:</strong> Provide clear fallback messages explaining
            why access is denied
          </p>
          <p>
            <strong>❌ DON&apos;T:</strong> Rely only on client-side permission
            checks for security
          </p>
          <p>
            <strong>❌ DON&apos;T:</strong> Show UI elements that will always be
            disabled without explanation
          </p>
        </div>
      </div>
    </div>
  );
}
