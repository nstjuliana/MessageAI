/**
 * Protected Routes Layout
 * This layout ensures users are authenticated before accessing these screens
 * Also handles presence tracking (online/offline/away status)
 */

import { Redirect, Stack } from 'expo-router';
import { ActivityIndicator, StyleSheet, View } from 'react-native';

import { useAuth } from '@/contexts/AuthContext';
import { usePresenceTracking } from '@/hooks/usePresenceTracking';

export default function AuthenticatedLayout() {
  const { user, loading } = useAuth();
  
  // Track user presence (online/offline/away) and update lastSeen
  usePresenceTracking();

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
    <Stack>
      <Stack.Screen 
        name="chats" 
        options={{ 
          title: 'Chats',
          headerShown: true,
        }} 
      />
    </Stack>
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


