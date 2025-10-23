/**
 * Message Service
 * Handles message operations with optimistic UI and offline support
 * 
 * Features:
 * - Optimistic UI: messages appear immediately
 * - Offline queue: messages are queued when offline
 * - Retry mechanism: failed messages can be retried
 * - SQLite + Firestore sync
 * - Media caching: automatically cache attachments
 */

import { db } from '@/config/firebase';
import { executeStatement, getDatabase } from '@/database/database';
import type { CreateMessageData, Message, MessageStatus } from '@/types/chat.types';
import NetInfo from '@react-native-community/netinfo';
import {
  doc,
  serverTimestamp,
  setDoc,
  updateDoc
} from 'firebase/firestore';

import { cacheMedia, getCachedMediaPath } from './media-cache.service';

const CHATS_COLLECTION = 'chats';
const MESSAGES_COLLECTION = 'messages';

// Retry configuration
const MAX_RETRY_ATTEMPTS = 5;
const BASE_RETRY_DELAY = 1000; // 1 second
const MAX_RETRY_DELAY = 60000; // 60 seconds (1 minute)

/**
 * Calculate exponential backoff delay
 * Formula: min(BASE_DELAY * 2^retryCount, MAX_DELAY)
 * Example: 1s, 2s, 4s, 8s, 16s, 32s, 60s (capped)
 */
function calculateBackoffDelay(retryCount: number): number {
  const delay = BASE_RETRY_DELAY * Math.pow(2, retryCount);
  return Math.min(delay, MAX_RETRY_DELAY);
}

/**
 * Check if a message should be retried based on last retry time
 */
function shouldRetryMessage(retryCount: number, lastRetryAt: number | null): boolean {
  // If never retried, allow retry
  if (!lastRetryAt) return true;
  
  // If max retries reached, don't retry
  if (retryCount >= MAX_RETRY_ATTEMPTS) {
    console.log(`⚠️ Max retry attempts (${MAX_RETRY_ATTEMPTS}) reached`);
    return false;
  }
  
  // Calculate required delay based on retry count
  const requiredDelay = calculateBackoffDelay(retryCount);
  const timeSinceLastRetry = Date.now() - lastRetryAt;
  
  // Only retry if enough time has passed
  return timeSinceLastRetry >= requiredDelay;
}

/**
 * Generate a unique local message ID
 * Uses timestamp + random string for uniqueness
 */
function generateLocalMessageId(): string {
  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(2, 15);
  return `local_${timestamp}_${random}`;
}

/**
 * Insert a message into SQLite
 */
async function insertMessageToSQLite(
  message: Message,
  localId: string,
  queuedAt: number | null = null
): Promise<void> {
  const sqlite = getDatabase();
  
  const sql = `
    INSERT INTO messages (
      id, chatId, senderId, text, mediaUrl, mediaMime, replyToId,
      status, createdAt, edited, localId, queuedAt, retryCount,
      lastRetryAt, syncedToFirestore
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `;
  
  await executeStatement(sql, [
    message.id,
    message.chatId,
    message.senderId,
    message.text || null,
    message.mediaUrl || null,
    message.mediaMime || null,
    message.replyToId || null,
    message.status,
    message.createdAt,
    message.edited ? 1 : 0,
    localId,
    queuedAt,
    0, // retryCount
    null, // lastRetryAt
    0, // syncedToFirestore
  ]);
}

/**
 * Update message status in SQLite
 */
async function updateMessageStatusInSQLite(
  messageId: string,
  status: MessageStatus,
  syncedToFirestore: boolean = false
): Promise<void> {
  const sql = `
    UPDATE messages 
    SET status = ?, syncedToFirestore = ?
    ${syncedToFirestore ? ', queuedAt = NULL' : ''}
    WHERE id = ?
  `;
  
  await executeStatement(sql, [
    status,
    syncedToFirestore ? 1 : 0,
    messageId,
  ]);
}

/**
 * Update message retry information in SQLite
 */
async function updateMessageRetryInfo(
  messageId: string,
  retryCount: number
): Promise<void> {
  const sql = `
    UPDATE messages 
    SET retryCount = ?, lastRetryAt = ?, status = ?
    WHERE id = ?
  `;
  
  await executeStatement(sql, [
    retryCount,
    Date.now(),
    'failed',
    messageId,
  ]);
}

