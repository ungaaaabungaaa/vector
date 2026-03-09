/**
 * Mention system configuration.
 *
 * To add a new mentionable entity type:
 * 1. Add an entry to MENTION_TYPES below
 * 2. Return the new entity from the search query (convex/search/queries.ts)
 * 3. Map search results to MentionItem in mention-list-wrapper.tsx
 *
 * The renderHTML logic, CSS, icons, and hash encoding are all driven
 * from this config — no need to touch those files.
 */

import type { LucideIcon } from 'lucide-react';
import { CheckSquare, FolderOpen, Users, User } from 'lucide-react';

export type MentionTypeId = 'user' | 'team' | 'project' | 'issue';

export interface MentionTypeConfig {
  /** Unique type identifier */
  id: MentionTypeId;
  /** Display label for the group header in the dropdown */
  label: string;
  /** Default Lucide icon for this type */
  icon: LucideIcon;
  /** Regex to match this entity's href in the editor (used by renderHTML) */
  hrefPattern: RegExp;
  /** CSS class applied to the mention chip (appended to 'mention-chip') */
  cssClass: string;
  /** Prefix added to the mention text (e.g., '@' for users) */
  textPrefix: string;
  /**
   * Which hash params this type encodes in the URL for icon rendering.
   * - 'email': encodes user email for Avvvatars avatar
   * - 'icon': encodes Lucide icon name + color
   * - 'none': no extra hash params
   */
  hashEncoding: 'email' | 'icon' | 'none';
  /** Whether ::before should have border-radius: 50% (for circular avatars) */
  roundIcon: boolean;
}

/**
 * All supported mention entity types.
 * Order here determines display order in the dropdown when multiple types match.
 */
export const MENTION_TYPES: MentionTypeConfig[] = [
  {
    id: 'user',
    label: 'People',
    icon: User,
    hrefPattern: /\/people\//,
    cssClass: 'mention-user',
    textPrefix: '@',
    hashEncoding: 'email',
    roundIcon: true,
  },
  {
    id: 'team',
    label: 'Teams',
    icon: Users,
    hrefPattern: /\/teams\/[A-Z]+/,
    cssClass: 'mention-team',
    textPrefix: '',
    hashEncoding: 'icon',
    roundIcon: false,
  },
  {
    id: 'project',
    label: 'Projects',
    icon: FolderOpen,
    hrefPattern: /\/projects\/[A-Z]+/,
    cssClass: 'mention-project',
    textPrefix: '',
    hashEncoding: 'icon',
    roundIcon: false,
  },
  {
    id: 'issue',
    label: 'Issues',
    icon: CheckSquare,
    hrefPattern: /\/issues\/[A-Z]+-\d+/,
    cssClass: 'mention-issue',
    textPrefix: '',
    hashEncoding: 'icon',
    roundIcon: false,
  },
];

/** Lookup a mention type config by its ID */
export function getMentionType(
  id: MentionTypeId,
): MentionTypeConfig | undefined {
  return MENTION_TYPES.find(t => t.id === id);
}

/** Detect mention type from an href string */
export function detectMentionType(href: string): MentionTypeConfig | undefined {
  return MENTION_TYPES.find(t => t.hrefPattern.test(href));
}

/** Map of type ID to icon and label for use in mention-list */
export const TYPE_ICONS: Record<MentionTypeId, LucideIcon> = Object.fromEntries(
  MENTION_TYPES.map(t => [t.id, t.icon]),
) as Record<MentionTypeId, LucideIcon>;

export const TYPE_LABELS: Record<MentionTypeId, string> = Object.fromEntries(
  MENTION_TYPES.map(t => [t.id, t.label]),
) as Record<MentionTypeId, string>;
