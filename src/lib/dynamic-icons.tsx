import React from "react";
import {
  // Priority Icons
  ArrowUp,
  ArrowDown,
  ArrowRight,
  ArrowLeft,
  TrendingUp,
  TrendingDown,
  ChevronUp,
  ChevronDown,
  ChevronsUp,
  ChevronsDown,
  Minus,
  Equal,
  Plus,

  // State Icons - Basic Shapes
  Circle,
  CircleDot,
  CircleCheck,
  CircleX,
  CirclePause,
  CirclePlay,
  CircleStop,
  CheckCircle,
  XCircle,

  // State Icons - Progress
  Play,
  Pause,
  SkipForward,
  SkipBack,
  FastForward,
  Rewind,

  // State Icons - Status
  Check,
  X,
  Loader,
  Clock,
  Timer,
  Hourglass,
  Ban,
  AlertCircle,
  AlertTriangle,
  Info,

  // State Icons - Geometric
  Square,
  Triangle,
  Diamond,
  Hexagon,
  Octagon,

  // Workflow Icons
  GitBranch,
  GitCommit,
  GitMerge,
  RotateCcw,
  RotateCw,
  Repeat,
  RefreshCw,

  // Misc Icons
  Star,
  Heart,
  Bookmark,
  Flag,
  Target,
  Zap,
  Flame,
  Settings,
  type LucideIcon,
} from "lucide-react";

// Map of icon names to their components
const ICON_MAP: Record<string, LucideIcon> = {
  // Priority Icons
  ArrowUp,
  ArrowDown,
  ArrowRight,
  ArrowLeft,
  TrendingUp,
  TrendingDown,
  ChevronUp,
  ChevronDown,
  ChevronsUp,
  ChevronsDown,
  Minus,
  Equal,
  Plus,

  // State Icons - Basic Shapes
  Circle,
  CircleDot,
  CircleCheck,
  CircleX,
  CirclePause,
  CirclePlay,
  CircleStop,
  CheckCircle,
  XCircle,

  // State Icons - Progress
  Play,
  Pause,
  SkipForward,
  SkipBack,
  FastForward,
  Rewind,

  // State Icons - Status
  Check,
  X,
  Loader,
  Clock,
  Timer,
  Hourglass,
  Ban,
  AlertCircle,
  AlertTriangle,
  Info,

  // State Icons - Geometric
  Square,
  Triangle,
  Diamond,
  Hexagon,
  Octagon,

  // Workflow Icons
  GitBranch,
  GitCommit,
  GitMerge,
  RotateCcw,
  RotateCw,
  Repeat,
  RefreshCw,

  // Misc Icons
  Star,
  Heart,
  Bookmark,
  Flag,
  Target,
  Zap,
  Flame,
  Settings,
};

/**
 * Get a Lucide icon component by its string name
 * @param iconName - The name of the Lucide icon (e.g., "ArrowUp")
 * @returns The icon component or null if not found
 */
export function getDynamicIcon(iconName?: string | null): LucideIcon | null {
  if (!iconName) return null;
  return ICON_MAP[iconName] || null;
}

/**
 * Check if an icon name is valid/available
 * @param iconName - The name of the icon to check
 * @returns boolean indicating if the icon exists
 */
export function isValidIconName(iconName?: string | null): boolean {
  if (!iconName) return false;
  return iconName in ICON_MAP;
}

/**
 * Get all available icon names
 * @returns Array of all available icon names
 */
export function getAvailableIconNames(): string[] {
  return Object.keys(ICON_MAP);
}

/**
 * Dynamic Icon component that renders an icon by name
 */
interface DynamicIconProps {
  name?: string | null;
  className?: string;
  style?: React.CSSProperties;
  fallback?: React.ComponentType<React.SVGProps<SVGSVGElement>>;
}

export function DynamicIcon({
  name,
  className,
  style,
  fallback: Fallback = Circle,
}: DynamicIconProps) {
  const IconComponent = getDynamicIcon(name);

  if (!IconComponent) {
    return <Fallback className={className} style={style} />;
  }

  return <IconComponent className={className} style={style} />;
}
