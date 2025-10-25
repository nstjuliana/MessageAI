/**
 * Chat Sync Context
 * Manages background synchronization of chats and messages
 * Provides sync status and control to the app
 */

import React, { createContext, useContext, useEffect, useState } from 'react';

import {
    getSyncStats,
    isBackgroundSyncRunning,
    preloadRecentChats,
    startBackgroundSync,
    stopBackgroundSync
} from '@/services/chat-sync.service';
import { getCacheStats } from '@/services/media-cache.service';
import { useAuth } from './AuthContext';
import { useNetwork } from './NetworkContext';

interface SyncStats {
  totalChats: number;
  syncedChats: number;
  pendingChats: number;
  failedChats: number;
}

interface CacheStats {
  size: number;
  sizeInMB: string;
  fileCount: number;
  maxSize: number;
  maxSizeInMB: string;
}

interface ChatSyncContextValue {
  // Sync status
  isSyncing: boolean;
  isPreloading: boolean;
  syncProgress: number; // 0-100
  
  // Stats
  syncStats: SyncStats | null;
  cacheStats: CacheStats | null;
  
  // Actions
  startSync: () => Promise<void>;
  stopSync: () => void;
  refreshStats: () => Promise<void>;
}

const ChatSyncContext = createContext<ChatSyncContextValue | undefined>(undefined);

export function ChatSyncProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const { isConnected } = useNetwork();
  
  const [isSyncing, setIsSyncing] = useState(false);
  const [isPreloading, setIsPreloading] = useState(false);
  const [syncProgress, setSyncProgress] = useState(0);
  const [syncStats, setSyncStats] = useState<SyncStats | null>(null);
  const [cacheStats, setCacheStats] = useState<CacheStats | null>(null);
  const [hasPreloaded, setHasPreloaded] = useState(false);

  /**
   * Refresh sync and cache statistics
   */
  const refreshStats = async () => {
    try {
      const [newSyncStats, newCacheStats] = await Promise.all([
        getSyncStats(),
        getCacheStats(),
      ]);
      
      setSyncStats(newSyncStats);
      setCacheStats(newCacheStats);
      
      // Calculate sync progress
      if (newSyncStats.totalChats > 0) {
        const progress = (newSyncStats.syncedChats / newSyncStats.totalChats) * 100;
        setSyncProgress(Math.round(progress));
      } else {
        setSyncProgress(100);
      }
    } catch (error) {
      console.error('❌ Failed to refresh sync stats:', error);
    }
  };

  /**
   * Start background sync
   */
  const startSync = async () => {
    if (!user || !isConnected) {
      console.log('⚠️ Cannot start sync: user not logged in or offline');
      return;
    }
    
    if (isBackgroundSyncRunning()) {
      console.log('⚠️ Sync already running');
      return;
    }
    
    setIsSyncing(true);
    
    try {
      // Start background sync (non-blocking)
      startBackgroundSync().then(() => {
        setIsSyncing(false);
        refreshStats();
      });
      
      // Refresh stats periodically while syncing
      const intervalId = setInterval(() => {
        if (isBackgroundSyncRunning()) {
          refreshStats();
        } else {
          clearInterval(intervalId);
        }
      }, 3000); // Every 3 seconds
    } catch (error) {
      console.error('❌ Failed to start sync:', error);
      setIsSyncing(false);
    }
  };

  /**
   * Stop background sync
   */
  const stopSync = () => {
    stopBackgroundSync();
    setIsSyncing(false);
  };

  /**
   * Preload recent chats on login
   */
  useEffect(() => {
    if (!user || !isConnected || hasPreloaded) return;
    
    const performPreload = async () => {
      setIsPreloading(true);
      
      try {
        console.log('🚀 Starting preload of recent chats...');
        await preloadRecentChats(user.uid);
        setHasPreloaded(true);
        
        // Refresh stats after preload
        await refreshStats();
        
        console.log('✅ Preload complete!');
        
        // Start background sync for remaining chats after a short delay
        setTimeout(() => {
          startSync();
        }, 2000); // 2 second delay
      } catch (error) {
        console.error('❌ Failed to preload chats:', error);
      } finally {
        setIsPreloading(false);
      }
    };
    
    performPreload();
  }, [user, isConnected, hasPreloaded]);

  /**
   * Refresh stats periodically
   */
  useEffect(() => {
    if (!user) return;
    
    // Initial stats load
    refreshStats();
    
    // Refresh stats every 30 seconds
    const intervalId = setInterval(refreshStats, 30000);
    
    return () => clearInterval(intervalId);
  }, [user]);

  /**
   * Stop sync when going offline
   */
  useEffect(() => {
    if (!isConnected && isSyncing) {
      console.log('📴 Going offline, stopping sync...');
      stopSync();
    }
  }, [isConnected, isSyncing]);

  /**
   * Reset preload flag when user changes
   */
  useEffect(() => {
    setHasPreloaded(false);
  }, [user?.uid]);

  const value: ChatSyncContextValue = {
    isSyncing,
    isPreloading,
    syncProgress,
    syncStats,
    cacheStats,
    startSync,
    stopSync,
    refreshStats,
  };

  return (
    <ChatSyncContext.Provider value={value}>
      {children}
    </ChatSyncContext.Provider>
  );
}

export function useChatSync() {
  const context = useContext(ChatSyncContext);
  if (context === undefined) {
    throw new Error('useChatSync must be used within a ChatSyncProvider');
  }
  return context;
}

