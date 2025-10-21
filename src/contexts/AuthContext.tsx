/**
 * Authentication Context
 * Provides global authentication state and functions throughout the app
 */

import { router } from 'expo-router';
import { User as FirebaseUser } from 'firebase/auth';
import React, { createContext, useContext, useEffect, useState } from 'react';

import { logOut, onAuthStateChange, signIn, signUp } from '@/services/auth.service';
import { onUserSnapshot } from '@/services/user.service';
import type { User } from '@/types/user.types';

interface AuthContextType {
  // Current authenticated user (null if not logged in)
  user: FirebaseUser | null;
  
  // User profile from Firestore (null if not loaded yet)
  userProfile: User | null;
  
  // Loading state (true while checking authentication status)
  loading: boolean;
  
  // Authentication functions
  signUp: (email: string, password: string) => Promise<FirebaseUser>;
  signIn: (email: string, password: string) => Promise<FirebaseUser>;
  logOut: () => Promise<void>;
}

// Create the context with undefined default value
const AuthContext = createContext<AuthContextType | undefined>(undefined);

/**
 * Auth Provider Component
 * Wraps the app and provides authentication state to all child components
 */
export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<FirebaseUser | null>(null);
  const [userProfile, setUserProfile] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  // Listen to Firebase auth state changes
  useEffect(() => {
    const unsubscribe = onAuthStateChange((firebaseUser) => {
      setUser(firebaseUser);
      setLoading(false);
    });

    // Cleanup listener on unmount
    return unsubscribe;
  }, []);

  // Listen to Firestore user profile changes
  useEffect(() => {
    if (!user) {
      setUserProfile(null);
      return;
    }

    // Subscribe to user profile updates
    const unsubscribe = onUserSnapshot(user.uid, (profile) => {
      setUserProfile(profile);
    });

    // Cleanup listener on unmount or user change
    return unsubscribe;
  }, [user]);

  // Sign up function
  const handleSignUp = async (email: string, password: string): Promise<FirebaseUser> => {
    const newUser = await signUp(email, password);
    // Firebase listener will automatically update the user state
    return newUser;
  };

  // Sign in function
  const handleSignIn = async (email: string, password: string): Promise<FirebaseUser> => {
    const authenticatedUser = await signIn(email, password);
    // Firebase listener will automatically update the user state
    return authenticatedUser;
  };

  // Log out function
  const handleLogOut = async (): Promise<void> => {
    await logOut();
    // Firebase listener will automatically set user to null
    // Redirect to login screen
    router.replace('/auth/login');
  };

  const value: AuthContextType = {
    user,
    userProfile,
    loading,
    signUp: handleSignUp,
    signIn: handleSignIn,
    logOut: handleLogOut,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

/**
 * Custom hook to access authentication context
 * Must be used within an AuthProvider
 */
export function useAuth(): AuthContextType {
  const context = useContext(AuthContext);
  
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  
  return context;
}


