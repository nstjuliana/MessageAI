/**
 * Protected Routes Layout
 * This layout ensures users are authenticated before accessing these screens
 * Also handles presence tracking (online/offline/away status)
 */

import { Redirect, Stack, usePathname } from 'expo-router';
import { useEffect } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';

import { ActivityProvider } from '@/contexts/ActivityContext';
import { useAuth } from '@/contexts/AuthContext';
import { NetworkProvider } from '@/contexts/NetworkContext';
import { NotificationProvider, useNotifications } from '@/contexts/NotificationContext';
import { ProfileCacheProvider } from '@/contexts/ProfileCacheContext';
import { useInAppNotifications } from '@/hooks/useInAppNotifications';
import { useNetworkRetry } from '@/hooks/useNetworkRetry';
import { usePresenceTrackingRTDB } from '@/hooks/usePresenceTrackingRTDB';
import InAppNotification from '../../components/InAppNotification';

// Component that uses notification context (must be inside provider)
function AuthenticatedContent() {
  const pathname = usePathname();
  const { resetActivityTimer } = usePresenceTrackingRTDB();
  const { currentNotification, dismissNotification } = useNotifications();
  
  // Enable automatic message retry when network reconnects (app-wide)
  useNetworkRetry();
  
  // Enable in-app notifications
  useInAppNotifications();

  // Reset activity timer whenever user navigates to a new screen
  useEffect(() => {
    resetActivityTimer();
  }, [pathname]);

  // Handle all touches to reset activity timer (for presence tracking)
  const handleTouchActivity = () => {
    resetActivityTimer();
  };

  return (
    <ActivityProvider resetActivityTimer={resetActivityTimer}>
      <View 
        style={{ flex: 1 }}
        collapsable={false}
        onTouchStart={handleTouchActivity}
        onTouchMove={handleTouchActivity}
        onStartShouldSetResponderCapture={() => {
          handleTouchActivity();
          return false; // Don't capture, let children handle the touch
        }}
        onMoveShouldSetResponderCapture={() => {
          handleTouchActivity();
          return false; // Don't capture, let children handle scrolling
        }}
      >
        <Stack
          screenOptions={{
            headerShown: false, // Hide header for all screens by default
          }}
        >
          <Stack.Screen 
            name="chats" 
            options={{ 
              headerShown: false,
            }} 
          />
          <Stack.Screen 
            name="new-chat" 
            options={{ 
              headerShown: false,
            }} 
          />
          <Stack.Screen 
            name="chat/[chatId]" 
            options={{ 
              headerShown: false,
            }} 
          />
          <Stack.Screen 
            name="profile" 
            options={{ 
              headerShown: false,
            }} 
          />
        </Stack>
        
        {/* In-app notification banner */}
        <InAppNotification 
          notification={currentNotification} 
          onDismiss={dismissNotification} 
        />
      </View>
    </ActivityProvider>
  );
}

export default function AuthenticatedLayout() {
  const { user, loading } = useAuth();

  // Show loading spinner while checking authentication
  if (loading) {
    return (
      <View style={styles.container}>
        <ActivityIndicator size="large" color="#007AFF" />
      </View>
    );
  }

  // Redirect to login if not authenticated
  if (!user) {
    return <Redirect href="/auth/login" />;
  }

  // User is authenticated, wrap with providers
  return (
    <NetworkProvider>
      <ProfileCacheProvider>
        <NotificationProvider>
          <AuthenticatedContent />
        </NotificationProvider>
      </ProfileCacheProvider>
    </NetworkProvider>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#fff',
  },
});


