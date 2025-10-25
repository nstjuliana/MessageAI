/**
 * Database Initialization and Management
 * Handles SQLite database setup, migrations, and connections
 */

import type { SQLiteBindParams } from 'expo-sqlite';
import * as SQLite from 'expo-sqlite';

import { ALL_TABLES, CREATE_PROFILES_INDEXES, DATABASE_NAME, DATABASE_VERSION } from './schema';

let db: SQLite.SQLiteDatabase | null = null;

/**
 * Initialize the database
 * Creates tables if they don't exist
 * Handles migrations if database version changes
 */
export async function initDatabase(): Promise<SQLite.SQLiteDatabase> {
  if (db) {
    return db;
  }

  try {
    console.log('Initializing database...');
    
    // Open database
    db = await SQLite.openDatabaseAsync(DATABASE_NAME);
    
    // Check current version
    const currentVersion = await getDatabaseVersion();
    console.log(`Current database version: ${currentVersion}`);
    
    if (currentVersion === 0) {
      // First time setup - create all tables
      console.log('Creating database tables...');
      await createTables();
      await setDatabaseVersion(DATABASE_VERSION);
      console.log('Database initialized successfully');
    } else if (currentVersion < DATABASE_VERSION) {
      // Migration needed
      console.log(`Migrating database from v${currentVersion} to v${DATABASE_VERSION}`);
      try {
        await migrateDatabase(currentVersion, DATABASE_VERSION);
        await setDatabaseVersion(DATABASE_VERSION);
        console.log('Database migration completed');
      } catch (migrationError) {
        console.error('Migration failed, attempting to rebuild database:', migrationError);
        // If migration fails, drop and recreate (development fallback)
        await db.closeAsync();
        try {
          await SQLite.deleteDatabaseAsync(DATABASE_NAME);
        } catch (deleteError) {
          console.log('Database file not found, continuing with fresh creation');
        }
        db = await SQLite.openDatabaseAsync(DATABASE_NAME);
        await createTables();
        await setDatabaseVersion(DATABASE_VERSION);
        console.log('Database rebuilt successfully');
      }
    } else {
      console.log('Database is up to date');
    }
    
    return db;
  } catch (error) {
    console.error('Failed to initialize database:', error);
    throw new Error('Database initialization failed');
  }
}

/**
 * Get the database instance
 * Throws error if database hasn't been initialized
 */
export function getDatabase(): SQLite.SQLiteDatabase {
  if (!db) {
    throw new Error('Database not initialized. Call initDatabase() first.');
  }
  return db;
}

/**
 * Create all database tables
 */
async function createTables(): Promise<void> {
  if (!db) throw new Error('Database not initialized');
  
  try {
    // Execute all table creation statements in a transaction
    await db.execAsync(`
      BEGIN TRANSACTION;
      ${ALL_TABLES.join('\n')}
      COMMIT;
    `);
    
    console.log('All tables created successfully');
  } catch (error) {
    console.error('Error creating tables:', error);
    
    // Rollback on error
    try {
      await db.execAsync('ROLLBACK;');
    } catch (rollbackError) {
      console.error('Error rolling back transaction:', rollbackError);
    }
    
    throw error;
  }
}

/**
 * Get current database version
 */
async function getDatabaseVersion(): Promise<number> {
  if (!db) throw new Error('Database not initialized');
  
  try {
    // Try to get version from user_version pragma
    const result = await db.getFirstAsync<{ user_version: number }>(
      'PRAGMA user_version'
    );
    
    return result?.user_version || 0;
  } catch (error) {
    console.error('Error getting database version:', error);
    return 0;
  }
}

/**
 * Set database version
 */
async function setDatabaseVersion(version: number): Promise<void> {
  if (!db) throw new Error('Database not initialized');
  
  try {
    await db.execAsync(`PRAGMA user_version = ${version}`);
    console.log(`Database version set to ${version}`);
  } catch (error) {
    console.error('Error setting database version:', error);
    throw error;
  }
}

/**
 * Migrate database from one version to another
 * Add migration logic here as schema evolves
 */
