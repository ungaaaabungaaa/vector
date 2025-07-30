"use client";

import { useState } from "react";
import { useMutation } from "convex/react";
import { api } from "@/lib/convex";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertCircle } from "lucide-react";

interface DemoError {
  category?: string;
  userMessage?: string;
  message?: string;
  retryable?: boolean;
}

/**
 * Demo component showing different error handling patterns
 */
export function ErrorHandlingDemo() {
  const [selectedDemo, setSelectedDemo] = useState<string>("basic");

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Error Handling Demo</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="mb-4 flex gap-2">
            <Button
              variant={selectedDemo === "basic" ? "default" : "outline"}
              onClick={() => setSelectedDemo("basic")}
            >
              Basic Mutation
            </Button>
            <Button
              variant={selectedDemo === "form" ? "default" : "outline"}
              onClick={() => setSelectedDemo("form")}
            >
              Form Submission
            </Button>
            <Button
              variant={selectedDemo === "retry" ? "default" : "outline"}
              onClick={() => setSelectedDemo("retry")}
            >
              Retry Logic
            </Button>
          </div>

          {selectedDemo === "basic" && <BasicMutationDemo />}
          {selectedDemo === "form" && <FormSubmissionDemo />}
          {selectedDemo === "retry" && <RetryLogicDemo />}
        </CardContent>
      </Card>
    </div>
  );
}

/**
 * Basic mutation with error handling
 */
function BasicMutationDemo() {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<DemoError | null>(null);
  const inviteMutation = useMutation(api.organizations.invite);

  const handleInvite = async () => {
    setIsLoading(true);
    setError(null);

    try {
      const result = await inviteMutation({
        orgSlug: "demo",
        email: "test@example.com",
        role: "member",
      });
      console.log("Success:", result);
    } catch (err) {
      setError(err as DemoError);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold">Basic Mutation</h3>
      <p className="text-muted-foreground text-sm">
        This demo shows basic mutation error handling with automatic toast
        notifications.
      </p>

      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            <strong>Error Category:</strong> {error.category}
            <br />
            <strong>User Message:</strong> {error.userMessage}
            <br />
            <strong>Technical Message:</strong> {error.message}
          </AlertDescription>
        </Alert>
      )}

      <Button onClick={handleInvite} disabled={isLoading}>
        {isLoading ? "Sending Invite..." : "Send Demo Invite"}
      </Button>

      <div className="text-muted-foreground text-xs">
        <p>This will trigger a &quot;User is already a member&quot; error.</p>
      </div>
    </div>
  );
}

/**
 * Form submission with error handling
 */
function FormSubmissionDemo() {
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<"member" | "admin">("member");

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<DemoError | null>(null);
  const inviteMutation = useMutation(api.organizations.invite);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;

    setIsSubmitting(true);
    setError(null);

    try {
      await inviteMutation({
        orgSlug: "demo",
        email: email.trim(),
        role,
      });
      setEmail("");
      setRole("member");
    } catch (err) {
      setError(err as DemoError);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold">Form Submission</h3>
      <p className="text-muted-foreground text-sm">
        This demo shows form submission with inline error display and success
        messages.
      </p>

      <form onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{error.userMessage}</AlertDescription>
          </Alert>
        )}

        <div>
          <label className="text-sm font-medium">Email</label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="mt-1 w-full rounded-md border px-3 py-2"
            placeholder="test@example.com"
          />
        </div>

        <div>
          <label className="text-sm font-medium">Role</label>
          <div className="mt-1 flex gap-2">
            <Button
              type="button"
              variant={role === "member" ? "default" : "outline"}
              size="sm"
              onClick={() => setRole("member")}
            >
              Member
            </Button>
            <Button
              type="button"
              variant={role === "admin" ? "default" : "outline"}
              size="sm"
              onClick={() => setRole("admin")}
            >
              Admin
            </Button>
          </div>
        </div>

        <Button type="submit" disabled={isSubmitting || !email.trim()}>
          {isSubmitting ? "Sending..." : "Send Invite"}
        </Button>
      </form>
    </div>
  );
}

/**
 * Retry logic demo
 */
function RetryLogicDemo() {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<DemoError | null>(null);
  const inviteMutation = useMutation(api.organizations.invite);

  const handleRetryDemo = async () => {
    setIsLoading(true);
    setError(null);

    try {
      await inviteMutation({
        orgSlug: "demo",
        email: "retry@example.com",
        role: "member",
      });
    } catch (err) {
      setError(err as DemoError);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold">Retry Logic</h3>
      <p className="text-muted-foreground text-sm">
        This demo shows how retry logic works for network and server errors.
      </p>

      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            <strong>Error:</strong> {error.userMessage}
            <br />
            <strong>Retryable:</strong> {error.retryable ? "Yes" : "No"}
          </AlertDescription>
        </Alert>
      )}

      <Button onClick={handleRetryDemo} disabled={isLoading}>
        {isLoading ? "Retrying..." : "Test Retry Logic"}
      </Button>

      <div className="text-muted-foreground text-xs">
        <p>This will trigger a conflict error (not retryable).</p>
      </div>
    </div>
  );
}
