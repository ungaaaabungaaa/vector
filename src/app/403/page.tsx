export default function ForbiddenPage() {
  return (
    <div className="bg-background flex min-h-screen flex-col items-center justify-center p-4 text-center">
      <h1 className="mb-4 text-4xl font-bold">403 • Access Denied</h1>
      <p className="text-muted-foreground mb-6">
        You do not have permission to view this page.
      </p>
      <a href="/" className="text-primary underline-offset-4 hover:underline">
        Go back to dashboard
      </a>
    </div>
  );
}
