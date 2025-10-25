/**
 * Chat Sync Service
 * Manages background synchronization of chats and messages
 * 
 * Strategy:
 * 1. On login: Preload top 20 most recent chats
 * 2. Background: Gradually sync remaining chats one at a time
 * 3. Cache all messages and media attachments to SQLite/filesystem
 */

import { db } from '@/config/firebase';
import { executeStatement, getDatabase } from '@/database/database';
import type { Message } from '@/types/chat.types';
import {
    collection,
    getDocs,
    limit,
    orderBy,
    query,
    where
} from 'firebase/firestore';

import { syncMessageToSQLite } from './message.service';

const CHATS_COLLECTION = 'chats';
const MESSAGES_COLLECTION = 'messages';

// Number of chats to preload on login
const PRELOAD_CHAT_COUNT = 20;

// Delay between background sync operations (ms)
const BACKGROUND_SYNC_DELAY = 2000; // 2 seconds

// Maximum messages to sync per chat
const MAX_MESSAGES_PER_CHAT = 100;

// Background sync state
let isSyncing = false;
let syncAbortController: AbortController | null = null;

/**
 * Update chat sync status in SQLite
 */
async function updateChatSyncStatus(
  chatId: string,
  status: 'pending' | 'syncing' | 'synced' | 'failed',
  messageCount?: number
): Promise<void> {
  try {
    const sqlite = getDatabase();
    
    const sql = `
      UPDATE chats 
      SET syncStatus = ?, lastSyncedAt = ?, messageCount = COALESCE(?, messageCount)
      WHERE id = ?
    `;
    
    await executeStatement(sql, [
      status,
      Date.now(),
      messageCount ?? null,
      chatId,
    ]);
  } catch (error) {
    console.error('❌ Failed to update chat sync status:', error);
  }
}

/**
 * Sync messages for a specific chat from Firestore to SQLite
 */
async function syncChatMessages(chatId: string): Promise<number> {
  try {
    console.log(`📥 Syncing messages for chat: ${chatId}`);
    
    // Fetch messages from Firestore
    const messagesRef = collection(db, CHATS_COLLECTION, chatId, MESSAGES_COLLECTION);
    const messagesQuery = query(
      messagesRef,
      orderBy('createdAt', 'desc'),
      limit(MAX_MESSAGES_PER_CHAT)
    );
    
    const snapshot = await getDocs(messagesQuery);
    const messages: Message[] = [];
    
    for (const doc of snapshot.docs) {
      const data = doc.data();
      const message: Message = {
        id: doc.id,
        chatId,
        senderId: data.senderId,
        text: data.text || undefined,
        mediaUrl: data.mediaUrl || undefined,
        mediaMime: data.mediaMime || undefined,
        replyToId: data.replyToId || undefined,
        status: data.status || 'sent',
        edited: data.edited || false,
        editedAt: data.editedAt?.toMillis?.() || data.editedAt,
        createdAt: data.createdAt?.toMillis?.() || data.createdAt || Date.now(),
      };
      
      messages.push(message);
    }
    
    console.log(`📝 Fetched ${messages.length} messages from Firestore`);
    
    // Store messages in SQLite using the centralized sync function
    // This handles UPSERT logic and media caching automatically
    for (const message of messages) {
      await syncMessageToSQLite(message);
    }
    
    console.log(`✅ Synced ${messages.length} messages to SQLite`);
    
    return messages.length;
  } catch (error) {
    console.error(`❌ Failed to sync messages for chat ${chatId}:`, error);
    throw error;
  }
}

/**
 * Get chats that need syncing from SQLite
 */
async function getChatsNeedingSync(): Promise<string[]> {
  try {
    const sqlite = getDatabase();
    
    const sql = `
      SELECT id 
      FROM chats 
      WHERE syncStatus IN ('pending', 'failed')
      ORDER BY lastMessageAt DESC
    `;
    
    const result = await sqlite.getAllAsync<{ id: string }>(sql);
    
    return result.map((row) => row.id);
  } catch (error) {
    console.error('❌ Failed to get chats needing sync:', error);
    return [];
  }
}

/**
 * Preload top N most recent chats
 * Called on app startup/login
 */
export async function preloadRecentChats(userId: string): Promise<void> {
  try {
    console.log(`🚀 Preloading top ${PRELOAD_CHAT_COUNT} recent chats...`);
    
    // Get top N chats from Firestore
    const chatsRef = collection(db, CHATS_COLLECTION);
    const chatsQuery = query(
      chatsRef,
      where('participantIds', 'array-contains', userId),
      orderBy('lastMessageAt', 'desc'),
      limit(PRELOAD_CHAT_COUNT)
    );
    
    const snapshot = await getDocs(chatsQuery);
    console.log(`📥 Found ${snapshot.size} chats to preload`);
    
    // Sync each chat's messages
    for (const docSnap of snapshot.docs) {
      const chatId = docSnap.id;
      
      try {
        // Mark as syncing
        await updateChatSyncStatus(chatId, 'syncing');
        
        // Sync messages
        const messageCount = await syncChatMessages(chatId);
        
        // Mark as synced
        await updateChatSyncStatus(chatId, 'synced', messageCount);
        
        console.log(`✅ Preloaded chat: ${chatId} (${messageCount} messages)`);
      } catch (error) {
        console.error(`❌ Failed to preload chat ${chatId}:`, error);
        await updateChatSyncStatus(chatId, 'failed');
      }
    }
    
    console.log('✅ Preload complete!');
  } catch (error) {
    console.error('❌ Failed to preload recent chats:', error);
    throw error;
  }
}

