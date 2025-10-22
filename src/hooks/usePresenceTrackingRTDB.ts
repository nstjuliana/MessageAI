/**
 * Presence Tracking Hook (RTDB)
 * Automatically tracks user presence using Firebase Realtime Database
 * 
 * Features:
 * - Sets user "online" when app is active
 * - Sets user "offline" automatically when app closes or network disconnects (via onDisconnect)
 * - Sets user "away" after 5 minutes of inactivity
 * - No periodic writes needed (95%+ reduction vs Firestore approach)
 */

import { useEffect, useRef, useState } from 'react';
import { AppState, AppStateStatus } from 'react-native';

import { useAuth } from '@/contexts/AuthContext';
import {
  setUserOffline,
  setUserOnline,
  updateUserPresence
} from '@/services/presence.service';
import { UserPresence } from '@/types/user.types';

const AWAY_TIMEOUT = 5 * 60 * 1000; // 5 minutes

/**
 * Hook to automatically track user presence
 * - Sets user "online" when app is active
 * - Sets user "offline" automatically on disconnect (via RTDB onDisconnect)
 * - Sets user "away" after 5 minutes of inactivity
 */
export function usePresenceTrackingRTDB() {
  const { user } = useAuth();
  const appState = useRef(AppState.currentState);
  const awayTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [currentStatus, setCurrentStatus] = useState<UserPresence>('online');
  const lastActivityTime = useRef<number>(Date.now());

  // Clear away timer
  const clearAwayTimer = () => {
    if (awayTimerRef.current) {
      clearTimeout(awayTimerRef.current);
      awayTimerRef.current = null;
    }
  };

  // Start away timer
  const startAwayTimer = () => {
    clearAwayTimer();

    awayTimerRef.current = setTimeout(async () => {
      if (user) {
        console.log('⏰ User inactive for 5 minutes - setting status to away');
        await updateUserPresence(user.uid, 'away');
        setCurrentStatus('away');
      }
    }, AWAY_TIMEOUT);
  };

  // Handle app state changes
  const handleAppStateChange = async (nextAppState: AppStateStatus) => {
    if (!user) return;

    const previousState = appState.current;
    appState.current = nextAppState;

    try {
      // App coming to foreground
      if (previousState.match(/inactive|background/) && nextAppState === 'active') {
        console.log('📱 App came to foreground - setting user online');

        // Set user online and configure auto-disconnect
        await setUserOnline(user.uid);
        setCurrentStatus('online');

        // Start tracking for away status
        startAwayTimer();
      }

      // App going to background
      if (previousState === 'active' && nextAppState.match(/inactive|background/)) {
        console.log('📱 App went to background');

        // Clear timers
        clearAwayTimer();

        // Don't manually set offline - onDisconnect will handle it
        // This is the key benefit of RTDB!
      }
    } catch (error) {
      console.error('Error updating presence:', error);
    }
  };

  // Set up presence tracking
  useEffect(() => {
    if (!user) {
      clearAwayTimer();
      return;
    }

    // Set user online when hook initializes
    setUserOnline(user.uid)
      .then(() => {
        setCurrentStatus('online');
      })
      .catch((error) => {
        console.error('Failed to set initial online status:', error);
      });

    // Start tracking
    startAwayTimer();

    // Listen for app state changes
    const subscription = AppState.addEventListener('change', handleAppStateChange);

    // Cleanup on unmount or user change
    return () => {
      clearAwayTimer();
      subscription.remove();

      // Set user offline when component unmounts (e.g., logout)
      if (user) {
        setUserOffline(user.uid).catch((error) => {
          console.error('Failed to set offline status on unmount:', error);
        });
      }
    };
  }, [user]);

  // Reset away timer on user activity
  const resetActivityTimer = async () => {
    if (!user) return;

    // Always reset the away timer first
    startAwayTimer();

    const now = Date.now();
    const timeSinceLastActivity = now - lastActivityTime.current;

    // If we're away, ALWAYS update to online (no debounce for away->online)
    if (currentStatus === 'away') {
      console.log('👆 User activity detected - resetting to online from away');
      lastActivityTime.current = now;
      await updateUserPresence(user.uid, 'online');
      setCurrentStatus('online');
      return;
    }

    // For online status, debounce writes (but still reset timer above)
    if (timeSinceLastActivity < 2000) {
      // Already online and updated recently, just timer reset is enough
      return;
    }

    lastActivityTime.current = now;
  };

  return {
    resetActivityTimer,
    currentStatus,
  };
}

