export * from '@/convex/_shared/permissions';

/**
 * Utility function to check if a user permission matches a required permission
 * Supports exact matches and wildcard patterns
 */
export function permissionMatches(
  userPermission: string,
  requiredPermission: string,
): boolean {
  // Exact match
  if (userPermission === requiredPermission) {
    return true;
  }

  // Full wildcard permission
  if (userPermission === '*') {
    return true;
  }

  // Scoped wildcard permissions (e.g., "issue:*" matches "issue:create")
  if (userPermission.endsWith(':*')) {
    const prefix = userPermission.slice(0, -1); // Remove the "*"
    return requiredPermission.startsWith(prefix);
  }

  return false;
}
