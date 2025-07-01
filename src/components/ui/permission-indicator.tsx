"use client";

import { Badge } from "./badge";
import { usePermission } from "@/hooks/use-permissions";
import type { Permission } from "@/auth/permission-constants";

interface PermissionIndicatorProps {
  orgSlug: string;
  permission: Permission;
  label?: string;
}

/**
 * Simple component to show whether a user has a specific permission.
 * Useful for debugging or admin interfaces.
 */
export function PermissionIndicator({
  orgSlug,
  permission,
  label,
}: PermissionIndicatorProps) {
  const { hasPermission, isLoading } = usePermission(orgSlug, permission);

  if (isLoading) {
    return (
      <Badge variant="outline" className="text-xs">
        {label || permission}: checking...
      </Badge>
    );
  }

  return (
    <Badge
      variant={hasPermission ? "default" : "secondary"}
      className={`text-xs ${
        hasPermission
          ? "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-100"
          : "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-100"
      }`}
    >
      {label || permission}: {hasPermission ? "✓" : "✗"}
    </Badge>
  );
}
