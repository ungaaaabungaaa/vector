import React from 'react';
import {
  AlertCircle,
  AlertTriangle,
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  ArrowUp,
  Ban,
  Bookmark,
  Check,
  CheckCircle,
  ChevronDown,
  ChevronUp,
  ChevronsDown,
  ChevronsUp,
  Circle,
  CircleCheck,
  CircleDot,
  CirclePause,
  CirclePlay,
  CircleStop,
  CircleX,
  Clock,
  Diamond,
  Equal,
  FastForward,
  Flag,
  Flame,
  GitBranch,
  GitCommit,
  GitMerge,
  Heart,
  Hexagon,
  Hourglass,
  Info,
  Loader,
  Minus,
  Octagon,
  Pause,
  Play,
  Plus,
  RefreshCw,
  Repeat,
  Rewind,
  RotateCcw,
  RotateCw,
  Settings,
  SkipBack,
  SkipForward,
  Square,
  Star,
  Target,
  Timer,
  TrendingDown,
  TrendingUp,
  Triangle,
  X,
  XCircle,
  Zap,
} from 'lucide-react';
import {
  FaArrowsRotate,
  FaBolt,
  FaBullseye,
  FaCircleCheck,
  FaCirclePause,
  FaCircleXmark,
  FaFire,
  FaFlag,
  FaHourglassHalf,
  FaRoad,
  FaRocket,
  FaWandMagicSparkles,
} from 'react-icons/fa6';
import {
  PiCheckCircleDuotone,
  PiClockCountdownDuotone,
  PiFlagPennantDuotone,
  PiFlowArrowDuotone,
  PiKanbanDuotone,
  PiPauseCircleDuotone,
  PiRocketLaunchDuotone,
  PiSpinnerGapDuotone,
  PiTargetDuotone,
  PiXCircleDuotone,
} from 'react-icons/pi';
import {
  RiCheckboxCircleLine,
  RiCloseCircleLine,
  RiCompass3Line,
  RiFlag2Line,
  RiFlowChart,
  RiGitBranchLine,
  RiLoader4Line,
  RiPauseCircleLine,
  RiRocketLine,
  RiSparklingLine,
  RiTimerLine,
} from 'react-icons/ri';
import {
  TbBolt,
  TbCircleDashedCheck,
  TbClockPause,
  TbClockPlay,
  TbFlag3,
  TbFlame,
  TbGitMerge,
  TbProgress,
  TbProgressCheck,
  TbRosetteDiscountCheck,
  TbRoute,
  TbTargetArrow,
} from 'react-icons/tb';

export type DynamicIconComponent = React.ComponentType<{
  className?: string;
  style?: React.CSSProperties;
  size?: number | string;
  color?: string;
  strokeWidth?: number | string;
}>;

export type IconLibrary =
  | 'lucide'
  | 'font-awesome'
  | 'phosphor'
  | 'remix'
  | 'tabler';

export interface AvailableIconDefinition {
  value: string;
  name: string;
  label: string;
  category: string;
  library: IconLibrary;
  libraryLabel: string;
  keywords: string[];
}

type IconRecord = AvailableIconDefinition & {
  component: DynamicIconComponent;
  aliases?: string[];
};

export const ICON_LIBRARY_LABELS: Record<IconLibrary, string> = {
  lucide: 'Lucide',
  'font-awesome': 'Font Awesome',
  phosphor: 'Phosphor',
  remix: 'Remix',
  tabler: 'Tabler',
};

const toStoredValue = (library: IconLibrary, name: string) =>
  library === 'lucide' ? name : `${library}:${name}`;

function defineIcon(
  library: IconLibrary,
  name: string,
  label: string,
  category: string,
  component: DynamicIconComponent,
  keywords: string[] = [],
): IconRecord {
  return {
    value: toStoredValue(library, name),
    name,
    label,
    category,
    library,
    libraryLabel: ICON_LIBRARY_LABELS[library],
    keywords,
    component,
    aliases: library === 'lucide' ? [`lucide:${name}`] : undefined,
  };
}

