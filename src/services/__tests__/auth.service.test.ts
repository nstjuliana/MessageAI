/**
 * Auth Service Tests
 */

import {
    createMockFirebaseUser,
    resetAuthMocks
} from '@/__mocks__/firebase-auth.mock';
import { auth } from '@/config/firebase';
import {
    createUserWithEmailAndPassword,
    EmailAuthProvider,
    onAuthStateChanged,
    reauthenticateWithCredential,
    sendPasswordResetEmail,
    signInWithEmailAndPassword,
    signOut,
    updateEmail,
    updatePassword,
    updateProfile,
} from 'firebase/auth';
import {
    changeEmail,
    changePassword,
    getCurrentUser,
    logOut,
    onAuthStateChange,
    reauthenticate,
    sendPasswordReset,
    signIn,
    signUp,
    updateUserProfile,
} from '../auth.service';

// Mock the firebase config module
jest.mock('@/config/firebase', () => ({
  auth: {
    currentUser: null,
  },
}));

// Mock Firebase auth functions
jest.mock('firebase/auth');

describe('Auth Service', () => {
  beforeEach(() => {
    resetAuthMocks();
    (auth as any).currentUser = null;
  });

  describe('signUp', () => {
    it('should create a new user successfully', async () => {
      const mockUser = createMockFirebaseUser();
      const mockUserCredential = { user: mockUser };

      (createUserWithEmailAndPassword as jest.Mock).mockResolvedValue(mockUserCredential);

      const result = await signUp('test@example.com', 'password123');

      expect(createUserWithEmailAndPassword).toHaveBeenCalledWith(
        auth,
        'test@example.com',
        'password123'
      );
      expect(result).toEqual(mockUser);
    });

    it('should throw error for invalid email', async () => {
      const error = { code: 'auth/invalid-email' };
      (createUserWithEmailAndPassword as jest.Mock).mockRejectedValue(error);

      await expect(signUp('invalid-email', 'password123')).rejects.toThrow(
        'Invalid email address. Please check and try again.'
      );
    });

    it('should throw error for weak password', async () => {
      const error = { code: 'auth/weak-password' };
      (createUserWithEmailAndPassword as jest.Mock).mockRejectedValue(error);

      await expect(signUp('test@example.com', '123')).rejects.toThrow(
        'Password is too weak. Please use at least 6 characters.'
      );
    });

    it('should throw error for email already in use', async () => {
      const error = { code: 'auth/email-already-in-use' };
      (createUserWithEmailAndPassword as jest.Mock).mockRejectedValue(error);

      await expect(signUp('existing@example.com', 'password123')).rejects.toThrow(
        'This email is already registered. Please sign in instead.'
      );
    });
  });

  describe('signIn', () => {
    it('should sign in user successfully', async () => {
      const mockUser = createMockFirebaseUser();
      const mockUserCredential = { user: mockUser };

      (signInWithEmailAndPassword as jest.Mock).mockResolvedValue(mockUserCredential);

      const result = await signIn('test@example.com', 'password123');

      expect(signInWithEmailAndPassword).toHaveBeenCalledWith(
        auth,
        'test@example.com',
        'password123'
      );
      expect(result).toEqual(mockUser);
    });

    it('should throw error for user not found', async () => {
      const error = { code: 'auth/user-not-found' };
      (signInWithEmailAndPassword as jest.Mock).mockRejectedValue(error);

      await expect(signIn('notfound@example.com', 'password123')).rejects.toThrow(
        'No account found with this email. Please sign up first.'
      );
    });

    it('should throw error for wrong password', async () => {
      const error = { code: 'auth/wrong-password' };
      (signInWithEmailAndPassword as jest.Mock).mockRejectedValue(error);

      await expect(signIn('test@example.com', 'wrongpassword')).rejects.toThrow(
        'Incorrect password. Please try again.'
      );
    });

    it('should throw error for network failure', async () => {
      const error = { code: 'auth/network-request-failed' };
      (signInWithEmailAndPassword as jest.Mock).mockRejectedValue(error);

      await expect(signIn('test@example.com', 'password123')).rejects.toThrow(
        'Network error. Please check your connection and try again.'
      );
    });
  });

  describe('logOut', () => {
    it('should sign out user successfully', async () => {
      (signOut as jest.Mock).mockResolvedValue(undefined);

      await logOut();

      expect(signOut).toHaveBeenCalledWith(auth);
    });

    it('should throw error if sign out fails', async () => {
      (signOut as jest.Mock).mockRejectedValue(new Error('Sign out failed'));

      await expect(logOut()).rejects.toThrow('Failed to sign out. Please try again.');
    });
  });

  describe('getCurrentUser', () => {
    it('should return current user', () => {
      const mockUser = createMockFirebaseUser();
      (auth as any).currentUser = mockUser;

      const result = getCurrentUser();

      expect(result).toEqual(mockUser);
    });

    it('should return null if no user is signed in', () => {
      (auth as any).currentUser = null;

      const result = getCurrentUser();

      expect(result).toBeNull();
    });
  });

  describe('onAuthStateChange', () => {
    it('should set up auth state listener', () => {
      const mockCallback = jest.fn();
      const mockUnsubscribe = jest.fn();

      (onAuthStateChanged as jest.Mock).mockReturnValue(mockUnsubscribe);

      const unsubscribe = onAuthStateChange(mockCallback);

      expect(onAuthStateChanged).toHaveBeenCalledWith(auth, mockCallback);
      expect(unsubscribe).toBe(mockUnsubscribe);
    });
  });

  describe('updateUserProfile', () => {
    it('should update display name successfully', async () => {
      const mockUser = createMockFirebaseUser();
      (auth as any).currentUser = mockUser;
      (updateProfile as jest.Mock).mockResolvedValue(undefined);

      await updateUserProfile('New Name');

      expect(updateProfile).toHaveBeenCalledWith(mockUser, {
        displayName: 'New Name',
        photoURL: null,
      });
    });

    it('should update photo URL successfully', async () => {
      const mockUser = createMockFirebaseUser();
      (auth as any).currentUser = mockUser;
      (updateProfile as jest.Mock).mockResolvedValue(undefined);

      await updateUserProfile(undefined, 'https://example.com/photo.jpg');

      expect(updateProfile).toHaveBeenCalledWith(mockUser, {
        displayName: 'Test User',
        photoURL: 'https://example.com/photo.jpg',
      });
    });

    it('should throw error if no user is signed in', async () => {
      (auth as any).currentUser = null;

      await expect(updateUserProfile('New Name')).rejects.toThrow(
        'No user is currently signed in'
      );
    });
  });

  describe('sendPasswordReset', () => {
    it('should send password reset email successfully', async () => {
      (sendPasswordResetEmail as jest.Mock).mockResolvedValue(undefined);

      await sendPasswordReset('test@example.com');

      expect(sendPasswordResetEmail).toHaveBeenCalledWith(auth, 'test@example.com');
    });

    it('should throw error for invalid email', async () => {
      const error = { code: 'auth/invalid-email' };
      (sendPasswordResetEmail as jest.Mock).mockRejectedValue(error);

      await expect(sendPasswordReset('invalid-email')).rejects.toThrow(
        'Invalid email address. Please check and try again.'
      );
    });
  });

  describe('changeEmail', () => {
    it('should update email successfully', async () => {
      const mockUser = createMockFirebaseUser();
      (auth as any).currentUser = mockUser;
      (updateEmail as jest.Mock).mockResolvedValue(undefined);

      await changeEmail('newemail@example.com');

      expect(updateEmail).toHaveBeenCalledWith(mockUser, 'newemail@example.com');
    });

    it('should throw error if recent login required', async () => {
      const mockUser = createMockFirebaseUser();
      (auth as any).currentUser = mockUser;
      const error = { code: 'auth/requires-recent-login' };
      (updateEmail as jest.Mock).mockRejectedValue(error);

      await expect(changeEmail('newemail@example.com')).rejects.toThrow(
        'Please sign in again to update your email address'
      );
    });

    it('should throw error if no user is signed in', async () => {
      (auth as any).currentUser = null;

      await expect(changeEmail('newemail@example.com')).rejects.toThrow(
        'No user is currently signed in'
      );
    });
  });

  describe('changePassword', () => {
    it('should update password successfully', async () => {
      const mockUser = createMockFirebaseUser();
      (auth as any).currentUser = mockUser;
      (updatePassword as jest.Mock).mockResolvedValue(undefined);

      await changePassword('newpassword123');

      expect(updatePassword).toHaveBeenCalledWith(mockUser, 'newpassword123');
    });

    it('should throw error if recent login required', async () => {
      const mockUser = createMockFirebaseUser();
      (auth as any).currentUser = mockUser;
      const error = { code: 'auth/requires-recent-login' };
      (updatePassword as jest.Mock).mockRejectedValue(error);

      await expect(changePassword('newpassword123')).rejects.toThrow(
        'Please sign in again to update your password'
      );
    });

    it('should throw error if no user is signed in', async () => {
      (auth as any).currentUser = null;

      await expect(changePassword('newpassword123')).rejects.toThrow(
        'No user is currently signed in'
      );
    });
  });

  describe('reauthenticate', () => {
    it('should reauthenticate user successfully', async () => {
      const mockUser = createMockFirebaseUser();
      (auth as any).currentUser = mockUser;
      const mockCredential = {};

      (EmailAuthProvider.credential as jest.Mock).mockReturnValue(mockCredential);
      (reauthenticateWithCredential as jest.Mock).mockResolvedValue(undefined);

      await reauthenticate('password123');

      expect(EmailAuthProvider.credential).toHaveBeenCalledWith(
        'test@example.com',
        'password123'
      );
      expect(reauthenticateWithCredential).toHaveBeenCalledWith(
        mockUser,
        mockCredential
      );
    });

    it('should throw error for invalid password', async () => {
      const mockUser = createMockFirebaseUser();
      (auth as any).currentUser = mockUser;
      const mockCredential = {};

      (EmailAuthProvider.credential as jest.Mock).mockReturnValue(mockCredential);
      (reauthenticateWithCredential as jest.Mock).mockRejectedValue(
        new Error('Invalid password')
      );

      await expect(reauthenticate('wrongpassword')).rejects.toThrow(
        'Invalid password. Please try again.'
      );
    });

    it('should throw error if no user is signed in', async () => {
      (auth as any).currentUser = null;

      await expect(reauthenticate('password123')).rejects.toThrow(
        'No user is currently signed in'
      );
    });
  });
});

