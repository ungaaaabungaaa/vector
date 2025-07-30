"use client";

import React, { createContext, useContext } from "react";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Lock, Shield, AlertTriangle, Home, ArrowLeft } from "lucide-react";
import {
  usePermission,
  useScopedPermission,
  type PermissionScope,
} from "@/hooks/use-permissions";
import { cn } from "@/lib/utils";
import type { Permission } from "@/convex/_shared/permissions";

// Access Context - generic for various access states
interface AccessContextValue {
  viewOnly: boolean;
  isLoading: boolean;
  hasPermission: boolean;
  // Future access states can be added here:
  // canEdit?: boolean;
  // canDelete?: boolean;
  // canCreate?: boolean;
  // accessLevel?: 'none' | 'read' | 'write' | 'admin';
}

const AccessContext = createContext<AccessContextValue>({
  viewOnly: false,
  isLoading: false,
  hasPermission: true,
});

// Hook to access all access-related states
export function useAccess(): AccessContextValue {
  return useContext(AccessContext);
}

// Legacy hook for backward compatibility (can be removed later)
export function useViewOnly(): boolean {
  const { viewOnly } = useContext(AccessContext);
  return viewOnly;
}

// Hook to access permission context (alias for useAccess for clarity)
export function usePermissionContext(): AccessContextValue {
  return useAccess();
}

// Base interfaces
interface BasePermissionProps {
  orgSlug: string;
  permission: Permission;
  scope?: PermissionScope;
  fallbackMessage?: string;
  showPermissionIndicator?: boolean;
  disabled?: boolean;
  className?: string;
}

// Component-specific interfaces
interface PermissionAwareButtonProps
  extends BasePermissionProps,
    React.ComponentProps<typeof Button> {
  children: React.ReactNode;
  onClick?: () => void;
}

interface PermissionAwareWrapperProps extends BasePermissionProps {
  children: React.ReactNode;
  fallbackMessage?: string;
  showPermissionIndicator?: boolean;
}

interface PermissionAwareFieldProps extends BasePermissionProps {
  children: React.ReactNode;
}

/**
 * Main PermissionAware component that provides access context to children
 */
interface PermissionAwareProps extends BasePermissionProps {
  children: React.ReactNode;
  fallbackMessage?: string;
  showTooltip?: boolean;
}

export function PermissionAware({
  children,
  orgSlug,
  permission,
  scope,
  fallbackMessage = "You don't have permission for this action",
  showTooltip = true,
}: PermissionAwareProps) {
  // Always call both hooks to maintain consistent order
  const scopedResult = useScopedPermission(scope || { orgSlug }, permission);
  const unscopeResult = usePermission(orgSlug, permission);

  // Use the appropriate result based on whether scope is provided
  const { hasPermission, isLoading } = scope ? scopedResult : unscopeResult;

  const contextValue: AccessContextValue = {
    viewOnly: !hasPermission,
    isLoading,
    hasPermission,
    // Future access states can be computed here:
    // canEdit: hasPermission && someOtherCondition,
    // canDelete: hasPermission && deletePermission,
    // accessLevel: computeAccessLevel(hasPermission, otherPermissions),
  };

  if (isLoading) {
    return (
      <AccessContext.Provider value={contextValue}>
        <div className="animate-pulse">{children}</div>
      </AccessContext.Provider>
    );
  }

  if (!hasPermission && showTooltip) {
    return (
      <AccessContext.Provider value={contextValue}>
        <Tooltip>
          <TooltipTrigger asChild>
            <div className="relative">{children}</div>
          </TooltipTrigger>
          <TooltipContent>
            <p>{fallbackMessage}</p>
          </TooltipContent>
        </Tooltip>
      </AccessContext.Provider>
    );
  }

  return (
    <AccessContext.Provider value={contextValue}>
      {children}
    </AccessContext.Provider>
  );
}

/**
 * Legacy PermissionAwareSelector - now just wraps PermissionAware
 * @deprecated Use PermissionAware instead
 */
interface PermissionAwareSelectorProps extends BasePermissionProps {
  children: React.ReactNode;
  fallbackMessage?: string;
  allowDropdownView?: boolean;
}

export function PermissionAwareSelector({
  children,
  orgSlug,
  permission,
  scope,
  fallbackMessage = "You don't have permission to change this selection",
}: PermissionAwareSelectorProps) {
  return (
    <PermissionAware
      orgSlug={orgSlug}
      permission={permission}
      scope={scope}
      fallbackMessage={fallbackMessage}
      showTooltip={true}
    >
      {children}
    </PermissionAware>
  );
}

interface PermissionStatusProps {
  orgSlug: string;
  permission: Permission;
  scope?: PermissionScope;
  showIcon?: boolean;
  showText?: boolean;
  className?: string;
}

interface PermissionGateProps {
  orgSlug: string;
  permission: Permission;
  scope?: PermissionScope;
  children: React.ReactNode;
  fallback?: React.ReactNode;
  loading?: React.ReactNode;
}

interface PageProtectionProps {
  orgSlug: string;
  requiredPermissions: Permission[];
  scope?: PermissionScope;
  children: React.ReactNode;
  fallbackPath?: string;
}

