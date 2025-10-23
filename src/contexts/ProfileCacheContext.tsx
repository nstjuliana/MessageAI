/**
 * Profile Cache Context
 * Centralized caching for user profiles to reduce Firestore reads
 * and improve performance across the app
 */

import { executeStatement, getDatabase } from '@/database/database';
import { getPublicProfile } from '@/services/user.service';
import type { PublicUserProfile } from '@/types/user.types';
import * as FileSystem from 'expo-file-system/legacy';
import React, { createContext, useContext, useRef, useState } from 'react';

interface CachedProfile {
  profile: PublicUserProfile;
  timestamp: number;
}

interface ProfileCacheContextValue {
  getProfile: (userId: string) => Promise<PublicUserProfile | null>;
  getProfiles: (userIds: string[]) => Promise<Record<string, PublicUserProfile>>;
  cacheProfile: (profile: PublicUserProfile) => Promise<void>;
  invalidateProfile: (userId: string) => void;
  invalidateAll: () => void;
  getCachedProfile: (userId: string) => PublicUserProfile | null;
}

const ProfileCacheContext = createContext<ProfileCacheContextValue | undefined>(undefined);

// Cache TTL: Memory (5 minutes), SQLite (24 hours)
const MEMORY_CACHE_TTL = 5 * 60 * 1000;
const SQLITE_CACHE_TTL = 24 * 60 * 60 * 1000;

/**
 * Download image from URL and convert to base64
 */
async function downloadImageAsBase64(url: string): Promise<string | null> {
  try {
    console.log(`📥 Downloading image for offline cache: ${url.substring(0, 80)}...`);
    console.log(`📥 Full URL: ${url}`);
    
    const tempPath = FileSystem.cacheDirectory + 'temp_avatar_' + Date.now() + '.jpg';
    console.log(`📥 Download destination: ${tempPath}`);
    
    const response = await FileSystem.downloadAsync(url, tempPath);
    
    console.log(`📥 Download response:`, {
      status: response.status,
      uri: response.uri,
      headers: response.headers,
    });
    
    if (response.status !== 200) {
      console.error(`❌ Failed to download image: HTTP ${response.status}`);
      console.error(`❌ Response headers:`, response.headers);
      return null;
    }
    
    console.log(`📥 Reading file as base64...`);
    // Read as base64
    const base64 = await FileSystem.readAsStringAsync(response.uri, {
      encoding: FileSystem.EncodingType.Base64,
    });
    
    console.log(`📥 Base64 read successfully, length: ${base64.length}`);
    
    // Delete temp file
    console.log(`📥 Deleting temp file...`);
    await FileSystem.deleteAsync(response.uri, { idempotent: true });
    
    console.log(`✅ Image downloaded and converted to base64 (${Math.round(base64.length / 1024)}KB)`);
    return base64;
  } catch (error: any) {
    console.error('❌ Failed to download image:', error);
    console.error('❌ Error details:', {
      message: error?.message,
      code: error?.code,
      stack: error?.stack,
    });
    return null;
  }
}

/**
 * Sync profile to SQLite for offline access
 * Downloads and caches avatar image as base64 for offline use
 */
