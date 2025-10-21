import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import 'react-native-reanimated';

import { AuthProvider } from '@/contexts/AuthContext';
import { UserProvider } from '@/contexts/UserContext';
import { useColorScheme } from '@/hooks/use-color-scheme';

export default function RootLayout() {
  const colorScheme = useColorScheme();

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
