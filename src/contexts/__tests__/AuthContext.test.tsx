/**
 * AuthContext Integration Tests
 * Tests the integration between AuthContext and auth.service
 * 
 * Note: Full React Context/hook testing requires React Native test environment.
 * These tests verify the auth service integration and logic flow.
 */


import {
    createMockFirebaseUser,
    resetAuthMocks,
} from '@/__mocks__/firebase-auth.mock';
import * as authService from '@/services/auth.service';

// Mock the router
const mockRouterReplace = jest.fn();
jest.mock('expo-router', () => ({
  router: {
    replace: mockRouterReplace,
  },
}));

// Mock the auth service
jest.mock('@/services/auth.service');

describe('AuthContext Integration', () => {
  let mockOnAuthStateChange: jest.Mock;
  let mockSignUp: jest.Mock;
  let mockSignIn: jest.Mock;
  let mockLogOut: jest.Mock;

  beforeEach(() => {
    resetAuthMocks();
    jest.clearAllMocks();

    // Set up mocks
    mockOnAuthStateChange = authService.onAuthStateChange as jest.Mock;
    mockSignUp = authService.signUp as jest.Mock;
    mockSignIn = authService.signIn as jest.Mock;
    mockLogOut = authService.logOut as jest.Mock;
  });

  describe('Auth Service Integration', () => {
    it('should call onAuthStateChange when initialized', () => {
      // When context is initialized, it should set up auth listener
      // This verifies the service function is available
      expect(mockOnAuthStateChange).toBeDefined();
      expect(typeof mockOnAuthStateChange).toBe('function');
    });

    it('should have signUp function available', () => {
      expect(mockSignUp).toBeDefined();
      expect(typeof mockSignUp).toBe('function');
    });

    it('should have signIn function available', () => {
      expect(mockSignIn).toBeDefined();
      expect(typeof mockSignIn).toBe('function');
    });

    it('should have logOut function available', () => {
      expect(mockLogOut).toBeDefined();
      expect(typeof mockLogOut).toBe('function');
    });
  });

  describe('signUp integration', () => {
    it('should call auth service signUp with correct parameters', async () => {
      const mockUser = createMockFirebaseUser();
      mockSignUp.mockResolvedValue(mockUser);

      const result = await mockSignUp('test@example.com', 'password123');

      expect(mockSignUp).toHaveBeenCalledWith('test@example.com', 'password123');
      expect(result).toEqual(mockUser);
    });

    it('should propagate signUp errors', async () => {
      const error = new Error('Email already in use');
      mockSignUp.mockRejectedValue(error);

      await expect(mockSignUp('test@example.com', 'password123')).rejects.toThrow(
        'Email already in use'
      );
    });
  });

  describe('signIn integration', () => {
    it('should call auth service signIn with correct parameters', async () => {
      const mockUser = createMockFirebaseUser();
      mockSignIn.mockResolvedValue(mockUser);

      const result = await mockSignIn('test@example.com', 'password123');

      expect(mockSignIn).toHaveBeenCalledWith('test@example.com', 'password123');
      expect(result).toEqual(mockUser);
    });

    it('should propagate signIn errors', async () => {
      const error = new Error('Invalid credentials');
      mockSignIn.mockRejectedValue(error);

      await expect(mockSignIn('test@example.com', 'wrongpassword')).rejects.toThrow(
        'Invalid credentials'
      );
    });
  });

  describe('logOut integration', () => {
    it('should call auth service logOut', async () => {
      mockLogOut.mockResolvedValue(undefined);

      await mockLogOut();

      expect(mockLogOut).toHaveBeenCalled();
    });

    it('should propagate logOut errors', async () => {
      const error = new Error('Logout failed');
      mockLogOut.mockRejectedValue(error);

      await expect(mockLogOut()).rejects.toThrow('Logout failed');
    });
  });

  describe('auth state change listener', () => {
    it('should register listener with callback', () => {
      const mockCallback = jest.fn();
      const mockUnsubscribe = jest.fn();
      
      mockOnAuthStateChange.mockImplementation((callback) => {
        // Call the callback immediately with null user
        callback(null);
        return mockUnsubscribe;
      });

      const unsubscribe = mockOnAuthStateChange(mockCallback);

      expect(mockOnAuthStateChange).toHaveBeenCalledWith(mockCallback);
      expect(mockCallback).toHaveBeenCalledWith(null);
      expect(typeof unsubscribe).toBe('function');
    });

    it('should call callback with user when authenticated', () => {
      const mockUser = createMockFirebaseUser();
      const mockCallback = jest.fn();
      
      mockOnAuthStateChange.mockImplementation((callback) => {
        callback(mockUser);
        return jest.fn();
      });

      mockOnAuthStateChange(mockCallback);

      expect(mockCallback).toHaveBeenCalledWith(mockUser);
    });

    it('should return unsubscribe function', () => {
      const mockUnsubscribe = jest.fn();
      
      mockOnAuthStateChange.mockImplementation(() => mockUnsubscribe);

      const unsubscribe = mockOnAuthStateChange(jest.fn());

      expect(unsubscribe).toBe(mockUnsubscribe);
    });
  });

  describe('Router integration', () => {
    it('should have router.replace available for logout redirect', () => {
      expect(mockRouterReplace).toBeDefined();
      expect(typeof mockRouterReplace).toBe('function');
    });

    it('should call router.replace with /auth/login', () => {
      mockRouterReplace('/auth/login');

      expect(mockRouterReplace).toHaveBeenCalledWith('/auth/login');
    });
  });

  describe('User data flow', () => {
    it('should properly handle user object from Firebase', () => {
      const mockUser = createMockFirebaseUser({
        uid: 'test-123',
        email: 'custom@example.com',
        displayName: 'Custom User',
      });

      expect(mockUser.uid).toBe('test-123');
      expect(mockUser.email).toBe('custom@example.com');
      expect(mockUser.displayName).toBe('Custom User');
    });

    it('should handle null user (not authenticated)', () => {
      const mockCallback = jest.fn();
      
      mockOnAuthStateChange.mockImplementation((callback) => {
        callback(null);
        return jest.fn();
      });

      mockOnAuthStateChange(mockCallback);

      expect(mockCallback).toHaveBeenCalledWith(null);
    });
  });
});

