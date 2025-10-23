/**
 * User Types
 * Based on Firestore 'users' collection schema
 */

export type UserPresence = 'online' | 'offline' | 'away';

export interface User {
  id: string;
  username: string; // Unique username (lowercase, alphanumeric + underscore)
  displayName: string;
  phoneNumber?: string;
  email?: string;
  avatarUrl?: string;
  bio?: string;
  lastSeen: number; // Unix timestamp
  presence: UserPresence;
  deviceTokens: string[]; // Array of push notification tokens
  createdAt: number; // Unix timestamp
  updatedAt: number; // Unix timestamp
}

/**
 * User data for creation (when signing up)
 * Excludes fields that are auto-generated
 */
export interface CreateUserData {
  username: string; // Must be unique
  displayName: string;
  phoneNumber?: string;
  email?: string;
  avatarUrl?: string;
  bio?: string;
}

/**
 * User data for updates (when editing profile)
 * All fields optional
 */
export interface UpdateUserData {
  displayName?: string;
  phoneNumber?: string;
  email?: string;
  avatarUrl?: string;
  bio?: string;
  presence?: UserPresence;
  lastSeen?: number;
  deviceTokens?: string[];
}

/**
 * Public user profile (for displaying in chats, user search, etc.)
 * Excludes sensitive information like device tokens
 */
export interface PublicUserProfile {
  id: string;
  username: string;
  displayName: string;
  avatarUrl?: string;
  avatarBlob?: string; // Base64 encoded avatar image for offline use
  bio?: string;
  presence: UserPresence;
  lastSeen: number;
}

