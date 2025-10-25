/**
 * Global Message Listeners Hook
 * Sets up real-time listeners for ALL user's chats while app is open
 * Runs independently of which screen is active
 */

import { useEffect, useRef } from 'react';

import { useAuth } from '@/contexts/AuthContext';
import {
    getLastSyncedTimestamp,
    onMessageStatusUpdatesSnapshot,
    onNewMessagesSnapshot,
    onUserChatsSnapshot,
    updateLastSyncedTimestamp,
} from '@/services/chat.service';
import { markMessageAsDelivered, syncMessageToSQLite } from '@/services/message.service';

export function useGlobalMessageListeners() {
  const { user } = useAuth();
  const listenersRef = useRef<Map<string, () => void>>(new Map()); // chatId -> unsubscribe function

  useEffect(() => {
    if (!user) {
      // Clean up all listeners on logout
      listenersRef.current.forEach(unsub => unsub());
      listenersRef.current.clear();
      return;
    }

    console.log('🌐 Setting up global message listeners for all chats...');

    // Listen to user's chats to know which chats to monitor
    const unsubscribeChats = onUserChatsSnapshot(user.uid, async (chats) => {
      // Get current set of chat IDs we're listening to
      const currentChatIds = new Set(listenersRef.current.keys());
      const newChatIds = new Set(chats.map(c => c.id));

      // Remove listeners for chats that no longer exist
      for (const chatId of currentChatIds) {
        if (!newChatIds.has(chatId)) {
          console.log(`🔇 Removing listeners for chat: ${chatId}`);
          listenersRef.current.get(chatId)?.();
          listenersRef.current.delete(chatId);
        }
      }

      // Add listeners for new chats
      for (const chat of chats) {
        if (!currentChatIds.has(chat.id)) {
          console.log(`🔊 Adding listeners for chat: ${chat.id}`);
          await setupChatListeners(chat.id, user.uid);
        }
      }
    });

    // Setup listeners for a specific chat
    const setupChatListeners = async (chatId: string, userId: string) => {
      const lastSynced = await getLastSyncedTimestamp(chatId);

      // Listener A: New messages
      const unsubscribeNewMessages = onNewMessagesSnapshot(
        chatId,
        lastSynced,
        async (message) => {
          console.log(`📩 [Global] New message in chat ${chatId}: ${message.id}`);
          
          // Sync to SQLite
          await syncMessageToSQLite(message);
          
          // Update lastSyncedTimestamp
          await updateLastSyncedTimestamp(chatId, message.createdAt);
          
          // Mark as delivered if from someone else
          if (message.senderId !== userId) {
            await markMessageAsDelivered(chatId, message.id, userId, message.senderId);
          }
        }
      );

      // Listener B: Status updates
      const unsubscribeStatusUpdates = onMessageStatusUpdatesSnapshot(
        chatId,
        async (message) => {
          console.log(`📝 [Global] Status update in chat ${chatId}: ${message.id} → ${message.status}`);
          
          // Sync to SQLite
          await syncMessageToSQLite(message);
        }
      );

      // Combined unsubscribe function
      const unsubscribe = () => {
        unsubscribeNewMessages();
        unsubscribeStatusUpdates();
      };

      listenersRef.current.set(chatId, unsubscribe);
    };

    // Cleanup on unmount
    return () => {
      console.log('🌐 Cleaning up global message listeners');
      unsubscribeChats();
      listenersRef.current.forEach(unsub => unsub());
      listenersRef.current.clear();
    };
  }, [user]);
}

