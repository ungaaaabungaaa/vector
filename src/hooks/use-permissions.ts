import { trpc } from "@/lib/trpc";
import type { Permission } from "@/auth/permission-constants";

/**
 * React hook for checking user permissions in an organization.
 * Returns a boolean indicating if the user has the requested permission.
 *
 * @param orgSlug - Organization slug
 * @param permission - Permission to check
 * @returns Object with { hasPermission: boolean, isLoading: boolean }
 */
export function usePermission(orgSlug: string, permission: Permission) {
  const { data: hasPermission = false, isLoading } =
    trpc.organization.hasPermission.useQuery(
      { orgSlug, permission },
      {
        enabled: !!orgSlug && !!permission,
        staleTime: 5 * 60 * 1000, // 5 minutes
        refetchOnWindowFocus: false,
      },
    );

  return { hasPermission, isLoading };
}

/**
 * React hook for checking multiple permissions at once.
 * Returns a map of permission -> boolean for efficient bulk checking.
 */
export function usePermissions(orgSlug: string, permissions: Permission[]) {
  const { data: permissionMap = {}, isLoading } =
    trpc.organization.hasPermissions.useQuery(
      { orgSlug, permissions },
      {
        enabled: !!orgSlug && permissions.length > 0,
        staleTime: 5 * 60 * 1000, // 5 minutes
        refetchOnWindowFocus: false,
      },
    );

  return { permissions: permissionMap, isLoading };
}

/**
 * Higher-order component that conditionally renders children based on permission.
 *
 * @example
 * <PermissionGate orgSlug="acme" permission="project:create">
 *   <CreateProjectButton />
 * </PermissionGate>
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
  const { hasPermission, isLoading } = usePermission(orgSlug, permission);

  if (isLoading) return null;
  if (!hasPermission) return fallback;

  return children;
}
