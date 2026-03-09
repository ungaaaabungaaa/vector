export const DEFAULT_DOCUMENT_COLORS = [
  '#94a3b8',
  '#3b82f6',
  '#10b981',
  '#f59e0b',
  '#ef4444',
  '#8b5cf6',
  '#06b6d4',
  '#6b7280',
] as const;

const DOCUMENT_COLOR_SET = new Set<string>(DEFAULT_DOCUMENT_COLORS);
const STORED_ICON_NAME_RE =
  /^(?:lucide|phosphor|remix|tabler|font-awesome):[A-Za-z][A-Za-z0-9]*$|^[A-Za-z][A-Za-z0-9]*$/;

export function isValidDocumentColor(
  color: string | null | undefined,
): color is (typeof DEFAULT_DOCUMENT_COLORS)[number] {
  return typeof color === 'string' && DOCUMENT_COLOR_SET.has(color);
}

export function isValidDocumentIconName(
  iconName: string | null | undefined,
): iconName is string {
  return (
    typeof iconName === 'string' &&
    iconName.length > 0 &&
    iconName.length <= 64 &&
    STORED_ICON_NAME_RE.test(iconName)
  );
}
