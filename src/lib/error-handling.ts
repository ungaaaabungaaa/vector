import { toast } from 'sonner';

// Error categories for better UX
export type ErrorCategory =
  | 'validation'
  | 'permission'
  | 'not_found'
  | 'conflict'
  | 'network'
  | 'server'
  | 'unknown';

// Error information structure
export interface ErrorInfo {
  category: ErrorCategory;
  message: string;
  userMessage: string;
  retryable: boolean;
  code?: string;
}

// Common error patterns and their user-friendly messages
const ERROR_PATTERNS: Array<{
  pattern: RegExp;
  category: ErrorCategory;
  userMessage: string;
  retryable: boolean;
}> = [
  // Validation errors
  {
    pattern: /required|cannot be empty/i,
    category: 'validation',
    userMessage: 'Please check your input and try again.',
    retryable: false,
  },
  {
    pattern: /must be at least|must be less than|invalid/i,
    category: 'validation',
    userMessage: 'Please check your input and try again.',
    retryable: false,
  },

  // Permission errors
  {
    pattern: /not authenticated|unauthorized/i,
    category: 'permission',
    userMessage: 'Please sign in to continue.',
    retryable: false,
  },
  {
    pattern: /access denied|insufficient permissions|not a member/i,
    category: 'permission',
    userMessage: "You don't have permission to perform this action.",
    retryable: false,
  },

  // Not found errors
  {
    pattern: /not found/i,
    category: 'not_found',
    userMessage: 'The requested resource was not found.',
    retryable: false,
  },

  // Conflict errors
  {
    pattern: /already exists|already a member|duplicate/i,
    category: 'conflict',
    userMessage: 'This item already exists.',
    retryable: false,
  },

  // Network errors
  {
    pattern: /network|connection|timeout/i,
    category: 'network',
    userMessage: 'Network error. Please check your connection and try again.',
    retryable: true,
  },

  // Server errors
  {
    pattern: /server|internal|error/i,
    category: 'server',
    userMessage: 'Something went wrong. Please try again later.',
    retryable: true,
  },
];

/**
 * Analyze an error and return structured error information
 */
export function analyzeError(error: unknown): ErrorInfo {
  const errorMessage = error instanceof Error ? error.message : String(error);

  // Check for known patterns
  for (const { pattern, category, userMessage, retryable } of ERROR_PATTERNS) {
    if (pattern.test(errorMessage)) {
      return {
        category,
        message: errorMessage,
        userMessage,
        retryable,
      };
    }
  }

  // Default to unknown error
  return {
    category: 'unknown',
    message: errorMessage,
    userMessage: 'Something went wrong. Please try again.',
    retryable: true,
  };
}

/**
 * Show appropriate toast notification based on error category
 */
export function showErrorToast(error: unknown, context?: string): void {
  const errorInfo = analyzeError(error);

  const title = context ? `${context} failed` : 'Operation failed';

  switch (errorInfo.category) {
    case 'validation':
      toast.error(title, {
        description: errorInfo.userMessage,
      });
      break;

    case 'permission':
      toast.error(title, {
        description: errorInfo.userMessage,
      });
      break;

    case 'not_found':
      toast.error(title, {
        description: errorInfo.userMessage,
      });
      break;

    case 'conflict':
      toast.warning(title, {
        description: errorInfo.userMessage,
      });
      break;

    case 'network':
      toast.error(title, {
        description: errorInfo.userMessage,
      });
      break;

    case 'server':
      toast.error(title, {
        description: errorInfo.userMessage,
      });
      break;

    default:
      toast.error(title, {
        description: errorInfo.userMessage,
      });
      break;
  }
}

/**
 * Show success toast notification
 */
export function showSuccessToast(message: string, context?: string): void {
  const title = context ? `${context} successful` : 'Success';
  toast.success(title, {
    description: message,
  });
}

/**
 * Wrapper for mutation error handling with consistent UX
 */
export async function handleMutationError<T>(
  mutationFn: () => Promise<T>,
  context?: string,
  onSuccess?: (result: T) => void,
  onError?: (error: ErrorInfo) => void,
): Promise<T | null> {
  try {
    const result = await mutationFn();

    if (onSuccess) {
      onSuccess(result);
    }

    return result;
  } catch (error) {
    const errorInfo = analyzeError(error);

    showErrorToast(error, context);

    if (onError) {
      onError(errorInfo);
    }

    return null;
  }
}

/**
 * Hook for consistent mutation error handling
 */
export function useMutationErrorHandler() {
  return {
    handleError: (error: unknown, context?: string) => {
      showErrorToast(error, context);
    },
    handleSuccess: (message: string, context?: string) => {
      showSuccessToast(message, context);
    },
    handleMutation: <T>(
      mutationFn: () => Promise<T>,
      context?: string,
      onSuccess?: (result: T) => void,
      onError?: (error: ErrorInfo) => void,
    ) => handleMutationError(mutationFn, context, onSuccess, onError),
  };
}
