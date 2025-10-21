/**
 * SQLite Database Schema
 * Defines table structures for local data persistence
 * 
 * Tables:
 * - messages: Local message storage with offline queue
 * - chats: Chat list cache
 * - chat_participants: Participant cache for chats
 */

/**
 * Messages Table
 * Stores all messages locally for offline access and queue
 */
export const CREATE_MESSAGES_TABLE = `
  CREATE TABLE IF NOT EXISTS messages (
    id TEXT PRIMARY KEY,
    chatId TEXT NOT NULL,
    senderId TEXT NOT NULL,
    text TEXT,
    mediaUrl TEXT,
    mediaMime TEXT,
    replyToId TEXT,
    status TEXT NOT NULL CHECK(status IN ('sending', 'sent', 'delivered', 'read', 'failed')),
    createdAt INTEGER NOT NULL,
    edited INTEGER DEFAULT 0,
    
    -- Offline queue fields
    localId TEXT UNIQUE,
    queuedAt INTEGER,
    retryCount INTEGER DEFAULT 0,
    lastRetryAt INTEGER,
    syncedToFirestore INTEGER DEFAULT 0,
    
    -- Indexes for common queries
    FOREIGN KEY (chatId) REFERENCES chats(id) ON DELETE CASCADE
  );
`;

export const CREATE_MESSAGES_INDEXES = `
  CREATE INDEX IF NOT EXISTS idx_messages_chatId ON messages(chatId);
  CREATE INDEX IF NOT EXISTS idx_messages_createdAt ON messages(createdAt DESC);
  CREATE INDEX IF NOT EXISTS idx_messages_status ON messages(status);
  CREATE INDEX IF NOT EXISTS idx_messages_queue ON messages(queuedAt) WHERE queuedAt IS NOT NULL;
  CREATE INDEX IF NOT EXISTS idx_messages_synced ON messages(syncedToFirestore);
`;

/**
 * Chats Table
 * Caches chat list data for offline access
 */
export const CREATE_CHATS_TABLE = `
  CREATE TABLE IF NOT EXISTS chats (
    id TEXT PRIMARY KEY,
    type TEXT NOT NULL CHECK(type IN ('dm', 'group')),
    lastMessageId TEXT,
    lastMessageText TEXT,
    lastMessageAt INTEGER,
    createdAt INTEGER NOT NULL,
    updatedAt INTEGER NOT NULL,
    
    -- Group chat specific
    groupName TEXT,
    groupAvatarUrl TEXT,
    
    -- UI state
    unreadCount INTEGER DEFAULT 0,
    isMuted INTEGER DEFAULT 0,
    isPinned INTEGER DEFAULT 0,
    archivedAt INTEGER
  );
`;

export const CREATE_CHATS_INDEXES = `
  CREATE INDEX IF NOT EXISTS idx_chats_lastMessageAt ON chats(lastMessageAt DESC);
  CREATE INDEX IF NOT EXISTS idx_chats_type ON chats(type);
  CREATE INDEX IF NOT EXISTS idx_chats_pinned ON chats(isPinned DESC, lastMessageAt DESC);
  CREATE INDEX IF NOT EXISTS idx_chats_archived ON chats(archivedAt) WHERE archivedAt IS NOT NULL;
`;

/**
 * Chat Participants Table
 * Stores participant information for each chat
 */
export const CREATE_CHAT_PARTICIPANTS_TABLE = `
  CREATE TABLE IF NOT EXISTS chat_participants (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    chatId TEXT NOT NULL,
    userId TEXT NOT NULL,
    
    -- Participant info cache
    displayName TEXT,
    avatarUrl TEXT,
    
    -- Role (for group chats)
    isAdmin INTEGER DEFAULT 0,
    
    -- Join/leave tracking
    joinedAt INTEGER NOT NULL,
    leftAt INTEGER,
    
    -- Read receipt tracking
    lastReadMessageId TEXT,
    lastReadAt INTEGER,
    
    -- Unique constraint
    UNIQUE(chatId, userId),
    FOREIGN KEY (chatId) REFERENCES chats(id) ON DELETE CASCADE
  );
`;

export const CREATE_CHAT_PARTICIPANTS_INDEXES = `
  CREATE INDEX IF NOT EXISTS idx_participants_chatId ON chat_participants(chatId);
  CREATE INDEX IF NOT EXISTS idx_participants_userId ON chat_participants(userId);
  CREATE INDEX IF NOT EXISTS idx_participants_active ON chat_participants(chatId, userId) WHERE leftAt IS NULL;
`;

/**
 * Typing Indicators Table (Optional)
 * Temporary storage for typing status
 */
export const CREATE_TYPING_TABLE = `
  CREATE TABLE IF NOT EXISTS typing_indicators (
    chatId TEXT NOT NULL,
    userId TEXT NOT NULL,
    startedAt INTEGER NOT NULL,
    expiresAt INTEGER NOT NULL,
    
    PRIMARY KEY (chatId, userId)
  );
`;

export const CREATE_TYPING_INDEXES = `
  CREATE INDEX IF NOT EXISTS idx_typing_expires ON typing_indicators(expiresAt);
`;

/**
 * Message Reactions Table (Optional)
 * Stores emoji reactions to messages
 */
export const CREATE_REACTIONS_TABLE = `
  CREATE TABLE IF NOT EXISTS message_reactions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    messageId TEXT NOT NULL,
    userId TEXT NOT NULL,
    emoji TEXT NOT NULL,
    createdAt INTEGER NOT NULL,
    
    UNIQUE(messageId, userId, emoji),
    FOREIGN KEY (messageId) REFERENCES messages(id) ON DELETE CASCADE
  );
`;

export const CREATE_REACTIONS_INDEXES = `
  CREATE INDEX IF NOT EXISTS idx_reactions_messageId ON message_reactions(messageId);
`;

/**
 * Drafts Table (Optional)
 * Stores unsent message drafts
 */
export const CREATE_DRAFTS_TABLE = `
  CREATE TABLE IF NOT EXISTS drafts (
    chatId TEXT PRIMARY KEY,
    text TEXT NOT NULL,
    updatedAt INTEGER NOT NULL
  );
`;

/**
 * All table creation statements
 */
export const ALL_TABLES = [
  CREATE_MESSAGES_TABLE,
  CREATE_MESSAGES_INDEXES,
  CREATE_CHATS_TABLE,
  CREATE_CHATS_INDEXES,
  CREATE_CHAT_PARTICIPANTS_TABLE,
  CREATE_CHAT_PARTICIPANTS_INDEXES,
  CREATE_TYPING_TABLE,
  CREATE_TYPING_INDEXES,
  CREATE_REACTIONS_TABLE,
  CREATE_REACTIONS_INDEXES,
  CREATE_DRAFTS_TABLE,
];

/**
 * Database version
 * Increment this when schema changes to trigger migrations
 */
export const DATABASE_VERSION = 1;

/**
 * Database name
 */
export const DATABASE_NAME = 'messageai.db';

