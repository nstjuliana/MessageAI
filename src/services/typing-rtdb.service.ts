/**
 * Typing Indicator Service (RTDB)
 * Manages typing status using Firebase Realtime Database
 * 
 * Benefits over Firestore:
 * - onDisconnect() automatically clears typing status when user disconnects
 * - Real-time updates with lower latency
 * - Cheaper at scale (no write charges)
 */

import { rtdb } from '@/config/firebase';
import {
    onDisconnect,
    onValue,
    ref,
    remove,
    serverTimestamp,
    set,
    type Unsubscribe
} from 'firebase/database';

const TYPING_PATH = 'typing';

/**
 * Set user as typing in a chat
 * Automatically clears when user disconnects
 */
export async function setUserTyping(
  chatId: string,
  userId: string
): Promise<void> {
  if (!rtdb) {
    console.warn('⚠️ RTDB not initialized. Typing indicators disabled.');
    return;
  }
  
  try {
    const typingRef = ref(rtdb, `${TYPING_PATH}/${chatId}/${userId}`);

    // Set typing status
    await set(typingRef, {
      isTyping: true,
      timestamp: serverTimestamp(),
    });

    // Auto-clear typing status on disconnect
    await onDisconnect(typingRef).remove();

    console.log(`✍️ Set typing status for user ${userId} in chat ${chatId}`);
  } catch (error) {
    console.error('Failed to set typing status:', error);
    // Don't throw - typing indicators are not critical
  }
}

/**
 * Clear user's typing status in a chat
 */
export async function clearUserTyping(
  chatId: string,
  userId: string
): Promise<void> {
  if (!rtdb) {
    return;
  }
  
  try {
    const typingRef = ref(rtdb, `${TYPING_PATH}/${chatId}/${userId}`);
    await remove(typingRef);

    console.log(`🛑 Cleared typing status for user ${userId} in chat ${chatId}`);
  } catch (error) {
    console.error('Failed to clear typing status:', error);
    // Don't throw - typing indicators are not critical
  }
}

/**
 * Listen to typing status for all users in a chat
 * Returns unsubscribe function
 */
export function onTypingStatusChange(
  chatId: string,
  currentUserId: string,
  callback: (typingUserIds: string[]) => void
): Unsubscribe {
  if (!rtdb) {
    console.warn('⚠️ RTDB not initialized. Typing indicators disabled.');
    return () => {}; // Return no-op unsubscribe
  }
  
  const typingChatRef = ref(rtdb, `${TYPING_PATH}/${chatId}`);

  return onValue(
    typingChatRef,
    (snapshot) => {
      const typingUserIds: string[] = [];

      if (snapshot.exists()) {
        const data = snapshot.val();
        Object.keys(data).forEach((userId) => {
          // Only include other users (not current user)
          // and only if they have isTyping: true
          if (userId !== currentUserId && data[userId]?.isTyping) {
            typingUserIds.push(userId);
          }
        });
      }

      console.log(`👀 Typing users in chat ${chatId}:`, typingUserIds);
      callback(typingUserIds);
    },
    (error) => {
      console.error('Error listening to typing status:', error);
      // Call callback with empty array on error
      callback([]);
    }
  );
}

