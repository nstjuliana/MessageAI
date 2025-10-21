/**
 * Chat Service
 * Handles all Firestore operations for chats and messages
 */

import { db } from '@/config/firebase';
import type { Chat, CreateChatData, CreateMessageData, Message } from '@/types/chat.types';
import {
    collection,
    doc,
    getDoc,
    serverTimestamp,
    setDoc,
    updateDoc,
} from 'firebase/firestore';

const CHATS_COLLECTION = 'chats';
const MESSAGES_COLLECTION = 'messages';

// MessageAI system user ID (consistent across all users)
export const MESSAGE_AI_USER_ID = 'messageai-system';

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

