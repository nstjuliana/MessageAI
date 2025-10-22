/**
 * Typing Indicator Service
 * Manages typing status in Firestore for real-time typing indicators
 */

import { db } from '@/config/firebase';
import {
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  serverTimestamp,
  setDoc,
  Unsubscribe
} from 'firebase/firestore';

const CHATS_COLLECTION = 'chats';
const TYPING_COLLECTION = 'typing';

/**
 * Set user as typing in a chat
 * Creates or updates a typing status document
 */
export async function setUserTyping(
  chatId: string,
  userId: string
): Promise<void> {
  try {
    const typingRef = doc(
      db,
      CHATS_COLLECTION,
      chatId,
      TYPING_COLLECTION,
      userId
    );

    await setDoc(typingRef, {
      isTyping: true,
      updatedAt: serverTimestamp(),
    });

    console.log(`✍️ Set typing status for user ${userId} in chat ${chatId}`);
  } catch (error) {
    console.error('Failed to set typing status:', error);
    // Don't throw - typing indicators are not critical
  }
}

/**
 * Clear user's typing status in a chat
 * Deletes the typing status document
 */
export async function clearUserTyping(
  chatId: string,
  userId: string
): Promise<void> {
  try {
    const typingRef = doc(
      db,
      CHATS_COLLECTION,
      chatId,
      TYPING_COLLECTION,
      userId
    );

    await deleteDoc(typingRef);

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
  const typingCollectionRef = collection(
    db,
    CHATS_COLLECTION,
    chatId,
    TYPING_COLLECTION
  );

  return onSnapshot(
    typingCollectionRef,
    (snapshot) => {
      const typingUserIds: string[] = [];

      snapshot.forEach((doc) => {
        const userId = doc.id;
        const data = doc.data();

        // Only include other users (not current user)
        // and only if they have isTyping: true
        if (userId !== currentUserId && data.isTyping) {
          typingUserIds.push(userId);
        }
      });

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

