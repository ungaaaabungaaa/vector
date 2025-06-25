"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert } from "@/components/ui/alert";
import { authClient } from "@/lib/auth-client";
import { Loader2 } from "lucide-react";

export function OrgSetupForm() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    name: "",
    slug: "",
  });

  const handleNameChange = (value: string) => {
    setFormData((prev) => ({
      ...prev,
      name: value,
      // Auto-generate slug from name
      slug: value
        .toLowerCase()
        .replace(/[^a-z0-9\s-]/g, "") // Remove special characters
        .replace(/\s+/g, "-") // Replace spaces with hyphens
        .replace(/-+/g, "-") // Replace multiple hyphens with single
        .replace(/^-|-$/g, ""), // Remove leading/trailing hyphens
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);

    try {
      // Validate inputs
      if (!formData.name.trim()) {
        throw new Error("Organization name is required");
      }

      if (!formData.slug.trim()) {
        throw new Error("Organization slug is required");
      }

      // Check if slug is available
      const slugCheck = await authClient.organization.checkSlug({
        slug: formData.slug,
      });

      if (!slugCheck.data?.status) {
        throw new Error(
          "This organization name is already taken. Please choose a different one.",
        );
      }

      // Create organization
      const result = await authClient.organization.create({
        name: formData.name.trim(),
        slug: formData.slug.trim(),
      });

      if (result.data?.slug) {
        // Redirect to the new organization's dashboard using slug
        router.push(`/${result.data.slug}/dashboard`);
      } else {
        throw new Error("Failed to create organization");
      }
    } catch (err) {
      console.error("Organization creation failed:", err);
      setError(
        err instanceof Error ? err.message : "Failed to create organization",
      );
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {error && <Alert variant="destructive">{error}</Alert>}

      <div className="space-y-2">
        <Label htmlFor="orgName">Organization Name</Label>
        <Input
          id="orgName"
          type="text"
          placeholder="My Company"
          value={formData.name}
          onChange={(e) => handleNameChange(e.target.value)}
          disabled={isLoading}
          required
          className="h-11"
        />
        <p className="text-muted-foreground text-sm">
          This will be the display name for your organization
        </p>
      </div>

      <div className="space-y-2">
        <Label htmlFor="orgSlug">Organization URL</Label>
        <div className="flex items-center gap-2">
          <span className="text-muted-foreground text-sm">aikp.dev/</span>
          <Input
            id="orgSlug"
            type="text"
            placeholder="my-company"
            value={formData.slug}
            onChange={(e) =>
              setFormData((prev) => ({ ...prev, slug: e.target.value }))
            }
            disabled={isLoading}
            required
            pattern="[a-z0-9-]+"
            className="h-11 flex-1"
          />
        </div>
        <p className="text-muted-foreground text-sm">
          This will be used in your organization's URL. Only lowercase letters,
          numbers, and hyphens are allowed.
        </p>
      </div>

      <Button
        type="submit"
        className="h-11 w-full"
        disabled={isLoading || !formData.name.trim() || !formData.slug.trim()}
      >
        {isLoading && <Loader2 className="mr-2 size-4 animate-spin" />}
        {isLoading ? "Creating Organization..." : "Create Organization"}
      </Button>
    </form>
  );
}