async function syncProfileToSQLite(profile: PublicUserProfile): Promise<void> {
  try {
    console.log(`💾 syncProfileToSQLite called for: ${profile.displayName}`);
    console.log(`💾 Profile has avatarUrl: ${!!profile.avatarUrl}`);
    
    const sqlite = getDatabase();
    const now = Date.now();
    
    // Download avatar image if URL exists
    let avatarBlob: string | null = null;
    if (profile.avatarUrl) {
      console.log(`💾 Attempting to download avatar image...`);
      avatarBlob = await downloadImageAsBase64(profile.avatarUrl);
      console.log(`💾 Download result: ${avatarBlob ? 'SUCCESS' : 'FAILED'}, length: ${avatarBlob?.length || 0}`);
    } else {
      console.log(`💾 No avatarUrl, skipping image download`);
    }
    
    const sql = `
      INSERT OR REPLACE INTO profiles (
        userId, username, displayName, avatarUrl, avatarBlob, bio, lastSeen,
        cachedAt, updatedAt
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;
    
    console.log(`💾 Executing SQL to cache profile...`);
    await executeStatement(sql, [
      profile.id,
      profile.username,
      profile.displayName,
      profile.avatarUrl || null,
      avatarBlob,
      profile.bio || null,
      profile.lastSeen || 0,
      now,
      now,
    ]);
    
    if (avatarBlob) {
      console.log(`✅ Profile cached to SQLite WITH image blob: ${profile.displayName} (${Math.round(avatarBlob.length / 1024)}KB)`);
    } else {
      console.log(`⚠️ Profile cached to SQLite WITHOUT image blob: ${profile.displayName}`);
    }
  } catch (error: any) {
    console.error('❌ Failed to sync profile to SQLite:', error);
    console.error('❌ Error details:', {
      message: error?.message,
      code: error?.code,
      stack: error?.stack,
    });
  }
}

/**
 * Get profile from SQLite (L2 cache)
 */
async function getProfileFromSQLite(userId: string): Promise<PublicUserProfile | null> {
  try {
    const sqlite = getDatabase();
    
    const sql = `
      SELECT userId, username, displayName, avatarUrl, avatarBlob, bio, lastSeen, cachedAt
      FROM profiles
      WHERE userId = ?
    `;
    
    const row = await sqlite.getFirstAsync<any>(sql, [userId]);
    
    if (!row) return null;
    
    // Check if cache is still valid (24 hours)
    const age = Date.now() - row.cachedAt;
    if (age > SQLITE_CACHE_TTL) {
      console.log(`💾 SQLite cache expired for ${userId} (age: ${Math.floor(age / 1000 / 60 / 60)}h)`);
      return null;
    }
    
    const profile: PublicUserProfile = {
      id: row.userId,
      username: row.username,
      displayName: row.displayName,
      avatarUrl: row.avatarUrl || undefined,
      avatarBlob: row.avatarBlob || undefined,
      bio: row.bio || undefined,
      presence: 'offline', // Will be updated by presence listener
      lastSeen: row.lastSeen || 0,
    };
    
    // If profile has avatarUrl but no avatarBlob, download image in background
    if (profile.avatarUrl && !profile.avatarBlob) {
      console.log(`📥 Profile missing image blob, downloading in background: ${profile.displayName}`);
      // Download asynchronously, don't block this function
      downloadImageAsBase64(profile.avatarUrl).then(async (blob) => {
        if (blob) {
          profile.avatarBlob = blob;
          // Update SQLite with the blob
          const sqlite = getDatabase();
          await executeStatement(
            'UPDATE profiles SET avatarBlob = ? WHERE userId = ?',
            [blob, userId]
          );
          console.log(`✅ Updated profile with image blob: ${profile.displayName}`);
        }
      }).catch(err => console.error('Failed to download missing blob:', err));
    } else if (profile.avatarBlob) {
      console.log(`💾 Profile loaded with cached image blob: ${profile.displayName} (${Math.round(profile.avatarBlob.length / 1024)}KB)`);
    }
    
    return profile;
  } catch (error) {
    console.error('❌ Failed to get profile from SQLite:', error);
    return null;
  }
}

export function ProfileCacheProvider({ children }: { children: React.ReactNode }) {
  // Use ref for cache to avoid re-renders
  const cacheRef = useRef<Map<string, CachedProfile>>(new Map());
  // Track in-flight requests to avoid duplicate fetches
  const pendingRequestsRef = useRef<Map<string, Promise<PublicUserProfile | null>>>(new Map());
  
  // Force re-render when needed (though we mostly rely on components updating themselves)
  const [, forceUpdate] = useState({});

  /**
   * Check if memory cached profile is still valid
   */
  const isMemoryCacheValid = (cached: CachedProfile): boolean => {
    const age = Date.now() - cached.timestamp;
    return age < MEMORY_CACHE_TTL;
  };

  /**
   * Get cached profile without fetching (synchronous, memory only)
   */
  const getCachedProfile = (userId: string): PublicUserProfile | null => {
    const cached = cacheRef.current.get(userId);
    if (cached && isMemoryCacheValid(cached)) {
      return cached.profile;
    }
    return null;
  };

  /**
   * Get single profile (with 3-tier caching: Memory → SQLite → Firestore)
   */
  const getProfile = async (userId: string): Promise<PublicUserProfile | null> => {
    console.log(`🔍 getProfile called for: ${userId}`);
    
    // L1: Check memory cache first
    const memCached = cacheRef.current.get(userId);
    if (memCached && isMemoryCacheValid(memCached)) {
      // Check if profile has avatarUrl but missing avatarBlob - if so, it's incomplete
      const hasUrl = !!memCached.profile.avatarUrl;
      const hasBlob = !!memCached.profile.avatarBlob;
      
      if (hasUrl && !hasBlob) {
        console.log(`⚠️ L1 cache has profile WITHOUT blob - reloading from SQLite: ${userId}`);
        // Fall through to check SQLite which should have the blob
      } else {
        console.log(`📦 L1 cache HIT (memory): ${userId}, hasBlob=${hasBlob}`);
        return memCached.profile;
      }
    }

    // Check if already fetching
    const pending = pendingRequestsRef.current.get(userId);
    if (pending) {
      console.log(`⏳ Profile fetch in progress: ${userId}`);
      return pending;
    }

    // L2: Check SQLite cache
    const fetchPromise = (async () => {
      console.log(`🔍 Checking L2 (SQLite) for: ${userId}`);
      const sqliteCached = await getProfileFromSQLite(userId);
      if (sqliteCached) {
        console.log(`💾 L2 cache HIT (SQLite): ${userId}, hasBlob=${!!sqliteCached.avatarBlob}, blobLength=${sqliteCached.avatarBlob?.length || 0}`);
        // Promote to L1 (memory)
        cacheRef.current.set(userId, {
          profile: sqliteCached,
          timestamp: Date.now(),
        });
        pendingRequestsRef.current.delete(userId);
        return sqliteCached;
      }

      // L3: Fetch from Firestore
      console.log(`🌐 L3 fetch (Firestore): ${userId}`);
      try {
        const profile = await getPublicProfile(userId);
        
        if (profile) {
          console.log(`✅ Got profile from Firestore: ${profile.displayName}, avatarUrl=${profile.avatarUrl?.substring(0, 50)}`);
          // Store in all cache layers
          console.log(`💾 Syncing to SQLite (with image download)...`);
          await syncProfileToSQLite(profile); // L2
          cacheRef.current.set(userId, {      // L1
            profile,
            timestamp: Date.now(),
          });
          console.log(`✅ Profile cached in all layers: ${profile.displayName}`);
        }
        
        pendingRequestsRef.current.delete(userId);
        return profile;
      } catch (error) {
        console.error(`❌ Failed to fetch profile ${userId}:`, error);
        pendingRequestsRef.current.delete(userId);
        return null;
      }
    })();

    // Store pending request
    pendingRequestsRef.current.set(userId, fetchPromise);
    return fetchPromise;
  };

  /**
   * Get multiple profiles (batched, with 3-tier caching)
   */
  const getProfiles = async (userIds: string[]): Promise<Record<string, PublicUserProfile>> => {
    const result: Record<string, PublicUserProfile> = {};
    const toFetch: string[] = [];

    // Check L1 (memory) cache for each user
    for (const userId of userIds) {
      const cached = cacheRef.current.get(userId);
      if (cached && isMemoryCacheValid(cached)) {
        result[userId] = cached.profile;
      } else {
        toFetch.push(userId);
      }
    }

    console.log(`📦 Profile batch: ${Object.keys(result).length} from L1, ${toFetch.length} to fetch`);

    // Fetch missing profiles (will check L2/L3 automatically)
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
   * Manually cache a profile (useful when profile comes from other sources)
   */
  const cacheProfile = async (profile: PublicUserProfile): Promise<void> => {
    console.log(`🔄 cacheProfile called for: ${profile.displayName}, hasBlob=${!!profile.avatarBlob}`);
    
    // Store in L2 (SQLite) - this will download image if needed
    await syncProfileToSQLite(profile);
    
    // NOW reload from SQLite to get the version WITH blob
    const profileWithBlob = await getProfileFromSQLite(profile.id);
    
    if (profileWithBlob) {
      console.log(`✅ Reloaded profile from SQLite with blob: ${profileWithBlob.displayName}, hasBlob=${!!profileWithBlob.avatarBlob}, blobLength=${profileWithBlob.avatarBlob?.length || 0}`);
      
      // Update L1 (memory) with the version that includes the blob
      cacheRef.current.set(profile.id, {
        profile: profileWithBlob,
        timestamp: Date.now(),
      });
      
      console.log(`✅ L1 cache updated with blob for: ${profileWithBlob.displayName}`);
    } else {
      // Fallback: store the original profile without blob
      cacheRef.current.set(profile.id, {
        profile,
        timestamp: Date.now(),
      });
      console.log(`⚠️ Could not reload from SQLite, cached original profile: ${profile.displayName}`);
    }
    
    console.log(`✅ Manually cached profile complete: ${profile.displayName}`);
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
        cacheProfile,
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

