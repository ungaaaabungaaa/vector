"use client";

import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Edit, Check, X } from "lucide-react";
import { useRouter } from "next/navigation";

interface EditorProps {
  orgSlug: string;
  initialValue: string;
}

// Edit organization NAME
export function OrgNameEditor({ orgSlug, initialValue }: EditorProps) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(initialValue);
  const router = useRouter();
  const mutation = trpc.organization.update.useMutation({
    onSuccess: () => {
      setEditing(false);
      router.refresh();
    },
  });

  if (!editing) {
    return (
      <div className="flex items-center justify-between">
        <span className="truncate text-sm" title={initialValue}>
          {initialValue}
        </span>
        <Button variant="ghost" size="sm" onClick={() => setEditing(true)}>
          <Edit className="mr-1 size-3" />
          Edit
        </Button>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <Input
        value={value}
        onChange={(e) => setValue(e.target.value)}
        className="h-8 w-40"
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            if (value.trim() !== "" && !mutation.isPending) {
              mutation.mutate({ orgSlug, data: { name: value } });
            }
          } else if (e.key === "Escape") {
            setEditing(false);
          }
        }}
      />
      <Button
        variant="secondary"
        size="sm"
        onClick={() => mutation.mutate({ orgSlug, data: { name: value } })}
        disabled={value.trim() === "" || mutation.isPending}
      >
        <Check className="size-3" />
      </Button>
      <Button variant="ghost" size="sm" onClick={() => setEditing(false)}>
        <X className="size-3" />
      </Button>
    </div>
  );
}

// Edit organization SLUG
export function OrgSlugEditor({ orgSlug, initialValue }: EditorProps) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(initialValue);
  const router = useRouter();
  const mutation = trpc.organization.update.useMutation({
    onSuccess: (data) => {
      setEditing(false);
      if (data?.slug && data.slug !== orgSlug) {
        // Redirect to new slug path
        router.push(`/${data.slug}/settings`);
      } else {
        router.refresh();
      }
    },
  });

  if (!editing) {
    return (
      <div className="flex items-center justify-between">
        <span
          className="bg-muted truncate rounded px-2 py-1 font-mono text-sm"
          title={initialValue}
        >
          {initialValue}
        </span>
        <Button variant="ghost" size="sm" onClick={() => setEditing(true)}>
          <Edit className="mr-1 size-3" />
          Edit
        </Button>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <Input
        value={value}
        onChange={(e) => setValue(e.target.value)}
        pattern="[a-z0-9-]+"
        className="h-8 w-32 font-mono"
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            if (value.trim() !== "" && !mutation.isPending) {
              mutation.mutate({ orgSlug, data: { slug: value } });
            }
          } else if (e.key === "Escape") {
            setEditing(false);
          }
        }}
      />
      <Button
        variant="secondary"
        size="sm"
        onClick={() => mutation.mutate({ orgSlug, data: { slug: value } })}
        disabled={value.trim() === "" || mutation.isPending}
      >
        <Check className="size-3" />
      </Button>
      <Button variant="ghost" size="sm" onClick={() => setEditing(false)}>
        <X className="size-3" />
      </Button>
    </div>
  );
}
