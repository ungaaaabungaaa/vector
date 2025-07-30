"use client";

import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { SquareDashed } from "lucide-react";
import { useMutation } from "convex/react";
import { api } from "@/lib/convex";
import { IconPicker } from "@/components/ui/icon-picker";
import { getDynamicIcon } from "@/lib/dynamic-icons";
import { Label } from "../ui/label";
import type { Id } from "../../../convex/_generated/dataModel";

interface PriorityData {
  id?: string;
  name: string;
  weight: number;
  color: string | null;
  icon: string | null;
}

interface PrioritiesManagementPopoverProps {
  priority?: PriorityData;
  existingPriorities: PriorityData[];
  onClose: () => void;
  onSave: (priority: Omit<PriorityData, "id">) => void;
  orgSlug?: string;
  children: React.ReactNode;
}

const DEFAULT_COLORS = [
  "#94a3b8", // slate-400
  "#10b981", // emerald-500
  "#f59e0b", // amber-500
  "#ef4444", // red-500
  "#dc2626", // red-600
];

interface ColorSelectorProps {
  colors: string[];
  selectedColor: string;
  onColorSelect: (color: string) => void;
}

function ColorSelector({
  colors,
  selectedColor,
  onColorSelect,
}: ColorSelectorProps) {
  const [open, setOpen] = useState(false);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className="bg-muted/30 hover:bg-muted/50 h-8 gap-2"
        >
          <div
            className="h-3 w-3 rounded-full"
            style={{ backgroundColor: selectedColor }}
          />
          Color
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-48 p-3">
        <div className="flex flex-wrap gap-2">
          {colors.map((colorOption) => (
            <button
              key={colorOption}
              type="button"
              className={`size-8 rounded-md border-2 transition-all ${
                selectedColor === colorOption
                  ? "border-foreground scale-110"
                  : "border-border hover:scale-105"
              }`}
              style={{ backgroundColor: colorOption }}
              onClick={() => {
                onColorSelect(colorOption);
                setOpen(false);
              }}
            />
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}

export function PrioritiesManagementPopover({
  priority,
  existingPriorities,
  onClose,
  onSave,
  orgSlug,
  children,
}: PrioritiesManagementPopoverProps) {
  const [isDeleting, setIsDeleting] = useState(false);
  const deleteMutation = useMutation(api.organizations.deleteIssuePriority);

  const [name, setName] = useState(priority?.name || "");
  const [color, setColor] = useState(priority?.color || DEFAULT_COLORS[0]);
  const [icon, setIcon] = useState(priority?.icon || null);
  const [weight, setWeight] = useState(priority?.weight ?? 0);
  const [open, setOpen] = useState(false);

  const isEditing = !!priority;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    // Determine next weight value (max + 1) if creating new without explicit weight
    const maxWeight = Math.max(-1, ...existingPriorities.map((p) => p.weight));
    const finalWeight = isEditing ? weight : maxWeight + 1;

    onSave({
      name: name.trim(),
      weight: finalWeight,
      color,
      icon,
    });
    setOpen(false);
  };

  const handleDelete = async () => {
    if (!priority?.id || !orgSlug) return;
    if (
      !confirm(
        "Are you sure you want to delete this priority? This cannot be undone.",
      )
    )
      return;

    setIsDeleting(true);
    try {
      await deleteMutation({
        orgSlug,
        priorityId: priority.id as Id<"issuePriorities">,
      });
      onClose();
      setOpen(false);
    } catch (error) {
      console.error("Failed to delete priority:", error);
    } finally {
      setIsDeleting(false);
    }
  };

  const IconComponent = icon
    ? getDynamicIcon(icon) || SquareDashed
    : SquareDashed;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>{children}</PopoverTrigger>
      <PopoverContent className="w-80 p-2" align="start">
        <div className="space-y-4">
          {/* Properties */}
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <Input
                id="priority-weight"
                type="number"
                value={weight}
                onChange={(e) => setWeight(parseInt(e.target.value, 10) || 0)}
                className="h-8 w-16"
              />
              <Label className="text-muted-foreground text-xs">Weight</Label>
            </div>

            <div className="flex gap-2">
              <IconPicker
                value={icon}
                onValueChange={setIcon}
                placeholder="Select an icon..."
                trigger={
                  <Button variant="outline" size="sm" className="h-8 gap-2">
                    <IconComponent
                      className="size-4"
                      style={{ color: color || "#94a3b8" }}
                    />
                  </Button>
                }
              />

              <ColorSelector
                colors={DEFAULT_COLORS}
                selectedColor={color}
                onColorSelect={setColor}
              />
            </div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-3">
            {/* Name */}
            <Input
              placeholder="Priority name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="text-base"
              autoFocus
            />

            {/* Bottom action row */}
            <div className="flex w-full flex-row items-center justify-between gap-2">
              {isEditing && (
                <Button
                  type="button"
                  variant="destructive"
                  size="sm"
                  onClick={handleDelete}
                  disabled={isDeleting}
                >
                  Delete
                </Button>
              )}
              <div className="ml-auto flex gap-2">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setOpen(false)}
                >
                  Cancel
                </Button>
                <Button
                  size="sm"
                  onClick={handleSubmit}
                  disabled={!name.trim()}
                >
                  {isEditing ? "Save Changes" : "Add Priority"}
                </Button>
              </div>
            </div>
          </form>
        </div>
      </PopoverContent>
    </Popover>
  );
}
