"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Input } from "@/components/ui/input";
import { ChevronsUpDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { getDynamicIcon } from "@/lib/dynamic-icons";

// Curated list of Lucide icons suitable for priorities and states
export const AVAILABLE_ICONS = [
  // Priority Icons
  { name: "ArrowUp", label: "Arrow Up", category: "Priority" },
  { name: "ArrowDown", label: "Arrow Down", category: "Priority" },
  { name: "ArrowRight", label: "Arrow Right", category: "Priority" },
  { name: "ArrowLeft", label: "Arrow Left", category: "Priority" },
  { name: "TrendingUp", label: "Trending Up", category: "Priority" },
  { name: "TrendingDown", label: "Trending Down", category: "Priority" },
  { name: "ChevronUp", label: "Chevron Up", category: "Priority" },
  { name: "ChevronDown", label: "Chevron Down", category: "Priority" },
  { name: "ChevronsUp", label: "Double Chevron Up", category: "Priority" },
  { name: "ChevronsDown", label: "Double Chevron Down", category: "Priority" },
  { name: "Minus", label: "Minus", category: "Priority" },
  { name: "Equal", label: "Equal", category: "Priority" },
  { name: "Plus", label: "Plus", category: "Priority" },

  // State Icons - Basic Shapes
  { name: "Circle", label: "Circle", category: "State" },
  { name: "CircleDot", label: "Circle Dot", category: "State" },
  { name: "CircleCheck", label: "Circle Check", category: "State" },
  { name: "CircleX", label: "Circle X", category: "State" },
  { name: "CirclePause", label: "Circle Pause", category: "State" },
  { name: "CirclePlay", label: "Circle Play", category: "State" },
  { name: "CircleStop", label: "Circle Stop", category: "State" },
  { name: "CheckCircle", label: "Check Circle", category: "State" },
  { name: "XCircle", label: "X Circle", category: "State" },

  // State Icons - Progress
  { name: "Play", label: "Play", category: "State" },
  { name: "Pause", label: "Pause", category: "State" },
  { name: "SkipForward", label: "Skip Forward", category: "State" },
  { name: "SkipBack", label: "Skip Back", category: "State" },
  { name: "FastForward", label: "Fast Forward", category: "State" },
  { name: "Rewind", label: "Rewind", category: "State" },

  // State Icons - Status
  { name: "Check", label: "Check", category: "State" },
  { name: "X", label: "X", category: "State" },
  { name: "Loader", label: "Loader", category: "State" },
  { name: "Clock", label: "Clock", category: "State" },
  { name: "Timer", label: "Timer", category: "State" },
  { name: "Hourglass", label: "Hourglass", category: "State" },
  { name: "Ban", label: "Ban", category: "State" },
  { name: "AlertCircle", label: "Alert Circle", category: "State" },
  { name: "AlertTriangle", label: "Alert Triangle", category: "State" },
  { name: "Info", label: "Info", category: "State" },

  // State Icons - Geometric
  { name: "Square", label: "Square", category: "State" },
  { name: "Triangle", label: "Triangle", category: "State" },
  { name: "Diamond", label: "Diamond", category: "State" },
  { name: "Hexagon", label: "Hexagon", category: "State" },
  { name: "Octagon", label: "Octagon", category: "State" },

  // Workflow Icons
  { name: "GitBranch", label: "Git Branch", category: "Workflow" },
  { name: "GitCommit", label: "Git Commit", category: "Workflow" },
  { name: "GitMerge", label: "Git Merge", category: "Workflow" },
  {
    name: "RotateCcw",
    label: "Rotate Counter-clockwise",
    category: "Workflow",
  },
  { name: "RotateCw", label: "Rotate Clockwise", category: "Workflow" },
  { name: "Repeat", label: "Repeat", category: "Workflow" },
  { name: "RefreshCw", label: "Refresh", category: "Workflow" },

  // Misc Icons
  { name: "Star", label: "Star", category: "Misc" },
  { name: "Heart", label: "Heart", category: "Misc" },
  { name: "Bookmark", label: "Bookmark", category: "Misc" },
  { name: "Flag", label: "Flag", category: "Misc" },
  { name: "Target", label: "Target", category: "Misc" },
  { name: "Zap", label: "Zap", category: "Misc" },
  { name: "Flame", label: "Flame", category: "Misc" },
  { name: "Settings", label: "Settings", category: "Misc" },
] as const;

export type AvailableIconName = (typeof AVAILABLE_ICONS)[number]["name"];

interface IconPickerProps {
  value?: string | null;
  onValueChange: (iconName: string | null) => void;
  placeholder?: string;
  className?: string;
  /** Optional custom trigger element (e.g. an icon button). */
  trigger?: React.ReactElement;
}

export function IconPicker({
  value,
  onValueChange,
  placeholder = "Select icon...",
  className,
  trigger,
}: IconPickerProps) {
  const [open, setOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  const selectedIcon = AVAILABLE_ICONS.find((icon) => icon.name === value);
  const SelectedIconComponent = selectedIcon
    ? getDynamicIcon(selectedIcon.name)
    : null;

  const filteredIcons = AVAILABLE_ICONS.filter(
    (icon) =>
      icon.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      icon.label.toLowerCase().includes(searchQuery.toLowerCase()) ||
      icon.category.toLowerCase().includes(searchQuery.toLowerCase()),
  );

  const groupedIcons = filteredIcons.reduce(
    (acc, icon) => {
      if (!acc[icon.category]) {
        acc[icon.category] = [];
      }
      acc[icon.category].push(icon);
      return acc;
    },
    {} as Record<string, Array<(typeof AVAILABLE_ICONS)[number]>>,
  );

  return (
    <Popover modal open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        {trigger ?? (
          <Button
            variant="outline"
            role="combobox"
            aria-expanded={open}
            className={cn("h-9 w-full justify-between", className)}
          >
            <div className="flex items-center gap-2">
              {SelectedIconComponent && (
                <SelectedIconComponent className="size-4" />
              )}
              <span className="truncate">
                {selectedIcon ? selectedIcon.label : placeholder}
              </span>
            </div>
            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
          </Button>
        )}
      </PopoverTrigger>
      <PopoverContent
        side="bottom"
        align="start"
        className="max-h-[400px] w-96 overflow-y-auto p-0"
      >
        {/* Search bar - sticky so it remains visible while scrolling */}
        <div className="bg-background sticky top-0 z-10 border-b p-3">
          <Input
            placeholder="Search icons..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="h-8"
          />
        </div>

        {/* Clear Selection Option */}
        <div className="border-b p-3">
          <div className="text-muted-foreground mb-2 text-xs font-medium tracking-wider uppercase">
            Clear Selection
          </div>
          <button
            type="button"
            onClick={() => {
              onValueChange(null);
              setOpen(false);
            }}
            className={cn(
              "hover:bg-muted/50 flex items-center gap-2 rounded-md border-2 border-dashed p-2 text-sm transition-all",
              !value ? "border-primary bg-primary/10" : "border-border",
            )}
          >
            <div className="size-4 rounded border border-dashed border-gray-400" />
            <span>No icon</span>
          </button>
        </div>

        {/* Icon Categories */}
        {Object.entries(groupedIcons).map(([category, icons]) => (
          <div key={category} className="border-b p-3 last:border-b-0">
            <div className="text-muted-foreground mb-3 text-xs font-medium tracking-wider uppercase">
              {category}
            </div>
            <div className="grid grid-cols-8 gap-1">
              {icons.map((icon) => {
                const IconComponent = getDynamicIcon(icon.name);
                const isSelected = value === icon.name;

                return (
                  <button
                    key={icon.name}
                    type="button"
                    onClick={() => {
                      onValueChange(icon.name);
                      setOpen(false);
                    }}
                    className={cn(
                      "hover:bg-muted/50 flex size-8 items-center justify-center rounded-md border transition-all",
                      isSelected
                        ? "border-primary bg-primary/10 text-primary"
                        : "border-border",
                    )}
                    title={icon.label}
                  >
                    {IconComponent && <IconComponent className="size-4" />}
                  </button>
                );
              })}
            </div>
          </div>
        ))}

        {/* Scrollable icon list */}
        <div className="pb-3">
          {filteredIcons.length === 0 && (
            <div className="text-muted-foreground p-8 text-center text-sm">
              No icons found matching &quot;{searchQuery}&quot;
            </div>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
