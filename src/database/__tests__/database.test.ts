/**
 * Database Tests
 * Tests for SQLite database initialization and operations
 */

import * as SQLite from 'expo-sqlite';
import {
    clearAllData,
    closeDatabase,
    dropAllTables,
    executeQuery,
    executeQueryFirst,
    executeStatement,
    executeTransaction,
    getDatabase,
    getDatabaseStats,
    initDatabase,
} from '../database';

// Mock expo-sqlite
jest.mock('expo-sqlite', () => ({
  openDatabaseAsync: jest.fn(),
}));

describe('Database Module', () => {
  let mockDb: any;

  beforeEach(() => {
    // Reset all mocks
    jest.clearAllMocks();

    // Create mock database instance
    mockDb = {
      execAsync: jest.fn().mockResolvedValue(undefined),
      getFirstAsync: jest.fn(),
      getAllAsync: jest.fn(),
      runAsync: jest.fn(),
      closeAsync: jest.fn().mockResolvedValue(undefined),
    };

    // Mock openDatabaseAsync to return our mock db
    (SQLite.openDatabaseAsync as jest.Mock).mockResolvedValue(mockDb);
  });

  afterEach(async () => {
    // Clean up after each test
    try {
      await closeDatabase();
    } catch (error) {
      // Ignore errors in cleanup
    }
  });

  describe('initDatabase', () => {
    it('should initialize database successfully on first run', async () => {
      // Mock database version as 0 (first run)
      mockDb.getFirstAsync.mockResolvedValueOnce({ user_version: 0 });

      const db = await initDatabase();

      expect(SQLite.openDatabaseAsync).toHaveBeenCalledWith('messageai.db');
      expect(mockDb.getFirstAsync).toHaveBeenCalledWith('PRAGMA user_version');
      expect(mockDb.execAsync).toHaveBeenCalled();
      expect(db).toBe(mockDb);
    });

    it('should skip initialization if database is already initialized', async () => {
      // First initialization
      mockDb.getFirstAsync.mockResolvedValueOnce({ user_version: 0 });
      await initDatabase();

      // Reset mock call counts
      jest.clearAllMocks();

      // Second initialization
      const db = await initDatabase();

      // Should not open database again
      expect(SQLite.openDatabaseAsync).not.toHaveBeenCalled();
      expect(db).toBe(mockDb);
    });

    it('should handle migration when version is lower than current', async () => {
      // Mock database version as 0 (needs migration to version 1)
      mockDb.getFirstAsync.mockResolvedValueOnce({ user_version: 0 });

      await initDatabase();

      // Should have created tables
      expect(mockDb.execAsync).toHaveBeenCalled();
      // Should have set version
      expect(mockDb.execAsync).toHaveBeenCalledWith(expect.stringContaining('PRAGMA user_version'));
    });

    it('should skip migration if database is up to date', async () => {
      // Mock database version as current version
      mockDb.getFirstAsync.mockResolvedValueOnce({ user_version: 1 });

      await initDatabase();

      // Should have checked version
      expect(mockDb.getFirstAsync).toHaveBeenCalledWith('PRAGMA user_version');
      // Should not have created tables (only on version 0)
      const execCalls = (mockDb.execAsync as jest.Mock).mock.calls;
      const hasTableCreation = execCalls.some(call => 
        call[0].includes('CREATE TABLE')
      );
      expect(hasTableCreation).toBe(false);
    });

    it('should throw error if initialization fails', async () => {
      // Ensure database is closed before this test
      await closeDatabase();
      
      // Mock openDatabaseAsync to reject
      (SQLite.openDatabaseAsync as jest.Mock).mockRejectedValueOnce(new Error('Database error'));

      await expect(initDatabase()).rejects.toThrow('Database initialization failed');
    });
  });

  describe('getDatabase', () => {
    it('should return database instance after initialization', async () => {
      mockDb.getFirstAsync.mockResolvedValueOnce({ user_version: 0 });
      await initDatabase();

      const db = getDatabase();

      expect(db).toBe(mockDb);
    });

    it('should throw error if database not initialized', async () => {
      // Close database first
      await closeDatabase();

      expect(() => getDatabase()).toThrow('Database not initialized');
    });
  });

  describe('executeQuery', () => {
    beforeEach(async () => {
      mockDb.getFirstAsync.mockResolvedValueOnce({ user_version: 0 });
      await initDatabase();
    });

    it('should execute SELECT query and return results', async () => {
      const mockResults = [
        { id: '1', text: 'Hello' },
        { id: '2', text: 'World' },
      ];
      mockDb.getAllAsync.mockResolvedValueOnce(mockResults);

      const results = await executeQuery('SELECT * FROM messages');

      expect(mockDb.getAllAsync).toHaveBeenCalledWith('SELECT * FROM messages', []);
      expect(results).toEqual(mockResults);
    });

    it('should execute query with parameters', async () => {
      const mockResults = [{ id: '1', text: 'Hello' }];
      mockDb.getAllAsync.mockResolvedValueOnce(mockResults);

      const results = await executeQuery('SELECT * FROM messages WHERE id = ?', ['1']);

      expect(mockDb.getAllAsync).toHaveBeenCalledWith(
        'SELECT * FROM messages WHERE id = ?',
        ['1']
      );
      expect(results).toEqual(mockResults);
    });

    it('should handle empty results', async () => {
      mockDb.getAllAsync.mockResolvedValueOnce([]);

      const results = await executeQuery('SELECT * FROM messages WHERE id = ?', ['999']);

      expect(results).toEqual([]);
    });

    it('should throw error on query failure', async () => {
      mockDb.getAllAsync.mockRejectedValueOnce(new Error('Query failed'));

      await expect(
        executeQuery('SELECT * FROM invalid_table')
      ).rejects.toThrow('Query failed');
    });
  });

  describe('executeQueryFirst', () => {
    beforeEach(async () => {
      mockDb.getFirstAsync.mockResolvedValueOnce({ user_version: 0 });
      await initDatabase();
      jest.clearAllMocks();
    });

    it('should execute query and return first result', async () => {
      const mockResult = { id: '1', text: 'Hello' };
      mockDb.getFirstAsync.mockResolvedValueOnce(mockResult);

      const result = await executeQueryFirst('SELECT * FROM messages WHERE id = ?', ['1']);

      expect(mockDb.getFirstAsync).toHaveBeenCalledWith(
        'SELECT * FROM messages WHERE id = ?',
        ['1']
      );
      expect(result).toEqual(mockResult);
    });

    it('should return null if no results found', async () => {
      mockDb.getFirstAsync.mockResolvedValueOnce(null);

      const result = await executeQueryFirst('SELECT * FROM messages WHERE id = ?', ['999']);

      expect(result).toBeNull();
    });

    it('should throw error on query failure', async () => {
      mockDb.getFirstAsync.mockRejectedValueOnce(new Error('Query failed'));

      await expect(
        executeQueryFirst('SELECT * FROM invalid_table')
      ).rejects.toThrow('Query failed');
    });
  });

  describe('executeStatement', () => {
    beforeEach(async () => {
      mockDb.getFirstAsync.mockResolvedValueOnce({ user_version: 0 });
      await initDatabase();
    });

    it('should execute INSERT statement', async () => {
      const mockResult = { changes: 1, lastInsertRowId: 1 };
      mockDb.runAsync.mockResolvedValueOnce(mockResult);

      const result = await executeStatement(
        'INSERT INTO messages (id, chatId, senderId, text) VALUES (?, ?, ?, ?)',
        ['1', 'chat1', 'user1', 'Hello']
      );

      expect(mockDb.runAsync).toHaveBeenCalledWith(
        'INSERT INTO messages (id, chatId, senderId, text) VALUES (?, ?, ?, ?)',
        ['1', 'chat1', 'user1', 'Hello']
      );
      expect(result).toEqual(mockResult);
    });

    it('should execute UPDATE statement', async () => {
      const mockResult = { changes: 1, lastInsertRowId: 0 };
      mockDb.runAsync.mockResolvedValueOnce(mockResult);

      const result = await executeStatement(
        'UPDATE messages SET text = ? WHERE id = ?',
        ['Updated text', '1']
      );

      expect(result).toEqual(mockResult);
    });

    it('should execute DELETE statement', async () => {
      const mockResult = { changes: 1, lastInsertRowId: 0 };
      mockDb.runAsync.mockResolvedValueOnce(mockResult);

      const result = await executeStatement('DELETE FROM messages WHERE id = ?', ['1']);

      expect(result).toEqual(mockResult);
    });

    it('should throw error on statement failure', async () => {
      mockDb.runAsync.mockRejectedValueOnce(new Error('Statement failed'));

      await expect(
        executeStatement('INSERT INTO invalid_table VALUES (?)', ['test'])
      ).rejects.toThrow('Statement failed');
    });
  });

  describe('executeTransaction', () => {
    beforeEach(async () => {
      mockDb.getFirstAsync.mockResolvedValueOnce({ user_version: 0 });
      await initDatabase();
    });

    it('should execute multiple statements in a transaction', async () => {
      mockDb.runAsync.mockResolvedValue({ changes: 1, lastInsertRowId: 1 });

      const statements = [
        { sql: 'INSERT INTO messages (id, text) VALUES (?, ?)', params: ['1', 'Hello'] },
        { sql: 'INSERT INTO messages (id, text) VALUES (?, ?)', params: ['2', 'World'] },
      ];

      await executeTransaction(statements);

      expect(mockDb.execAsync).toHaveBeenCalledWith('BEGIN TRANSACTION');
      expect(mockDb.runAsync).toHaveBeenCalledTimes(2);
      expect(mockDb.execAsync).toHaveBeenCalledWith('COMMIT');
    });

    it('should rollback transaction on error', async () => {
      mockDb.runAsync
        .mockResolvedValueOnce({ changes: 1, lastInsertRowId: 1 })
        .mockRejectedValueOnce(new Error('Statement failed'));

      const statements = [
        { sql: 'INSERT INTO messages (id, text) VALUES (?, ?)', params: ['1', 'Hello'] },
        { sql: 'INSERT INTO messages (id, text) VALUES (?, ?)', params: ['2', 'World'] },
      ];

      await expect(executeTransaction(statements)).rejects.toThrow('Statement failed');

      expect(mockDb.execAsync).toHaveBeenCalledWith('BEGIN TRANSACTION');
      expect(mockDb.execAsync).toHaveBeenCalledWith('ROLLBACK');
    });

    it('should handle statements without parameters', async () => {
      mockDb.runAsync.mockResolvedValue({ changes: 1, lastInsertRowId: 1 });

      const statements = [
        { sql: 'DELETE FROM messages' },
        { sql: 'DELETE FROM chats' },
      ];

      await executeTransaction(statements);

      expect(mockDb.runAsync).toHaveBeenCalledWith('DELETE FROM messages', []);
      expect(mockDb.runAsync).toHaveBeenCalledWith('DELETE FROM chats', []);
      expect(mockDb.execAsync).toHaveBeenCalledWith('COMMIT');
    });
  });

  describe('getDatabaseStats', () => {
    beforeEach(async () => {
      mockDb.getFirstAsync.mockResolvedValueOnce({ user_version: 0 });
      await initDatabase();
      jest.clearAllMocks();
    });

    it('should return database statistics', async () => {
      // Mock count queries
      mockDb.getFirstAsync
        .mockResolvedValueOnce({ count: 10 }) // message count
        .mockResolvedValueOnce({ count: 3 }) // chat count
        .mockResolvedValueOnce({ count: 5 }) // participant count
        .mockResolvedValueOnce({ page_count: 100 }) // page count
        .mockResolvedValueOnce({ page_size: 4096 }); // page size

      const stats = await getDatabaseStats();

      expect(stats).toEqual({
        messageCount: 10,
        chatCount: 3,
        participantCount: 5,
        databaseSize: '0.39 MB', // (100 * 4096) / (1024 * 1024)
      });
    });

    it('should handle zero counts', async () => {
      mockDb.getFirstAsync
        .mockResolvedValueOnce({ count: 0 })
        .mockResolvedValueOnce({ count: 0 })
        .mockResolvedValueOnce({ count: 0 })
        .mockResolvedValueOnce({ page_count: 0 })
        .mockResolvedValueOnce({ page_size: 4096 });

      const stats = await getDatabaseStats();

      expect(stats.messageCount).toBe(0);
      expect(stats.chatCount).toBe(0);
      expect(stats.participantCount).toBe(0);
      expect(stats.databaseSize).toBe('0.00 MB');
    });

    it('should throw error on failure', async () => {
      mockDb.getFirstAsync.mockRejectedValueOnce(new Error('Stats query failed'));

      await expect(getDatabaseStats()).rejects.toThrow('Stats query failed');
    });
  });

  describe('clearAllData', () => {
    beforeEach(async () => {
      mockDb.getFirstAsync.mockResolvedValueOnce({ user_version: 0 });
      await initDatabase();
    });

    it('should clear all data from tables', async () => {
      await clearAllData();

      expect(mockDb.execAsync).toHaveBeenCalledWith(
        expect.stringContaining('DELETE FROM')
      );
      expect(mockDb.execAsync).toHaveBeenCalledWith(
        expect.stringContaining('BEGIN TRANSACTION')
      );
      expect(mockDb.execAsync).toHaveBeenCalledWith(
        expect.stringContaining('COMMIT')
      );
    });

    it('should throw error on failure', async () => {
      mockDb.execAsync.mockRejectedValueOnce(new Error('Clear failed'));

      await expect(clearAllData()).rejects.toThrow('Clear failed');
    });
  });

  describe('dropAllTables', () => {
    beforeEach(async () => {
      mockDb.getFirstAsync.mockResolvedValueOnce({ user_version: 0 });
      await initDatabase();
    });

    it('should drop all tables', async () => {
      await dropAllTables();

      expect(mockDb.execAsync).toHaveBeenCalledWith(
        expect.stringContaining('DROP TABLE')
      );
      expect(mockDb.execAsync).toHaveBeenCalledWith(
        expect.stringContaining('BEGIN TRANSACTION')
      );
    });

    it('should reset database version to 0', async () => {
      await dropAllTables();

      expect(mockDb.execAsync).toHaveBeenCalledWith('PRAGMA user_version = 0');
    });

    it('should throw error on failure', async () => {
      mockDb.execAsync.mockRejectedValueOnce(new Error('Drop failed'));

      await expect(dropAllTables()).rejects.toThrow('Drop failed');
    });
  });

  describe('closeDatabase', () => {
    beforeEach(async () => {
      mockDb.getFirstAsync.mockResolvedValueOnce({ user_version: 0 });
      await initDatabase();
    });

    it('should close database connection', async () => {
      await closeDatabase();

      expect(mockDb.closeAsync).toHaveBeenCalled();
    });

    it('should handle close when database is not initialized', async () => {
      await closeDatabase(); // Close once
      await closeDatabase(); // Try to close again

      // Should not throw error
      expect(mockDb.closeAsync).toHaveBeenCalledTimes(1);
    });

    it('should throw error if close fails', async () => {
      mockDb.closeAsync.mockRejectedValueOnce(new Error('Close failed'));

      await expect(closeDatabase()).rejects.toThrow('Close failed');
    });
  });

  describe('Error handling', () => {
    it('should throw error when querying uninitialized database', async () => {
      await expect(executeQuery('SELECT * FROM messages')).rejects.toThrow(
        'Database not initialized'
      );
    });

    it('should throw error when executing statement on uninitialized database', async () => {
      await expect(
        executeStatement('INSERT INTO messages VALUES (?)', ['test'])
      ).rejects.toThrow('Database not initialized');
    });

    it('should throw error when executing transaction on uninitialized database', async () => {
      await expect(
        executeTransaction([{ sql: 'INSERT INTO messages VALUES (?)', params: ['test'] }])
      ).rejects.toThrow('Database not initialized');
    });
  });
});

