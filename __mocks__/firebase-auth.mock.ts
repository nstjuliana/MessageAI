/**
 * Firebase Auth Mock for Testing
 */

import { User as FirebaseUser } from 'firebase/auth';

// Mock Firebase User
export const createMockFirebaseUser = (overrides?: Partial<FirebaseUser>): FirebaseUser => {
  return {
    uid: 'test-user-id',
    email: 'test@example.com',
    displayName: 'Test User',
    photoURL: null,
    emailVerified: false,
    isAnonymous: false,
    metadata: {
      creationTime: new Date().toISOString(),
      lastSignInTime: new Date().toISOString(),
    },
    providerData: [],
    refreshToken: 'mock-refresh-token',
    tenantId: null,
    delete: jest.fn(),
    getIdToken: jest.fn(),
    getIdTokenResult: jest.fn(),
    reload: jest.fn(),
    toJSON: jest.fn(),
    phoneNumber: null,
    providerId: 'firebase',
    ...overrides,
  } as FirebaseUser;
};

// Mock Auth instance
export const mockAuth = {
  currentUser: null,
  languageCode: 'en',
  settings: {},
  tenantId: null,
  config: {},
  name: 'test-auth',
  useDeviceLanguage: jest.fn(),
  signOut: jest.fn(),
};

// Mock auth functions
export const mockCreateUserWithEmailAndPassword = jest.fn();
export const mockSignInWithEmailAndPassword = jest.fn();
export const mockSignOut = jest.fn();
export const mockOnAuthStateChanged = jest.fn();
export const mockUpdateProfile = jest.fn();
export const mockSendPasswordResetEmail = jest.fn();
export const mockUpdateEmail = jest.fn();
export const mockUpdatePassword = jest.fn();
export const mockEmailAuthProviderCredential = jest.fn();
export const mockReauthenticateWithCredential = jest.fn();

// Reset all mocks
export const resetAuthMocks = () => {
  mockAuth.currentUser = null;
  mockCreateUserWithEmailAndPassword.mockReset();
  mockSignInWithEmailAndPassword.mockReset();
  mockSignOut.mockReset();
  mockOnAuthStateChanged.mockReset();
  mockUpdateProfile.mockReset();
  mockSendPasswordResetEmail.mockReset();
  mockUpdateEmail.mockReset();
  mockUpdatePassword.mockReset();
  mockEmailAuthProviderCredential.mockReset();
  mockReauthenticateWithCredential.mockReset();
};

