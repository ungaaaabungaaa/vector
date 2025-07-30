"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { useErrorBoundary } from "@/components/ui/error-boundary";
import { usePermission } from "@/hooks/use-permissions";
import type { Permission } from "@/convex/_shared/permissions";

interface SafeActionOptions {
  // Permission checking
  orgSlug?: string;
  permission?: Permission;

  // Error handling
  onError?: (error: Error) => void;
  onSuccess?: (result?: unknown) => void;

  // UI feedback
  loadingMessage?: string;
  successMessage?: string;
  errorMessage?: string;

  // Navigation
  redirectTo?: string;

  // Confirmation
  requireConfirmation?: boolean;
  confirmationMessage?: string;
}

interface SafeActionResult {
  execute: (...args: unknown[]) => Promise<void>;
  isLoading: boolean;
  error: Error | null;
  hasPermission: boolean;
  canExecute: boolean;
}

/**
 * Hook for executing actions safely with permission checking, error handling, and UI feedback
 */
export function useSafeAction(
  action: (...args: unknown[]) => Promise<unknown>,
  options: SafeActionOptions = {},
): SafeActionResult {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const router = useRouter();
  const captureError = useErrorBoundary();

  // Check permissions if required
  const { hasPermission: permissionResult, isLoading: permissionLoading } =
    usePermission(
      options.orgSlug || "",
      options.permission || "org:view", // fallback permission
    );

  const hasPermission = !options.permission || permissionResult;
  const canExecute = hasPermission && !isLoading && !permissionLoading;

  const execute = useCallback(
    async (...args: unknown[]) => {
      // Clear previous errors
      setError(null);

      // Check permissions first
      if (options.permission && !hasPermission) {
        const permissionError = new Error("FORBIDDEN");
        setError(permissionError);

        if (options.onError) {
          options.onError(permissionError);
        } else {
          toast.error("You don't have permission to perform this action");
          router.push("/403");
        }
        return;
      }

      // Confirmation dialog if required
      if (options.requireConfirmation) {
        const confirmed = window.confirm(
          options.confirmationMessage ||
            "Are you sure you want to perform this action?",
        );
        if (!confirmed) {
          return;
        }
      }

      setIsLoading(true);

      // Show loading toast if message provided
      if (options.loadingMessage) {
        toast.loading(options.loadingMessage);
      }

      try {
        const result = await action(...args);

        // Handle success
        if (options.successMessage) {
          toast.dismiss();
          toast.success(options.successMessage);
        }

        if (options.onSuccess) {
          options.onSuccess(result);
        }

        // Navigate if redirect specified
        if (options.redirectTo) {
          router.push(options.redirectTo);
        }
      } catch (err) {
        const error = err instanceof Error ? err : new Error(String(err));
        setError(error);

        // Dismiss loading toast
        toast.dismiss();

        // Handle specific error types
        if (
          error.message === "FORBIDDEN" ||
          error.message.includes("FORBIDDEN")
        ) {
          toast.error("You don't have permission to perform this action");
          router.push("/403");
          return;
        }

        if (
          error.message.includes("not found") ||
          error.message.includes("Not found")
        ) {
          toast.error("The requested resource was not found");
          router.push("/404");
          return;
        }

        // Handle network/connectivity errors
        if (
          error.message.includes("fetch") ||
          error.message.includes("network")
        ) {
          toast.error(
            "Network error. Please check your connection and try again.",
          );
          return;
        }

        // Handle validation errors
        if (
          error.message.includes("validation") ||
          error.message.includes("invalid")
        ) {
          toast.error("Please check your input and try again");
          return;
        }

        // General error handling
        const errorMessage =
          options.errorMessage || "An unexpected error occurred";
        toast.error(errorMessage);

        if (options.onError) {
          options.onError(error);
        }

        // Capture error for error boundary if it's a critical error
        if (
          error.message.includes("CRITICAL") ||
          error.message.includes("CRASH")
        ) {
          captureError(error);
        }
      } finally {
        setIsLoading(false);
      }
    },
    [action, options, hasPermission, router, captureError],
  );

  return {
    execute,
    isLoading,
    error,
    hasPermission,
    canExecute,
  };
}

/**
 * Hook for form submissions with validation and error handling
 */
export function useSafeSubmit(
  submitAction: (data: Record<string, unknown>) => Promise<unknown>,
  options: SafeActionOptions & {
    validateData?: (data: Record<string, unknown>) => string | null;
    resetForm?: () => void;
  } = {},
) {
  const safeAction = useSafeAction(
    (data: unknown) => submitAction(data as Record<string, unknown>),
    {
      ...options,
      loadingMessage: options.loadingMessage || "Submitting...",
      successMessage: options.successMessage || "Saved successfully",
    },
  );

  const submit = useCallback(
    async (data: Record<string, unknown>) => {
      // Validate data if validator provided
      if (options.validateData) {
        const validationError = options.validateData(data);
        if (validationError) {
          toast.error(validationError);
          return;
        }
      }

      await safeAction.execute(data);

      // Reset form on successful submission if requested
      if (options.resetForm && !safeAction.error) {
        options.resetForm();
      }
    },
    [safeAction, options],
  );

  return {
    ...safeAction,
    submit,
  };
}

/**
 * Hook for delete operations with confirmation
 */
export function useSafeDelete(
  deleteAction: (id: string) => Promise<unknown>,
  options: Omit<
    SafeActionOptions,
    "requireConfirmation" | "confirmationMessage"
  > & {
    itemName?: string;
  } = {},
) {
  const itemName = options.itemName || "item";

  return useSafeAction((id: unknown) => deleteAction(id as string), {
    ...options,
    requireConfirmation: true,
    confirmationMessage: `Are you sure you want to delete this ${itemName}? This action cannot be undone.`,
    loadingMessage: options.loadingMessage || `Deleting ${itemName}...`,
    successMessage:
      options.successMessage || `${itemName} deleted successfully`,
    errorMessage: options.errorMessage || `Failed to delete ${itemName}`,
  });
}
