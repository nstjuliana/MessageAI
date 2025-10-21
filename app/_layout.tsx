import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import { ActivityIndicator, View } from 'react-native';
import 'react-native-reanimated';

import { AuthProvider } from '@/contexts/AuthContext';
import { UserProvider } from '@/contexts/UserContext';
import { initDatabase } from '@/database/database';
import { useColorScheme } from '@/hooks/use-color-scheme';

export default function RootLayout() {
  const colorScheme = useColorScheme();
  const [dbInitialized, setDbInitialized] = useState(false);

  // Initialize database on app start
  useEffect(() => {
    initDatabase()
      .then(() => {
        console.log('Database initialized');
        setDbInitialized(true);
      })
      .catch((error) => {
        console.error('Failed to initialize database:', error);
        // Still allow app to run without local database
        setDbInitialized(true);
      });
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
          <Stack>
            <Stack.Screen name="index" options={{ headerShown: false }} />
            <Stack.Screen 
              name="auth/signup" 
              options={{ 
                title: 'Sign Up',
                headerShown: true,
              }} 
            />
            <Stack.Screen 
              name="auth/login" 
              options={{ 
                title: 'Log In',
                headerShown: true,
              }} 
            />
            <Stack.Screen 
              name="auth/profile-setup" 
              options={{ 
                title: 'Profile Setup',
                headerShown: true,
                headerBackVisible: false,
              }} 
            />
            <Stack.Screen 
              name="(authenticated)" 
              options={{ 
                headerShown: false,
              }} 
            />
          </Stack>
          <StatusBar style="auto" />
        </ThemeProvider>
      </UserProvider>
    </AuthProvider>
  );
}
