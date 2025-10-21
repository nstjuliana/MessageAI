/**
 * Chat Service Tests
 * Tests for chat and message CRUD operations
 */

import {
    collection,
    doc,
    getDoc,
    setDoc,
    updateDoc
} from 'firebase/firestore';

import {
    createChat,
    createMessage,
    createWelcomeChat,
    MESSAGE_AI_USER_ID,
} from '../chat.service';

// Mock firebase/firestore
jest.mock('firebase/firestore', () => ({
  collection: jest.fn(),
  doc: jest.fn(),
  getDoc: jest.fn(),
  setDoc: jest.fn(),
  updateDoc: jest.fn(),
  serverTimestamp: jest.fn(() => ({ _seconds: 1234567890, _nanoseconds: 0 })),
}));

// Mock firebase config
jest.mock('@/config/firebase', () => ({
  db: {},
}));

describe('Chat Service', () => {
  const mockDoc = doc as jest.MockedFunction<typeof doc>;
  const mockCollection = collection as jest.MockedFunction<typeof collection>;
  const mockGetDoc = getDoc as jest.MockedFunction<typeof getDoc>;
  const mockSetDoc = setDoc as jest.MockedFunction<typeof setDoc>;
  const mockUpdateDoc = updateDoc as jest.MockedFunction<typeof updateDoc>;

  beforeEach(() => {
    jest.clearAllMocks();

    // Default mock implementations
    mockDoc.mockReturnValue({ id: 'mock-id' } as any);
    mockCollection.mockReturnValue({} as any);
    mockSetDoc.mockResolvedValue(undefined);
    mockUpdateDoc.mockResolvedValue(undefined);
  });

  describe('createChat', () => {
    it('should create a DM chat successfully', async () => {
      const chatData = {
        type: 'dm' as const,
        participantIds: ['user1', 'user2'],
      };

      const chat = await createChat(chatData);

      expect(mockSetDoc).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          type: 'dm',
          participantIds: ['user1', 'user2'],
          adminIds: [],
          createdAt: expect.anything(),
          updatedAt: expect.anything(),
        })
      );

      expect(chat).toMatchObject({
        id: 'mock-id',
        type: 'dm',
        participantIds: ['user1', 'user2'],
      });
    });

    it('should create a group chat with name and avatar', async () => {
      const chatData = {
        type: 'group' as const,
        participantIds: ['user1', 'user2', 'user3'],
        groupName: 'Test Group',
        groupAvatarUrl: 'https://example.com/avatar.jpg',
        adminIds: ['user1'],
      };

      await createChat(chatData);

      expect(mockSetDoc).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          type: 'group',
          participantIds: ['user1', 'user2', 'user3'],
          groupName: 'Test Group',
          groupAvatarUrl: 'https://example.com/avatar.jpg',
          adminIds: ['user1'],
        })
      );
    });

    it('should not include undefined fields for DM chats', async () => {
      const chatData = {
        type: 'dm' as const,
        participantIds: ['user1', 'user2'],
        // groupName and groupAvatarUrl are undefined
      };

      await createChat(chatData);

      const setDocCall = mockSetDoc.mock.calls[0][1];
      expect(setDocCall).not.toHaveProperty('groupName');
      expect(setDocCall).not.toHaveProperty('groupAvatarUrl');
    });

    it('should throw error on failure', async () => {
      mockSetDoc.mockRejectedValueOnce(new Error('Firestore error'));

      const chatData = {
        type: 'dm' as const,
        participantIds: ['user1', 'user2'],
      };

      await expect(createChat(chatData)).rejects.toThrow();
    });
  });

  describe('createMessage', () => {
    beforeEach(() => {
      // Mock document references for chat and message
      mockDoc.mockImplementation((db, collection, ...args) => {
        if (args.length === 0) {
          // Creating new message document
          return { id: 'message-id' } as any;
        }
        // Updating chat document
        return { id: 'chat-id' } as any;
      });
    });

    it('should create a text message successfully', async () => {
      const messageData = {
        chatId: 'chat-123',
        senderId: 'user-456',
        text: 'Hello, world!',
      };

      const message = await createMessage(messageData);

      expect(mockSetDoc).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          chatId: 'chat-123',
          senderId: 'user-456',
          text: 'Hello, world!',
          status: 'sent',
          edited: false,
        })
      );

      expect(mockUpdateDoc).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          lastMessageId: 'message-id',
          lastMessageText: 'Hello, world!',
        })
      );

      expect(message).toMatchObject({
        id: 'message-id',
        chatId: 'chat-123',
        senderId: 'user-456',
        text: 'Hello, world!',
        status: 'sent',
      });
    });

    it('should create a media message successfully', async () => {
      const messageData = {
        chatId: 'chat-123',
        senderId: 'user-456',
        text: 'Check this out',
        mediaUrl: 'https://example.com/image.jpg',
        mediaMime: 'image/jpeg',
      };

      await createMessage(messageData);

      expect(mockSetDoc).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          text: 'Check this out',
          mediaUrl: 'https://example.com/image.jpg',
          mediaMime: 'image/jpeg',
        })
      );
    });

    it('should not include undefined fields for simple text messages', async () => {
      const messageData = {
        chatId: 'chat-123',
        senderId: 'user-456',
        text: 'Hello',
        // mediaUrl, mediaMime, replyToId are undefined
      };

      await createMessage(messageData);

      const setDocCall = mockSetDoc.mock.calls[0][1];
      expect(setDocCall).toHaveProperty('text', 'Hello');
      expect(setDocCall).not.toHaveProperty('mediaUrl');
      expect(setDocCall).not.toHaveProperty('mediaMime');
      expect(setDocCall).not.toHaveProperty('replyToId');
    });

    it('should create a reply message', async () => {
      const messageData = {
        chatId: 'chat-123',
        senderId: 'user-456',
        text: 'Replying to you',
        replyToId: 'original-message-id',
      };

      await createMessage(messageData);

      expect(mockSetDoc).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          text: 'Replying to you',
          replyToId: 'original-message-id',
        })
      );
    });

    it('should update chat metadata with last message', async () => {
      const messageData = {
        chatId: 'chat-123',
        senderId: 'user-456',
        text: 'Latest message',
      };

      await createMessage(messageData);

      expect(mockUpdateDoc).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          lastMessageId: 'message-id',
          lastMessageText: 'Latest message',
          lastMessageAt: expect.anything(),
          updatedAt: expect.anything(),
        })
      );
    });

    it('should use [Media] for media-only messages', async () => {
      const messageData = {
        chatId: 'chat-123',
        senderId: 'user-456',
        mediaUrl: 'https://example.com/video.mp4',
        mediaMime: 'video/mp4',
        // No text
      };

      await createMessage(messageData);

      expect(mockUpdateDoc).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          lastMessageText: '[Media]',
        })
      );
    });

    it('should throw error on message creation failure', async () => {
      mockSetDoc.mockRejectedValueOnce(new Error('Firestore error'));

      const messageData = {
        chatId: 'chat-123',
        senderId: 'user-456',
        text: 'Hello',
      };

      await expect(createMessage(messageData)).rejects.toThrow();
    });

    it('should throw error on chat update failure', async () => {
      mockSetDoc.mockResolvedValueOnce(undefined);
      mockUpdateDoc.mockRejectedValueOnce(new Error('Update failed'));

      const messageData = {
        chatId: 'chat-123',
        senderId: 'user-456',
        text: 'Hello',
      };

      await expect(createMessage(messageData)).rejects.toThrow();
    });
  });

  describe('createWelcomeChat', () => {
    beforeEach(() => {
      // Mock for checking if MessageAI user exists
      mockGetDoc.mockResolvedValue({
        exists: () => true,
        data: () => ({ displayName: 'MessageAI' }),
      } as any);

      // Mock for creating chat and message
      mockDoc.mockImplementation((db, collection, ...args) => {
        if (args.length === 0) {
          return { id: 'welcome-chat-id' } as any;
        }
        return { id: 'welcome-message-id' } as any;
      });

      mockSetDoc.mockResolvedValue(undefined);
      mockUpdateDoc.mockResolvedValue(undefined);
    });

    it('should create welcome chat successfully', async () => {
      await createWelcomeChat('user-123', 'John Doe');

      // Should create chat
      expect(mockSetDoc).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          type: 'dm',
          participantIds: ['user-123', MESSAGE_AI_USER_ID],
        })
      );

      // Should create welcome message
      const messageCall = mockSetDoc.mock.calls.find(
        call => (call[1] as any)?.senderId === MESSAGE_AI_USER_ID
      );
      expect(messageCall).toBeDefined();
      expect(messageCall![1]).toMatchObject({
        senderId: MESSAGE_AI_USER_ID,
      });
      const messageData = messageCall![1] as any;
      expect(messageData.text).toContain('Hi John Doe');
      expect(messageData.text).toContain('Welcome to MessageAI');
    });

    it('should create MessageAI user if it does not exist', async () => {
      mockGetDoc.mockResolvedValueOnce({
        exists: () => false,
      } as any);

      await createWelcomeChat('user-123', 'John Doe');

      // Should create MessageAI user
      expect(mockSetDoc).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          displayName: 'MessageAI',
          bio: 'Your AI messaging assistant',
          presence: 'online',
        })
      );

      // Should still create chat and message
      expect(mockSetDoc).toHaveBeenCalledTimes(3); // MessageAI user + chat + message
    });

    it('should not recreate MessageAI user if it already exists', async () => {
      mockGetDoc.mockResolvedValueOnce({
        exists: () => true,
      } as any);

      await createWelcomeChat('user-123', 'John Doe');

      // Should only create chat and message, not MessageAI user
      expect(mockSetDoc).toHaveBeenCalledTimes(2); // chat + message
    });

    it('should personalize welcome message with user name', async () => {
      await createWelcomeChat('user-456', 'Jane Smith');

      expect(mockSetDoc).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          text: expect.stringContaining('Hi Jane Smith'),
        })
      );
    });

    it('should throw error if welcome chat creation fails', async () => {
      mockSetDoc.mockRejectedValueOnce(new Error('Chat creation failed'));

      await expect(
        createWelcomeChat('user-123', 'John Doe')
      ).rejects.toThrow();
    });
  });

  describe('MESSAGE_AI_USER_ID', () => {
    it('should have a consistent system user ID', () => {
      expect(MESSAGE_AI_USER_ID).toBe('messageai-system');
    });
  });
});

