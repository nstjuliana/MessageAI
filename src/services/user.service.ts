/**
 * User Service
 * Handles all Firestore operations for the 'users' collection
 */

import { db } from '@/config/firebase';
import type {
    CreateUserData,
    PublicUserProfile,
    UpdateUserData,
    User,
    UserPresence,
} from '@/types/user.types';
import {
    collection,
    deleteDoc,
    doc,
    getDoc,
    getDocs,
    limit,
    onSnapshot,
    query,
    serverTimestamp,
    setDoc,
    updateDoc,
    type Unsubscribe
} from 'firebase/firestore';

const USERS_COLLECTION = 'users';
const USERNAMES_COLLECTION = 'usernames';

/**
 * Check if a username is available
 * @param username - Username to check (will be lowercased)
 * @returns true if available, false if taken
 */
export async function isUsernameAvailable(username: string): Promise<boolean> {
  try {
    const usernameDoc = doc(db, USERNAMES_COLLECTION, username.toLowerCase());
    const docSnap = await getDoc(usernameDoc);
    return !docSnap.exists();
  } catch (error) {
    console.error('Error checking username availability:', error);
    throw new Error('Failed to check username availability.');
  }
}

/**
 * Reserve a username for a user (creates entry in usernames collection)
 * @param username - Username to reserve (will be lowercased)
 * @param userId - User ID
 */
async function reserveUsername(username: string, userId: string): Promise<void> {
  const usernameDoc = doc(db, USERNAMES_COLLECTION, username.toLowerCase());
  await setDoc(usernameDoc, {
    userId,
    createdAt: serverTimestamp(),
  });
}

/**
 * Release a username (deletes entry from usernames collection)
 * @param username - Username to release (will be lowercased)
 */
async function releaseUsername(username: string): Promise<void> {
  const usernameDoc = doc(db, USERNAMES_COLLECTION, username.toLowerCase());
  await deleteDoc(usernameDoc);
}

/**
 * Get user ID by username
 * @param username - Username to look up
 * @returns User ID or null if not found
 */
export async function getUserIdByUsername(username: string): Promise<string | null> {
  try {
    const usernameDoc = doc(db, USERNAMES_COLLECTION, username.toLowerCase());
    const docSnap = await getDoc(usernameDoc);
    
    if (!docSnap.exists()) {
      return null;
    }
    
    return docSnap.data().userId;
  } catch (error) {
    console.error('Error getting user by username:', error);
    return null;
  }
}

/**
 * Create a new user document in Firestore
 * Called after successful Firebase Auth sign up
 * @param userId - Firebase Auth user ID
 * @param userData - User data for creation
 * @returns Created user object
 */
export async function createUser(
  userId: string,
  userData: CreateUserData
): Promise<User> {
  try {
    const now = Date.now();
    const username = userData.username.toLowerCase();
    
    // Check if username is available
    const available = await isUsernameAvailable(username);
    if (!available) {
      throw new Error('Username is already taken');
    }
    
    // Reserve username first
    await reserveUsername(username, userId);
    
    try {
      // Build user document, excluding undefined fields
      const userDoc: any = {
        username,
        displayName: userData.displayName,
        bio: userData.bio || '',
        lastSeen: serverTimestamp(),
        presence: 'online',
        deviceTokens: [],
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      };

      // Only add optional fields if they have values
      if (userData.phoneNumber !== undefined) {
        userDoc.phoneNumber = userData.phoneNumber;
      }
      if (userData.email !== undefined) {
        userDoc.email = userData.email;
      }
      if (userData.avatarUrl !== undefined) {
        userDoc.avatarUrl = userData.avatarUrl;
      }

      const userRef = doc(db, USERS_COLLECTION, userId);
      await setDoc(userRef, userDoc);

      // Return the user object with actual values
      return {
        id: userId,
        username,
        displayName: userData.displayName,
        phoneNumber: userData.phoneNumber,
        email: userData.email,
        avatarUrl: userData.avatarUrl,
        bio: userData.bio || '',
        lastSeen: now,
        presence: 'online',
        deviceTokens: [],
        createdAt: now,
        updatedAt: now,
      };
    } catch (userCreationError) {
      // If user creation fails, release the username
      await releaseUsername(username);
      throw userCreationError;
    }
  } catch (error: any) {
    console.error('Error creating user:', error);
    if (error.message === 'Username is already taken') {
      throw error;
    }
    throw new Error('Failed to create user profile. Please try again.');
  }
}

/**
 * Get a user by their ID
 * @param userId - User ID to fetch
 * @returns User object or null if not found
 */
export async function getUserById(userId: string): Promise<User | null> {
  try {
    const userRef = doc(db, USERS_COLLECTION, userId);
    const userSnap = await getDoc(userRef);

    if (!userSnap.exists()) {
      return null;
    }

    return firestoreUserToUser(userId, userSnap.data());
  } catch (error) {
    console.error('Error fetching user:', error);
    throw new Error('Failed to fetch user profile.');
  }
}

/**
 * Get public profile for a user (excludes sensitive data)
 * @param userId - User ID to fetch
 * @returns Public user profile or null if not found
 */
