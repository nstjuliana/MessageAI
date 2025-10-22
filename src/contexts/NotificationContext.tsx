/**
 * Notification Context
 * Manages in-app notification state and active chat tracking
 */

import React, { createContext, useContext, useRef, useState } from 'react';
import type { InAppNotificationData } from '../../components/InAppNotification';

interface NotificationContextValue {
  currentNotification: InAppNotificationData | null;
  showNotification: (notification: InAppNotificationData) => void;
  dismissNotification: () => void;
  setActiveChatId: (chatId: string | null) => void;
  activeChatId: string | null;
}

const NotificationContext = createContext<NotificationContextValue | undefined>(undefined);

export function NotificationProvider({ children }: { children: React.ReactNode }) {
  const [currentNotification, setCurrentNotification] = useState<InAppNotificationData | null>(null);
  const [activeChatId, setActiveChatId] = useState<string | null>(null);
  const lastProcessedMessageIdRef = useRef<string | null>(null);

  const showNotification = (notification: InAppNotificationData) => {
    // Suppress if user is viewing this chat
    if (activeChatId === notification.chatId) {
      console.log('📵 Notification suppressed: user is viewing this chat');
      return;
    }

    // Suppress duplicate notifications
    const notificationId = `${notification.chatId}-${notification.messageText}`;
    if (lastProcessedMessageIdRef.current === notificationId) {
      console.log('📵 Notification suppressed: duplicate');
      return;
    }

    console.log('🔔 ✅ Notification showing:', {
      chatId: notification.chatId,
      sender: notification.senderName,
      message: notification.messageText.substring(0, 50),
    });

    lastProcessedMessageIdRef.current = notificationId;
    setCurrentNotification(notification);
  };

  const dismissNotification = () => {
    setCurrentNotification(null);
  };

  return (
    <NotificationContext.Provider
      value={{
        currentNotification,
        showNotification,
        dismissNotification,
        setActiveChatId,
        activeChatId,
      }}
    >
      {children}
    </NotificationContext.Provider>
  );
}

export function useNotifications() {
  const context = useContext(NotificationContext);
  if (!context) {
    throw new Error('useNotifications must be used within NotificationProvider');
  }
  return context;
}

