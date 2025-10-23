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
  const lastNotificationTimeRef = useRef<number>(0);

  const showNotification = (notification: InAppNotificationData) => {
    // Suppress if user is viewing this chat
    if (activeChatId === notification.chatId) {
      console.log('📵 Notification suppressed: user is viewing this chat');
      return;
    }

    // Suppress duplicate notifications within 1 second (based on time, not content)
    const now = Date.now();
    if (now - lastNotificationTimeRef.current < 1000) {
      console.log('📵 Notification suppressed: too soon after last notification');
      return;
    }

    console.log('🔔 ✅ Notification showing:', {
      chatId: notification.chatId,
      sender: notification.senderName,
      message: notification.messageText.substring(0, 50),
    });

    lastNotificationTimeRef.current = now;
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

