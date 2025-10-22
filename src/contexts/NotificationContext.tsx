/**
 * Notification Context
 * Manages in-app notifications and tracks which chat is currently active
 * This allows us to suppress notifications for the chat the user is actively viewing
 */

import React, { createContext, useContext, useRef, useState } from 'react';

import type { NotificationData } from '@/components/InAppNotification';

interface NotificationContextType {
  // Current notification being displayed
  currentNotification: NotificationData | null;
  
  // Show a new notification (will be suppressed if user is viewing that chat)
  showNotification: (notification: NotificationData) => void;
  
  // Dismiss the current notification
  dismissNotification: () => void;
  
  // Set the chat that the user is currently viewing (to suppress notifications)
  setActiveChatId: (chatId: string | null) => void;
  
  // Get the currently active chat ID
  activeChatId: string | null;
}

const NotificationContext = createContext<NotificationContextType | undefined>(undefined);

export function NotificationProvider({ children }: { children: React.ReactNode }) {
  const [currentNotification, setCurrentNotification] = useState<NotificationData | null>(null);
  const [activeChatId, setActiveChatId] = useState<string | null>(null);
  
  // Track the last message we processed to avoid duplicate notifications
  const lastProcessedMessageId = useRef<string | null>(null);

  const dismissNotification = () => {
    setCurrentNotification(null);
    lastProcessedMessageId.current = null;
  };

  // Public method to show a notification (called from useInAppNotifications hook)
  const showNotification = (notification: NotificationData) => {
    console.log('🎯 showNotification called with:', {
      senderName: notification.senderName,
      chatId: notification.chatId,
      activeChatId,
      messageText: notification.messageText?.substring(0, 30),
    });
    
    // Don't show if this is the active chat
    if (activeChatId === notification.chatId) {
      console.log('📵 Suppressing notification - user is viewing this chat');
      return;
    }

    // Don't show duplicate notifications
    if (lastProcessedMessageId.current === notification.id) {
      console.log('📵 Suppressing duplicate notification');
      return;
    }

    console.log('🔔 ✅ SHOWING IN-APP NOTIFICATION:', notification.senderName);
    setCurrentNotification(notification);
    lastProcessedMessageId.current = notification.id;
  };

  const value: NotificationContextType = {
    currentNotification,
    showNotification,
    dismissNotification,
    setActiveChatId,
    activeChatId,
  };

  return (
    <NotificationContext.Provider value={value}>
      {children}
    </NotificationContext.Provider>
  );
}

/**
 * Hook to access notification context
 */
export function useNotifications(): NotificationContextType {
  const context = useContext(NotificationContext);
  
  if (context === undefined) {
    throw new Error('useNotifications must be used within a NotificationProvider');
  }
  
  return context;
}