export async function getPublicProfile(
  userId: string
): Promise<PublicUserProfile | null> {
  try {
    const user = await getUserById(userId);
    if (!user) return null;

    return {
      id: user.id,
      username: user.username,
      displayName: user.displayName,
      avatarUrl: user.avatarUrl,
      bio: user.bio,
      presence: user.presence,
      lastSeen: user.lastSeen,
    };
  } catch (error) {
    console.error('Error fetching public profile:', error);
    throw new Error('Failed to fetch user profile.');
  }
}

/**
 * Get multiple users by their IDs
 * @param userIds - Array of user IDs
 * @returns Array of users (excluding any not found)
 */
export async function getUsersByIds(userIds: string[]): Promise<User[]> {
  try {
    if (userIds.length === 0) return [];

    const userPromises = userIds.map((userId) => getUserById(userId));
    const users = await Promise.all(userPromises);

    // Filter out null values
    return users.filter((user): user is User => user !== null);
  } catch (error) {
    console.error('Error fetching users:', error);
    throw new Error('Failed to fetch users.');
  }
}

/**
 * Update user data
 * @param userId - User ID to update
 * @param userData - Fields to update
 */
export async function updateUser(
  userId: string,
  userData: UpdateUserData
): Promise<void> {
  try {
    const userRef = doc(db, USERS_COLLECTION, userId);
    await updateDoc(userRef, {
      ...userData,
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    console.error('Error updating user:', error);
    throw new Error('Failed to update user profile.');
  }
}

/**
 * Update user presence status (online/offline/away)
 * @param userId - User ID to update
 * @param presence - New presence status
 */
export async function updatePresence(
  userId: string,
  presence: UserPresence
): Promise<void> {
  try {
    const userRef = doc(db, USERS_COLLECTION, userId);
    // Use setDoc with merge to create document if it doesn't exist
    await setDoc(userRef, {
      presence,
      lastSeen: serverTimestamp(),
      updatedAt: serverTimestamp(),
    }, { merge: true });
  } catch (error: any) {
    // Permission errors are expected during logout (user already signed out)
    if (error?.code === 'permission-denied' || error?.message?.includes('permission')) {
      console.warn('Could not update presence (user likely logged out):', presence);
    } else if (error?.code === 'not-found') {
      console.warn('User document not found, skipping presence update:', userId);
    } else {
      console.error('Error updating presence:', error);
    }
    // Don't throw error for presence updates - fail silently
  }
}

/**
 * Update user's last seen timestamp
 * @param userId - User ID to update
 */
export async function updateLastSeen(userId: string): Promise<void> {
  try {
    const userRef = doc(db, USERS_COLLECTION, userId);
    // Use setDoc with merge to create document if it doesn't exist
    await setDoc(userRef, {
      lastSeen: serverTimestamp(),
      updatedAt: serverTimestamp(),
    }, { merge: true });
  } catch (error: any) {
    // Permission errors are expected during logout (user already signed out)
    if (error?.code === 'permission-denied' || error?.message?.includes('permission')) {
      console.warn('Could not update last seen (user likely logged out)');
    } else if (error?.code === 'not-found') {
      console.warn('User document not found, skipping last seen update:', userId);
    } else {
      console.error('Error updating last seen:', error);
    }
    // Don't throw error for last seen updates - fail silently
  }
}

/**
 * Add a device token to user's account (for push notifications)
 * @param userId - User ID
 * @param deviceToken - Push notification token
 */
export async function addDeviceToken(
  userId: string,
  deviceToken: string
): Promise<void> {
  try {
    const user = await getUserById(userId);
    if (!user) {
      throw new Error('User not found');
    }

    // Don't add duplicate tokens
    if (user.deviceTokens.includes(deviceToken)) {
      return;
    }

    const userRef = doc(db, USERS_COLLECTION, userId);
    await updateDoc(userRef, {
      deviceTokens: [...user.deviceTokens, deviceToken],
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    console.error('Error adding device token:', error);
    throw new Error('Failed to register device for notifications.');
  }
}

/**
 * Remove a device token from user's account
 * @param userId - User ID
 * @param deviceToken - Push notification token to remove
 */
export async function removeDeviceToken(
  userId: string,
  deviceToken: string
): Promise<void> {
  try {
    const user = await getUserById(userId);
    if (!user) {
      throw new Error('User not found');
    }

    const userRef = doc(db, USERS_COLLECTION, userId);
    await updateDoc(userRef, {
      deviceTokens: user.deviceTokens.filter((token) => token !== deviceToken),
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    console.error('Error removing device token:', error);
    // Don't throw error - fail silently
  }
}

/**
 * Search for users by display name
 * @param searchQuery - Search term
 * @param excludeUserId - Optional user ID to exclude from results (usually current user)
 * @param maxResults - Maximum number of results to return
 * @returns Array of matching users
 */
export async function searchUsers(
  searchQuery: string,
  excludeUserId?: string,
  maxResults: number = 20
): Promise<PublicUserProfile[]> {
  try {
    if (!searchQuery.trim()) {
      return [];
    }

    const searchLower = searchQuery.toLowerCase().trim();

    // Firestore doesn't support full-text search or case-insensitive queries
    // For MVP, we'll fetch all users and filter client-side
    // In production, use Algolia or similar for better search
    const usersRef = collection(db, USERS_COLLECTION);
    const q = query(usersRef, limit(100)); // Limit to prevent huge queries
    const snapshot = await getDocs(q);

    const users: PublicUserProfile[] = snapshot.docs
      .map((doc) => {
        const data = doc.data();
        return {
          id: doc.id,
          username: data.username || '',
          displayName: data.displayName || 'Unknown User',
          bio: data.bio,
          avatarUrl: data.avatarUrl,
          presence: data.presence || 'offline',
          lastSeen: firestoreTimestampToMillis(data.lastSeen),
        } as PublicUserProfile;
      })
      .filter((user) => {
        // Exclude specified user
        if (excludeUserId && user.id === excludeUserId) {
          return false;
        }
        // Filter by search term (case-insensitive) - search both username and display name
        return (
          user.displayName.toLowerCase().includes(searchLower) ||
          user.username.toLowerCase().includes(searchLower)
        );
      })
      .slice(0, maxResults); // Limit results

    return users;
  } catch (error) {
    console.error('Error searching users:', error);
    throw new Error('Failed to search users.');
  }
}

/**
 * Listen to user data changes in real-time
 * @param userId - User ID to listen to
 * @param callback - Function to call when user data changes
 * @returns Unsubscribe function to stop listening
 */
export function onUserSnapshot(
  userId: string,
  callback: (user: User | null) => void
): Unsubscribe {
  const userRef = doc(db, USERS_COLLECTION, userId);

  return onSnapshot(
    userRef,
    (snapshot) => {
      if (snapshot.exists()) {
        const user = firestoreUserToUser(userId, snapshot.data());
        callback(user);
      } else {
        callback(null);
      }
    },
    (error) => {
      console.error('Error listening to user:', error);
      callback(null);
    }
  );
}

/**
 * Listen to presence changes for multiple users
 * @param userIds - Array of user IDs to listen to
 * @param callback - Function to call when any user's presence changes
 * @returns Unsubscribe function to stop listening
 */
export function onUsersPresenceSnapshot(
  userIds: string[],
  callback: (users: Map<string, { presence: UserPresence; lastSeen: number }>) => void
): Unsubscribe {
  if (userIds.length === 0) {
    return () => {}; // Return empty unsubscribe function
  }

  // Create individual listeners for each user
  // Note: For large user lists, consider batching or alternative approaches
  const unsubscribers: Unsubscribe[] = [];
  const presenceMap = new Map<string, { presence: UserPresence; lastSeen: number }>();

  userIds.forEach((userId) => {
    const userRef = doc(db, USERS_COLLECTION, userId);
    const unsubscribe = onSnapshot(
      userRef,
      (snapshot) => {
        if (snapshot.exists()) {
          const data = snapshot.data();
          presenceMap.set(userId, {
            presence: data.presence || 'offline',
            lastSeen: firestoreTimestampToMillis(data.lastSeen),
          });
          callback(new Map(presenceMap));
        }
      },
      (error) => {
        console.error(`Error listening to user ${userId} presence:`, error);
      }
    );
    unsubscribers.push(unsubscribe);
  });

  // Return a function that unsubscribes from all listeners
  return () => {
    unsubscribers.forEach((unsubscribe) => unsubscribe());
  };
}

/**
 * Delete a user document (use with caution)
 * Note: This only deletes the Firestore document, not the Firebase Auth account
 * @param userId - User ID to delete
 */
export async function deleteUser(userId: string): Promise<void> {
  try {
    const userRef = doc(db, USERS_COLLECTION, userId);
    await deleteDoc(userRef);
  } catch (error) {
    console.error('Error deleting user:', error);
    throw new Error('Failed to delete user.');
  }
}

/**
 * Convert Firestore document data to User object
 * Handles Firestore Timestamp conversion
 */
function firestoreUserToUser(userId: string, data: any): User {
  return {
    id: userId,
    username: data.username || '',
    displayName: data.displayName || '',
    phoneNumber: data.phoneNumber,
    email: data.email,
    avatarUrl: data.avatarUrl,
    bio: data.bio || '',
    lastSeen: firestoreTimestampToMillis(data.lastSeen),
    presence: data.presence || 'offline',
    deviceTokens: data.deviceTokens || [],
    createdAt: firestoreTimestampToMillis(data.createdAt),
    updatedAt: firestoreTimestampToMillis(data.updatedAt),
  };
}

/**
 * Convert Firestore Timestamp to milliseconds
 * Handles both Timestamp objects and numbers
 */
function firestoreTimestampToMillis(timestamp: any): number {
  // Check if it has a toMillis method (duck typing for Timestamp)
  if (timestamp && typeof timestamp.toMillis === 'function') {
    return timestamp.toMillis();
  }
  if (typeof timestamp === 'number') {
    return timestamp;
  }
  return Date.now();
}