async function migrateDatabase(fromVersion: number, toVersion: number): Promise<void> {
  if (!db) throw new Error('Database not initialized');
  
  console.log(`Migrating database from version ${fromVersion} to ${toVersion}`);
  
  try {
    // Version 1 migrations
    if (fromVersion < 1 && toVersion >= 1) {
      // Initial version - no migration needed
      await createTables();
    }
    
    // Version 2 migrations - Add editedAt column
    if (fromVersion < 2 && toVersion >= 2) {
      console.log('Migrating to version 2: Adding editedAt column to messages table');
      try {
        await db.execAsync('ALTER TABLE messages ADD COLUMN editedAt INTEGER');
        console.log('✅ Added editedAt column to messages table');
      } catch (error: any) {
        if (error.message?.includes('duplicate column name')) {
          console.log('⚠️ editedAt column already exists, skipping...');
        } else {
          throw error;
        }
      }
    }
    
    // Version 3 migrations - Ensure editedAt column exists (failsafe)
    if (fromVersion < 3 && toVersion >= 3) {
      console.log('Migrating to version 3: Ensuring editedAt column exists');
      try {
        // Try to add the column (will fail if it exists)
        await db.execAsync('ALTER TABLE messages ADD COLUMN editedAt INTEGER');
        console.log('✅ Added editedAt column to messages table');
      } catch (error: any) {
        // Check if it's a "duplicate column" error (which is fine)
        if (error.message?.includes('duplicate column name') || 
            error.message?.includes('already exists')) {
          console.log('✅ editedAt column already exists');
        } else {
          // Some other error - log and continue
          console.error('⚠️ Could not add editedAt column:', error.message);
          console.log('Attempting to rebuild messages table...');
          
          // As a last resort, rebuild the messages table
          await db.execAsync(`
            BEGIN TRANSACTION;
            
            -- Create temporary table with new schema
            CREATE TABLE messages_new (
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
              editedAt INTEGER,
              localId TEXT UNIQUE,
              queuedAt INTEGER,
              retryCount INTEGER DEFAULT 0,
              lastRetryAt INTEGER,
              syncedToFirestore INTEGER DEFAULT 0,
              FOREIGN KEY (chatId) REFERENCES chats(id) ON DELETE CASCADE
            );
            
            -- Copy existing data (without editedAt)
            INSERT INTO messages_new (
              id, chatId, senderId, text, mediaUrl, mediaMime, replyToId,
              status, createdAt, edited, localId, queuedAt, retryCount,
              lastRetryAt, syncedToFirestore
            )
            SELECT 
              id, chatId, senderId, text, mediaUrl, mediaMime, replyToId,
              status, createdAt, edited, localId, queuedAt, retryCount,
              lastRetryAt, syncedToFirestore
            FROM messages;
            
            -- Drop old table
            DROP TABLE messages;
            
            -- Rename new table
            ALTER TABLE messages_new RENAME TO messages;
            
            -- Recreate indexes
            CREATE INDEX IF NOT EXISTS idx_messages_chatId ON messages(chatId);
            CREATE INDEX IF NOT EXISTS idx_messages_createdAt ON messages(createdAt DESC);
            CREATE INDEX IF NOT EXISTS idx_messages_status ON messages(status);
            CREATE INDEX IF NOT EXISTS idx_messages_queue ON messages(queuedAt) WHERE queuedAt IS NOT NULL;
            CREATE INDEX IF NOT EXISTS idx_messages_synced ON messages(syncedToFirestore);
            
            COMMIT;
          `);
          console.log('✅ Messages table rebuilt with editedAt column');
        }
      }
    }
    
    // Version 4 migrations - Add new columns to chats table
    if (fromVersion < 4 && toVersion >= 4) {
      console.log('Migrating to version 4: Adding columns to chats table');
      
      // Try to add columns one by one
      const columnsToAdd = [
        { name: 'lastMessageSenderId', definition: 'TEXT' },
        { name: 'participantIds', definition: 'TEXT NOT NULL DEFAULT "[]"' },
        { name: 'adminIds', definition: 'TEXT' },
      ];
      
      for (const column of columnsToAdd) {
        try {
          await db.execAsync(`ALTER TABLE chats ADD COLUMN ${column.name} ${column.definition}`);
          console.log(`✅ Added ${column.name} column to chats table`);
        } catch (error: any) {
          if (error.message?.includes('duplicate column name') || 
              error.message?.includes('already exists')) {
            console.log(`✅ ${column.name} column already exists`);
          } else {
            console.error(`⚠️ Could not add ${column.name} column:`, error.message);
          }
        }
      }
      
      console.log('✅ Chats table migration completed');
    }
    
    // Version 5 migrations - Create profiles table
    if (fromVersion < 5 && toVersion >= 5) {
      console.log('Migrating to version 5: Creating profiles table');
      const { CREATE_PROFILES_TABLE, CREATE_PROFILES_INDEXES } = await import('./schema');
      await db.execAsync(CREATE_PROFILES_TABLE);
      await db.execAsync(CREATE_PROFILES_INDEXES);
      console.log('✅ Profiles table created');
    }
    
    // Version 6 migrations - Add avatarBlob column to profiles table
    if (fromVersion < 6 && toVersion >= 6) {
      console.log('Migrating to version 6: Adding avatarBlob column to profiles table');
      try {
        await db.execAsync('ALTER TABLE profiles ADD COLUMN avatarBlob TEXT');
        console.log('✅ Added avatarBlob column to profiles table');
        
        // Clear existing profiles so they're re-cached with image blobs
        console.log('🗑️ Clearing old profiles (will re-download with images)...');
        await db.execAsync('DELETE FROM profiles');
        console.log('✅ Profiles cleared - will re-cache with images on next use');
      } catch (error: any) {
        if (error.message?.includes('duplicate column name') || 
            error.message?.includes('already exists')) {
          console.log('✅ avatarBlob column already exists');
        } else {
          console.error('⚠️ Could not add avatarBlob column:', error.message);
        }
      }
    }

    // Version 7 migrations - Replace avatarBlob with avatarLocalPath (file system storage)
    if (fromVersion < 7 && toVersion >= 7) {
      console.log('Migrating to version 7: Switching to file system storage for avatars');
      try {
        // Check if profiles table exists and has data
        const result = await db.getFirstAsync<{ count: number }>(
          `SELECT COUNT(*) as count FROM sqlite_master WHERE type='table' AND name='profiles'`
        );
        
        if (result && result.count > 0) {
          // Table exists, recreate it without avatarBlob column
          console.log('🔄 Recreating profiles table to remove avatarBlob column...');
          
          // Step 1: Create new table with correct schema (without avatarBlob)
          await db.execAsync(`
            CREATE TABLE profiles_new (
              userId TEXT PRIMARY KEY,
              username TEXT NOT NULL,
              displayName TEXT NOT NULL,
              avatarUrl TEXT,
              avatarLocalPath TEXT,
              bio TEXT,
              lastSeen INTEGER,
              cachedAt INTEGER NOT NULL,
              updatedAt INTEGER NOT NULL
            )
          `);
          console.log('✅ Created new profiles table without avatarBlob column');
          
          // Step 2: Copy data from old table to new table (excluding avatarBlob)
          await db.execAsync(`
            INSERT INTO profiles_new (userId, username, displayName, avatarUrl, avatarLocalPath, bio, lastSeen, cachedAt, updatedAt)
            SELECT userId, username, displayName, avatarUrl, NULL, bio, lastSeen, cachedAt, updatedAt
            FROM profiles
          `);
          console.log('✅ Copied profile data (excluding avatarBlob)');
          
          // Step 3: Drop old table
          await db.execAsync('DROP TABLE profiles');
          console.log('✅ Dropped old profiles table');
          
          // Step 4: Rename new table to original name
          await db.execAsync('ALTER TABLE profiles_new RENAME TO profiles');
          console.log('✅ Renamed new table to profiles');
          
          // Step 5: Recreate indexes
          await db.execAsync(CREATE_PROFILES_INDEXES);
          console.log('✅ Recreated profiles indexes');
        } else {
          // Table doesn't exist, will be created with correct schema by ALL_TABLES
          console.log('ℹ️ Profiles table does not exist yet, will be created with new schema');
        }
        
        // Clear existing profiles so they're re-cached with file system storage
        console.log('🗑️ Clearing profiles (will re-download with local file storage)...');
        await db.execAsync('DELETE FROM profiles WHERE 1=1');
        console.log('✅ Profiles cleared - will re-cache with file system storage on next use');
        
      } catch (error: any) {
        console.error('⚠️ Migration error:', error.message);
        // Don't throw - allow app to continue with whatever table structure exists
      }
    }
    
    // Version 8 migrations - Add localMediaPath to messages and sync tracking to chats
    if (fromVersion < 8 && toVersion >= 8) {
      console.log('Migrating to version 8: Adding media caching and sync tracking');
      
      // Add localMediaPath to messages table
      try {
        await db.execAsync('ALTER TABLE messages ADD COLUMN localMediaPath TEXT');
        console.log('✅ Added localMediaPath column to messages table');
      } catch (error: any) {
        if (error.message?.includes('duplicate column name')) {
          console.log('✅ localMediaPath column already exists');
        } else {
          console.error('⚠️ Could not add localMediaPath column:', error.message);
        }
      }
      
      // Add sync tracking columns to chats table
      const chatColumns = [
        { name: 'syncStatus', definition: 'TEXT DEFAULT "pending"' },
        { name: 'lastSyncedAt', definition: 'INTEGER' },
        { name: 'messageCount', definition: 'INTEGER DEFAULT 0' },
      ];
      
      for (const column of chatColumns) {
        try {
          await db.execAsync(`ALTER TABLE chats ADD COLUMN ${column.name} ${column.definition}`);
          console.log(`✅ Added ${column.name} column to chats table`);
        } catch (error: any) {
          if (error.message?.includes('duplicate column name')) {
            console.log(`✅ ${column.name} column already exists`);
          } else {
            console.error(`⚠️ Could not add ${column.name} column:`, error.message);
          }
        }
      }
      
      console.log('✅ Version 8 migration completed');
    }
    
    // Version 9 migrations - Add deliveredTo and readBy columns for group status tracking
    if (fromVersion < 9 && toVersion >= 9) {
      console.log('Migrating to version 9: Adding deliveredTo and readBy columns to messages');
      
      // Add deliveredTo column
      try {
        await db.execAsync('ALTER TABLE messages ADD COLUMN deliveredTo TEXT');
        console.log('✅ Added deliveredTo column to messages table');
      } catch (error: any) {
        if (error.message?.includes('duplicate column name')) {
          console.log('✅ deliveredTo column already exists');
        } else {
          console.error('⚠️ Could not add deliveredTo column:', error.message);
        }
      }
      
      // Add readBy column
      try {
        await db.execAsync('ALTER TABLE messages ADD COLUMN readBy TEXT');
        console.log('✅ Added readBy column to messages table');
      } catch (error: any) {
        if (error.message?.includes('duplicate column name')) {
          console.log('✅ readBy column already exists');
        } else {
          console.error('⚠️ Could not add readBy column:', error.message);
        }
      }
      
      console.log('✅ Version 9 migration completed');
    }
    
    console.log('Migration completed successfully');
  } catch (error) {
    console.error('Migration failed:', error);
    throw error;
  }
}