/**
 * Start background sync for remaining chats
 * Syncs one chat at a time with delays
 */
export async function startBackgroundSync(): Promise<void> {
  if (isSyncing) {
    console.log('⚠️ Background sync already running');
    return;
  }
  
  isSyncing = true;
  syncAbortController = new AbortController();
  
  console.log('🔄 Starting background chat sync...');
  
  try {
    // Get chats that need syncing
    const chatIds = await getChatsNeedingSync();
    
    console.log(`📋 ${chatIds.length} chats need syncing`);
    
    if (chatIds.length === 0) {
      console.log('✅ All chats already synced!');
      isSyncing = false;
      return;
    }
    
    // Sync each chat with delays
    for (let i = 0; i < chatIds.length; i++) {
      // Check if sync was aborted
      if (syncAbortController?.signal.aborted) {
        console.log('⏹️ Background sync aborted');
        break;
      }
      
      const chatId = chatIds[i];
      
      try {
        console.log(`🔄 Background syncing chat ${i + 1}/${chatIds.length}: ${chatId}`);
        
        // Mark as syncing
        await updateChatSyncStatus(chatId, 'syncing');
        
        // Sync messages
        const messageCount = await syncChatMessages(chatId);
        
        // Mark as synced
        await updateChatSyncStatus(chatId, 'synced', messageCount);
        
        console.log(`✅ Background synced: ${chatId} (${messageCount} messages)`);
        
        // Delay before next chat
        if (i < chatIds.length - 1) {
          await new Promise((resolve) => setTimeout(resolve, BACKGROUND_SYNC_DELAY));
        }
      } catch (error) {
        console.error(`❌ Failed to sync chat ${chatId}:`, error);
        await updateChatSyncStatus(chatId, 'failed');
      }
    }
    
    console.log('✅ Background sync complete!');
  } catch (error) {
    console.error('❌ Background sync failed:', error);
  } finally {
    isSyncing = false;
    syncAbortController = null;
  }
}

/**
 * Stop background sync
 */
export function stopBackgroundSync(): void {
  if (syncAbortController) {
    syncAbortController.abort();
    console.log('⏹️ Stopping background sync...');
  }
}

/**
 * Check if background sync is running
 */
export function isBackgroundSyncRunning(): boolean {
  return isSyncing;
}

/**
 * Get sync statistics
 */
export async function getSyncStats(): Promise<{
  totalChats: number;
  syncedChats: number;
  pendingChats: number;
  failedChats: number;
}> {
  try {
    const sqlite = getDatabase();
    
    const totalResult = await sqlite.getFirstAsync<{ count: number }>(
      'SELECT COUNT(*) as count FROM chats'
    );
    
    const syncedResult = await sqlite.getFirstAsync<{ count: number }>(
      "SELECT COUNT(*) as count FROM chats WHERE syncStatus = 'synced'"
    );
    
    const pendingResult = await sqlite.getFirstAsync<{ count: number }>(
      "SELECT COUNT(*) as count FROM chats WHERE syncStatus = 'pending'"
    );
    
    const failedResult = await sqlite.getFirstAsync<{ count: number }>(
      "SELECT COUNT(*) as count FROM chats WHERE syncStatus = 'failed'"
    );
    
    return {
      totalChats: totalResult?.count || 0,
      syncedChats: syncedResult?.count || 0,
      pendingChats: pendingResult?.count || 0,
      failedChats: failedResult?.count || 0,
    };
  } catch (error) {
    console.error('❌ Failed to get sync stats:', error);
    return {
      totalChats: 0,
      syncedChats: 0,
      pendingChats: 0,
      failedChats: 0,
    };
  }
}

/**
 * Force re-sync a specific chat
 */
export async function forceSyncChat(chatId: string): Promise<void> {
  try {
    console.log(`🔄 Force syncing chat: ${chatId}`);
    
    await updateChatSyncStatus(chatId, 'syncing');
    const messageCount = await syncChatMessages(chatId);
    await updateChatSyncStatus(chatId, 'synced', messageCount);
    
    console.log(`✅ Chat force synced: ${chatId}`);
  } catch (error) {
    console.error(`❌ Failed to force sync chat ${chatId}:`, error);
    await updateChatSyncStatus(chatId, 'failed');
    throw error;
  }
}