/**
 * Simple hook to check permissions and get loading state
 * This is the function the user requested for easy UI permission checks
 */
export function usePermissionCheck(
  orgSlug: string,
  permission: Permission,
  scope?: PermissionScope,
) {
  const scopedResult = useScopedPermission(scope || { orgSlug }, permission);
  const orgResult = usePermission(orgSlug, permission);

  const result = scope ? scopedResult : orgResult;

  return {
    isAllowed: result.hasPermission,
    isLoading: result.isLoading,
  };
}

/**
 * Permission gate component that shows/hides content based on permissions
 */
export function PermissionGate({
  orgSlug,
  permission,
  scope,
  children,
  fallback = null,
  loading = <div>Loading...</div>,
}: PermissionGateProps) {
  const scopedResult = useScopedPermission(scope || { orgSlug }, permission);
  const orgResult = usePermission(orgSlug, permission);

  const { hasPermission, isLoading } = scope ? scopedResult : orgResult;

  if (isLoading) {
    return <>{loading}</>;
  }

  if (!hasPermission) {
    return <>{fallback}</>;
  }

  return <>{children}</>;
}

/**
 * Page-level protection component that handles unauthorized access
 */

// New component to check a single permission
function SinglePermissionCheck({
  orgSlug,
  permission,
  scope,
  onResult,
}: {
  orgSlug: string;
  permission: Permission;
  scope?: PermissionScope;
  onResult: (hasPermission: boolean, isLoading: boolean) => void;
}) {
  const scopedResult = useScopedPermission(scope || { orgSlug }, permission);
  const orgResult = usePermission(orgSlug, permission);
  const { hasPermission, isLoading } = scope ? scopedResult : orgResult;

  React.useEffect(() => {
    onResult(hasPermission, isLoading);
  }, [hasPermission, isLoading, onResult]);

  return null; // This component does not render anything itself
}

// New component to check multiple permissions
function MultiPermissionChecker({
  orgSlug,
  permissions,
  scope,
  onFinished,
}: {
  orgSlug: string;
  permissions: Permission[];
  scope?: PermissionScope;
  onFinished: (results: { allGranted: boolean; allFinished: boolean }) => void;
}) {
  const [permissionStates, setPermissionStates] = React.useState<
    Record<string, { hasPermission: boolean; isLoading: boolean }>
  >({});

  const handleResult = React.useCallback(
    (permission: Permission, hasPermission: boolean, isLoading: boolean) => {
      setPermissionStates((prev) => ({
        ...prev,
        [permission]: { hasPermission, isLoading },
      }));
    },
    [],
  );

  React.useEffect(() => {
    const allFinished =
      Object.keys(permissionStates).length === permissions.length &&
      Object.values(permissionStates).every((state) => !state.isLoading);

    const allGranted =
      allFinished &&
      Object.values(permissionStates).every((state) => state.hasPermission);

    if (allFinished) {
      onFinished({ allGranted, allFinished });
    }
  }, [permissionStates, permissions.length, onFinished]);

  return (
    <>
      {permissions.map((permission) => (
        <SinglePermissionCheck
          key={permission}
          orgSlug={orgSlug}
          permission={permission}
          scope={scope}
          onResult={(hasPermission, isLoading) =>
            handleResult(permission, hasPermission, isLoading)
          }
        />
      ))}
    </>
  );
}