/**
 * Clear profiles table to force re-cache with image blobs
 */
export async function clearProfilesCache(): Promise<void> {
  if (!db) throw new Error('Database not initialized');
  
  try {
    console.log('🗑️ Clearing profiles cache...');
    await db.execAsync('DELETE FROM profiles');
    console.log('✅ Profiles cache cleared - will re-download with images on next use');
  } catch (error) {
    console.error('Failed to clear profiles cache:', error);
    throw error;
  }
}

/**
 * Drop all tables (use with caution!)
 * Useful for development/testing
 */
export async function dropAllTables(): Promise<void> {
  if (!db) throw new Error('Database not initialized');
  
  try {
    await db.execAsync(`
      BEGIN TRANSACTION;
      DROP TABLE IF EXISTS message_reactions;
      DROP TABLE IF EXISTS typing_indicators;
      DROP TABLE IF EXISTS drafts;
      DROP TABLE IF EXISTS chat_participants;
      DROP TABLE IF EXISTS messages;
      DROP TABLE IF EXISTS chats;
      DROP TABLE IF EXISTS profiles;
      COMMIT;
    `);
    
    // Reset version
    await setDatabaseVersion(0);
    
    console.log('All tables dropped');
  } catch (error) {
    console.error('Error dropping tables:', error);
    throw error;
  }
}