/**
 * Send message to Firestore
 */
async function sendMessageToFirestore(
  message: Message
): Promise<void> {
  const messageRef = doc(
    db,
    CHATS_COLLECTION,
    message.chatId,
    MESSAGES_COLLECTION,
    message.id
  );
  
  // Build message document
  const messageDoc: any = {
    chatId: message.chatId,
    senderId: message.senderId,
    status: 'sent',
    edited: false,
    createdAt: serverTimestamp(),
  };
  
  // Only add fields that have values
  if (message.text) messageDoc.text = message.text;
  if (message.mediaUrl) messageDoc.mediaUrl = message.mediaUrl;
  if (message.mediaMime) messageDoc.mediaMime = message.mediaMime;
  if (message.replyToId) messageDoc.replyToId = message.replyToId;
  
  await setDoc(messageRef, messageDoc);
}

/**
 * Update chat's last message information in Firestore
 */
async function updateChatLastMessage(
  chatId: string,
  messageId: string,
  messageText: string,
  senderId: string
): Promise<void> {
  const chatRef = doc(db, CHATS_COLLECTION, chatId);
  
  await updateDoc(chatRef, {
    lastMessageId: messageId,
    lastMessageText: messageText || '[Media]',
    lastMessageSenderId: senderId,
    lastMessageAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
}

/**
 * Update message status in Firestore
 * Used for delivery and read receipts
 */
export async function updateMessageStatusInFirestore(
  chatId: string,
  messageId: string,
  status: MessageStatus
): Promise<void> {
  try {
    const messageRef = doc(
      db,
      CHATS_COLLECTION,
      chatId,
      MESSAGES_COLLECTION,
      messageId
    );
    
    await updateDoc(messageRef, {
      status,
      updatedAt: serverTimestamp(),
    });
    
    // Only log errors, not successful status updates (too verbose)
  } catch (error) {
    console.error(`❌ Failed to update message status in Firestore:`, error);
    // Don't throw - delivery status is not critical for app functionality
  }
}

/**
 * Mark a message as delivered
 * Called when the recipient receives the message
 */
export async function markMessageAsDelivered(
  chatId: string,
  messageId: string,
  currentUserId: string,
  senderId: string
): Promise<void> {
  // Only mark as delivered if the current user is NOT the sender
  if (currentUserId === senderId) {
    return;
  }
  
  try {
    // Update in Firestore
    await updateMessageStatusInFirestore(chatId, messageId, 'delivered');
    
    // Update in SQLite
    await updateMessageStatusInSQLite(messageId, 'delivered', true);
    
    // Silent success - delivery status updates are frequent and not critical to log
  } catch (error) {
    console.error(`❌ Failed to mark message as delivered:`, error);
  }
}

/**
 * Send a message with optimistic UI
 * 
 * Flow:
 * 1. Generate local ID
 * 2. Create message object with "sending" status
 * 3. Insert into SQLite immediately
 * 4. Return message (for optimistic UI)
 * 5. Try to send to Firestore in background
 * 6. Update status to "sent" or "failed"
 * 7. Update chat's last message
 */
export async function sendMessageOptimistic(
  messageData: CreateMessageData,
  onStatusChange?: (messageId: string, status: MessageStatus) => void
): Promise<Message> {
  const localId = generateLocalMessageId();
  const now = Date.now();
  
  // Create message object with generated ID
  const message: Message = {
    id: localId, // Will be the same in Firestore (we control the ID)
    chatId: messageData.chatId,
    senderId: messageData.senderId,
    text: messageData.text,
    mediaUrl: messageData.mediaUrl,
    mediaMime: messageData.mediaMime,
    replyToId: messageData.replyToId,
    status: 'sending',
    edited: false,
    createdAt: now,
  };
  
  console.log('📤 Sending message (optimistic):', {
    id: message.id,
    chatId: message.chatId,
    text: message.text?.substring(0, 50),
  });
  
  try {
    // 1. Insert into SQLite immediately (with queuedAt timestamp)
    await insertMessageToSQLite(message, localId, now);
    console.log('✅ Message inserted into SQLite');
    
    // 2. Return message immediately for optimistic UI
    // This allows the UI to display the message right away
    
    // 3. Try to send to Firestore in background
    (async () => {
      try {
        // Check network state
        const netState = await NetInfo.fetch();
        if (!netState.isConnected || !netState.isInternetReachable) {
          console.log('📴 Offline - message queued');
          // Keep message in "sending" state - will retry when online
          return;
        }
        
        // Add timeout to Firestore write (10 seconds)
        const firestoreWritePromise = Promise.all([
          sendMessageToFirestore(message),
          updateChatLastMessage(message.chatId, message.id, message.text || '', message.senderId)
        ]);
        
        const timeoutPromise = new Promise((_, reject) =>
          setTimeout(() => reject(new Error('Firestore write timeout')), 10000)
        );
        
        // Race between write and timeout
        await Promise.race([firestoreWritePromise, timeoutPromise]);
        
        console.log('✅ Message sent to Firestore');
        console.log('✅ Chat last message updated');
        
        // Update status in SQLite to "sent"
        await updateMessageStatusInSQLite(message.id, 'sent', true);
        console.log('✅ Message status updated to "sent"');
        
        // Notify status change
        if (onStatusChange) {
          onStatusChange(message.id, 'sent');
        }
      } catch (error) {
        console.error('❌ Failed to send message to Firestore:', error);
        
        // Update status to "failed" and increment retry count
        await updateMessageRetryInfo(message.id, 1);
        console.log('❌ Message marked as failed');
        
        // Notify status change
        if (onStatusChange) {
          onStatusChange(message.id, 'failed');
        }
      }
    })();
    
    return message;
  } catch (error) {
    console.error('❌ Failed to insert message into SQLite:', error);
    
    // If we can't even insert into SQLite, throw error
    // This means something is seriously wrong
    throw new Error('Failed to queue message');
  }
}

/**
 * Get messages from SQLite for a chat
 * @param chatId - Chat ID
 * @param limit - Number of messages to fetch
 * @returns Array of messages
 */
export async function getMessagesFromSQLite(
  chatId: string,
  limit: number = 50
): Promise<Message[]> {
  try {
    const sqlite = getDatabase();
    
    const sql = `
      SELECT 
        id, chatId, senderId, text, mediaUrl, mediaMime, localMediaPath,
        replyToId, status, createdAt, edited, editedAt
      FROM messages
      WHERE chatId = ?
      ORDER BY createdAt DESC
      LIMIT ?
    `;
    
    const result = await sqlite.getAllAsync<any>(sql, [chatId, limit]);
    
    // Convert SQLite rows to Message objects
    const messages: Message[] = result.map((row) => ({
      id: row.id,
      chatId: row.chatId,
      senderId: row.senderId,
      text: row.text || undefined,
      mediaUrl: row.mediaUrl || undefined,
      mediaMime: row.mediaMime || undefined,
      localMediaPath: row.localMediaPath || undefined,
      replyToId: row.replyToId || undefined,
      status: row.status as MessageStatus,
      edited: row.edited === 1,
      editedAt: row.editedAt || undefined,
      createdAt: row.createdAt,
    }));
    
    // Return in ascending order (oldest first)
    return messages.reverse();
  } catch (error) {
    console.error('❌ Failed to get messages from SQLite:', error);
    return [];
  }
}

/**
 * Sync a received message from Firestore to SQLite
 * Used when receiving messages via real-time listener
 * Also caches media attachments if present
 */
export async function syncMessageToSQLite(message: Message): Promise<void> {
  try {
    const sqlite = getDatabase();
    
    // Check if message already exists
    const existingSql = 'SELECT id, status, localMediaPath FROM messages WHERE id = ?';
    const existing = await sqlite.getFirstAsync<{ id: string; status: string; localMediaPath: string | null }>(
      existingSql,
      [message.id]
    );
    
    // If message has media, try to get or cache it
    let localMediaPath: string | null = null;
    if (message.mediaUrl) {
      // Check if already cached
      if (existing?.localMediaPath) {
        localMediaPath = existing.localMediaPath;
      } else {
        // Try to get from cache
        localMediaPath = await getCachedMediaPath(message.mediaUrl, message.mediaMime);
        
        // If not cached, cache it in background
        if (!localMediaPath) {
          cacheMedia(message.mediaUrl, message.mediaMime).then((path) => {
            if (path) {
              // Update message with local path after caching completes
              executeStatement(
                'UPDATE messages SET localMediaPath = ? WHERE id = ?',
                [path, message.id]
              ).catch((error) => {
                console.error('❌ Failed to update localMediaPath:', error);
              });
            }
          }).catch((error) => {
            console.error('❌ Failed to cache media in background:', error);
          });
        }
      }
    }
    
    if (existing) {
      // Update existing message (only if status changed or other fields differ)
      const updateSql = `
        UPDATE messages 
        SET text = ?, mediaUrl = ?, mediaMime = ?, localMediaPath = ?, status = ?,
            edited = ?, editedAt = ?, syncedToFirestore = 1
        WHERE id = ?
      `;
      
      await executeStatement(updateSql, [
        message.text || null,
        message.mediaUrl || null,
        message.mediaMime || null,
        localMediaPath,
        message.status,
        message.edited ? 1 : 0,
        message.editedAt || null,
        message.id,
      ]);
      
      // Only log if status changed (meaningful update)
      if (existing.status !== message.status) {
        console.log(`📝 Message ${message.id} status: ${existing.status} → ${message.status}`);
      }
    } else {
      // Insert new message
      const insertSql = `
        INSERT INTO messages (
          id, chatId, senderId, text, mediaUrl, mediaMime, localMediaPath, replyToId,
          status, createdAt, edited, editedAt, syncedToFirestore
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)
      `;
      
      await executeStatement(insertSql, [
        message.id,
        message.chatId,
        message.senderId,
        message.text || null,
        message.mediaUrl || null,
        message.mediaMime || null,
        localMediaPath,
        message.replyToId || null,
        message.status,
        message.createdAt,
        message.edited ? 1 : 0,
        message.editedAt || null,
      ]);
      
      // Only log new message inserts, not updates
      console.log('✅ New message synced to SQLite:', message.id);
    }
  } catch (error) {
    // If we get a UNIQUE constraint error, it means a race condition occurred
    // Try to update the existing message instead
    if (error instanceof Error && error.message.includes('UNIQUE constraint failed')) {
      try {
        const sqlite = getDatabase();
        const updateSql = `
          UPDATE messages 
          SET text = ?, mediaUrl = ?, mediaMime = ?, status = ?,
              edited = ?, editedAt = ?, syncedToFirestore = 1
          WHERE id = ?
        `;
        
        await executeStatement(updateSql, [
          message.text || null,
          message.mediaUrl || null,
          message.mediaMime || null,
          message.status,
          message.edited ? 1 : 0,
          message.editedAt || null,
          message.id,
        ]);
        
        console.log(`🔄 Recovered from race condition - updated message ${message.id}`);
      } catch (updateError) {
        console.error('❌ Failed to recover from UNIQUE constraint error:', updateError);
      }
    } else {
      console.error('❌ Failed to sync message to SQLite:', error);
    }
  }
}

/**
 * Retry sending a failed or queued message
 */
export async function retryFailedMessage(
  messageId: string,
  onStatusChange?: (messageId: string, status: MessageStatus) => void
): Promise<void> {
  try {
    const sqlite = getDatabase();
    
    // Get message from SQLite (including sending/failed states)
    const sql = `
      SELECT 
        id, chatId, senderId, text, mediaUrl, mediaMime, replyToId,
        retryCount, lastRetryAt
      FROM messages
      WHERE id = ? AND (status = 'failed' OR status = 'sending')
    `;
    
    const row = await sqlite.getFirstAsync<any>(sql, [messageId]);
    
    if (!row) {
      console.warn('Message not found or not in failed/sending state:', messageId);
      return;
    }
    
    // Check if we should retry based on exponential backoff
    const retryCount = row.retryCount || 0;
    const lastRetryAt = row.lastRetryAt || null;
    
    if (!shouldRetryMessage(retryCount, lastRetryAt)) {
      const nextRetryDelay = calculateBackoffDelay(retryCount);
      const timeSinceLastRetry = lastRetryAt ? Date.now() - lastRetryAt : 0;
      const remainingTime = Math.ceil((nextRetryDelay - timeSinceLastRetry) / 1000);
      
      console.log(`⏳ Message ${messageId} - retry ${retryCount + 1}/${MAX_RETRY_ATTEMPTS} in ${remainingTime}s`);
      return;
    }
    
    const message: Message = {
      id: row.id,
      chatId: row.chatId,
      senderId: row.senderId,
      text: row.text || undefined,
      mediaUrl: row.mediaUrl || undefined,
      mediaMime: row.mediaMime || undefined,
      replyToId: row.replyToId || undefined,
      status: 'sending',
      edited: false,
      createdAt: Date.now(), // Use original timestamp ideally
    };
    
    console.log(`🔄 Retrying message ${messageId} (attempt ${retryCount + 1}/${MAX_RETRY_ATTEMPTS})`);
    
    // Update status to "sending"
    await updateMessageStatusInSQLite(messageId, 'sending', false);
    if (onStatusChange) onStatusChange(messageId, 'sending');
    
    try {
      // Try to send to Firestore
      await sendMessageToFirestore(message);
      
      // Update chat's last message
      await updateChatLastMessage(
        message.chatId,
        message.id,
        message.text || '',
        message.senderId
      );
      
      // Update status to "sent"
      await updateMessageStatusInSQLite(messageId, 'sent', true);
      console.log('✅ Message retry successful');
      
      if (onStatusChange) onStatusChange(messageId, 'sent');
    } catch (error) {
      console.error('❌ Message retry failed:', error);
      
      // Increment retry count
      const newRetryCount = retryCount + 1;
      await updateMessageRetryInfo(messageId, newRetryCount);
      
      // Log backoff information
      if (newRetryCount < MAX_RETRY_ATTEMPTS) {
        const nextRetryDelay = calculateBackoffDelay(newRetryCount);
        console.log(`⏳ Will retry again in ${nextRetryDelay / 1000}s (attempt ${newRetryCount + 1}/${MAX_RETRY_ATTEMPTS})`);
      } else {
        console.log(`❌ Max retry attempts reached (${MAX_RETRY_ATTEMPTS}). Message will not be retried.`);
      }
      
      if (onStatusChange) onStatusChange(messageId, 'failed');
    }
  } catch (error) {
    console.error('❌ Failed to retry message:', error);
    throw error;
  }
}

/**
 * Get all failed messages for retry
 */
export async function getFailedMessages(): Promise<Message[]> {
  try {
    const sqlite = getDatabase();
    
    const sql = `
      SELECT 
        id, chatId, senderId, text, mediaUrl, mediaMime, replyToId,
        status, createdAt, edited, retryCount
      FROM messages
      WHERE status = 'failed'
      ORDER BY createdAt ASC
    `;
    
    const result = await sqlite.getAllAsync<any>(sql);
    
    const messages: Message[] = result.map((row) => ({
      id: row.id,
      chatId: row.chatId,
      senderId: row.senderId,
      text: row.text || undefined,
      mediaUrl: row.mediaUrl || undefined,
      mediaMime: row.mediaMime || undefined,
      replyToId: row.replyToId || undefined,
      status: row.status as MessageStatus,
      edited: row.edited === 1,
      createdAt: row.createdAt,
    }));
    
    return messages;
  } catch (error) {
    console.error('❌ Failed to get failed messages:', error);
    return [];
  }
}

/**
 * Get queued messages (messages waiting to be sent)
 */
export async function getQueuedMessages(): Promise<Message[]> {
  try {
    const sqlite = getDatabase();
    
    const sql = `
      SELECT 
        id, chatId, senderId, text, mediaUrl, mediaMime, replyToId,
        status, createdAt, edited, queuedAt, retryCount
      FROM messages
      WHERE queuedAt IS NOT NULL AND syncedToFirestore = 0
      ORDER BY queuedAt ASC
    `;
    
    const result = await sqlite.getAllAsync<any>(sql);
    
    const messages: Message[] = result.map((row) => ({
      id: row.id,
      chatId: row.chatId,
      senderId: row.senderId,
      text: row.text || undefined,
      mediaUrl: row.mediaUrl || undefined,
      mediaMime: row.mediaMime || undefined,
      replyToId: row.replyToId || undefined,
      status: row.status as MessageStatus,
      edited: row.edited === 1,
      createdAt: row.createdAt,
    }));
    
    return messages;
  } catch (error) {
    console.error('❌ Failed to get queued messages:', error);
    return [];
  }
}

