/**
 * Profile Cache Context
 * Centralized caching for user profiles to reduce Firestore reads
 * and improve performance across the app
 */

import { getPublicProfile } from '@/services/user.service';
import type { PublicUserProfile } from '@/types/user.types';
import React, { createContext, useContext, useRef, useState } from 'react';

interface CachedProfile {
  profile: PublicUserProfile;
  timestamp: number;
}

interface ProfileCacheContextValue {
  getProfile: (userId: string) => Promise<PublicUserProfile | null>;
  getProfiles: (userIds: string[]) => Promise<Record<string, PublicUserProfile>>;
  invalidateProfile: (userId: string) => void;
  invalidateAll: () => void;
  getCachedProfile: (userId: string) => PublicUserProfile | null;
}

const ProfileCacheContext = createContext<ProfileCacheContextValue | undefined>(undefined);

// Cache TTL: 5 minutes (profiles don't change that often)
const CACHE_TTL = 5 * 60 * 1000;

export function ProfileCacheProvider({ children }: { children: React.ReactNode }) {
  // Use ref for cache to avoid re-renders
  const cacheRef = useRef<Map<string, CachedProfile>>(new Map());
  // Track in-flight requests to avoid duplicate fetches
  const pendingRequestsRef = useRef<Map<string, Promise<PublicUserProfile | null>>>(new Map());
  
  // Force re-render when needed (though we mostly rely on components updating themselves)
  const [, forceUpdate] = useState({});

  /**
   * Check if cached profile is still valid
   */
  const isCacheValid = (cached: CachedProfile): boolean => {
    const age = Date.now() - cached.timestamp;
    return age < CACHE_TTL;
  };

  /**
   * Get cached profile without fetching (synchronous)
   */
  const getCachedProfile = (userId: string): PublicUserProfile | null => {
    const cached = cacheRef.current.get(userId);
    if (cached && isCacheValid(cached)) {
      return cached.profile;
    }
    return null;
  };

  /**
   * Get single profile (with caching)
   */
  const getProfile = async (userId: string): Promise<PublicUserProfile | null> => {
    // Check cache first
    const cached = cacheRef.current.get(userId);
    if (cached && isCacheValid(cached)) {
      console.log(`📦 Profile cache HIT: ${userId}`);
      return cached.profile;
    }

    // Check if already fetching
    const pending = pendingRequestsRef.current.get(userId);
    if (pending) {
      console.log(`⏳ Profile fetch in progress: ${userId}`);
      return pending;
    }

    // Fetch from Firestore
    console.log(`🌐 Profile cache MISS: ${userId} - fetching from Firestore`);
    const fetchPromise = getPublicProfile(userId)
      .then((profile) => {
        if (profile) {
          // Store in cache
          cacheRef.current.set(userId, {
            profile,
            timestamp: Date.now(),
          });
          console.log(`✅ Profile cached: ${profile.displayName} (${userId})`);
        }
        // Remove from pending
        pendingRequestsRef.current.delete(userId);
        return profile;
      })
      .catch((error) => {
        console.error(`❌ Failed to fetch profile ${userId}:`, error);
        // Remove from pending
        pendingRequestsRef.current.delete(userId);
        return null;
      });

    // Store pending request
    pendingRequestsRef.current.set(userId, fetchPromise);
    return fetchPromise;
  };

  /**
   * Get multiple profiles (batched, with caching)
   */
  const getProfiles = async (userIds: string[]): Promise<Record<string, PublicUserProfile>> => {
    const result: Record<string, PublicUserProfile> = {};
    const toFetch: string[] = [];

    // Check cache for each user
    for (const userId of userIds) {
      const cached = cacheRef.current.get(userId);
      if (cached && isCacheValid(cached)) {
        result[userId] = cached.profile;
      } else {
        toFetch.push(userId);
      }
    }

    console.log(`📦 Profile batch: ${result.length} from cache, ${toFetch.length} to fetch`);

    // Fetch missing profiles in parallel
    if (toFetch.length > 0) {
      const fetchPromises = toFetch.map((userId) => getProfile(userId));
      const fetchedProfiles = await Promise.all(fetchPromises);

      // Add fetched profiles to result
      fetchedProfiles.forEach((profile, index) => {
        if (profile) {
          result[toFetch[index]] = profile;
        }
      });
    }

    return result;
  };

  /**
   * Invalidate a single profile (force refresh on next fetch)
   */
  const invalidateProfile = (userId: string) => {
    cacheRef.current.delete(userId);
    console.log(`🗑️ Profile cache invalidated: ${userId}`);
  };

  /**
   * Clear entire cache
   */
  const invalidateAll = () => {
    cacheRef.current.clear();
    pendingRequestsRef.current.clear();
    console.log('🗑️ Profile cache cleared');
  };

  return (
    <ProfileCacheContext.Provider
      value={{
        getProfile,
        getProfiles,
        invalidateProfile,
        invalidateAll,
        getCachedProfile,
      }}
    >
      {children}
    </ProfileCacheContext.Provider>
  );
}

export function useProfileCache() {
  const context = useContext(ProfileCacheContext);
  if (!context) {
    throw new Error('useProfileCache must be used within ProfileCacheProvider');
  }
  return context;
}