/**
 * Force rebuild database (for development)
 * Deletes the database file and recreates with latest schema
 */
export async function rebuildDatabase(): Promise<void> {
  try {
    console.log('🔄 Rebuilding database...');
    
    // Close existing connection
    if (db) {
      await db.closeAsync();
      db = null;
    }
    
    // Delete database file (if it exists)
    try {
      await SQLite.deleteDatabaseAsync(DATABASE_NAME);
      console.log('✅ Old database deleted');
    } catch (deleteError: any) {
      // Database might not exist on first load - this is fine
      if (deleteError.message?.includes('not found')) {
        console.log('ℹ️ No existing database to delete');
      } else {
        console.warn('⚠️ Could not delete database:', deleteError);
      }
    }
    
    // Reinitialize with new schema
    await initDatabase();
    console.log('✅ Database rebuilt successfully!');
  } catch (error) {
    console.error('❌ Failed to rebuild database:', error);
    throw error;
  }
}

/**
 * Close database connection
 */
export async function closeDatabase(): Promise<void> {
  if (db) {
    try {
      await db.closeAsync();
      db = null;
      console.log('Database closed');
    } catch (error) {
      console.error('Error closing database:', error);
      throw error;
    }
  }
}

/**
 * Execute a raw SQL query
 * Use with caution - prefer typed query functions
 */
