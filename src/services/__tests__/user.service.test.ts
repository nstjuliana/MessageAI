/**
 * User Service Tests
 */

import { db } from '@/config/firebase';
import type { CreateUserData, UpdateUserData, UserPresence } from '@/types/user.types';
import {
    collection,
    deleteDoc,
    doc,
    getDoc,
    getDocs,
    onSnapshot,
    serverTimestamp,
    setDoc,
    Timestamp,
    updateDoc,
} from 'firebase/firestore';
import {
    addDeviceToken,
    createUser,
    deleteUser,
    getPublicProfile,
    getUserById,
    getUsersByIds,
    onUserSnapshot,
    onUsersPresenceSnapshot,
    removeDeviceToken,
    searchUsers,
    updateLastSeen,
    updatePresence,
    updateUser,
} from '../user.service';

// Mock the firebase config module
jest.mock('@/config/firebase', () => ({
  db: {},
}));

// Mock Firestore functions
jest.mock('firebase/firestore', () => {
  const actual = jest.requireActual('firebase/firestore');
  return {
    ...actual,
    doc: jest.fn(),
    collection: jest.fn(),
    getDoc: jest.fn(),
    getDocs: jest.fn(),
    setDoc: jest.fn(),
    updateDoc: jest.fn(),
    deleteDoc: jest.fn(),
    onSnapshot: jest.fn(),
    serverTimestamp: jest.fn(),
    query: jest.fn(),
    where: jest.fn(),
    limit: jest.fn(),
    Timestamp: {
      fromMillis: (millis: number) => ({
        toMillis: () => millis,
        seconds: Math.floor(millis / 1000),
        nanoseconds: (millis % 1000) * 1000000,
      }),
    },
  };
});

const mockDoc = doc as jest.MockedFunction<typeof doc>;
const mockCollection = collection as jest.MockedFunction<typeof collection>;
const mockGetDoc = getDoc as jest.MockedFunction<typeof getDoc>;
const mockGetDocs = getDocs as jest.MockedFunction<typeof getDocs>;
const mockSetDoc = setDoc as jest.MockedFunction<typeof setDoc>;
const mockUpdateDoc = updateDoc as jest.MockedFunction<typeof updateDoc>;
const mockDeleteDoc = deleteDoc as jest.MockedFunction<typeof deleteDoc>;
const mockOnSnapshot = onSnapshot as jest.MockedFunction<typeof onSnapshot>;
const mockServerTimestamp = serverTimestamp as jest.MockedFunction<typeof serverTimestamp>;

