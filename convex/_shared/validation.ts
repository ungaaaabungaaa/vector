/**
 * Validation utilities for Convex functions
 */

/**
 * Validate string length
 */
export function validateStringLength(
  value: string | undefined,
  fieldName: string,
  maxLength: number,
  minLength: number = 1,
): void {
  if (!value || !value.trim()) {
    throw new Error(`${fieldName} is required`);
  }

  if (value.length < minLength) {
    throw new Error(`${fieldName} must be at least ${minLength} characters`);
  }

  if (value.length > maxLength) {
    throw new Error(`${fieldName} must be ${maxLength} characters or less`);
  }
}

/**
 * Validate key format (alphanumeric, hyphens, underscores)
 */
export function validateKeyFormat(value: string, fieldName: string): void {
  validateStringLength(value, fieldName, 20, 1);

  if (!/^[a-zA-Z0-9_-]+$/.test(value)) {
    throw new Error(
      `${fieldName} must contain only letters, numbers, hyphens, and underscores`,
    );
  }
}

/**
 * Validate color format (hex or CSS color)
 */
export function validateColorFormat(
  value: string | undefined,
  fieldName: string,
): void {
  if (!value) return; // Optional field

  if (
    !/^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/.test(value) &&
    !/^rgb\(\s*\d+\s*,\s*\d+\s*,\s*\d+\s*\)$/.test(value) &&
    !/^rgba\(\s*\d+\s*,\s*\d+\s*,\s*\d+\s*,\s*[\d.]+\s*\)$/.test(value)
  ) {
    throw new Error(
      `${fieldName} must be a valid color (hex, rgb, or rgba format)`,
    );
  }
}

/**
 * Validate email format
 */
export function validateEmailFormat(email: string): void {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    throw new Error('Invalid email format');
  }
}

/**
 * Validate URL format
 */
export function validateUrlFormat(
  url: string | undefined,
  fieldName: string,
): void {
  if (!url) return; // Optional field

  try {
    new URL(url);
  } catch {
    throw new Error(`${fieldName} must be a valid URL`);
  }
}