export async function executeQuery<T = any>(
  sql: string,
  params?: SQLiteBindParams
): Promise<T[]> {
  if (!db) throw new Error('Database not initialized');
  
  try {
    const result = await db.getAllAsync<T>(sql, params || []);
    return result;
  } catch (error) {
    console.error('Query execution failed:', error);
    throw error;
  }
}

/**
 * Execute a raw SQL query and get first result
 */
export async function executeQueryFirst<T = any>(
  sql: string,
  params?: SQLiteBindParams
): Promise<T | null> {
  if (!db) throw new Error('Database not initialized');
  
  try {
    const result = await db.getFirstAsync<T>(sql, params || []);
    return result || null;
  } catch (error) {
    console.error('Query execution failed:', error);
    throw error;
  }
}

/**
 * Execute a SQL statement (INSERT, UPDATE, DELETE)
 */
export async function executeStatement(
  sql: string,
  params?: SQLiteBindParams
): Promise<SQLite.SQLiteRunResult> {
  if (!db) throw new Error('Database not initialized');
  
  try {
    const result = await db.runAsync(sql, params || []);
    return result;
  } catch (error) {
    console.error('Statement execution failed:', error);
    throw error;
  }
}

/**
 * Execute multiple statements in a transaction
 */
export async function executeTransaction(
  statements: Array<{ sql: string; params?: SQLiteBindParams }>
): Promise<void> {
  if (!db) throw new Error('Database not initialized');
  
  try {
    await db.execAsync('BEGIN TRANSACTION');
    
    for (const statement of statements) {
      await db.runAsync(statement.sql, statement.params || []);
    }
    
    await db.execAsync('COMMIT');
  } catch (error) {
    console.error('Transaction failed:', error);
    
    try {
      await db.execAsync('ROLLBACK');
    } catch (rollbackError) {
      console.error('Rollback failed:', rollbackError);
    }
    
    throw error;
  }
}

/**
 * Get database statistics (for debugging)
 */
export async function getDatabaseStats(): Promise<{
  messageCount: number;
  chatCount: number;
  participantCount: number;
  databaseSize: string;
}> {
  if (!db) throw new Error('Database not initialized');
  
  try {
    const messageCount = await db.getFirstAsync<{ count: number }>(
      'SELECT COUNT(*) as count FROM messages'
    );
    
    const chatCount = await db.getFirstAsync<{ count: number }>(
      'SELECT COUNT(*) as count FROM chats'
    );
    
    const participantCount = await db.getFirstAsync<{ count: number }>(
      'SELECT COUNT(*) as count FROM chat_participants'
    );
    
    const pageCount = await db.getFirstAsync<{ page_count: number }>(
      'PRAGMA page_count'
    );
    
    const pageSize = await db.getFirstAsync<{ page_size: number }>(
      'PRAGMA page_size'
    );
    
    const sizeBytes = (pageCount?.page_count || 0) * (pageSize?.page_size || 0);
    const sizeMB = (sizeBytes / (1024 * 1024)).toFixed(2);
    
    return {
      messageCount: messageCount?.count || 0,
      chatCount: chatCount?.count || 0,
      participantCount: participantCount?.count || 0,
      databaseSize: `${sizeMB} MB`,
    };
  } catch (error) {
    console.error('Error getting database stats:', error);
    throw error;
  }
}

/**
 * Clear all data (keep tables)
 */
export async function clearAllData(): Promise<void> {
  if (!db) throw new Error('Database not initialized');
  
  try {
    await db.execAsync(`
      BEGIN TRANSACTION;
      DELETE FROM message_reactions;
      DELETE FROM typing_indicators;
      DELETE FROM drafts;
      DELETE FROM chat_participants;
      DELETE FROM messages;
      DELETE FROM chats;
      COMMIT;
    `);
    
    console.log('All data cleared');
  } catch (error) {
    console.error('Error clearing data:', error);
    throw error;
  }
}

