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
import { useNetworkRetry } from '@/hooks/useNetworkRetry';
import { usePresenceTrackingRTDB } from '@/hooks/usePresenceTrackingRTDB';

export default function AuthenticatedLayout() {
  const { user, loading } = useAuth();
  const pathname = usePathname();
  
  // Track user presence (online/offline/away) using RTDB
  const { resetActivityTimer } = usePresenceTrackingRTDB();
  
  // Enable automatic message retry when network reconnects (app-wide)
  useNetworkRetry();

  // Reset activity timer whenever user navigates to a new screen
  useEffect(() => {
    if (user) {
      resetActivityTimer();
    }
  }, [pathname, user]);

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

  // User is authenticated, render the protected screens
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
        </Stack>
      </View>
    </ActivityProvider>
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


