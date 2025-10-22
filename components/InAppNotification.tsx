/**
 * In-App Notification Banner
 * Shows notification banner for incoming messages when app is in foreground
 * but user is not viewing the specific chat
 */

import { router } from 'expo-router';
import { useEffect, useRef } from 'react';
import { Animated, Image, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

export interface InAppNotificationData {
  chatId: string;
  senderId: string;
  senderName: string;
  senderAvatarUrl?: string;
  messageText: string;
}

interface InAppNotificationProps {
  notification: InAppNotificationData | null;
  onDismiss: () => void;
}

export default function InAppNotification({ notification, onDismiss }: InAppNotificationProps) {
  const slideAnim = useRef(new Animated.Value(-100)).current;
  const autoHideTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (notification) {
      // Slide down animation
      Animated.spring(slideAnim, {
        toValue: 0,
        useNativeDriver: true,
        tension: 65,
        friction: 8,
      }).start();

      // Auto-hide after 4 seconds
      autoHideTimeoutRef.current = setTimeout(() => {
        handleDismiss();
      }, 4000);

      return () => {
        if (autoHideTimeoutRef.current) {
          clearTimeout(autoHideTimeoutRef.current);
        }
      };
    } else {
      // Slide up animation when dismissed
      Animated.timing(slideAnim, {
        toValue: -100,
        duration: 200,
        useNativeDriver: true,
      }).start();
    }
  }, [notification]);

  const handleDismiss = () => {
    Animated.timing(slideAnim, {
      toValue: -100,
      duration: 200,
      useNativeDriver: true,
    }).start(() => {
      onDismiss();
    });
  };

  const handleTap = () => {
    if (notification) {
      console.log('🎯 Notification tapped, navigating to chat:', notification.chatId);
      handleDismiss();
      router.push(`/(authenticated)/chat/${notification.chatId}`);
    }
  };

  if (!notification) return null;

  return (
    <Animated.View
      style={[
        styles.container,
        {
          transform: [{ translateY: slideAnim }],
        },
      ]}
    >
      <TouchableOpacity
        style={styles.notificationCard}
        onPress={handleTap}
        activeOpacity={0.8}
      >
        {/* Avatar */}
        <View style={styles.avatar}>
          {notification.senderAvatarUrl ? (
            <Image source={{ uri: notification.senderAvatarUrl }} style={styles.avatarImage} />
          ) : (
            <Text style={styles.avatarText}>
              {notification.senderName.charAt(0).toUpperCase()}
            </Text>
          )}
        </View>

        {/* Content */}
        <View style={styles.content}>
          <Text style={styles.senderName} numberOfLines={1}>
            {notification.senderName}
          </Text>
          <Text style={styles.messageText} numberOfLines={2}>
            {notification.messageText}
          </Text>
        </View>

        {/* Dismiss button */}
        <TouchableOpacity onPress={handleDismiss} style={styles.dismissButton}>
          <Text style={styles.dismissText}>✕</Text>
        </TouchableOpacity>
      </TouchableOpacity>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 9999,
    paddingTop: 60, // Below status bar
    paddingHorizontal: 16,
  },
  notificationCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 5,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#007AFF',
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
    marginRight: 12,
  },
  avatarImage: {
    width: 40,
    height: 40,
  },
  avatarText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
  },
  content: {
    flex: 1,
    marginRight: 8,
  },
  senderName: {
    fontSize: 15,
    fontWeight: '600',
    color: '#000',
    marginBottom: 2,
  },
  messageText: {
    fontSize: 14,
    color: '#555',
  },
  dismissButton: {
    width: 28,
    height: 28,
    justifyContent: 'center',
    alignItems: 'center',
  },
  dismissText: {
    fontSize: 18,
    color: '#8E8E93',
  },
});

