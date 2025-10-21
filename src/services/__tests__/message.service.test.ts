/**
 * Message Service Tests
 * Tests for message operations with optimistic UI
 */

// Mock Firestore
jest.mock('@/config/firebase', () => ({
  db: {},
}));

// Mock database
jest.mock('@/database/database', () => ({
  getDatabase: jest.fn(),
  executeStatement: jest.fn().mockResolvedValue({ changes: 1 }),
  executeTransaction: jest.fn(),
}));

// Mock Firestore functions
jest.mock('firebase/firestore', () => ({
  collection: jest.fn(),
  doc: jest.fn(() => ({ id: 'test-message-id' })),
  setDoc: jest.fn(),
  updateDoc: jest.fn(),
  serverTimestamp: jest.fn(() => 'TIMESTAMP'),
}));

// Import after mocks
import { executeStatement, getDatabase } from '@/database/database';
import type { CreateMessageData, Message } from '@/types/chat.types';
import * as messageService from '../message.service';

describe('Message Service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('sendMessageOptimistic', () => {
    it('should create a message with optimistic UI', async () => {
      const mockDatabase = {
        getAllAsync: jest.fn().mockResolvedValue([]),
        getFirstAsync: jest.fn().mockResolvedValue(null),
        runAsync: jest.fn().mockResolvedValue({ changes: 1, lastInsertRowId: 1 }),
      };
      
      (getDatabase as jest.Mock).mockReturnValue(mockDatabase);

      const messageData: CreateMessageData = {
        chatId: 'test-chat',
        senderId: 'test-user',
        text: 'Test message',
      };

      const result = await messageService.sendMessageOptimistic(messageData);

      expect(result).toBeDefined();
      expect(result.chatId).toBe('test-chat');
      expect(result.senderId).toBe('test-user');
      expect(result.text).toBe('Test message');
      expect(result.status).toBe('sending');
      expect(result.id).toContain('local_');
    });

    it('should generate unique local IDs', async () => {
      const mockDatabase = {
        getAllAsync: jest.fn().mockResolvedValue([]),
        getFirstAsync: jest.fn().mockResolvedValue(null),
        runAsync: jest.fn().mockResolvedValue({ changes: 1, lastInsertRowId: 1 }),
      };
      
      (getDatabase as jest.Mock).mockReturnValue(mockDatabase);

      const messageData: CreateMessageData = {
        chatId: 'test-chat',
        senderId: 'test-user',
        text: 'Test message',
      };

      const result1 = await messageService.sendMessageOptimistic(messageData);
      const result2 = await messageService.sendMessageOptimistic(messageData);

      expect(result1.id).not.toBe(result2.id);
      expect(result1.id).toContain('local_');
      expect(result2.id).toContain('local_');
    });
  });

  describe('getMessagesFromSQLite', () => {
    it('should retrieve messages from SQLite', async () => {
      const mockMessages = [
        {
          id: 'msg-1',
          chatId: 'test-chat',
          senderId: 'user-1',
          text: 'Hello',
          status: 'sent',
          createdAt: Date.now() - 1000,
          edited: 0,
        },
        {
          id: 'msg-2',
          chatId: 'test-chat',
          senderId: 'user-2',
          text: 'Hi',
          status: 'sent',
          createdAt: Date.now(),
          edited: 0,
        },
      ];

      const mockDatabase = {
        getAllAsync: jest.fn().mockResolvedValue([...mockMessages].reverse()),
      };
      
      (getDatabase as jest.Mock).mockReturnValue(mockDatabase);

      const result = await messageService.getMessagesFromSQLite('test-chat');

      expect(result).toHaveLength(2);
      expect(result[0].id).toBe('msg-1');
      expect(result[1].id).toBe('msg-2');
    });

    it('should return empty array on error', async () => {
      const mockDatabase = {
        getAllAsync: jest.fn().mockRejectedValue(new Error('Database error')),
      };
      
      (getDatabase as jest.Mock).mockReturnValue(mockDatabase);

      const result = await messageService.getMessagesFromSQLite('test-chat');

      expect(result).toEqual([]);
    });
  });

  describe('syncMessageToSQLite', () => {
    it('should insert new message if it does not exist', async () => {
      const mockDatabase = {
        getFirstAsync: jest.fn().mockResolvedValue(null),
      };
      
      (getDatabase as jest.Mock).mockReturnValue(mockDatabase);
      (executeStatement as jest.Mock).mockClear();

      const message: Message = {
        id: 'msg-1',
        chatId: 'test-chat',
        senderId: 'user-1',
        text: 'Hello',
        status: 'sent',
        edited: false,
        createdAt: Date.now(),
      };

      await messageService.syncMessageToSQLite(message);

      expect(mockDatabase.getFirstAsync).toHaveBeenCalled();
      expect(executeStatement).toHaveBeenCalled();
    });

    it('should update existing message if it exists', async () => {
      const mockDatabase = {
        getFirstAsync: jest.fn().mockResolvedValue({ id: 'msg-1' }),
      };
      
      (getDatabase as jest.Mock).mockReturnValue(mockDatabase);
      (executeStatement as jest.Mock).mockClear();

      const message: Message = {
        id: 'msg-1',
        chatId: 'test-chat',
        senderId: 'user-1',
        text: 'Updated message',
        status: 'sent',
        edited: true,
        createdAt: Date.now(),
      };

      await messageService.syncMessageToSQLite(message);

      expect(mockDatabase.getFirstAsync).toHaveBeenCalled();
      expect(executeStatement).toHaveBeenCalled();
    });
  });

  describe('getFailedMessages', () => {
    it('should retrieve failed messages', async () => {
      const mockMessages = [
        {
          id: 'msg-1',
          chatId: 'test-chat',
          senderId: 'user-1',
          text: 'Failed message',
          status: 'failed',
          createdAt: Date.now(),
          edited: 0,
          retryCount: 2,
        },
      ];

      const mockDatabase = {
        getAllAsync: jest.fn().mockResolvedValue(mockMessages),
      };
      
      (getDatabase as jest.Mock).mockReturnValue(mockDatabase);

      const result = await messageService.getFailedMessages();

      expect(result).toHaveLength(1);
      expect(result[0].status).toBe('failed');
    });
  });

  describe('getQueuedMessages', () => {
    it('should retrieve queued messages', async () => {
      const mockMessages = [
        {
          id: 'msg-1',
          chatId: 'test-chat',
          senderId: 'user-1',
          text: 'Queued message',
          status: 'sending',
          createdAt: Date.now(),
          edited: 0,
          queuedAt: Date.now(),
          retryCount: 0,
        },
      ];

      const mockDatabase = {
        getAllAsync: jest.fn().mockResolvedValue(mockMessages),
      };
      
      (getDatabase as jest.Mock).mockReturnValue(mockDatabase);

      const result = await messageService.getQueuedMessages();

      expect(result).toHaveLength(1);
      expect(result[0].status).toBe('sending');
    });
  });
});

