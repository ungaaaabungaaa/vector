"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert } from "@/components/ui/alert";
import { authClient } from "@/lib/auth-client";
import { Loader2 } from "lucide-react";

interface User {
  id: string;
  name: string;
  email: string;
  image?: string | null;
  username?: string | null;
}

interface ProfileFormProps {
  user: User;
}

export function ProfileForm({ user }: ProfileFormProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    name: user.name || "",
    username: user.username || "",
    image: user.image || "",
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);
    setSuccess(false);

    try {
      // Update user profile
      await authClient.updateUser({
        name: formData.name.trim(),
        image: formData.image.trim() || null,
      });

      setSuccess(true);

      // Auto-hide success message after 3 seconds
      setTimeout(() => setSuccess(false), 3000);
    } catch (err) {
      console.error("Profile update failed:", err);
      setError(err instanceof Error ? err.message : "Failed to update profile");
    } finally {
      setIsLoading(false);
    }
  };

  const handleChange = (field: string, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    // Clear success/error messages when user starts typing
    if (success) setSuccess(false);
    if (error) setError(null);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {success && <Alert>Profile updated successfully!</Alert>}

      {error && <Alert variant="destructive">{error}</Alert>}

      <div className="space-y-2">
        <Label htmlFor="email">Email Address</Label>
        <Input
          id="email"
          type="email"
          value={user.email}
          disabled
          className="bg-muted"
        />
        <p className="text-muted-foreground text-sm">
          Email address cannot be changed. Contact support if you need to update
          it.
        </p>
      </div>

      <div className="space-y-2">
        <Label htmlFor="name">Full Name</Label>
        <Input
          id="name"
          type="text"
          value={formData.name}
          onChange={(e) => handleChange("name", e.target.value)}
          disabled={isLoading}
          required
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="username">Username</Label>
        <Input
          id="username"
          type="text"
          value={formData.username}
          onChange={(e) => handleChange("username", e.target.value)}
          disabled={isLoading}
          placeholder="Optional"
        />
        <p className="text-muted-foreground text-sm">
          Your username can be used for @mentions and quick references.
        </p>
      </div>

      <div className="space-y-2">
        <Label htmlFor="image">Profile Image URL</Label>
        <Input
          id="image"
          type="url"
          value={formData.image}
          onChange={(e) => handleChange("image", e.target.value)}
          disabled={isLoading}
          placeholder="https://example.com/avatar.jpg"
        />
        <p className="text-muted-foreground text-sm">
          Provide a URL to your profile image. Leave empty to use the default
          avatar.
        </p>
      </div>

      {formData.image && (
        <div className="space-y-2">
          <Label>Preview</Label>
          <div className="flex items-center gap-4">
            <img
              src={formData.image}
              alt="Profile preview"
              className="size-16 rounded-full border object-cover"
              onError={(e) => {
                e.currentTarget.src = ""; // Clear broken image
                setError("Failed to load image from the provided URL");
              }}
            />
            <p className="text-muted-foreground text-sm">
              This is how your profile image will appear
            </p>
          </div>
        </div>
      )}

      <div className="flex gap-3 pt-4">
        <Button type="submit" disabled={isLoading}>
          {isLoading && <Loader2 className="mr-2 size-4 animate-spin" />}
          {isLoading ? "Saving..." : "Save Changes"}
        </Button>

        <Button
          type="button"
          variant="outline"
          onClick={() => {
            setFormData({
              name: user.name || "",
              username: user.username || "",
              image: user.image || "",
            });
            setError(null);
            setSuccess(false);
          }}
          disabled={isLoading}
        >
          Reset
        </Button>
      </div>
    </form>
  );
}
