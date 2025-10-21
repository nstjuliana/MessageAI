/**
 * Presence Tracking Hook
 * Automatically tracks user presence based on app state
 * Updates online/offline/away status and last seen timestamp
 */

import { useEffect, useRef } from 'react';
import { AppState, AppStateStatus } from 'react-native';

import { useAuth } from '@/contexts/AuthContext';
import { updateLastSeen, updatePresence } from '@/services/user.service';

/**
 * Hook to automatically track user presence
 * - Sets user "online" when app is active
 * - Sets user "offline" when app goes to background
 * - Sets user "away" after 5 minutes of inactivity
 * - Updates lastSeen timestamp on activity
 */
export function usePresenceTracking() {
  const { user } = useAuth();
  const appState = useRef(AppState.currentState);
  const awayTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastSeenIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Clear all timers
  const clearTimers = () => {
    if (awayTimerRef.current) {
      clearTimeout(awayTimerRef.current);
      awayTimerRef.current = null;
    }
    if (lastSeenIntervalRef.current) {
      clearInterval(lastSeenIntervalRef.current);
      lastSeenIntervalRef.current = null;
    }
  };

  // Set user as away after 5 minutes of inactivity
  const startAwayTimer = () => {
    clearTimers();
    
    // Set away after 5 minutes (300000ms)
    awayTimerRef.current = setTimeout(() => {
      if (user) {
        updatePresence(user.uid, 'away').catch((error) => {
          console.error('Failed to set away status:', error);
        });
      }
    }, 300000); // 5 minutes
  };

  // Update lastSeen every 30 seconds when active
  const startLastSeenUpdates = () => {
    if (lastSeenIntervalRef.current) {
      clearInterval(lastSeenIntervalRef.current);
    }

    // Update lastSeen immediately
    if (user) {
      updateLastSeen(user.uid).catch((error) => {
        console.error('Failed to update lastSeen:', error);
      });
    }

    // Then update every 30 seconds
    lastSeenIntervalRef.current = setInterval(() => {
      if (user) {
        updateLastSeen(user.uid).catch((error) => {
          console.error('Failed to update lastSeen:', error);
        });
      }
    }, 30000); // 30 seconds
  };

  // Handle app state changes
  const handleAppStateChange = async (nextAppState: AppStateStatus) => {
    if (!user) return;

    const previousState = appState.current;
    appState.current = nextAppState;

    try {
      // App coming to foreground
      if (previousState.match(/inactive|background/) && nextAppState === 'active') {
        console.log('App came to foreground - setting user online');
        
        // Set user online
        await updatePresence(user.uid, 'online');
        
        // Start tracking for away status
        startAwayTimer();
        
        // Start updating lastSeen
        startLastSeenUpdates();
      }

      // App going to background
      if (previousState === 'active' && nextAppState.match(/inactive|background/)) {
        console.log('App went to background - setting user offline');
        
        // Clear timers
        clearTimers();
        
        // Update lastSeen one final time
        await updateLastSeen(user.uid);
        
        // Set user offline
        await updatePresence(user.uid, 'offline');
      }
    } catch (error) {
      console.error('Error updating presence:', error);
    }
  };

  // Set up presence tracking
  useEffect(() => {
    if (!user) {
      clearTimers();
      return;
    }

    // Set user online when hook initializes
    updatePresence(user.uid, 'online').catch((error) => {
      console.error('Failed to set initial online status:', error);
    });

    // Start tracking
    startAwayTimer();
    startLastSeenUpdates();

    // Listen for app state changes
    const subscription = AppState.addEventListener('change', handleAppStateChange);

    // Cleanup on unmount or user change
    return () => {
      clearTimers();
      subscription.remove();
      
      // Set user offline when component unmounts
      if (user) {
        updatePresence(user.uid, 'offline').catch((error) => {
          console.error('Failed to set offline status on unmount:', error);
        });
      }
    };
  }, [user]);

  // Reset away timer on user activity (could be triggered by touch events)
  const resetActivityTimer = () => {
    if (!user) return;
    
    // Clear existing timer and start new one
    startAwayTimer();
    
    // Update lastSeen on activity
    updateLastSeen(user.uid).catch((error) => {
      console.error('Failed to update lastSeen on activity:', error);
    });
  };

  return {
    resetActivityTimer,
  };
}

