'use client';
import React from 'react';
import { useQuery } from 'convex/react';
import { api } from '@/lib/convex';
import type { Permission } from '@/convex/_shared/permissions';
import type { Id } from '../../convex/_generated/dataModel';

// Permission scope for client-side permission checks
export interface PermissionScope {
  orgSlug: string;
  teamId?: Id<'teams'>;
  projectId?: Id<'projects'>;
}

/**
 * React hook for checking user permissions with optional scope.
 * Returns a boolean indicating if the user has the requested permission.
 */
export function useScopedPermission(
  scope: PermissionScope,
  permission: Permission,
) {
  const isClient = typeof window !== 'undefined';

  const hasPermission = useQuery(
    api.permissions.queries.has,
    scope.orgSlug && permission && isClient
      ? {
          orgSlug: scope.orgSlug,
          permission,
          teamId: scope.teamId,
          projectId: scope.projectId,
        }
      : 'skip',
  );

  if (!isClient || hasPermission === undefined) {
    return {
      hasPermission: false,
      isLoading: true,
    };
  }

  return {
    hasPermission: hasPermission ?? false,
    isLoading: false,
  };
}

/**
 * Legacy hook for backwards compatibility.
 */
export function usePermission(orgSlug: string, permission: Permission) {
  return useScopedPermission({ orgSlug }, permission);
}

/**
 * React hook for checking multiple permissions at once with optional scope.
 */
export function useScopedPermissions(
  scope: PermissionScope,
  permissions: Permission[],
) {
  const isClient = typeof window !== 'undefined';

  const permissionMap = useQuery(
    api.permissions.queries.hasMultiple,
    scope.orgSlug && permissions.length > 0 && isClient
      ? {
          orgSlug: scope.orgSlug,
          permissions,
          teamId: scope.teamId,
          projectId: scope.projectId,
        }
      : 'skip',
  );

  if (!isClient || permissionMap === undefined) {
    return {
      permissions: {},
      isLoading: true,
    };
  }

  return {
    permissions: permissionMap ?? {},
    isLoading: false,
  };
}

/**
 * Legacy hook for backwards compatibility.
 */
export function usePermissions(orgSlug: string, permissions: Permission[]) {
  return useScopedPermissions({ orgSlug }, permissions);
}

/**
 * Higher-order component that conditionally renders children based on scoped permission.
 */
interface ScopedPermissionGateProps {
  scope: PermissionScope;
  permission: Permission;
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

export function ScopedPermissionGate({
  scope,
  permission,
  children,
  fallback = null,
}: ScopedPermissionGateProps) {
  const { hasPermission, isLoading } = useScopedPermission(scope, permission);

  if (isLoading) return null;
  if (!hasPermission) return fallback;

  return <>{children}</>;
}

/**
 * Legacy component for backwards compatibility.
 */
interface PermissionGateProps {
  orgSlug: string;
  permission: Permission;
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

export function PermissionGate({
  orgSlug,
  permission,
  children,
  fallback = null,
}: PermissionGateProps) {
  return (
    <ScopedPermissionGate
      scope={{ orgSlug }}
      permission={permission}
      fallback={fallback}
    >
      {children}
    </ScopedPermissionGate>
  );
}

/**
 * Hook that returns a memoized scoped permission checker function.
 */
export function useScopedPermissionChecker(
  scope: PermissionScope,
  permissions: Permission[],
) {
  const { permissions: permissionMap, isLoading } = useScopedPermissions(
    scope,
    permissions,
  );

  const checker = React.useCallback(
    (permission: Permission) => {
      return permissionMap[permission] ?? false;
    },
    [permissionMap],
  );

  return { can: checker, isLoading };
}

/**
 * Legacy hook for backwards compatibility.
 */
export function usePermissionChecker(
  orgSlug: string,
  permissions: Permission[],
) {
  return useScopedPermissionChecker({ orgSlug }, permissions);
}
