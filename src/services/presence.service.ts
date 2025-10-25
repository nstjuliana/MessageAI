/**
 * Presence Service (RTDB)
 * Manages user presence tracking using Firebase Realtime Database
 * 
 * Benefits over Firestore:
 * - onDisconnect() automatically sets user offline when connection drops
 * - No need for periodic heartbeat writes (95%+ reduction in writes)
 * - Real-time connection state tracking
 * - Much cheaper at scale (charged by GB, not writes)
 */

import { rtdb } from '@/config/firebase';
import { UserPresence } from '@/types/user.types';
import {
    get,
    onDisconnect,
    onValue,
    ref,
    serverTimestamp,
    set,
    update,
    type Unsubscribe
} from 'firebase/database';

const PRESENCE_PATH = 'presence';

/**
 * Set user presence and configure auto-disconnect
 * This is the main function to call when user comes online
 */
export async function setUserOnline(userId: string): Promise<void> {
  if (!rtdb) {
    console.warn('⚠️ RTDB not initialized. Skipping presence update.');
    return;
  }
  
  try {
    const presenceRef = ref(rtdb, `${PRESENCE_PATH}/${userId}`);

    // Set user online
    await set(presenceRef, {
      status: 'online',
      lastSeen: serverTimestamp(),
    });

    // Configure automatic offline status when connection drops
    // This happens automatically when:
    // - User closes app
    // - Network disconnects
    // - App crashes
    // - Phone dies
    await onDisconnect(presenceRef).set({
      status: 'offline',
      lastSeen: serverTimestamp(),
    });

    console.log('✅ User presence set to online with auto-disconnect configured');
  } catch (error) {
    console.error('Failed to set user online:', error);
    throw error;
  }
}

/**
 * Update user presence status
 * Use this for away/online transitions (not initial setup)
 */
export async function updateUserPresence(
  userId: string,
  status: UserPresence
): Promise<void> {
  if (!rtdb) {
    console.warn('⚠️ RTDB not initialized. Skipping presence update.');
    return;
  }
  
  try {
    const presenceRef = ref(rtdb, `${PRESENCE_PATH}/${userId}`);

    await update(presenceRef, {
      status,
      lastSeen: serverTimestamp(),
    });

    console.log(`📍 User presence updated to: ${status}`);
  } catch (error) {
    console.error('Failed to update presence:', error);
    // Don't throw - presence updates are not critical
  }
}

/**
 * Set user offline
 * Use this for manual logout (not auto-disconnect)
 */
export async function setUserOffline(userId: string): Promise<void> {
  if (!rtdb) {
    console.warn('⚠️ RTDB not initialized. Skipping presence update.');
    return;
  }
  
  try {
    const presenceRef = ref(rtdb, `${PRESENCE_PATH}/${userId}`);

    await set(presenceRef, {
      status: 'offline',
      lastSeen: serverTimestamp(),
    });

    // Cancel auto-disconnect since we're manually setting offline
    await onDisconnect(presenceRef).cancel();

    console.log('🔴 User presence set to offline');
  } catch (error: any) {
    // Permission errors are expected during logout (user already signed out)
    if (error?.code === 'PERMISSION_DENIED' || error?.message?.includes('permission') || error?.message?.includes('PERMISSION_DENIED')) {
      console.warn('⚠️ Could not set offline (user already logged out)');
    } else {
      console.error('Failed to set user offline:', error);
    }
    // Don't throw - we still want logout to succeed
  }
}

/**
 * Get current user presence status
 */
export async function getUserPresence(userId: string): Promise<{
  status: UserPresence;
  lastSeen: number;
} | null> {
  try {
    const presenceRef = ref(rtdb, `${PRESENCE_PATH}/${userId}`);
    const snapshot = await get(presenceRef);

    if (snapshot.exists()) {
      return snapshot.val();
    }

    return null;
  } catch (error) {
    console.error('Failed to get user presence:', error);
    return null;
  }
}

/**
 * Listen to a user's presence changes in real-time
 */
export function onUserPresenceChange(
  userId: string,
  callback: (presence: { status: UserPresence; lastSeen: number } | null) => void
): Unsubscribe {
  const presenceRef = ref(rtdb, `${PRESENCE_PATH}/${userId}`);

  return onValue(
    presenceRef,
    (snapshot) => {
      if (snapshot.exists()) {
        callback(snapshot.val());
      } else {
        callback(null);
      }
    },
    (error) => {
      console.error('Error listening to user presence:', error);
      callback(null);
    }
  );
}

/**
 * Listen to multiple users' presence changes
 */
export function onUsersPresenceChange(
  userIds: string[],
  callback: (presenceMap: Record<string, { status: UserPresence; lastSeen: number }>) => void
): Unsubscribe {
  if (userIds.length === 0) {
    return () => {}; // No-op unsubscribe
  }

  const unsubscribes: Unsubscribe[] = [];
  const presenceMap: Record<string, { status: UserPresence; lastSeen: number }> = {};

  userIds.forEach((userId) => {
    const unsubscribe = onUserPresenceChange(userId, (presence) => {
      if (presence) {
        presenceMap[userId] = presence;
      } else {
        delete presenceMap[userId];
      }
      callback({ ...presenceMap });
    });

    unsubscribes.push(unsubscribe);
  });

  // Return combined unsubscribe function
  return () => {
    unsubscribes.forEach((unsubscribe) => unsubscribe());
  };
}

/**
 * Clean up presence for a user (for testing/admin purposes)
 */
export async function clearUserPresence(userId: string): Promise<void> {
  try {
    const presenceRef = ref(rtdb, `${PRESENCE_PATH}/${userId}`);
    await set(presenceRef, null);
    console.log('🗑️ User presence cleared');
  } catch (error) {
    console.error('Failed to clear user presence:', error);
  }
}

