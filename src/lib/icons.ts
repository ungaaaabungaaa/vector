import { getDynamicIcon } from '@/lib/dynamic-icons';
import { Circle, type LucideIcon } from 'lucide-react';

// Fallback priority icon mappings for backward compatibility
const FALLBACK_PRIORITY_ICONS: Record<string, string> = {
  urgent: 'ArrowUp',
  high: 'ArrowUp',
  medium: 'Circle',
  low: 'ArrowDown',
  none: 'Circle',
} as const;

// Fallback state type icon mappings for backward compatibility
const FALLBACK_STATE_TYPE_ICONS: Record<string, string> = {
  backlog: 'Circle',
  todo: 'Circle',
  in_progress: 'Play',
  done: 'CheckCircle',
  canceled: 'X',
} as const;

// Helper function to get priority icon with proper styling
export function getPriorityIcon(
  priorityName?: string | null,
  priorityIcon?: string | null,
  priorityColor?: string | null,
): {
  icon: LucideIcon;
  className: string;
  style?: React.CSSProperties;
} {
  // Use database icon if available, otherwise fall back to name-based mapping
  const iconName =
    priorityIcon ||
    (priorityName ? FALLBACK_PRIORITY_ICONS[priorityName.toLowerCase()] : null);
  const IconComponent = getDynamicIcon(iconName) || Circle;

  // Use database color if available, otherwise fall back to semantic colors
  let className = 'size-4';
  let style: React.CSSProperties | undefined;

  if (priorityColor) {
    style = { color: priorityColor, fill: priorityColor };
  } else {
    // Fallback semantic colors based on priority name
    const normalizedName = priorityName?.toLowerCase();
    switch (normalizedName) {
      case 'urgent':
        className += ' text-red-600 fill-red-600';
        break;
      case 'high':
        className += ' text-orange-600 fill-orange-600';
        break;
      case 'medium':
        className += ' text-yellow-600 fill-yellow-600';
        break;
      case 'low':
        className += ' text-blue-600 fill-blue-600';
        break;
      default:
        className += ' text-gray-400 fill-gray-400';
        break;
    }
  }

  return {
    icon: IconComponent,
    className,
    style,
  };
}

// Helper function to get state type icon with dynamic color
export function getStateTypeIcon(
  stateType?: string | null,
  stateColor?: string | null,
  stateIcon?: string | null,
): {
  icon: LucideIcon;
  className: string;
  style?: React.CSSProperties;
} {
  // Use database icon if available, otherwise fall back to type-based mapping
  const iconName =
    stateIcon || (stateType ? FALLBACK_STATE_TYPE_ICONS[stateType] : null);
  const IconComponent = getDynamicIcon(iconName) || Circle;

  // Use database color or fallback
  const style: React.CSSProperties = stateColor
    ? { color: stateColor, fill: stateColor }
    : { color: '#6b7280', fill: '#6b7280' }; // gray-500 fallback

  return {
    icon: IconComponent,
    className: 'size-4',
    style,
  };
}

// Legacy exports for backward compatibility
export const PRIORITY_ICONS = FALLBACK_PRIORITY_ICONS;
export const STATE_TYPE_ICONS = FALLBACK_STATE_TYPE_ICONS;
