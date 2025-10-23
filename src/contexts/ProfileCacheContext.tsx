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
  invalidateProfile: (userId: string, deleteFile?: boolean) => Promise<void>;
  invalidateAll: (deleteFiles?: boolean) => Promise<void>;
  getCachedProfile: (userId: string) => PublicUserProfile | null;
}

const ProfileCacheContext = createContext<ProfileCacheContextValue | undefined>(undefined);

// Cache TTL: Memory (5 minutes), SQLite (24 hours)
const MEMORY_CACHE_TTL = 5 * 60 * 1000;
const SQLITE_CACHE_TTL = 24 * 60 * 60 * 1000;

/**
 * Download image from URL and save to local file system
 * @returns Local file path or null if download failed
 */
async function downloadImageToLocalStorage(url: string, userId: string): Promise<string | null> {
  try {
    // Create avatars directory if it doesn't exist
    const avatarsDir = FileSystem.documentDirectory + 'avatars/';
    const dirInfo = await FileSystem.getInfoAsync(avatarsDir);
    
    if (!dirInfo.exists) {
      await FileSystem.makeDirectoryAsync(avatarsDir, { intermediates: true });
    }
    
    // Generate filename from userId
    const fileName = `avatar_${userId}.jpg`;
    const localPath = avatarsDir + fileName;
    
    // Check if old avatar exists and delete it
    const existingFile = await FileSystem.getInfoAsync(localPath);
    if (existingFile.exists) {
      console.log(`🗑️ Deleting old avatar for user ${userId}`);
      await FileSystem.deleteAsync(localPath, { idempotent: true });
    }
    
    console.log(`📥 Downloading new avatar to: ${localPath}`);
    
    // Download to permanent location
    const response = await FileSystem.downloadAsync(url, localPath);
    
    if (response.status !== 200) {
      console.error(`❌ Failed to download image: HTTP ${response.status}`);
      return null;
    }
    
    // Verify file was saved
    const fileInfo = await FileSystem.getInfoAsync(localPath);
    if (!fileInfo.exists) {
      console.error(`❌ File was not saved: ${localPath}`);
      return null;
    }
    
    console.log(`✅ Avatar downloaded successfully: ${localPath} (${Math.round((fileInfo.size || 0) / 1024)}KB)`);
    return localPath;
  } catch (error: any) {
    console.error('❌ Failed to download image:', error);
    return null;
  }
}

/**
 * Sync profile to SQLite for offline access
 * Downloads and caches avatar image to local file system
 */
