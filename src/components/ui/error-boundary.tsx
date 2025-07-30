"use client";

import React from "react";
import { AlertTriangle, RefreshCw, Home, ArrowLeft } from "lucide-react";
import { Button } from "./button";

interface ErrorInfo {
  componentStack: string;
  errorBoundary?: string;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

interface ErrorBoundaryProps {
  children: React.ReactNode;
  fallback?: React.ComponentType<{
    error: Error;
    retry: () => void;
    goHome: () => void;
  }>;
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
}

export class ErrorBoundary extends React.Component<
  ErrorBoundaryProps,
  ErrorBoundaryState
> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
    };
  }

  static getDerivedStateFromError(error: Error): Partial<ErrorBoundaryState> {
    return {
      hasError: true,
      error,
    };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    this.setState({
      errorInfo,
    });

    // Log error to monitoring service
    console.error("Error caught by boundary:", error, errorInfo);

    if (this.props.onError) {
      this.props.onError(error, errorInfo);
    }
  }

  retry = () => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
    });
  };

  goHome = () => {
    window.location.href = "/";
  };

  render() {
    if (this.state.hasError && this.state.error) {
      if (this.props.fallback) {
        const FallbackComponent = this.props.fallback;
        return (
          <FallbackComponent
            error={this.state.error}
            retry={this.retry}
            goHome={this.goHome}
          />
        );
      }

      return (
        <DefaultErrorFallback
          error={this.state.error}
          retry={this.retry}
          goHome={this.goHome}
        />
      );
    }

    return this.props.children;
  }
}

interface DefaultErrorFallbackProps {
  error: Error;
  retry: () => void;
  goHome: () => void;
}

function DefaultErrorFallback({
  error,
  retry,
  goHome,
}: DefaultErrorFallbackProps) {
  const isUnauthorized =
    error.message.includes("FORBIDDEN") ||
    error.message.includes("Unauthorized") ||
    error.message.includes("Access denied");

  const isNotFound =
    error.message.includes("not found") || error.message.includes("Not found");

  if (isUnauthorized) {
    return <UnauthorizedErrorFallback goHome={goHome} />;
  }

  if (isNotFound) {
    return <NotFoundErrorFallback goHome={goHome} retry={retry} />;
  }

  return <GenericErrorFallback error={error} retry={retry} goHome={goHome} />;
}

function UnauthorizedErrorFallback({ goHome }: { goHome: () => void }) {
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
            You don&apos;t have permission to access this resource.
          </p>
        </div>

        <div className="flex flex-col gap-3 pt-2">
          <Button onClick={goHome} className="gap-2">
            <Home className="size-4" />
            Go to Dashboard
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

function NotFoundErrorFallback({
  goHome,
  retry,
}: {
  goHome: () => void;
  retry: () => void;
}) {
  return (
    <div className="bg-background flex min-h-[400px] w-full items-center justify-center p-4">
      <div className="max-w-md space-y-6 text-center">
        <div className="space-y-2">
          <h2 className="text-foreground text-xl font-semibold">Not Found</h2>
          <p className="text-muted-foreground text-sm">
            The resource you&apos;re looking for doesn&apos;t exist or has been
            moved.
          </p>
        </div>

        <div className="flex flex-col gap-3 pt-2">
          <Button onClick={retry} variant="outline" className="gap-2">
            <RefreshCw className="size-4" />
            Try Again
          </Button>

          <Button onClick={goHome} className="gap-2">
            <Home className="size-4" />
            Go to Dashboard
          </Button>
        </div>
      </div>
    </div>
  );
}

function GenericErrorFallback({
  error,
  retry,
  goHome,
}: DefaultErrorFallbackProps) {
  const isDevelopment = process.env.NODE_ENV === "development";

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
            Something went wrong
          </h2>
          <p className="text-muted-foreground text-sm">
            An unexpected error occurred. Please try again or contact support if
            the problem persists.
          </p>

          {isDevelopment && (
            <details className="text-muted-foreground mt-4 text-left text-xs">
              <summary className="cursor-pointer font-medium">
                Error Details (Development)
              </summary>
              <pre className="bg-muted mt-2 rounded p-2 text-wrap">
                {error.message}
                {error.stack && `\n\n${error.stack}`}
              </pre>
            </details>
          )}
        </div>

        <div className="flex flex-col gap-3 pt-2">
          <Button onClick={retry} className="gap-2">
            <RefreshCw className="size-4" />
            Try Again
          </Button>

          <Button onClick={goHome} variant="outline" className="gap-2">
            <Home className="size-4" />
            Go to Dashboard
          </Button>
        </div>
      </div>
    </div>
  );
}

// Hook version for functional components
export function useErrorBoundary() {
  const [error, setError] = React.useState<Error | null>(null);

  const captureError = React.useCallback((error: Error) => {
    setError(error);
  }, []);

  React.useEffect(() => {
    if (error) {
      throw error;
    }
  }, [error]);

  return captureError;
}
