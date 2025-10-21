/**
 * User Context
 * Provides user profile data and management throughout the app
 * Separate from authentication - handles Firestore user profile only
 */

import React, { createContext, useContext, useEffect, useState } from 'react';

import { onUserSnapshot, updatePresence, updateUser } from '@/services/user.service';
import type { UpdateUserData, User } from '@/types/user.types';

import { useAuth } from './AuthContext';

interface UserContextType {
  // Current user profile from Firestore (null if not loaded)
  userProfile: User | null;
  
  // Loading state (true while fetching user profile)
  profileLoading: boolean;
  
  // User profile functions
  updateProfile: (updates: UpdateUserData) => Promise<void>;
  setPresence: (presence: 'online' | 'offline' | 'away') => Promise<void>;
  refreshProfile: () => Promise<void>;
}

// Create the context with undefined default value
const UserContext = createContext<UserContextType | undefined>(undefined);

/**
 * User Provider Component
 * Manages user profile state and provides profile functions
 * Must be nested inside AuthProvider
 */
export function UserProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const [userProfile, setUserProfile] = useState<User | null>(null);
  const [profileLoading, setProfileLoading] = useState(false);

  // Listen to Firestore user profile changes
  useEffect(() => {
    if (!user) {
      setUserProfile(null);
      setProfileLoading(false);
      return;
    }

    setProfileLoading(true);

    // Subscribe to user profile updates
    const unsubscribe = onUserSnapshot(user.uid, (profile) => {
      setUserProfile(profile);
      setProfileLoading(false);
    });

    // Cleanup listener on unmount or user change
    return unsubscribe;
  }, [user]);

  // Update user profile
  const handleUpdateProfile = async (updates: UpdateUserData): Promise<void> => {
    if (!user) {
      throw new Error('No authenticated user');
    }
    await updateUser(user.uid, updates);
    // Profile will update automatically via the listener
  };

  // Update user presence
  const handleSetPresence = async (presence: 'online' | 'offline' | 'away'): Promise<void> => {
    if (!user) {
      throw new Error('No authenticated user');
    }
    await updatePresence(user.uid, presence);
    // Profile will update automatically via the listener
  };

  // Force refresh profile (rarely needed due to real-time listener)
  const handleRefreshProfile = async (): Promise<void> => {
    // The listener will automatically fetch latest data
    // This is mainly for manual refresh if needed
    if (!user) return;
    
    setProfileLoading(true);
    // Trigger a re-subscription to force fresh data
    // In practice, the listener keeps data fresh automatically
  };

  const value: UserContextType = {
    userProfile,
    profileLoading,
    updateProfile: handleUpdateProfile,
    setPresence: handleSetPresence,
    refreshProfile: handleRefreshProfile,
  };

  return <UserContext.Provider value={value}>{children}</UserContext.Provider>;
}

/**
 * Custom hook to access user context
 * Must be used within a UserProvider (which must be inside AuthProvider)
 */
export function useUser(): UserContextType {
  const context = useContext(UserContext);
  
  if (context === undefined) {
    throw new Error('useUser must be used within a UserProvider');
  }
  
  return context;
}