describe('User Service', () => {
  const mockUserId = 'test-user-123';
  const mockTimestamp = 1635000000000;

  beforeEach(() => {
    jest.clearAllMocks();
    jest.resetAllMocks();
    
    // Mock serverTimestamp to return a mock timestamp
    mockServerTimestamp.mockReturnValue({ 
      _methodName: 'serverTimestamp' 
    } as any);

    // Mock Date.now for consistent timestamps
    jest.spyOn(Date, 'now').mockReturnValue(mockTimestamp);
    
    // Default mock for doc - can be overridden in individual tests
    mockDoc.mockImplementation((db, collection, id) => ({ 
      id, 
      path: `${collection}/${id}` 
    } as any));
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('createUser', () => {
    it('should create a new user successfully', async () => {
      const userData: CreateUserData = {
        displayName: 'Test User',
        email: 'test@example.com',
        phoneNumber: '+1234567890',
        avatarUrl: 'https://example.com/avatar.jpg',
        bio: 'Test bio',
      };

      mockDoc.mockReturnValue({ id: mockUserId } as any);
      mockSetDoc.mockResolvedValue(undefined);

      const result = await createUser(mockUserId, userData);

      expect(mockDoc).toHaveBeenCalledWith(db, 'users', mockUserId);
      expect(mockSetDoc).toHaveBeenCalled();
      expect(result).toEqual({
        id: mockUserId,
        displayName: userData.displayName,
        email: userData.email,
        phoneNumber: userData.phoneNumber,
        avatarUrl: userData.avatarUrl,
        bio: userData.bio,
        lastSeen: mockTimestamp,
        presence: 'online',
        deviceTokens: [],
        createdAt: mockTimestamp,
        updatedAt: mockTimestamp,
      });
    });

    it('should create user with empty bio if not provided', async () => {
      const userData: CreateUserData = {
        displayName: 'Test User',
        email: 'test@example.com',
      };

      mockDoc.mockReturnValue({ id: mockUserId } as any);
      mockSetDoc.mockResolvedValue(undefined);

      const result = await createUser(mockUserId, userData);

      expect(result.bio).toBe('');
    });

    it('should throw error if user creation fails', async () => {
      const userData: CreateUserData = {
        displayName: 'Test User',
        email: 'test@example.com',
      };

      mockDoc.mockReturnValue({ id: mockUserId } as any);
      mockSetDoc.mockRejectedValue(new Error('Firestore error'));

      await expect(createUser(mockUserId, userData)).rejects.toThrow(
        'Failed to create user profile. Please try again.'
      );
    });
  });

  describe('getUserById', () => {
    it('should fetch a user by ID successfully', async () => {
      const mockUserData = {
        displayName: 'Test User',
        email: 'test@example.com',
        phoneNumber: '+1234567890',
        avatarUrl: 'https://example.com/avatar.jpg',
        bio: 'Test bio',
        lastSeen: Timestamp.fromMillis(mockTimestamp),
        presence: 'online' as UserPresence,
        deviceTokens: ['token1', 'token2'],
        createdAt: Timestamp.fromMillis(mockTimestamp),
        updatedAt: Timestamp.fromMillis(mockTimestamp),
      };

      mockDoc.mockReturnValue({ id: mockUserId } as any);
      mockGetDoc.mockResolvedValue({
        exists: () => true,
        data: () => mockUserData,
        id: mockUserId,
      } as any);

      const result = await getUserById(mockUserId);

      expect(mockDoc).toHaveBeenCalledWith(db, 'users', mockUserId);
      expect(result).toEqual({
        id: mockUserId,
        displayName: mockUserData.displayName,
        email: mockUserData.email,
        phoneNumber: mockUserData.phoneNumber,
        avatarUrl: mockUserData.avatarUrl,
        bio: mockUserData.bio,
        lastSeen: mockTimestamp,
        presence: mockUserData.presence,
        deviceTokens: mockUserData.deviceTokens,
        createdAt: mockTimestamp,
        updatedAt: mockTimestamp,
      });
    });

    it('should return null if user does not exist', async () => {
      mockDoc.mockReturnValue({ id: mockUserId } as any);
      mockGetDoc.mockResolvedValue({
        exists: () => false,
      } as any);

      const result = await getUserById(mockUserId);

      expect(result).toBeNull();
    });

    it('should throw error if fetching user fails', async () => {
      mockDoc.mockReturnValue({ id: mockUserId } as any);
      mockGetDoc.mockRejectedValue(new Error('Firestore error'));

      await expect(getUserById(mockUserId)).rejects.toThrow(
        'Failed to fetch user profile.'
      );
    });
  });

  describe('getPublicProfile', () => {
    it('should fetch public profile successfully', async () => {
      const mockUserData = {
        displayName: 'Test User',
        email: 'test@example.com',
        phoneNumber: '+1234567890',
        avatarUrl: 'https://example.com/avatar.jpg',
        bio: 'Test bio',
        lastSeen: Timestamp.fromMillis(mockTimestamp),
        presence: 'online' as UserPresence,
        deviceTokens: ['token1', 'token2'],
        createdAt: Timestamp.fromMillis(mockTimestamp),
        updatedAt: Timestamp.fromMillis(mockTimestamp),
      };

      mockDoc.mockReturnValue({ id: mockUserId } as any);
      mockGetDoc.mockResolvedValue({
        exists: () => true,
        data: () => mockUserData,
        id: mockUserId,
      } as any);

      const result = await getPublicProfile(mockUserId);

      expect(result).toEqual({
        id: mockUserId,
        displayName: mockUserData.displayName,
        avatarUrl: mockUserData.avatarUrl,
        bio: mockUserData.bio,
        presence: mockUserData.presence,
        lastSeen: mockTimestamp,
      });
      // Ensure sensitive data is not included
      expect(result).not.toHaveProperty('email');
      expect(result).not.toHaveProperty('phoneNumber');
      expect(result).not.toHaveProperty('deviceTokens');
    });

    it('should return null if user does not exist', async () => {
      mockDoc.mockReturnValue({ id: mockUserId } as any);
      mockGetDoc.mockResolvedValue({
        exists: () => false,
      } as any);

      const result = await getPublicProfile(mockUserId);

      expect(result).toBeNull();
    });
  });

  describe('getUsersByIds', () => {
    it('should fetch multiple users by IDs', async () => {
      const userIds = ['user1', 'user2', 'user3'];
      const mockUserData = {
        displayName: 'Test User',
        email: 'test@example.com',
        lastSeen: Timestamp.fromMillis(mockTimestamp),
        presence: 'online' as UserPresence,
        deviceTokens: [],
        createdAt: Timestamp.fromMillis(mockTimestamp),
        updatedAt: Timestamp.fromMillis(mockTimestamp),
        bio: '',
      };

      mockDoc.mockReturnValue({ id: 'user1' } as any);
      mockGetDoc.mockResolvedValue({
        exists: () => true,
        data: () => mockUserData,
      } as any);

      const result = await getUsersByIds(userIds);

      expect(result).toHaveLength(3);
      expect(mockGetDoc).toHaveBeenCalledTimes(3);
    });

    it('should return empty array if no user IDs provided', async () => {
      const result = await getUsersByIds([]);

      expect(result).toEqual([]);
      expect(mockGetDoc).not.toHaveBeenCalled();
    });

    it('should filter out non-existent users', async () => {
      const userIds = ['user1', 'user2'];
      
      mockDoc
        .mockReturnValueOnce({ id: 'user1' } as any)
        .mockReturnValueOnce({ id: 'user2' } as any);
      
      mockGetDoc
        .mockResolvedValueOnce({
          exists: () => true,
          data: () => ({
            displayName: 'User 1',
            lastSeen: Timestamp.fromMillis(mockTimestamp),
            presence: 'online',
            deviceTokens: [],
            createdAt: Timestamp.fromMillis(mockTimestamp),
            updatedAt: Timestamp.fromMillis(mockTimestamp),
            bio: '',
          }),
        } as any)
        .mockResolvedValueOnce({
          exists: () => false,
        } as any);

      const result = await getUsersByIds(userIds);

      expect(result).toHaveLength(1);
    });
  });

  describe('updateUser', () => {
    it('should update user successfully', async () => {
      const updateData: UpdateUserData = {
        displayName: 'Updated Name',
        bio: 'Updated bio',
      };

      mockDoc.mockReturnValue({ id: mockUserId } as any);
      mockUpdateDoc.mockResolvedValue(undefined);

      await updateUser(mockUserId, updateData);

      expect(mockDoc).toHaveBeenCalledWith(db, 'users', mockUserId);
      expect(mockUpdateDoc).toHaveBeenCalled();
    });

    it('should throw error if update fails', async () => {
      const updateData: UpdateUserData = {
        displayName: 'Updated Name',
      };

      mockDoc.mockReturnValue({ id: mockUserId } as any);
      mockUpdateDoc.mockRejectedValue(new Error('Firestore error'));

      await expect(updateUser(mockUserId, updateData)).rejects.toThrow(
        'Failed to update user profile.'
      );
    });
  });

  describe('updatePresence', () => {
    it('should update presence to online', async () => {
      mockDoc.mockReturnValue({ id: mockUserId } as any);
      mockUpdateDoc.mockResolvedValue(undefined);

      await updatePresence(mockUserId, 'online');

      expect(mockUpdateDoc).toHaveBeenCalled();
    });

    it('should update presence to offline', async () => {
      mockDoc.mockReturnValue({ id: mockUserId } as any);
      mockUpdateDoc.mockResolvedValue(undefined);

      await updatePresence(mockUserId, 'offline');

      expect(mockUpdateDoc).toHaveBeenCalled();
    });

    it('should not throw error if update fails (fail silently)', async () => {
      mockDoc.mockReturnValue({ id: mockUserId } as any);
      mockUpdateDoc.mockRejectedValue(new Error('Firestore error'));

      await expect(updatePresence(mockUserId, 'online')).resolves.not.toThrow();
    });
  });

  describe('updateLastSeen', () => {
    it('should update last seen timestamp', async () => {
      mockDoc.mockReturnValue({ id: mockUserId } as any);
      mockUpdateDoc.mockResolvedValue(undefined);

      await updateLastSeen(mockUserId);

      expect(mockUpdateDoc).toHaveBeenCalled();
    });

    it('should not throw error if update fails (fail silently)', async () => {
      mockDoc.mockReturnValue({ id: mockUserId } as any);
      mockUpdateDoc.mockRejectedValue(new Error('Firestore error'));

      await expect(updateLastSeen(mockUserId)).resolves.not.toThrow();
    });
  });

  describe('addDeviceToken', () => {
    it('should add device token successfully', async () => {
      const deviceToken = 'new-token-123';
      
      // Mock getUserById call first
      mockDoc.mockReturnValue({ id: mockUserId } as any);
      mockGetDoc.mockResolvedValueOnce({
        exists: () => true,
        data: () => ({
          displayName: 'Test User',
          email: 'test@example.com',
          lastSeen: Timestamp.fromMillis(mockTimestamp),
          presence: 'online',
          deviceTokens: ['existing-token'],
          createdAt: Timestamp.fromMillis(mockTimestamp),
          updatedAt: Timestamp.fromMillis(mockTimestamp),
          bio: '',
        }),
      } as any);
      
      mockUpdateDoc.mockResolvedValue(undefined);

      await addDeviceToken(mockUserId, deviceToken);

      expect(mockUpdateDoc).toHaveBeenCalled();
    });

    it('should not add duplicate token', async () => {
      const deviceToken = 'existing-token';
      
      mockDoc.mockReturnValue({ id: mockUserId } as any);
      mockGetDoc.mockResolvedValueOnce({
        exists: () => true,
        data: () => ({
          displayName: 'Test User',
          email: 'test@example.com',
          lastSeen: Timestamp.fromMillis(mockTimestamp),
          presence: 'online',
          deviceTokens: ['existing-token'],
          createdAt: Timestamp.fromMillis(mockTimestamp),
          updatedAt: Timestamp.fromMillis(mockTimestamp),
          bio: '',
        }),
      } as any);

      await addDeviceToken(mockUserId, deviceToken);

      expect(mockUpdateDoc).not.toHaveBeenCalled();
    });

    it('should throw error if user not found', async () => {
      mockDoc.mockReturnValue({ id: mockUserId } as any);
      mockGetDoc.mockResolvedValue({
        exists: () => false,
      } as any);

      await expect(addDeviceToken(mockUserId, 'token')).rejects.toThrow(
        'Failed to register device for notifications.'
      );
    });
  });

  describe('removeDeviceToken', () => {
    it('should remove device token successfully', async () => {
      const deviceToken = 'token-to-remove';
      
      mockDoc.mockReturnValue({ id: mockUserId } as any);
      mockGetDoc.mockResolvedValueOnce({
        exists: () => true,
        data: () => ({
          displayName: 'Test User',
          email: 'test@example.com',
          lastSeen: Timestamp.fromMillis(mockTimestamp),
          presence: 'online',
          deviceTokens: ['token-to-remove', 'other-token'],
          createdAt: Timestamp.fromMillis(mockTimestamp),
          updatedAt: Timestamp.fromMillis(mockTimestamp),
          bio: '',
        }),
      } as any);
      
      mockUpdateDoc.mockResolvedValue(undefined);

      await removeDeviceToken(mockUserId, deviceToken);

      expect(mockUpdateDoc).toHaveBeenCalled();
    });

    it('should not throw error if removal fails (fail silently)', async () => {
      mockDoc.mockReturnValue({ id: mockUserId } as any);
      mockGetDoc.mockResolvedValue({
        exists: () => false,
      } as any);

      await expect(removeDeviceToken(mockUserId, 'token')).resolves.not.toThrow();
    });
  });

  describe('searchUsers', () => {
    it('should search users by display name', async () => {
      const searchQuery = 'Test';
      const mockUsers = [
        {
          displayName: 'Test User 1',
          email: 'test1@example.com',
          lastSeen: Timestamp.fromMillis(mockTimestamp),
          presence: 'online' as UserPresence,
          deviceTokens: [],
          createdAt: Timestamp.fromMillis(mockTimestamp),
          updatedAt: Timestamp.fromMillis(mockTimestamp),
          bio: '',
        },
        {
          displayName: 'Test User 2',
          email: 'test2@example.com',
          lastSeen: Timestamp.fromMillis(mockTimestamp),
          presence: 'offline' as UserPresence,
          deviceTokens: [],
          createdAt: Timestamp.fromMillis(mockTimestamp),
          updatedAt: Timestamp.fromMillis(mockTimestamp),
          bio: '',
        },
      ];

      mockCollection.mockReturnValue({} as any);
      mockGetDocs.mockResolvedValue({
        forEach: (callback: any) => {
          mockUsers.forEach((userData, index) => {
            callback({
              id: `user${index + 1}`,
              data: () => userData,
            });
          });
        },
      } as any);

      const result = await searchUsers(searchQuery);

      expect(result).toHaveLength(2);
      expect(result[0].displayName).toBe('Test User 1');
      expect(result[1].displayName).toBe('Test User 2');
    });

    it('should return empty array for empty search query', async () => {
      const result = await searchUsers('');

      expect(result).toEqual([]);
      expect(mockGetDocs).not.toHaveBeenCalled();
    });

    it('should return empty array for whitespace query', async () => {
      const result = await searchUsers('   ');

      expect(result).toEqual([]);
      expect(mockGetDocs).not.toHaveBeenCalled();
    });
  });

  describe('onUserSnapshot', () => {
    it('should listen to user changes', () => {
      const callback = jest.fn();
      const mockUnsubscribe = jest.fn();

      mockDoc.mockReturnValue({ id: mockUserId } as any);
      mockOnSnapshot.mockReturnValue(mockUnsubscribe);

      const unsubscribe = onUserSnapshot(mockUserId, callback);

      expect(mockOnSnapshot).toHaveBeenCalled();
      expect(typeof unsubscribe).toBe('function');
    });

    it('should call callback with user data when snapshot exists', () => {
      const callback = jest.fn();
      const mockUserData = {
        displayName: 'Test User',
        email: 'test@example.com',
        lastSeen: Timestamp.fromMillis(mockTimestamp),
        presence: 'online' as UserPresence,
        deviceTokens: [],
        createdAt: Timestamp.fromMillis(mockTimestamp),
        updatedAt: Timestamp.fromMillis(mockTimestamp),
        bio: '',
      };

      mockDoc.mockReturnValue({ id: mockUserId } as any);
      mockOnSnapshot.mockImplementation((ref, onNext: any) => {
        // Simulate snapshot callback
        onNext({
          exists: () => true,
          data: () => mockUserData,
        });
        return jest.fn();
      });

      onUserSnapshot(mockUserId, callback);

      expect(callback).toHaveBeenCalledWith(
        expect.objectContaining({
          id: mockUserId,
          displayName: 'Test User',
        })
      );
    });

    it('should call callback with null when snapshot does not exist', () => {
      const callback = jest.fn();

      mockDoc.mockReturnValue({ id: mockUserId } as any);
      mockOnSnapshot.mockImplementation((ref, onNext: any) => {
        // Simulate snapshot callback
        onNext({
          exists: () => false,
        });
        return jest.fn();
      });

      onUserSnapshot(mockUserId, callback);

      expect(callback).toHaveBeenCalledWith(null);
    });
  });

  describe('onUsersPresenceSnapshot', () => {
    it('should return empty unsubscribe function for empty user IDs', () => {
      const callback = jest.fn();
      const unsubscribe = onUsersPresenceSnapshot([], callback);

      expect(typeof unsubscribe).toBe('function');
      expect(callback).not.toHaveBeenCalled();
    });

    it('should listen to multiple users presence', () => {
      const userIds = ['user1', 'user2'];
      const callback = jest.fn();
      const mockUnsubscribe = jest.fn();

      mockDoc.mockReturnValue({ id: 'user1' } as any);
      mockOnSnapshot.mockReturnValue(mockUnsubscribe);

      const unsubscribe = onUsersPresenceSnapshot(userIds, callback);

      expect(mockOnSnapshot).toHaveBeenCalledTimes(2);
      expect(typeof unsubscribe).toBe('function');

      // Call unsubscribe and verify all listeners are unsubscribed
      unsubscribe();
      expect(mockUnsubscribe).toHaveBeenCalledTimes(2);
    });
  });

  describe('deleteUser', () => {
    it('should delete user successfully', async () => {
      mockDoc.mockReturnValue({ id: mockUserId } as any);
      mockDeleteDoc.mockResolvedValue(undefined);

      await deleteUser(mockUserId);

      expect(mockDoc).toHaveBeenCalledWith(db, 'users', mockUserId);
      expect(mockDeleteDoc).toHaveBeenCalled();
    });

    it('should throw error if deletion fails', async () => {
      mockDoc.mockReturnValue({ id: mockUserId } as any);
      mockDeleteDoc.mockRejectedValue(new Error('Firestore error'));

      await expect(deleteUser(mockUserId)).rejects.toThrow(
        'Failed to delete user.'
      );
    });
  });
});