export function PageProtection({
  orgSlug,
  requiredPermissions,
  scope,
  children,
  fallbackPath = "/",
}: PageProtectionProps) {
  const [permissionResult, setPermissionResult] = React.useState<{
    allGranted: boolean;
    allFinished: boolean;
  }>({ allGranted: false, allFinished: false });

  if (!permissionResult.allFinished) {
    return (
      <>
        <MultiPermissionChecker
          orgSlug={orgSlug}
          permissions={requiredPermissions}
          scope={scope}
          onFinished={setPermissionResult}
        />
        <div className="flex h-screen w-full items-center justify-center">
          <div className="space-y-4 text-center">
            <div className="border-primary mx-auto h-8 w-8 animate-spin rounded-full border-b-2" />
            <p className="text-muted-foreground">Checking permissions...</p>
          </div>
        </div>
      </>
    );
  }

  if (!permissionResult.allGranted) {
    return (
      <div className="bg-background flex min-h-[400px] w-full items-center justify-center p-4">
        <div className="max-w-md space-y-6 text-center">
          <div className="flex justify-center">
            <div className="bg-destructive/10 rounded-full p-4">
              <AlertTriangle className="text-destructive size-12" />
            </div>
          </div>
          <div className="space-y-2">
            <h2 className="text-foreground text-xl font-semibold">
              Access Denied
            </h2>
            <p className="text-muted-foreground text-sm">
              You don&apos;t have permission to access this page.
            </p>
          </div>
          <div className="flex flex-col gap-3 pt-2">
            <Button
              onClick={() => (window.location.href = fallbackPath)}
              className="gap-2"
            >
              <Home className="size-4" />
              Go Home
            </Button>
            <Button
              variant="outline"
              onClick={() => window.history.back()}
              className="gap-2"
            >
              <ArrowLeft className="size-4" />
              Go Back
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}

export function PermissionAwareButton({
  orgSlug,
  permission,
  scope,
  fallbackMessage = "You don't have permission for this action",
  showPermissionIndicator = true,
  children,
  onClick,
  disabled = false,
  className,
  ...buttonProps
}: PermissionAwareButtonProps) {
  const scopedResult = useScopedPermission(scope || { orgSlug }, permission);
  const orgResult = usePermission(orgSlug, permission);

  const { hasPermission, isLoading } = scope ? scopedResult : orgResult;

  const isDisabled = disabled || isLoading || !hasPermission;
  const tooltipMessage = !hasPermission ? fallbackMessage : undefined;

  const button = (
    <Button
      {...buttonProps}
      disabled={isDisabled}
      onClick={hasPermission ? onClick : undefined}
      className={cn(!hasPermission && "opacity-60", className)}
    >
      {showPermissionIndicator && !hasPermission && (
        <Lock className="mr-1 size-3" />
      )}
      {children}
    </Button>
  );

  if (tooltipMessage) {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>{button}</TooltipTrigger>
          <TooltipContent>
            <p>{tooltipMessage}</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  return button;
}

export function PermissionAwareWrapper({
  children,
  orgSlug,
  permission,
  scope,
  fallbackMessage = "You don't have permission to perform this action",
  showPermissionIndicator = false, // Default to false since user doesn't like the lock icon
}: PermissionAwareWrapperProps) {
  // Always call both hooks to maintain consistent order
  const scopedResult = useScopedPermission(scope || { orgSlug }, permission);
  const orgResult = usePermission(orgSlug, permission);

  // Use the appropriate result based on whether scope is provided
  const { hasPermission, isLoading } = scope ? scopedResult : orgResult;

  if (isLoading) {
    return <div className="animate-pulse">{children}</div>;
  }

  if (!hasPermission) {
    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <div
            className="relative cursor-not-allowed select-text"
            style={{ pointerEvents: "none" }}
            onClick={(e) => e.preventDefault()}
          >
            {children}
            {/* Remove the lock indicator by default */}
            {showPermissionIndicator && (
              <div className="absolute top-0 right-0 -mt-1 -mr-1">
                <div className="bg-muted text-muted-foreground flex h-4 w-4 items-center justify-center rounded-full text-xs">
                  <Lock className="h-2 w-2" />
                </div>
              </div>
            )}
          </div>
        </TooltipTrigger>
        <TooltipContent>
          <p>{fallbackMessage}</p>
        </TooltipContent>
      </Tooltip>
    );
  }

  return <>{children}</>;
}

export function PermissionAwareField({
  orgSlug,
  permission,
  scope,
  fallbackMessage = "You don't have permission to edit this field",
  showPermissionIndicator = true,
  children,
  disabled = false,
  className,
}: PermissionAwareFieldProps) {
  const scopedResult = useScopedPermission(scope || { orgSlug }, permission);
  const orgResult = usePermission(orgSlug, permission);

  const { hasPermission, isLoading } = scope ? scopedResult : orgResult;

  const isDisabled = disabled || isLoading || !hasPermission;

  return (
    <div className={cn("relative", className)}>
      <div
        className={cn(
          !hasPermission && "opacity-60",
          isDisabled && "pointer-events-none",
        )}
      >
        {React.Children.map(children, (child) => {
          if (React.isValidElement(child)) {
            return React.cloneElement(child, {
              disabled: isDisabled,
            } as Partial<typeof child.props>);
          }
          return child;
        })}
      </div>

      {showPermissionIndicator && !hasPermission && (
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <div className="absolute top-2 right-2 z-10">
                <Shield className="text-muted-foreground size-3" />
              </div>
            </TooltipTrigger>
            <TooltipContent>
              <p>{fallbackMessage}</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      )}
    </div>
  );
}

export function PermissionStatus({
  orgSlug,
  permission,
  scope,
  showIcon = true,
  showText = false,
  className,
}: PermissionStatusProps) {
  const scopedResult = useScopedPermission(scope || { orgSlug }, permission);
  const orgResult = usePermission(orgSlug, permission);

  const { hasPermission, isLoading } = scope ? scopedResult : orgResult;

  if (isLoading) {
    return (
      <div className={cn("inline-flex items-center gap-1", className)}>
        <div className="bg-muted size-3 animate-pulse rounded-full" />
        {showText && (
          <span className="text-muted-foreground text-xs">Checking...</span>
        )}
      </div>
    );
  }

  return (
    <div className={cn("inline-flex items-center gap-1", className)}>
      {showIcon && (
        <div
          className={cn(
            "size-2 rounded-full",
            hasPermission ? "bg-green-500" : "bg-red-500",
          )}
        />
      )}
      {showText && (
        <span
          className={cn(
            "text-xs",
            hasPermission ? "text-green-600" : "text-red-600",
          )}
        >
          {hasPermission ? "Allowed" : "Denied"}
        </span>
      )}
    </div>
  );
}
