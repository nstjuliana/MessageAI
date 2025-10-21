/**
 * Username validation and formatting utilities
 */

/**
 * Validate username format
 * Rules:
 * - 3-20 characters
 * - Only lowercase letters, numbers, and underscores
 * - Must start with a letter
 * - No consecutive underscores
 */
export function validateUsername(username: string): {
  valid: boolean;
  error?: string;
} {
  if (!username || username.trim().length === 0) {
    return { valid: false, error: 'Username is required' };
  }

  const trimmed = username.trim();

  // Length check
  if (trimmed.length < 3) {
    return { valid: false, error: 'Username must be at least 3 characters' };
  }

  if (trimmed.length > 20) {
    return { valid: false, error: 'Username must be 20 characters or less' };
  }

  // Must start with a letter
  if (!/^[a-z]/.test(trimmed)) {
    return { valid: false, error: 'Username must start with a letter' };
  }

  // Only lowercase letters, numbers, and underscores
  if (!/^[a-z0-9_]+$/.test(trimmed)) {
    return {
      valid: false,
      error: 'Username can only contain lowercase letters, numbers, and underscores',
    };
  }

  // No consecutive underscores
  if (/__/.test(trimmed)) {
    return { valid: false, error: 'Username cannot have consecutive underscores' };
  }

  // Reserved usernames
  const reserved = [
    'admin',
    'system',
    'root',
    'messageai',
    'support',
    'help',
    'api',
    'bot',
    'official',
  ];

  if (reserved.includes(trimmed)) {
    return { valid: false, error: 'This username is reserved' };
  }

  return { valid: true };
}

/**
 * Format username (lowercase and trim)
 */
export function formatUsername(username: string): string {
  return username.trim().toLowerCase();
}

/**
 * Check if username contains only valid characters
 */
export function isValidUsernameChar(char: string): boolean {
  return /[a-z0-9_]/.test(char);
}

