/**
 * Chat and Message Types
 * Defines TypeScript interfaces for chats and messages
 */

export type ChatType = 'dm' | 'group';
export type MessageStatus = 'sending' | 'sent' | 'delivered' | 'read' | 'failed';

/**
 * Chat interface - represents a conversation
 */
export interface Chat {
  id: string;
  type: ChatType;
  participantIds: string[]; // Array of user IDs in this chat
  adminIds?: string[]; // For group chats - who can add/remove members
  groupName?: string; // For group chats
  groupAvatarUrl?: string; // For group chats
  lastMessageId?: string;
  lastMessageText?: string;
  lastMessageSenderId?: string; // User ID of who sent the last message
  lastMessageAt?: number; // Unix timestamp
  createdAt: number; // Unix timestamp
  updatedAt: number; // Unix timestamp
}

/**
 * Message interface - represents a single message
 */
export interface Message {
  id: string;
  chatId: string;
  senderId: string;
  text?: string;
  mediaUrl?: string;
  mediaMime?: string; // MIME type of media (image/jpeg, video/mp4, etc.)
  localMediaPath?: string; // Local path to cached media file
  replyToId?: string; // ID of message being replied to
  status: MessageStatus;
  reactions?: { [emoji: string]: string[] }; // emoji -> array of user IDs
  createdAt: number; // Unix timestamp
  edited: boolean;
  editedAt?: number; // Unix timestamp
}

/**
 * Data needed to create a new chat
 */
export interface CreateChatData {
  type: ChatType;
  participantIds: string[];
  groupName?: string;
  groupAvatarUrl?: string;
  adminIds?: string[];
}

/**
 * Data needed to create a new message
 */
export interface CreateMessageData {
  chatId: string;
  senderId: string;
  text?: string;
  mediaUrl?: string;
  mediaMime?: string;
  replyToId?: string;
}

/**
 * Read receipt - tracks who read what message
 */
export interface ReadReceipt {
  userId: string;
  lastReadMessageId: string;
  lastReadAt: number; // Unix timestamp
}

