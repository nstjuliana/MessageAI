/**
 * In-App Notifications Hook
 * Global message listener that triggers notifications for new messages
 */

import { useAuth } from '@/contexts/AuthContext';
import { useNotifications } from '@/contexts/NotificationContext';
import { useProfileCache } from '@/contexts/ProfileCacheContext';
import { onUserChatsSnapshot } from '@/services/chat.service';
import type { Chat } from '@/types/chat.types';
import { useEffect, useRef } from 'react';

export function useInAppNotifications() {
  const { user } = useAuth();
  const { showNotification, activeChatId } = useNotifications();
  const { getProfile } = useProfileCache();
  const lastMessageTimestampsRef = useRef<Record<string, number>>({});
  const isInitialLoadRef = useRef(true);
  
  // Use ref to track activeChatId without triggering listener restart
  const activeChatIdRef = useRef<string | null>(activeChatId);
  useEffect(() => {
    activeChatIdRef.current = activeChatId;
  }, [activeChatId]);

  useEffect(() => {
    if (!user) {
      console.log('🔔 Notification listener: No user, skipping setup');
      return;
    }

    console.log('🔔 Setting up in-app notification listener for user:', user.uid);

    const unsubscribe = onUserChatsSnapshot(user.uid, async (chats: Chat[]) => {
      console.log('📬 Chat updates received:', chats.length, 'chats');

      // Skip notifications on initial load
      if (isInitialLoadRef.current) {
        console.log('📵 Initial load - storing timestamps, not showing notifications');
        // Store initial timestamps
        chats.forEach((chat) => {
          if (chat.lastMessageAt) {
            lastMessageTimestampsRef.current[chat.id] = chat.lastMessageAt;
          }
        });
        isInitialLoadRef.current = false;
        return;
      }

      // Check each chat for new messages
      for (const chat of chats) {
        const chatId = chat.id;
        const lastTimestamp = lastMessageTimestampsRef.current[chatId] || 0;
        const currentTimestamp = chat.lastMessageAt || 0;

        console.log(`🔍 Checking chat ${chatId}:`, {
          lastTimestamp,
          currentTimestamp,
          hasNewMessage: currentTimestamp > lastTimestamp,
        });

        // New message detected
        if (currentTimestamp > lastTimestamp) {
          console.log('✨ New message detected in chat:', chatId);

          // Update stored timestamp
          lastMessageTimestampsRef.current[chatId] = currentTimestamp;

          // Get sender ID from chat
          const senderId = chat.lastMessageSenderId;

          // Skip if no sender ID (old chat format)
          if (!senderId) {
            console.log('📵 No sender ID in chat document, skipping notification');
            continue;
          }

          // Skip own messages
          if (senderId === user.uid) {
            console.log('📵 Notification suppressed: own message');
            continue;
          }

          // Skip if user is viewing this chat (use ref to avoid dependency)
          if (activeChatIdRef.current === chatId) {
            console.log('📵 Notification suppressed: user is viewing this chat');
            continue;
          }

          try {
            // Fetch sender profile (with caching)
            console.log('👤 Fetching sender profile:', senderId);
            const senderProfile = await getProfile(senderId);

            if (!senderProfile) {
              console.error('❌ Failed to fetch sender profile for:', senderId);
              continue;
            }

            console.log('✅ Sender profile fetched:', senderProfile.displayName);

            // Build notification title (with group context if applicable)
            let notificationTitle = senderProfile.displayName;
            if (chat.type === 'group' && chat.groupName) {
              notificationTitle = `${senderProfile.displayName} in ${chat.groupName}`;
            }

            // Show notification
            console.log('🎯 showNotification called with:', {
              chatId,
              senderId,
              senderName: notificationTitle,
              messageText: chat.lastMessageText,
              chatType: chat.type,
            });

            showNotification({
              chatId,
              senderId,
              senderName: notificationTitle,
              senderAvatarUrl: senderProfile.avatarUrl,
              messageText: chat.lastMessageText || 'New message',
            });
          } catch (error) {
            console.error('❌ Error fetching sender info for notification:', error);
          }
        }
      }
    });

    return () => {
      console.log('👋 Cleaning up in-app notification listener');
      unsubscribe();
    };
  }, [user, showNotification, getProfile]); // activeChatId NOT in deps - using ref instead
}

