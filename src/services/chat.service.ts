/**
 * Chat Service
 * Handles all Firestore operations for chats and messages
 */

import { db } from '@/config/firebase';
import { executeStatement, getDatabase } from '@/database/database';
import type { Chat, CreateChatData, CreateMessageData, Message } from '@/types/chat.types';
import {
    collection,
    doc,
    getDoc,
    getDocs,
    onSnapshot,
    orderBy,
    query,
    serverTimestamp,
    setDoc,
    updateDoc,
    where,
    type Unsubscribe,
} from 'firebase/firestore';

const CHATS_COLLECTION = 'chats';
const MESSAGES_COLLECTION = 'messages';

// MessageAI system user ID (consistent across all users)
export const MESSAGE_AI_USER_ID = 'messageai-system';

/**
 * Sync chat to SQLite for offline access
 * Preserves existing sync status if already set
 */
async function syncChatToSQLite(chat: Chat): Promise<void> {
  try {
    const sqlite = getDatabase();
    
    // Check if chat exists to preserve sync status
    const existingChat = await sqlite.getFirstAsync<{ syncStatus: string }>(
      'SELECT syncStatus FROM chats WHERE id = ?',
      [chat.id]
    );
    
    const sql = `
      INSERT OR REPLACE INTO chats (
        id, type, lastMessageId, lastMessageText, lastMessageSenderId,
        lastMessageAt, createdAt, updatedAt, participantIds, adminIds,
        groupName, groupAvatarUrl, syncStatus
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;
    
    await executeStatement(sql, [
      chat.id,
      chat.type,
      chat.lastMessageId || null,
      chat.lastMessageText || null,
      chat.lastMessageSenderId || null,
      chat.lastMessageAt || 0,
      chat.createdAt,
      chat.updatedAt,
      JSON.stringify(chat.participantIds),
      JSON.stringify(chat.adminIds || []),
      chat.groupName || null,
      chat.groupAvatarUrl || null,
      existingChat?.syncStatus || 'pending', // Preserve existing status or default to pending
    ]);
  } catch (error) {
    console.error('❌ Failed to sync chat to SQLite:', error);
  }
}

/**
 * Get chat from SQLite (instant, offline-first)
 */
export async function getChatFromSQLite(chatId: string): Promise<Chat | null> {
  try {
    const sqlite = getDatabase();
    
    const sql = `
      SELECT 
        id, type, lastMessageId, lastMessageText, lastMessageSenderId,
        lastMessageAt, createdAt, updatedAt, participantIds, adminIds,
        groupName, groupAvatarUrl
      FROM chats
      WHERE id = ?
    `;
    
    const row = await sqlite.getFirstAsync<any>(sql, [chatId]);
    
    if (!row) return null;
    
    return {
      id: row.id,
      type: row.type,
      participantIds: JSON.parse(row.participantIds),
      adminIds: JSON.parse(row.adminIds || '[]'),
      groupName: row.groupName || undefined,
      groupAvatarUrl: row.groupAvatarUrl || undefined,
      lastMessageId: row.lastMessageId || undefined,
      lastMessageText: row.lastMessageText || undefined,
      lastMessageSenderId: row.lastMessageSenderId || undefined,
      lastMessageAt: row.lastMessageAt || 0,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    };
  } catch (error) {
    console.error('❌ Failed to get chat from SQLite:', error);
    return null;
  }
}

/**
 * Get all chats from SQLite (for chat list)
 */
export async function getChatsFromSQLite(userId: string): Promise<Chat[]> {
  try {
    const sqlite = getDatabase();
    
    const sql = `
      SELECT 
        id, type, lastMessageId, lastMessageText, lastMessageSenderId,
        lastMessageAt, createdAt, updatedAt, participantIds, adminIds,
        groupName, groupAvatarUrl
      FROM chats
      WHERE participantIds LIKE ?
      ORDER BY lastMessageAt DESC
    `;
    
    // Use LIKE to search for userId in JSON array
    const result = await sqlite.getAllAsync<any>(sql, [`%"${userId}"%`]);
    
    return result.map((row) => ({
      id: row.id,
      type: row.type,
      participantIds: JSON.parse(row.participantIds),
      adminIds: JSON.parse(row.adminIds || '[]'),
      groupName: row.groupName || undefined,
      groupAvatarUrl: row.groupAvatarUrl || undefined,
      lastMessageId: row.lastMessageId || undefined,
      lastMessageText: row.lastMessageText || undefined,
      lastMessageSenderId: row.lastMessageSenderId || undefined,
      lastMessageAt: row.lastMessageAt || 0,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    }));
  } catch (error) {
    console.error('❌ Failed to get chats from SQLite:', error);
    return [];
  }
}

/**
 * Create MessageAI system user if it doesn't exist
 * This is the bot that sends welcome messages
 */
async function ensureMessageAIUserExists(): Promise<void> {
  try {
    const userRef = doc(db, 'users', MESSAGE_AI_USER_ID);
    const userSnap = await getDoc(userRef);

    if (!userSnap.exists()) {
      await setDoc(userRef, {
        displayName: 'MessageAI',
        bio: 'Your AI messaging assistant',
        avatarUrl: '', // You can add a bot avatar URL here later
        presence: 'online',
        lastSeen: serverTimestamp(),
        deviceTokens: [],
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      console.log('MessageAI system user created');
    }
  } catch (error) {
    console.error('Error ensuring MessageAI user exists:', error);
    // Don't throw - this is not critical
  }
}

/**
 * Create a new chat
 */
export async function createChat(chatData: CreateChatData): Promise<Chat> {
  try {
    const now = Date.now();
    const chatRef = doc(collection(db, CHATS_COLLECTION));
    
    console.log('Creating chat with data:', {
      type: chatData.type,
      participantIds: chatData.participantIds,
      chatId: chatRef.id,
    });
    
    // Build chat object, only including defined fields
    const chatDoc: any = {
      type: chatData.type,
      participantIds: chatData.participantIds,
      adminIds: chatData.adminIds || [],
      lastMessageAt: serverTimestamp(), // Set initial timestamp so chat appears in list
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    };

    // Only add optional fields if they have values
    if (chatData.groupName !== undefined) {
      chatDoc.groupName = chatData.groupName;
    }
    if (chatData.groupAvatarUrl !== undefined) {
      chatDoc.groupAvatarUrl = chatData.groupAvatarUrl;
    }

    await setDoc(chatRef, chatDoc);

    const chat: Omit<Chat, 'id'> = {
      type: chatData.type,
      participantIds: chatData.participantIds,
      adminIds: chatData.adminIds || [],
      groupName: chatData.groupName,
      groupAvatarUrl: chatData.groupAvatarUrl,
      lastMessageAt: now, // Include in return value
      createdAt: now,
      updatedAt: now,
    };

    console.log('✅ Chat created successfully:', chatRef.id);

    return {
      id: chatRef.id,
      ...chat,
    };
  } catch (error: any) {
    console.error('❌ Error creating chat:', {
      error,
      code: error?.code,
      message: error?.message,
    });
    throw error; // Throw the original error, not a generic one
  }
}

/**
 * Create a new message in a chat
 */
export async function createMessage(messageData: CreateMessageData): Promise<Message> {
  try {
    const now = Date.now();
    const messageRef = doc(collection(db, CHATS_COLLECTION, messageData.chatId, MESSAGES_COLLECTION));
    
    console.log('Creating message:', {
      chatId: messageData.chatId,
      senderId: messageData.senderId,
      messageId: messageRef.id,
    });
    
    // Build message object, only including defined fields
    const messageDoc: any = {
      chatId: messageData.chatId,
      senderId: messageData.senderId,
      status: 'sent',
      edited: false,
      createdAt: serverTimestamp(),
    };

    // Only add optional fields if they have values
    if (messageData.text !== undefined) {
      messageDoc.text = messageData.text;
    }
    if (messageData.mediaUrl !== undefined) {
      messageDoc.mediaUrl = messageData.mediaUrl;
    }
    if (messageData.mediaMime !== undefined) {
      messageDoc.mediaMime = messageData.mediaMime;
    }
    if (messageData.replyToId !== undefined) {
      messageDoc.replyToId = messageData.replyToId;
    }

    await setDoc(messageRef, messageDoc);

    const message: Omit<Message, 'id'> = {
      chatId: messageData.chatId,
      senderId: messageData.senderId,
      text: messageData.text,
      mediaUrl: messageData.mediaUrl,
      mediaMime: messageData.mediaMime,
      replyToId: messageData.replyToId,
      status: 'sent',
      edited: false,
      createdAt: now,
    };

    console.log('✅ Message created, updating chat metadata...');

    // Update chat's last message
    const chatRef = doc(db, CHATS_COLLECTION, messageData.chatId);
    await updateDoc(chatRef, {
      lastMessageId: messageRef.id,
      lastMessageText: messageData.text || '[Media]',
      lastMessageSenderId: messageData.senderId,
      lastMessageAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });

    console.log('✅ Message created successfully:', messageRef.id);

    return {
      id: messageRef.id,
      ...message,
    };
  } catch (error: any) {
    console.error('❌ Error creating message:', {
      error,
      code: error?.code,
      message: error?.message,
      chatId: messageData.chatId,
    });
    throw error; // Throw the original error, not a generic one
  }
}

/**
 * Create a welcome chat with MessageAI for a new user
 * Called during user registration
 */
export async function createWelcomeChat(userId: string, displayName: string): Promise<void> {
  console.log('=== Starting welcome chat creation ===');
  console.log('User ID:', userId);
  console.log('Display Name:', displayName);
  
  try {
    // Ensure MessageAI system user exists
    console.log('Step 1: Ensuring MessageAI user exists...');
    await ensureMessageAIUserExists();

    // Create chat between user and MessageAI
    console.log('Step 2: Creating chat...');
    const chat = await createChat({
      type: 'dm',
      participantIds: [userId, MESSAGE_AI_USER_ID],
    });
    console.log('Chat created with ID:', chat.id);

    // Send welcome message from MessageAI
    console.log('Step 3: Sending welcome message...');
    const welcomeText = `👋 Hi ${displayName}! Welcome to MessageAI!

I'm your AI assistant, here to help you get the most out of your messaging experience.

Here are some things you can do:
• Start a chat with friends
• Create group conversations
• Share photos and media
• Get AI-powered assistance

Feel free to explore and reach out if you need help! 🚀`;

    await createMessage({
      chatId: chat.id,
      senderId: MESSAGE_AI_USER_ID,
      text: welcomeText,
    });

    console.log(`✅ Welcome chat created successfully for user ${userId}`);
  } catch (error: any) {
    console.error('❌ Error creating welcome chat:', {
      error,
      code: error?.code,
      message: error?.message,
      userId,
      displayName,
    });
    // Re-throw the error so it can be caught by the caller
    throw error;
  }
}

/**
 * Listen to user's chats in real-time
 * @param userId - Current user's ID
 * @param callback - Called with updated chats array
 * @returns Unsubscribe function
 */
export function onUserChatsSnapshot(
  userId: string,
  callback: (chats: Chat[]) => void
): Unsubscribe {
  try {
    // Query chats where user is a participant, sorted by most recent
    const chatsQuery = query(
      collection(db, CHATS_COLLECTION),
      where('participantIds', 'array-contains', userId),
      orderBy('lastMessageAt', 'desc')
    );

    const unsubscribe = onSnapshot(
      chatsQuery,
      async (snapshot) => {
        const chats: Chat[] = snapshot.docs.map((doc) => {
          const data = doc.data();
          return {
            id: doc.id,
            type: data.type,
            participantIds: data.participantIds || [],
            adminIds: data.adminIds || [],
            groupName: data.groupName,
            groupAvatarUrl: data.groupAvatarUrl,
            lastMessageId: data.lastMessageId,
            lastMessageText: data.lastMessageText,
            lastMessageSenderId: data.lastMessageSenderId,
            lastMessageAt: data.lastMessageAt?.toMillis?.() || data.lastMessageAt || 0,
            createdAt: data.createdAt?.toMillis?.() || data.createdAt || 0,
            updatedAt: data.updatedAt?.toMillis?.() || data.updatedAt || 0,
          };
        });

        console.log(`📱 Received ${chats.length} chats for user ${userId}`);
        
        // Sync all chats to SQLite for offline access
        for (const chat of chats) {
          await syncChatToSQLite(chat);
        }
        console.log(`💾 Synced ${chats.length} chats to SQLite`);
        
        callback(chats);
      },
      (error: any) => {
        // Handle offline errors gracefully
        const errorCode = error?.code || '';
        const errorMessage = error?.message || '';
        
        if (errorCode === 'permission-denied' || 
            errorCode === 'unavailable' ||
            errorMessage.includes('Missing or insufficient privileges') ||
            errorMessage.includes('offline') ||
            errorMessage.includes('network')) {
          console.log('⚠️ Firestore chat listener offline - will retry when back online');
        } else {
          console.error('Error listening to chats:', error);
        }
        // Don't callback with empty array - app will use SQLite data
      }
    );

    return unsubscribe;
  } catch (error) {
    console.error('Error setting up chats listener:', error);
    return () => {}; // Return no-op unsubscribe function
  }
}

/**
 * Find existing DM chat between two users, or create a new one
 * Prevents duplicate DM chats
 * @param currentUserId - Current user's ID
 * @param otherUserId - Other user's ID
 * @returns Existing or newly created chat
 */
export async function findOrCreateDMChat(
  currentUserId: string,
  otherUserId: string
): Promise<Chat> {
  try {
    console.log(`🔍 Looking for existing DM between ${currentUserId} and ${otherUserId}`);

    // Query for existing DM chat between these two users
    const chatsRef = collection(db, CHATS_COLLECTION);
    const q = query(
      chatsRef,
      where('type', '==', 'dm'),
      where('participantIds', 'array-contains', currentUserId)
    );

    const snapshot = await getDocs(q);

    // Check if any of the results includes both users
    for (const docSnap of snapshot.docs) {
      const data = docSnap.data();
      const participants = data.participantIds || [];

      // Check if this chat has exactly these two participants
      if (
        participants.length === 2 &&
        participants.includes(currentUserId) &&
        participants.includes(otherUserId)
      ) {
        console.log(`✅ Found existing DM chat: ${docSnap.id}`);

        return {
          id: docSnap.id,
          type: 'dm',
          participantIds: participants,
          adminIds: data.adminIds || [],
          groupName: data.groupName,
          groupAvatarUrl: data.groupAvatarUrl,
          lastMessageId: data.lastMessageId,
          lastMessageText: data.lastMessageText,
          lastMessageSenderId: data.lastMessageSenderId,
          lastMessageAt: data.lastMessageAt?.toMillis?.() || data.lastMessageAt || 0,
          createdAt: data.createdAt?.toMillis?.() || data.createdAt || 0,
          updatedAt: data.updatedAt?.toMillis?.() || data.updatedAt || 0,
        };
      }
    }

    // No existing chat found, create a new one
    console.log(`📝 No existing DM found, creating new chat`);

    const newChat = await createChat({
      type: 'dm',
      participantIds: [currentUserId, otherUserId],
    });

    return newChat;
  } catch (error: any) {
    console.error('❌ Error finding or creating DM chat:', error);
    throw error;
  }
}

/**
 * Get a chat by ID
 * @param chatId - Chat ID
 * @returns Chat object or null if not found
 */
export async function getChatById(chatId: string): Promise<Chat | null> {
  try {
    const chatRef = doc(db, CHATS_COLLECTION, chatId);
    const chatSnap = await getDoc(chatRef);

    if (!chatSnap.exists()) {
      return null;
    }

    const data = chatSnap.data();
    return {
      id: chatSnap.id,
      type: data.type,
      participantIds: data.participantIds || [],
      adminIds: data.adminIds || [],
      groupName: data.groupName,
      groupAvatarUrl: data.groupAvatarUrl,
      lastMessageId: data.lastMessageId,
      lastMessageText: data.lastMessageText,
      lastMessageSenderId: data.lastMessageSenderId,
      lastMessageAt: data.lastMessageAt?.toMillis?.() || data.lastMessageAt || 0,
      createdAt: data.createdAt?.toMillis?.() || data.createdAt || 0,
      updatedAt: data.updatedAt?.toMillis?.() || data.updatedAt || 0,
    };
  } catch (error) {
    console.error('❌ Error fetching chat:', error);
    throw error;
  }
}

/**
 * Listen to messages in a chat in real-time
 * @param chatId - Chat ID
 * @param callback - Function called with messages array when updated
 * @returns Unsubscribe function
 */
export function onChatMessagesSnapshot(
  chatId: string,
  callback: (messages: Message[]) => void
): Unsubscribe {
  try {
    const messagesRef = collection(db, CHATS_COLLECTION, chatId, MESSAGES_COLLECTION);
    const messagesQuery = query(messagesRef, orderBy('createdAt', 'asc'));

    const unsubscribe = onSnapshot(
      messagesQuery,
      (snapshot) => {
        const messages: Message[] = snapshot.docs.map((doc) => {
          const data = doc.data();
          return {
            id: doc.id,
            chatId,
            senderId: data.senderId,
            text: data.text || '',
            mediaUrl: data.mediaUrl,
            mediaMime: data.mediaMime,
            replyToId: data.replyToId,
            status: data.status || 'sent',
            edited: data.edited || false,
            editedAt: data.editedAt?.toMillis?.() || data.editedAt,
            createdAt: data.createdAt?.toMillis?.() || data.createdAt || Date.now(),
          };
        });
        console.log(`📱 Received ${messages.length} messages for chat ${chatId}`);
        callback(messages);
      },
      (error: any) => {
        // Handle offline errors gracefully - we already have SQLite data
        const errorCode = error?.code || '';
        const errorMessage = error?.message || '';
        
        if (errorCode === 'permission-denied' || 
            errorCode === 'unavailable' ||
            errorMessage.includes('Missing or insufficient privileges') ||
            errorMessage.includes('offline') ||
            errorMessage.includes('network')) {
          console.log('⚠️ Firestore listener offline (expected in airplane mode) - using cached data');
        } else {
          console.error('❌ Error listening to messages:', error);
        }
        // Don't callback with empty array - keep existing data
      }
    );

    return unsubscribe;
  } catch (error) {
    console.error('❌ Error setting up messages listener:', error);
    return () => {};
  }
}

/**
 * Send a message to a chat
 * @param chatId - Chat ID
 * @param senderId - Sender user ID
 * @param text - Message text
 * @returns Created message
 */
export async function sendMessage(
  chatId: string,
  senderId: string,
  text: string
): Promise<Message> {
  try {
    const messageData: CreateMessageData = {
      chatId,
      senderId,
      text,
    };

    const message = await createMessage(messageData);
    return message;
  } catch (error) {
    console.error('❌ Error sending message:', error);
    throw error;
  }
}