async function syncProfileToSQLite(profile: PublicUserProfile): Promise<void> {
  try {
    console.log(`💾 syncProfileToSQLite called for: ${profile.displayName}`);
    console.log(`💾 Profile has avatarUrl: ${!!profile.avatarUrl}`);
    
    const sqlite = getDatabase();
    const now = Date.now();
    
    // Download avatar image if URL exists
    let avatarLocalPath: string | null = null;
    if (profile.avatarUrl) {
      avatarLocalPath = await downloadImageToLocalStorage(profile.avatarUrl, profile.id);
    }
    
    const sql = `
      INSERT OR REPLACE INTO profiles (
        userId, username, displayName, avatarUrl, avatarLocalPath, bio, lastSeen,
        cachedAt, updatedAt
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;
    
    await executeStatement(sql, [
      profile.id,
      profile.username,
      profile.displayName,
      profile.avatarUrl || null,
      avatarLocalPath,
      profile.bio || null,
      profile.lastSeen || 0,
      now,
      now,
    ]);
    
    console.log(`✅ Profile cached: ${profile.displayName} (image: ${avatarLocalPath ? 'saved' : 'none'})`);

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
      SELECT userId, username, displayName, avatarUrl, avatarLocalPath, bio, lastSeen, cachedAt
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
      avatarLocalPath: row.avatarLocalPath || undefined,
      bio: row.bio || undefined,
      presence: 'offline', // Will be updated by presence listener
      lastSeen: row.lastSeen || 0,
    };
    
    // If profile has avatarUrl but no local image file, download in background
    if (profile.avatarUrl && !profile.avatarLocalPath) {
      console.log(`📥 Profile missing local image, downloading in background: ${profile.displayName}`);
      // Download asynchronously, don't block this function
      downloadImageToLocalStorage(profile.avatarUrl, userId).then(async (localPath) => {
        if (localPath) {
          profile.avatarLocalPath = localPath;
          // Update SQLite with the local path
          const sqlite = getDatabase();
          await executeStatement(
            'UPDATE profiles SET avatarLocalPath = ? WHERE userId = ?',
            [localPath, userId]
          );
          console.log(`✅ Updated profile with local image: ${profile.displayName}`);
        }
      }).catch(err => console.error('Failed to download missing image:', err));
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
      // Check if profile has avatarUrl but missing local file - if so, it's incomplete
      const hasUrl = !!memCached.profile.avatarUrl;
      const hasLocalFile = !!memCached.profile.avatarLocalPath;
      
      if (hasUrl && !hasLocalFile) {
        console.log(`⚠️ L1 cache has profile WITHOUT local image - reloading from SQLite: ${userId}`);
        // Fall through to check SQLite which should have the file
      } else {
        console.log(`📦 L1 cache HIT (memory): ${userId}, hasLocalFile=${hasLocalFile}`);
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
        console.log(`💾 L2 cache HIT (SQLite): ${userId}, hasLocalFile=${!!sqliteCached.avatarLocalPath}`);
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
    console.log(`🔄 cacheProfile called for: ${profile.displayName}, hasLocalFile=${!!profile.avatarLocalPath}`);
    
    // Store in L2 (SQLite) - this will download image if needed
    await syncProfileToSQLite(profile);
    
    // NOW reload from SQLite to get the version WITH local file path
    const profileWithFile = await getProfileFromSQLite(profile.id);
    
    if (profileWithFile) {
      console.log(`✅ Reloaded profile from SQLite: ${profileWithFile.displayName}, hasLocalFile=${!!profileWithFile.avatarLocalPath}`);
      
      // Update L1 (memory) with the version that includes the local file path
      cacheRef.current.set(profile.id, {
        profile: profileWithFile,
        timestamp: Date.now(),
      });
      
      console.log(`✅ L1 cache updated for: ${profileWithFile.displayName}`);
    } else {
      // Fallback: store the original profile
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
   * Optionally delete the avatar file from local storage
   */
  const invalidateProfile = async (userId: string, deleteFile: boolean = false) => {
    cacheRef.current.delete(userId);
    console.log(`🗑️ Profile cache invalidated: ${userId}`);
    
    if (deleteFile) {
      try {
        const avatarsDir = FileSystem.documentDirectory + 'avatars/';
        const fileName = `avatar_${userId}.jpg`;
        const localPath = avatarsDir + fileName;
        
        const fileInfo = await FileSystem.getInfoAsync(localPath);
        if (fileInfo.exists) {
          await FileSystem.deleteAsync(localPath);
          console.log(`🗑️ Deleted avatar file for: ${userId}`);
        }
      } catch (error) {
        console.error(`❌ Failed to delete avatar file for ${userId}:`, error);
      }
    }
  };

  /**
   * Clear entire cache
   * Optionally delete all avatar files from local storage
   */
  const invalidateAll = async (deleteFiles: boolean = false) => {
    cacheRef.current.clear();
    pendingRequestsRef.current.clear();
    console.log('🗑️ Profile cache cleared');
    
    if (deleteFiles) {
      try {
        const avatarsDir = FileSystem.documentDirectory + 'avatars/';
        const dirInfo = await FileSystem.getInfoAsync(avatarsDir);
        
        if (dirInfo.exists) {
          await FileSystem.deleteAsync(avatarsDir, { idempotent: true });
          console.log('🗑️ Deleted all avatar files');
          
          // Recreate the directory
          await FileSystem.makeDirectoryAsync(avatarsDir, { intermediates: true });
        }
      } catch (error) {
        console.error('❌ Failed to delete avatar files:', error);
      }
    }
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

