import { useState, useCallback } from 'react';
import { analyzeError, type ErrorInfo } from '@/lib/error-handling';
import { useMutation } from 'convex/react';
import type { FunctionReference } from 'convex/server';
import { toast } from 'sonner';

/**
 * Hook for handling Convex mutations with consistent error handling
 */
export function useConvexMutation<T extends FunctionReference<'mutation'>>(
  mutation: T,
  options?: {
    context?: string;
    onSuccess?: (result: unknown) => void;
    onError?: (error: ErrorInfo) => void;
  },
) {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<ErrorInfo | null>(null);
  const convexMutation = useMutation(mutation);

  const execute = useCallback(
    async (args?: unknown): Promise<unknown | null> => {
      setIsLoading(true);
      setError(null);

      try {
        const result = await convexMutation(
          args as Parameters<typeof convexMutation>[0],
        );

        if (options?.onSuccess) {
          options.onSuccess(result);
        }

        return result;
      } catch (err) {
        const errorInfo = analyzeError(err);
        setError(errorInfo);

        if (options?.onError) {
          options.onError(errorInfo);
        }

        return null;
      } finally {
        setIsLoading(false);
      }
    },
    [convexMutation, options],
  );

  return {
    execute,
    isLoading,
    error,
    clearError: () => setError(null),
  };
}

/**
 * Hook for handling form submissions with error handling
 */
export function useFormSubmission<
  T extends (...args: never[]) => Promise<unknown>,
>(
  mutation: T,
  options?: {
    context?: string;
    onSuccess?: (result: unknown) => void;
    onError?: (error: ErrorInfo) => void;
    successMessage?: string;
  },
) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<ErrorInfo | null>(null);

  const submit = useCallback(
    async (...args: Parameters<T>): Promise<unknown | null> => {
      setIsSubmitting(true);
      setError(null);

      try {
        const result = await mutation(...args);

        if (options?.onSuccess) {
          options.onSuccess(result);
        }

        if (options?.successMessage) {
          toast.success(options.successMessage);
        }

        return result;
      } catch (err) {
        const errorInfo = analyzeError(err);
        setError(errorInfo);

        if (options?.onError) {
          options.onError(errorInfo);
        }

        return null;
      } finally {
        setIsSubmitting(false);
      }
    },
    [mutation, options],
  );

  return {
    submit,
    isSubmitting,
    error,
    clearError: () => setError(null),
  };
}

/**
 * Hook for handling async operations with retry logic
 */
export function useAsyncOperation<
  T extends (...args: never[]) => Promise<unknown>,
>(
  operation: T,
  options?: {
    context?: string;
    maxRetries?: number;
    retryDelay?: number;
    onSuccess?: (result: unknown) => void;
    onError?: (error: ErrorInfo) => void;
  },
) {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<ErrorInfo | null>(null);
  const [retryCount, setRetryCount] = useState(0);

  const execute = useCallback(
    async (...args: Parameters<T>): Promise<unknown | null> => {
      setIsLoading(true);
      setError(null);

      const maxRetries = options?.maxRetries ?? 3;
      const retryDelay = options?.retryDelay ?? 1000;

      for (let attempt = 0; attempt <= maxRetries; attempt++) {
        try {
          const result = await operation(...args);

          if (options?.onSuccess) {
            options.onSuccess(result);
          }

          setRetryCount(0);
          return result;
        } catch (err) {
          const errorInfo = analyzeError(err);

          if (attempt === maxRetries) {
            setError(errorInfo);
            setRetryCount(0);

            if (options?.onError) {
              options.onError(errorInfo);
            }

            return null;
          }

          // Only retry if the error is retryable
          if (!errorInfo.retryable) {
            setError(errorInfo);
            setRetryCount(0);

            if (options?.onError) {
              options.onError(errorInfo);
            }

            return null;
          }

          setRetryCount(attempt + 1);

          // Wait before retrying
          await new Promise(resolve =>
            setTimeout(resolve, retryDelay * (attempt + 1)),
          );
        }
      }

      setIsLoading(false);
      return null;
    },
    [operation, options],
  );

  return {
    execute,
    isLoading,
    error,
    retryCount,
    clearError: () => setError(null),
  };
}
