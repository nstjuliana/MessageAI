/**
 * Protected Routes Layout
 * This layout ensures users are authenticated before accessing these screens
 * Also handles presence tracking (online/offline/away status)
 */

import { Redirect, Stack, usePathname } from 'expo-router';
import { useEffect } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';

import { useAuth } from '@/contexts/AuthContext';
import { usePresenceTracking } from '@/hooks/usePresenceTracking';

export default function AuthenticatedLayout() {
  const { user, loading } = useAuth();
  const pathname = usePathname();
  
  // Track user presence (online/offline/away) and update lastSeen
  const { resetActivityTimer } = usePresenceTracking();

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
  return (
    <Pressable style={{ flex: 1 }} onPress={resetActivityTimer}>
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
      </Stack>
    </Pressable>
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


