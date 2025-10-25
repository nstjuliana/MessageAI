import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import { ActivityIndicator, View } from 'react-native';
import 'react-native-reanimated';

import { AuthProvider } from '@/contexts/AuthContext';
import { UserProvider } from '@/contexts/UserContext';
import { initDatabase, rebuildDatabase } from '@/database/database';
import { useColorScheme } from '@/hooks/use-color-scheme';

export default function RootLayout() {
  const colorScheme = useColorScheme();
  const [dbInitialized, setDbInitialized] = useState(false);

  // Initialize database on app start
  useEffect(() => {
    // TEMPORARY: Force database rebuild for v8 migration
    // Remove this after everyone has migrated!
    const forceRebuild = true; // Set to false after migration
    
    if (forceRebuild) {
      console.log('🔄 Forcing database rebuild for v8 migration...');
      rebuildDatabase()
        .then(() => {
          console.log('✅ Database rebuilt successfully');
          setDbInitialized(true);
        })
        .catch((error) => {
          console.error('❌ Failed to rebuild database:', error);
          // Try regular init as fallback
          initDatabase()
            .then(() => {
              console.log('✅ Database initialized (fallback)');
              setDbInitialized(true);
            })
            .catch((initError) => {
              console.error('❌ Failed to initialize database:', initError);
              setDbInitialized(true);
            });
        });
    } else {
      console.log('🔄 Initializing database...');
      initDatabase()
        .then(() => {
          console.log('✅ Database initialized successfully');
          setDbInitialized(true);
        })
        .catch((error) => {
          console.error('❌ Failed to initialize database:', error);
          // Still allow app to run without local database
          setDbInitialized(true);
        });
    }
  }, []);

  // Show loading while database initializes
  if (!dbInitialized) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" color="#007AFF" />
      </View>
    );
  }

  return (
    <AuthProvider>
      <UserProvider>
        <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
          <Stack
            screenOptions={{
              headerShown: false, // Hide header for all screens
            }}
          >
            <Stack.Screen name="index" />
            <Stack.Screen name="auth/signup" />
            <Stack.Screen name="auth/login" />
            <Stack.Screen name="auth/profile-setup" />
            <Stack.Screen name="(authenticated)" />
          </Stack>
          <StatusBar style="auto" />
        </ThemeProvider>
      </UserProvider>
    </AuthProvider>
  );
}