const ICON_RECORDS: IconRecord[] = [
  defineIcon('lucide', 'ArrowUp', 'Arrow Up', 'Priority', ArrowUp, [
    'up',
    'high',
  ]),
  defineIcon('lucide', 'ArrowDown', 'Arrow Down', 'Priority', ArrowDown, [
    'down',
    'low',
  ]),
  defineIcon('lucide', 'ArrowRight', 'Arrow Right', 'Priority', ArrowRight, [
    'right',
    'medium',
  ]),
  defineIcon('lucide', 'ArrowLeft', 'Arrow Left', 'Priority', ArrowLeft, [
    'left',
  ]),
  defineIcon('lucide', 'TrendingUp', 'Trending Up', 'Priority', TrendingUp, [
    'trend',
    'growth',
  ]),
  defineIcon(
    'lucide',
    'TrendingDown',
    'Trending Down',
    'Priority',
    TrendingDown,
    ['trend', 'decline'],
  ),
  defineIcon('lucide', 'ChevronUp', 'Chevron Up', 'Priority', ChevronUp),
  defineIcon('lucide', 'ChevronDown', 'Chevron Down', 'Priority', ChevronDown),
  defineIcon(
    'lucide',
    'ChevronsUp',
    'Double Chevron Up',
    'Priority',
    ChevronsUp,
  ),
  defineIcon(
    'lucide',
    'ChevronsDown',
    'Double Chevron Down',
    'Priority',
    ChevronsDown,
  ),
  defineIcon('lucide', 'Minus', 'Minus', 'Priority', Minus),
  defineIcon('lucide', 'Equal', 'Equal', 'Priority', Equal),
  defineIcon('lucide', 'Plus', 'Plus', 'Priority', Plus),
  defineIcon('lucide', 'Circle', 'Circle', 'State', Circle),
  defineIcon('lucide', 'CircleDot', 'Circle Dot', 'State', CircleDot),
  defineIcon('lucide', 'CircleCheck', 'Circle Check', 'State', CircleCheck),
  defineIcon('lucide', 'CircleX', 'Circle X', 'State', CircleX),
  defineIcon('lucide', 'CirclePause', 'Circle Pause', 'State', CirclePause),
  defineIcon('lucide', 'CirclePlay', 'Circle Play', 'State', CirclePlay),
  defineIcon('lucide', 'CircleStop', 'Circle Stop', 'State', CircleStop),
  defineIcon('lucide', 'CheckCircle', 'Check Circle', 'State', CheckCircle),
  defineIcon('lucide', 'XCircle', 'X Circle', 'State', XCircle),
  defineIcon('lucide', 'Play', 'Play', 'Progress', Play),
  defineIcon('lucide', 'Pause', 'Pause', 'Progress', Pause),
  defineIcon('lucide', 'SkipForward', 'Skip Forward', 'Progress', SkipForward),
  defineIcon('lucide', 'SkipBack', 'Skip Back', 'Progress', SkipBack),
  defineIcon('lucide', 'FastForward', 'Fast Forward', 'Progress', FastForward),
  defineIcon('lucide', 'Rewind', 'Rewind', 'Progress', Rewind),
  defineIcon('lucide', 'Check', 'Check', 'Status', Check),
  defineIcon('lucide', 'X', 'X', 'Status', X),
  defineIcon('lucide', 'Loader', 'Loader', 'Status', Loader, [
    'loading',
    'spinner',
  ]),
  defineIcon('lucide', 'Clock', 'Clock', 'Status', Clock, ['time']),
  defineIcon('lucide', 'Timer', 'Timer', 'Status', Timer, ['time']),
  defineIcon('lucide', 'Hourglass', 'Hourglass', 'Status', Hourglass, ['wait']),
  defineIcon('lucide', 'Ban', 'Ban', 'Status', Ban, ['blocked']),
  defineIcon('lucide', 'AlertCircle', 'Alert Circle', 'Status', AlertCircle),
  defineIcon(
    'lucide',
    'AlertTriangle',
    'Alert Triangle',
    'Status',
    AlertTriangle,
  ),
  defineIcon('lucide', 'Info', 'Info', 'Status', Info),
  defineIcon('lucide', 'Square', 'Square', 'Shape', Square),
  defineIcon('lucide', 'Triangle', 'Triangle', 'Shape', Triangle),
  defineIcon('lucide', 'Diamond', 'Diamond', 'Shape', Diamond),
  defineIcon('lucide', 'Hexagon', 'Hexagon', 'Shape', Hexagon),
  defineIcon('lucide', 'Octagon', 'Octagon', 'Shape', Octagon),
  defineIcon('lucide', 'GitBranch', 'Git Branch', 'Workflow', GitBranch),
  defineIcon('lucide', 'GitCommit', 'Git Commit', 'Workflow', GitCommit),
  defineIcon('lucide', 'GitMerge', 'Git Merge', 'Workflow', GitMerge),
  defineIcon(
    'lucide',
    'RotateCcw',
    'Rotate Counter-clockwise',
    'Workflow',
    RotateCcw,
  ),
  defineIcon('lucide', 'RotateCw', 'Rotate Clockwise', 'Workflow', RotateCw),
  defineIcon('lucide', 'Repeat', 'Repeat', 'Workflow', Repeat),
  defineIcon('lucide', 'RefreshCw', 'Refresh', 'Workflow', RefreshCw),
  defineIcon('lucide', 'Star', 'Star', 'Misc', Star),
  defineIcon('lucide', 'Heart', 'Heart', 'Misc', Heart),
  defineIcon('lucide', 'Bookmark', 'Bookmark', 'Misc', Bookmark),
  defineIcon('lucide', 'Flag', 'Flag', 'Misc', Flag),
  defineIcon('lucide', 'Target', 'Target', 'Misc', Target),
  defineIcon('lucide', 'Zap', 'Zap', 'Misc', Zap),
  defineIcon('lucide', 'Flame', 'Flame', 'Misc', Flame),
  defineIcon('lucide', 'Settings', 'Settings', 'Misc', Settings),
  defineIcon(
    'phosphor',
    'PiKanbanDuotone',
    'Kanban',
    'Workflow',
    PiKanbanDuotone,
    ['board'],
  ),
  defineIcon(
    'phosphor',
    'PiRocketLaunchDuotone',
    'Rocket Launch',
    'Workflow',
    PiRocketLaunchDuotone,
    ['launch'],
  ),
  defineIcon(
    'phosphor',
    'PiFlowArrowDuotone',
    'Flow Arrow',
    'Workflow',
    PiFlowArrowDuotone,
    ['flow'],
  ),
  defineIcon(
    'phosphor',
    'PiTargetDuotone',
    'Target',
    'Priority',
    PiTargetDuotone,
    ['goal'],
  ),
  defineIcon(
    'phosphor',
    'PiFlagPennantDuotone',
    'Pennant',
    'Misc',
    PiFlagPennantDuotone,
    ['flag'],
  ),
  defineIcon(
    'phosphor',
    'PiSpinnerGapDuotone',
    'Spinner Gap',
    'Status',
    PiSpinnerGapDuotone,
    ['loading'],
  ),
  defineIcon(
    'phosphor',
    'PiCheckCircleDuotone',
    'Check Circle',
    'State',
    PiCheckCircleDuotone,
    ['done'],
  ),
  defineIcon(
    'phosphor',
    'PiPauseCircleDuotone',
    'Pause Circle',
    'State',
    PiPauseCircleDuotone,
    ['hold'],
  ),
  defineIcon(
    'phosphor',
    'PiXCircleDuotone',
    'X Circle',
    'State',
    PiXCircleDuotone,
    ['cancel'],
  ),
  defineIcon(
    'phosphor',
    'PiClockCountdownDuotone',
    'Countdown',
    'Status',
    PiClockCountdownDuotone,
    ['timer'],
  ),
  defineIcon('remix', 'RiRocketLine', 'Rocket', 'Workflow', RiRocketLine, [
    'launch',
  ]),
  defineIcon('remix', 'RiFlowChart', 'Flow Chart', 'Workflow', RiFlowChart, [
    'graph',
  ]),
  defineIcon(
    'remix',
    'RiGitBranchLine',
    'Git Branch',
    'Workflow',
    RiGitBranchLine,
  ),
  defineIcon(
    'remix',
    'RiCheckboxCircleLine',
    'Checkbox Circle',
    'State',
    RiCheckboxCircleLine,
    ['done'],
  ),
  defineIcon(
    'remix',
    'RiPauseCircleLine',
    'Pause Circle',
    'State',
    RiPauseCircleLine,
  ),
  defineIcon(
    'remix',
    'RiCloseCircleLine',
    'Close Circle',
    'State',
    RiCloseCircleLine,
  ),
  defineIcon('remix', 'RiLoader4Line', 'Loader 4', 'Status', RiLoader4Line, [
    'loading',
    'spinner',
  ]),
  defineIcon('remix', 'RiTimerLine', 'Timer', 'Status', RiTimerLine, ['clock']),
  defineIcon('remix', 'RiFlag2Line', 'Flag 2', 'Misc', RiFlag2Line),
  defineIcon('remix', 'RiSparklingLine', 'Sparkling', 'Misc', RiSparklingLine, [
    'sparkles',
  ]),
  defineIcon('remix', 'RiCompass3Line', 'Compass', 'Priority', RiCompass3Line, [
    'direction',
  ]),
  defineIcon(
    'tabler',
    'TbProgressCheck',
    'Progress Check',
    'State',
    TbProgressCheck,
    ['done'],
  ),
  defineIcon('tabler', 'TbProgress', 'Progress', 'Progress', TbProgress),
  defineIcon('tabler', 'TbClockPause', 'Clock Pause', 'Status', TbClockPause, [
    'hold',
  ]),
  defineIcon('tabler', 'TbClockPlay', 'Clock Play', 'Status', TbClockPlay, [
    'resume',
  ]),
  defineIcon('tabler', 'TbRoute', 'Route', 'Workflow', TbRoute, ['path']),
  defineIcon('tabler', 'TbGitMerge', 'Git Merge', 'Workflow', TbGitMerge),
  defineIcon(
    'tabler',
    'TbRosetteDiscountCheck',
    'Rosette Check',
    'State',
    TbRosetteDiscountCheck,
    ['badge'],
  ),
  defineIcon(
    'tabler',
    'TbCircleDashedCheck',
    'Dashed Check',
    'State',
    TbCircleDashedCheck,
    ['circle'],
  ),
  defineIcon(
    'tabler',
    'TbTargetArrow',
    'Target Arrow',
    'Priority',
    TbTargetArrow,
  ),
  defineIcon('tabler', 'TbFlag3', 'Flag 3', 'Misc', TbFlag3),
  defineIcon('tabler', 'TbBolt', 'Bolt', 'Misc', TbBolt, ['zap']),
  defineIcon('tabler', 'TbFlame', 'Flame', 'Misc', TbFlame),
  defineIcon('font-awesome', 'FaRocket', 'Rocket', 'Workflow', FaRocket, [
    'launch',
  ]),
  defineIcon(
    'font-awesome',
    'FaArrowsRotate',
    'Arrows Rotate',
    'Workflow',
    FaArrowsRotate,
    ['refresh'],
  ),
  defineIcon(
    'font-awesome',
    'FaCircleCheck',
    'Circle Check',
    'State',
    FaCircleCheck,
    ['done'],
  ),
  defineIcon(
    'font-awesome',
    'FaCirclePause',
    'Circle Pause',
    'State',
    FaCirclePause,
  ),
  defineIcon(
    'font-awesome',
    'FaCircleXmark',
    'Circle X',
    'State',
    FaCircleXmark,
    ['cancel'],
  ),
  defineIcon(
    'font-awesome',
    'FaHourglassHalf',
    'Hourglass Half',
    'Status',
    FaHourglassHalf,
    ['wait'],
  ),
  defineIcon('font-awesome', 'FaBullseye', 'Bullseye', 'Priority', FaBullseye, [
    'target',
  ]),
  defineIcon('font-awesome', 'FaFlag', 'Flag', 'Misc', FaFlag),
  defineIcon('font-awesome', 'FaBolt', 'Bolt', 'Misc', FaBolt, ['zap']),
  defineIcon('font-awesome', 'FaFire', 'Fire', 'Misc', FaFire, ['flame']),
  defineIcon('font-awesome', 'FaRoad', 'Road', 'Workflow', FaRoad, ['path']),
  defineIcon(
    'font-awesome',
    'FaWandMagicSparkles',
    'Magic Sparkles',
    'Misc',
    FaWandMagicSparkles,
    ['sparkles'],
  ),
];

