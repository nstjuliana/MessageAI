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
import { createSystemMessage, syncMessageToSQLite } from './message.service';

const CHATS_COLLECTION = 'chats';
const MESSAGES_COLLECTION = 'messages';

// MessageAI system user ID (consistent across all users)
export const MESSAGE_AI_USER_ID = 'messageai-system';

/**
 * Get the last synced timestamp for a chat (for efficient message fetching)
 */
export async function getLastSyncedTimestamp(chatId: string): Promise<number> {
  try {
    const sqlite = getDatabase();
    const result = await sqlite.getFirstAsync<{ lastSyncedAt: number | null }>(
      'SELECT lastSyncedAt FROM chats WHERE id = ?',
      [chatId]
    );
    return result?.lastSyncedAt || 0;
  } catch (error) {
    console.error('❌ Failed to get last synced timestamp:', error);
    return 0;
  }
}

/**
 * Update the last synced timestamp for a chat
 */
export async function updateLastSyncedTimestamp(chatId: string, timestamp: number): Promise<void> {
  try {
    await executeStatement(
      'UPDATE chats SET lastSyncedAt = ? WHERE id = ?',
      [timestamp, chatId]
    );
  } catch (error) {
    console.error('❌ Failed to update last synced timestamp:', error);
  }
}

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
        displayName: 'MessageAI Bot',
        bio: 'Ask me anything about your conversations',
        avatarUrl: '', // You can add a bot avatar URL here later
        presence: 'online',
        lastSeen: serverTimestamp(),
        deviceTokens: [],
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      console.log('MessageAI Bot system user created');
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

I'm MessageAI Bot, your intelligent assistant that can answer questions about your conversations.

Ask me anything! For example:
• "When did Amy tell me to come over?"
• "What did we discuss about the project?"
• "What plans do I have this weekend?"

