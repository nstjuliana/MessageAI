/**
 * In-App Notification Component
 * Shows a banner at the top when a new message arrives while user is in the app
 * but not actively viewing that specific chat
 */

import { router } from 'expo-router';
import React, { useEffect, useRef } from 'react';
import {
    Animated,
    Image,
    Platform,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';

export interface NotificationData {
  id: string;
  chatId: string;
  senderName: string;
  senderAvatarUrl?: string;
  messageText: string;
  timestamp: number;
}

interface InAppNotificationProps {
  notification: NotificationData | null;
  onDismiss: () => void;
  autoDismissDelay?: number; // milliseconds
}

export default function InAppNotification({
  notification,
  onDismiss,
  autoDismissDelay = 4000, // 4 seconds default
}: InAppNotificationProps) {
  const slideAnim = useRef(new Animated.Value(-100)).current;
  const opacityAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (notification) {
      // Slide down and fade in
      Animated.parallel([
        Animated.spring(slideAnim, {
          toValue: 0,
          useNativeDriver: true,
          damping: 15,
          stiffness: 150,
        }),
        Animated.timing(opacityAnim, {
          toValue: 1,
          duration: 300,
          useNativeDriver: true,
        }),
      ]).start();

      // Auto-dismiss after delay
      const timer = setTimeout(() => {
        handleDismiss();
      }, autoDismissDelay);

      return () => clearTimeout(timer);
    }
  }, [notification]);

  const handleDismiss = () => {
    // Slide up and fade out
    Animated.parallel([
      Animated.timing(slideAnim, {
        toValue: -100,
        duration: 200,
        useNativeDriver: true,
      }),
      Animated.timing(opacityAnim, {
        toValue: 0,
        duration: 200,
        useNativeDriver: true,
      }),
    ]).start(() => {
      onDismiss();
    });
  };

  const handlePress = () => {
    if (notification) {
      handleDismiss();
      // Navigate to the chat after a short delay to allow animation to complete
      setTimeout(() => {
        router.push(`/(authenticated)/chat/${notification.chatId}` as any);
      }, 100);
    }
  };

  if (!notification) {
    return null;
  }

  return (
    <Animated.View
      style={[
        styles.container,
        {
          transform: [{ translateY: slideAnim }],
          opacity: opacityAnim,
        },
      ]}
    >
      <TouchableOpacity
        style={styles.touchable}
        onPress={handlePress}
        activeOpacity={0.9}
      >
        <View style={styles.content}>
          {/* Avatar */}
          <View style={styles.avatarContainer}>
            {notification.senderAvatarUrl ? (
              <Image
                source={{ uri: notification.senderAvatarUrl }}
                style={styles.avatar}
              />
            ) : (
              <View style={styles.avatarPlaceholder}>
                <Text style={styles.avatarText}>
                  {notification.senderName.charAt(0).toUpperCase()}
                </Text>
              </View>
            )}
          </View>

          {/* Message content */}
          <View style={styles.textContainer}>
            <Text style={styles.senderName} numberOfLines={1}>
              {notification.senderName}
            </Text>
            <Text style={styles.messageText} numberOfLines={2}>
              {notification.messageText}
            </Text>
          </View>

          {/* Dismiss button */}
          <TouchableOpacity
            style={styles.dismissButton}
            onPress={handleDismiss}
            hitSlop={{ top: 10, right: 10, bottom: 10, left: 10 }}
          >
            <Text style={styles.dismissText}>✕</Text>
          </TouchableOpacity>
        </View>
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
    paddingTop: Platform.OS === 'ios' ? 50 : 10,
    paddingHorizontal: 12,
  },
  touchable: {
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: '#fff',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 10,
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    backgroundColor: '#fff',
  },
  avatarContainer: {
    marginRight: 12,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
  },
  avatarPlaceholder: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#007AFF',
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  textContainer: {
    flex: 1,
    marginRight: 8,
  },
  senderName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#000',
    marginBottom: 2,
  },
  messageText: {
    fontSize: 14,
    color: '#666',
    lineHeight: 18,
  },
  dismissButton: {
    padding: 4,
    justifyContent: 'center',
    alignItems: 'center',
  },
  dismissText: {
    fontSize: 20,
    color: '#999',
    fontWeight: '300',
  },
});

