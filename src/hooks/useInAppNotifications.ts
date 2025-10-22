/**
 * useInAppNotifications Hook
 * Listens for new messages across all user's chats and triggers in-app notifications
 * Only shows notifications for messages that arrive while the app is in foreground
 * and the user is NOT actively viewing that specific chat
 */

import { useEffect, useRef } from 'react';

import type { NotificationData } from '@/components/InAppNotification';
import { useAuth } from '@/contexts/AuthContext';
import { useNotifications } from '@/contexts/NotificationContext';
import { onUserChatsSnapshot } from '@/services/chat.service';
import { getUserById } from '@/services/user.service';

/**
 * Hook to monitor all user's chats and show notifications for new messages
 * Should be used once at the app level (in the authenticated layout)
 */
export function useInAppNotifications() {
  const { user } = useAuth();
  const { showNotification, activeChatId } = useNotifications();
  
  // Track the last message timestamp for each chat to avoid duplicate notifications
  const lastMessageTimestamps = useRef<Record<string, number>>({});
  
  // Track if this is the initial load (don't show notifications for existing messages)
  const isInitialLoad = useRef(true);

  useEffect(() => {
    if (!user) {
      return;
    }

    console.log('🔔 Setting up global in-app notification listener');

    // Listen to all user's chats
    const unsubscribe = onUserChatsSnapshot(user.uid, async (chats) => {
      console.log(`📬 Chat update received: ${chats.length} chat(s)`);
      
      // On first load, just record the last message timestamps
      if (isInitialLoad.current) {
        console.log('🔄 Initial load - recording timestamps for', chats.length, 'chats');
        chats.forEach(chat => {
          if (chat.lastMessageAt) {
            lastMessageTimestamps.current[chat.id] = chat.lastMessageAt;
            console.log(`  - Chat ${chat.id}: timestamp ${chat.lastMessageAt}, senderId: ${chat.lastMessageSenderId}`);
          }
        });
        isInitialLoad.current = false;
        console.log('📱 Initial chat load complete, notifications armed');
        console.log('💡 Current activeChatId:', activeChatId);
        return;
      }

      console.log('🔍 Checking for new messages...');
      
      // Check each chat for new messages
      for (const chat of chats) {
        const lastTimestamp = lastMessageTimestamps.current[chat.id] || 0;
        
        console.log(`  📋 Chat ${chat.id}:`, {
          lastMessageAt: chat.lastMessageAt,
          lastTimestamp,
          isNew: chat.lastMessageAt && chat.lastMessageAt > lastTimestamp,
          senderId: chat.lastMessageSenderId,
          activeChatId,
        });
        
        // New message detected
        if (chat.lastMessageAt && chat.lastMessageAt > lastTimestamp) {
          console.log('✨ NEW MESSAGE DETECTED in chat:', chat.id);
          
          // Update timestamp
          lastMessageTimestamps.current[chat.id] = chat.lastMessageAt;
          
          // Skip if this is the active chat (user is viewing it)
          if (activeChatId === chat.id) {
            console.log('📵 Skipping notification - user is viewing chat:', chat.id);
            continue;
          }

          // Skip if the last message sender is the current user (their own message)
          if (chat.lastMessageSenderId === user.uid) {
            console.log('📵 Skipping notification - own message');
            continue;
          }

          // Get sender information
          try {
            // Skip if no sender ID
            if (!chat.lastMessageSenderId) {
              console.log('📵 Skipping notification - no sender ID');
              continue;
            }

            const sender = await getUserById(chat.lastMessageSenderId);
            
            if (sender && chat.lastMessageText) {
              const notification: NotificationData = {
                id: `${chat.id}-${chat.lastMessageAt}`, // Unique ID for this notification
                chatId: chat.id,
                senderName: sender.displayName,
                senderAvatarUrl: sender.avatarUrl,
                messageText: chat.lastMessageText,
                timestamp: chat.lastMessageAt,
              };

              console.log('🔔 Triggering notification for message from:', sender.displayName);
              showNotification(notification);
            } else if (!sender) {
              console.log('📵 Skipping notification - sender not found:', chat.lastMessageSenderId);
            }
          } catch (error) {
            console.error('⚠️ Error fetching sender info for notification:', error);
            // Don't break the notification system if one user fetch fails
            // Just skip this notification and continue
          }
        }
      }
    });

    return () => {
      console.log('👋 Cleaning up global notification listener');
      unsubscribe();
    };
  }, [user, activeChatId, showNotification]);
}

/**
 * Hook to monitor a specific chat for new messages (useful for chat list items)
 * This is a lighter-weight alternative that can be used per-chat
 */
export function useChatNotificationListener(chatId: string) {
  const { user } = useAuth();
  const { showNotification, activeChatId } = useNotifications();
  const lastMessageTimestamp = useRef<number>(0);
  const isInitialLoad = useRef(true);

  useEffect(() => {
    if (!user || !chatId) {
      return;
    }

    // Don't listen if this is the active chat
    if (activeChatId === chatId) {
      return;
    }

    // This would require a direct message listener
    // For now, we'll rely on the global listener above
    // This hook is here for future enhancement if needed
  }, [user, chatId, activeChatId, showNotification]);
}