I'll search through your messages and give you helpful answers. Try asking me something! 🤖`;

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
          
          // Also fetch and sync the last message if it exists
          // This ensures messages are cached as soon as they arrive (even if chat isn't opened)
          if (chat.lastMessageId) {
            try {
              const sqlite = getDatabase();
              
              // Check if message is already in SQLite
              const existingMessage = await sqlite.getFirstAsync<{ id: string }>(
                'SELECT id FROM messages WHERE id = ?',
                [chat.lastMessageId]
              );
              
              // Only fetch from Firestore if not already cached
              if (!existingMessage) {
                const messageRef = doc(
                  db, 
                  CHATS_COLLECTION, 
                  chat.id, 
                  MESSAGES_COLLECTION, 
                  chat.lastMessageId
                );
                const messageDoc = await getDoc(messageRef);
                
                if (messageDoc.exists()) {
                  const data = messageDoc.data();
                  const message: Message = {
                    id: messageDoc.id,
                    chatId: chat.id,
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
                  
                  // Sync to SQLite with media caching
                  await syncMessageToSQLite(message);
                  console.log(`📩 Auto-cached new message: ${chat.lastMessageId}`);
                }
              }
            } catch (error) {
              // Silent fail - not critical if we can't sync the last message
              // Message will be synced when user opens the chat
              console.log(`⚠️ Could not auto-cache last message for chat ${chat.id}`);
            }
          }
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
 * Generate group name from participant IDs
 * @param participantIds - Array of user IDs
 * @returns Auto-generated group name
 */
async function generateGroupName(participantIds: string[]): Promise<string> {
  try {
    // Fetch profiles for all participants
    const profiles: Record<string, any> = {};
    
    for (const userId of participantIds) {
      const userDoc = await getDoc(doc(db, 'users', userId));
      if (userDoc.exists()) {
        profiles[userId] = userDoc.data();
      }
    }
    
    // Get display names
    const names = participantIds
      .map(id => profiles[id]?.displayName || 'Unknown')
      .slice(0, 3); // Take first 3
    
    // Build name
    let groupName = names.join(', ');
    
    // Add "+N more" if there are more participants
    if (participantIds.length > 3) {
      groupName += ` +${participantIds.length - 3} more`;
    }
    
    return groupName;
  } catch (error) {
    console.error('❌ Error generating group name:', error);
    return 'Group Chat';
  }
}

/**
 * Convert DM to group (changes type, adds participants)
 * @param chatId - Existing DM chat ID
 * @param newParticipantIds - Array of new participant user IDs to add
 * @param groupName - Optional group name (auto-generated if not provided)
 * @returns Updated chat object
 */
export async function convertDMToGroup(
  chatId: string,
  newParticipantIds: string[],
  groupName?: string
): Promise<Chat> {
  try {
    console.log(`🔄 Converting DM ${chatId} to group...`);
    
    // Get existing chat
    const chat = await getChatById(chatId);
    if (!chat) {
      throw new Error('Chat not found');
    }
    
    if (chat.type === 'group') {
      throw new Error('Chat is already a group');
    }
    
    // Merge participant IDs (existing + new)
    const allParticipantIds = [...new Set([...chat.participantIds, ...newParticipantIds])];
    
    // Generate group name if not provided
    const finalGroupName = groupName || await generateGroupName(allParticipantIds);
    
    // Set first participant as admin
    const adminIds = [chat.participantIds[0]];
    
    // Update Firestore
    const chatRef = doc(db, CHATS_COLLECTION, chatId);
    await updateDoc(chatRef, {
      type: 'group',
      participantIds: allParticipantIds,
      adminIds,
      groupName: finalGroupName,
      updatedAt: serverTimestamp(),
    });
    
    console.log(`✅ Converted to group with ${allParticipantIds.length} participants`);
    
    // Return updated chat
    const updatedChat: Chat = {
      ...chat,
      type: 'group',
      participantIds: allParticipantIds,
      adminIds,
      groupName: finalGroupName,
      updatedAt: Date.now(),
    };
    
    // Update SQLite
    await syncChatToSQLite(updatedChat);
    
    // Create system message
    try {
      const addedNames = await Promise.all(
        newParticipantIds.map(async id => {
          const userDoc = await getDoc(doc(db, 'users', id));
          return userDoc.exists() ? userDoc.data().displayName : 'Someone';
        })
      );
      await createSystemMessage(
        chatId,
        `Converted to group chat. Added ${addedNames.join(', ')}`
      );
    } catch (err) {
      console.error('Failed to create system message:', err);
    }
    
    return updatedChat;
  } catch (error) {
    console.error('❌ Error converting DM to group:', error);
    throw error;
  }
}

/**
 * Create new group chat
 * @param creatorId - User ID of group creator (becomes first admin)
 * @param participantIds - Array of all participant user IDs (including creator)
 * @param groupName - Optional group name (auto-generated if not provided)
 * @returns Created chat object
 */
export async function createGroupChat(
  creatorId: string,
  participantIds: string[],
  groupName?: string
): Promise<Chat> {
  try {
    console.log(`📝 Creating group chat with ${participantIds.length} participants...`);
    
    // Ensure creator is in participants
    const allParticipantIds = [...new Set([creatorId, ...participantIds])];
    
    // Generate group name if not provided
    const finalGroupName = groupName || await generateGroupName(allParticipantIds);
    
    // Creator becomes first admin
    const adminIds = [creatorId];
    
    // Create group chat
    const chat = await createChat({
      type: 'group',
      participantIds: allParticipantIds,
      adminIds,
      groupName: finalGroupName,
    });
    
    console.log(`✅ Group chat created: ${chat.id}`);
    
    return chat;
  } catch (error) {
    console.error('❌ Error creating group chat:', error);
    throw error;
  }
}

/**
 * Add participants to existing group
 * @param chatId - Group chat ID
 * @param newParticipantIds - Array of user IDs to add
 */
export async function addParticipantsToGroup(
  chatId: string,
  newParticipantIds: string[]
): Promise<void> {
  try {
    console.log(`➕ Adding ${newParticipantIds.length} participants to group ${chatId}...`);
    
    // Get existing chat
    const chat = await getChatById(chatId);
    if (!chat) {
      throw new Error('Chat not found');
    }
    
    if (chat.type !== 'group') {
      throw new Error('Chat is not a group');
    }
    
    // Merge participant IDs
    const allParticipantIds = [...new Set([...chat.participantIds, ...newParticipantIds])];
    
    // Update Firestore
    const chatRef = doc(db, CHATS_COLLECTION, chatId);
    await updateDoc(chatRef, {
      participantIds: allParticipantIds,
      updatedAt: serverTimestamp(),
    });
    
    // Update SQLite
    await syncChatToSQLite({
      ...chat,
      participantIds: allParticipantIds,
      updatedAt: Date.now(),
    });
    
    // Create system message
    try {
      const addedNames = await Promise.all(
        newParticipantIds.map(async id => {
          const userDoc = await getDoc(doc(db, 'users', id));
          return userDoc.exists() ? userDoc.data().displayName : 'Someone';
        })
      );
      await createSystemMessage(
        chatId,
        `Added ${addedNames.join(', ')} to the group`
      );
    } catch (err) {
      console.error('Failed to create system message:', err);
    }
    
    console.log(`✅ Added participants to group`);
  } catch (error) {
    console.error('❌ Error adding participants to group:', error);
    throw error;
  }
}

/**
 * Update group metadata (name, avatar)
 * @param chatId - Group chat ID
 * @param updates - Updates to apply
 */
export async function updateGroupInfo(
  chatId: string,
  updates: { groupName?: string; groupAvatarUrl?: string }
): Promise<void> {
  try {
    console.log(`✏️ Updating group info for ${chatId}...`);
    
    // Get existing chat
    const chat = await getChatById(chatId);
    if (!chat) {
      throw new Error('Chat not found');
    }
    
    if (chat.type !== 'group') {
      throw new Error('Chat is not a group');
    }
    
    // Build update object
    const updateData: any = {
      updatedAt: serverTimestamp(),
    };
    
    if (updates.groupName !== undefined) {
      updateData.groupName = updates.groupName;
    }
    if (updates.groupAvatarUrl !== undefined) {
      updateData.groupAvatarUrl = updates.groupAvatarUrl;
    }
    
    // Update Firestore
    const chatRef = doc(db, CHATS_COLLECTION, chatId);
    await updateDoc(chatRef, updateData);
    
    // Update SQLite
    await syncChatToSQLite({
      ...chat,
      ...updates,
      updatedAt: Date.now(),
    });
    
    // Create system message for name change
    if (updates.groupName && updates.groupName !== chat.groupName) {
      try {
        await createSystemMessage(
          chatId,
          `Group name changed to "${updates.groupName}"`
        );
      } catch (err) {
        console.error('Failed to create system message:', err);
      }
    }
    
    console.log(`✅ Updated group info`);
  } catch (error) {
    console.error('❌ Error updating group info:', error);
    throw error;
  }
}

/**
 * Remove participant from group (admin only)
 * @param chatId - Group chat ID
 * @param participantId - User ID to remove
 * @param removedBy - User ID performing the removal (must be admin)
 */
export async function removeParticipantFromGroup(
  chatId: string,
  participantId: string,
  removedBy: string
): Promise<void> {
  try {
    console.log(`➖ Removing participant ${participantId} from group ${chatId}...`);
    
    // Get existing chat
    const chat = await getChatById(chatId);
    if (!chat) {
      throw new Error('Chat not found');
    }
    
    if (chat.type !== 'group') {
      throw new Error('Chat is not a group');
    }
    
    // Check if remover is admin
    if (!chat.adminIds?.includes(removedBy)) {
      throw new Error('Only admins can remove participants');
    }
    
    // Remove participant
    const newParticipantIds = chat.participantIds.filter(id => id !== participantId);
    
    // Also remove from admins if they were an admin
    const newAdminIds = chat.adminIds?.filter(id => id !== participantId) || [];
    
    // Update Firestore
    const chatRef = doc(db, CHATS_COLLECTION, chatId);
    await updateDoc(chatRef, {
      participantIds: newParticipantIds,
      adminIds: newAdminIds,
      updatedAt: serverTimestamp(),
    });
    
    // Update SQLite
    await syncChatToSQLite({
      ...chat,
      participantIds: newParticipantIds,
      adminIds: newAdminIds,
      updatedAt: Date.now(),
    });
    
    // Create system message
    try {
      const removedUserDoc = await getDoc(doc(db, 'users', participantId));
      const removedUserName = removedUserDoc.exists()
        ? removedUserDoc.data().displayName
        : 'Someone';
      
      const removerUserDoc = await getDoc(doc(db, 'users', removedBy));
      const removerUserName = removerUserDoc.exists()
        ? removerUserDoc.data().displayName
        : 'Someone';
      
      await createSystemMessage(
        chatId,
        `${removerUserName} removed ${removedUserName} from the group`
      );
    } catch (err) {
      console.error('Failed to create system message:', err);
    }
    
    console.log(`✅ Removed participant from group`);
  } catch (error) {
    console.error('❌ Error removing participant from group:', error);
    throw error;
  }
}

/**
 * Leave group
 * @param chatId - Group chat ID
 * @param userId - User ID leaving the group
 */
export async function leaveGroup(
  chatId: string,
  userId: string
): Promise<void> {
  try {
    console.log(`👋 User ${userId} leaving group ${chatId}...`);
    
    // Get existing chat
    const chat = await getChatById(chatId);
    if (!chat) {
      throw new Error('Chat not found');
    }
    
    if (chat.type !== 'group') {
      throw new Error('Chat is not a group');
    }
    
    // Remove user from participants
    const newParticipantIds = chat.participantIds.filter(id => id !== userId);
    
    // Also remove from admins if they were an admin
    const newAdminIds = chat.adminIds?.filter(id => id !== userId) || [];
    
    // Check if group will be empty
    if (newParticipantIds.length === 0) {
      console.log('⚠️ Last participant leaving - group will be empty');
    }
    
    // Update Firestore
    const chatRef = doc(db, CHATS_COLLECTION, chatId);
    await updateDoc(chatRef, {
      participantIds: newParticipantIds,
      adminIds: newAdminIds,
      updatedAt: serverTimestamp(),
    });
    
    // Update SQLite
    await syncChatToSQLite({
      ...chat,
      participantIds: newParticipantIds,
      adminIds: newAdminIds,
      updatedAt: Date.now(),
    });
    
    // Create system message
    try {
      const userDoc = await getDoc(doc(db, 'users', userId));
      const userName = userDoc.exists() ? userDoc.data().displayName : 'Someone';
      
      await createSystemMessage(
        chatId,
        `${userName} left the group`
      );
    } catch (err) {
      console.error('Failed to create system message:', err);
    }
    
    console.log(`✅ Left group`);
  } catch (error) {
    console.error('❌ Error leaving group:', error);
    throw error;
  }
}

/**
 * Listen for NEW messages only (created after lastSyncedTimestamp)
 * @param chatId - Chat ID
 * @param lastSyncedTimestamp - Only fetch messages newer than this
 * @param callback - Function called with new messages
 * @returns Unsubscribe function
 */
export function onNewMessagesSnapshot(
  chatId: string,
  lastSyncedTimestamp: number,
  callback: (message: Message) => void
): Unsubscribe {
  try {
    const messagesRef = collection(db, CHATS_COLLECTION, chatId, MESSAGES_COLLECTION);
    const messagesQuery = query(
      messagesRef, 
      where('createdAt', '>', lastSyncedTimestamp),
      orderBy('createdAt', 'asc')
    );

    const unsubscribe = onSnapshot(
      messagesQuery,
      (snapshot) => {
        snapshot.docChanges().forEach(change => {
          if (change.type === 'added') {
            const doc = change.doc;
          const data = doc.data();
            const message: Message = {
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
            console.log(`📩 New message: ${message.id}`);
            callback(message);
          }
        });
      },
      (error: any) => {
        const errorCode = error?.code || '';
        if (errorCode === 'unavailable' || errorCode === 'permission-denied') {
          console.log('⚠️ New messages listener offline');
        } else {
          console.error('❌ Error in new messages listener:', error);
        }
      }
    );

    return unsubscribe;
  } catch (error) {
    console.error('❌ Error setting up new messages listener:', error);
    return () => {};
  }
}

/**
 * Listen for STATUS UPDATES on existing messages
 * @param chatId - Chat ID
 * @param callback - Function called when message status changes
 * @returns Unsubscribe function
 */
export function onMessageStatusUpdatesSnapshot(
  chatId: string,
  callback: (message: Message) => void
): Unsubscribe {
  try {
    const messagesRef = collection(db, CHATS_COLLECTION, chatId, MESSAGES_COLLECTION);
    const messagesQuery = query(messagesRef, orderBy('createdAt', 'asc'));
    
    let isFirstSnapshot = true;

    const unsubscribe = onSnapshot(
      messagesQuery,
      (snapshot) => {
        // Skip initial snapshot (we already have messages from SQLite)
        if (isFirstSnapshot) {
          isFirstSnapshot = false;
          console.log('📡 Status updates listener initialized');
          return;
        }
        
        // Only process 'modified' changes (status updates)
        snapshot.docChanges().forEach(change => {
          if (change.type === 'modified') {
            const doc = change.doc;
            const data = doc.data();
            const message: Message = {
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
            console.log(`📝 Status update: ${message.id} → ${message.status}`);
            callback(message);
          }
        });
      },
      (error: any) => {
        const errorCode = error?.code || '';
        if (errorCode === 'unavailable' || errorCode === 'permission-denied') {
          console.log('⚠️ Status updates listener offline');
        } else {
          console.error('❌ Error in status updates listener:', error);
        }
      }
    );

    return unsubscribe;
  } catch (error) {
    console.error('❌ Error setting up status updates listener:', error);
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