export const AVAILABLE_ICONS: AvailableIconDefinition[] = ICON_RECORDS.map(
  ({ component: _component, aliases: _aliases, ...icon }) => icon,
);

const AVAILABLE_ICON_MAP = new Map(
  AVAILABLE_ICONS.map(icon => [icon.value, icon] as const),
);
const ICON_VALUE_ALIASES = new Map<string, string>();
const ICON_MAP = new Map<string, DynamicIconComponent>();

for (const record of ICON_RECORDS) {
  ICON_MAP.set(record.value, record.component);
  for (const alias of record.aliases ?? []) {
    ICON_MAP.set(alias, record.component);
    ICON_VALUE_ALIASES.set(alias, record.value);
  }
}

export function findAvailableIcon(
  iconName?: string | null,
): AvailableIconDefinition | null {
  if (!iconName) return null;
  const resolvedValue = ICON_VALUE_ALIASES.get(iconName) ?? iconName;
  return AVAILABLE_ICON_MAP.get(resolvedValue) ?? null;
}

export function getDynamicIcon(
  iconName?: string | null,
): DynamicIconComponent | null {
  if (!iconName) return null;
  return ICON_MAP.get(iconName) ?? null;
}

export function isValidIconName(iconName?: string | null): boolean {
  if (!iconName) return false;
  return ICON_MAP.has(iconName);
}

export function getAvailableIconNames(): string[] {
  return AVAILABLE_ICONS.map(icon => icon.value);
}

interface DynamicIconProps {
  name?: string | null;
  className?: string;
  style?: React.CSSProperties;
  fallback?: DynamicIconComponent;
}

/* eslint-disable react-hooks/static-components -- Icons are module-level imports, not created during render */
export function DynamicIcon({
  name,
  className,
  style,
  fallback: Fallback = Circle,
}: DynamicIconProps) {
  const IconComponent = getDynamicIcon(name) || Fallback;

  return <IconComponent className={className} style={style} />;
}
/* eslint-enable react-hooks/static-components */
