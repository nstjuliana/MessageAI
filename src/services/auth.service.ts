/**
 * Authentication Service
 * Handles all Firebase Auth operations
 */

import { auth } from '@/config/firebase';
import {
    createUserWithEmailAndPassword,
    EmailAuthProvider,
    User as FirebaseUser,
    onAuthStateChanged,
    reauthenticateWithCredential,
    sendPasswordResetEmail,
    signInWithEmailAndPassword,
    signOut,
    updateEmail,
    updatePassword,
    updateProfile,
    type Unsubscribe,
} from 'firebase/auth';
import { updatePresence } from './user.service';

/**
 * Sign up a new user with email and password
 * @param email - User's email address
 * @param password - User's password
 * @returns Firebase user object
 */
export async function signUp(email: string, password: string): Promise<FirebaseUser> {
  try {
    const userCredential = await createUserWithEmailAndPassword(auth, email, password);
    return userCredential.user;
  } catch (error: any) {
    console.error('Sign up error:', error);
    throw new Error(getAuthErrorMessage(error.code));
  }
}

/**
 * Sign in an existing user with email and password
 * @param email - User's email address
 * @param password - User's password
 * @returns Firebase user object
 */
export async function signIn(email: string, password: string): Promise<FirebaseUser> {
  try {
    const userCredential = await signInWithEmailAndPassword(auth, email, password);
    return userCredential.user;
  } catch (error: any) {
    console.error('Sign in error:', error);
    throw new Error(getAuthErrorMessage(error.code));
  }
}

/**
 * Sign out the current user
 * 
 * NOTE: We update presence to offline BEFORE signing out.
 * We use Promise.race with a timeout to ensure logout completes within 1 second
 * even if the network is slow or offline. This gives us:
 * - Fast logout (max 1 second, typically 200-300ms)
 * - Presence update when network is available
 * - Guaranteed completion even when offline
 */
export async function logOut(): Promise<void> {
  try {
    const currentUser = auth.currentUser;
    
    // Update presence with a timeout
    if (currentUser) {
      try {
        // Race between presence update and 1 second timeout
        await Promise.race([
          updatePresence(currentUser.uid, 'offline'),
          new Promise((resolve) => setTimeout(resolve, 1000)) // 1 second max
        ]);
      } catch (error) {
        // Log but don't throw - we still want to sign out even if presence update fails
        console.warn('Failed to update presence on logout:', error);
      }
    }
    
    await signOut(auth);
  } catch (error: any) {
    console.error('Sign out error:', error);
    throw new Error('Failed to sign out. Please try again.');
  }
}

/**
 * Get the currently authenticated user
 * @returns Firebase user object or null if not authenticated
 */
export function getCurrentUser(): FirebaseUser | null {
  return auth.currentUser;
}

/**
 * Listen to authentication state changes
 * @param callback - Function to call when auth state changes
 * @returns Unsubscribe function to stop listening
 */
export function onAuthStateChange(
  callback: (user: FirebaseUser | null) => void
): Unsubscribe {
  return onAuthStateChanged(auth, callback);
}

/**
 * Update the user's display name and/or photo URL
 * @param displayName - New display name (optional)
 * @param photoURL - New photo URL (optional)
 */
export async function updateUserProfile(
  displayName?: string,
  photoURL?: string
): Promise<void> {
  const user = auth.currentUser;
  if (!user) {
    throw new Error('No user is currently signed in');
  }

  try {
    await updateProfile(user, {
      displayName: displayName ?? user.displayName,
      photoURL: photoURL ?? user.photoURL,
    });
  } catch (error: any) {
    console.error('Update profile error:', error);
    throw new Error('Failed to update profile. Please try again.');
  }
}

/**
 * Send a password reset email to the user
 * @param email - User's email address
 */
export async function sendPasswordReset(email: string): Promise<void> {
  try {
    await sendPasswordResetEmail(auth, email);
  } catch (error: any) {
    console.error('Password reset error:', error);
    throw new Error(getAuthErrorMessage(error.code));
  }
}

/**
 * Update the user's email address
 * Requires recent authentication
 * @param newEmail - New email address
 */
export async function changeEmail(newEmail: string): Promise<void> {
  const user = auth.currentUser;
  if (!user) {
    throw new Error('No user is currently signed in');
  }

  try {
    await updateEmail(user, newEmail);
  } catch (error: any) {
    console.error('Update email error:', error);
    if (error.code === 'auth/requires-recent-login') {
      throw new Error('Please sign in again to update your email address');
    }
    throw new Error(getAuthErrorMessage(error.code));
  }
}

/**
 * Update the user's password
 * Requires recent authentication
 * @param newPassword - New password
 */
export async function changePassword(newPassword: string): Promise<void> {
  const user = auth.currentUser;
  if (!user) {
    throw new Error('No user is currently signed in');
  }

  try {
    await updatePassword(user, newPassword);
  } catch (error: any) {
    console.error('Update password error:', error);
    if (error.code === 'auth/requires-recent-login') {
      throw new Error('Please sign in again to update your password');
    }
    throw new Error(getAuthErrorMessage(error.code));
  }
}

/**
 * Re-authenticate user with their current credentials
 * Required before sensitive operations like email/password change
 * @param currentPassword - User's current password
 */
export async function reauthenticate(currentPassword: string): Promise<void> {
  const user = auth.currentUser;
  if (!user || !user.email) {
    throw new Error('No user is currently signed in');
  }

  try {
    const credential = EmailAuthProvider.credential(user.email, currentPassword);
    await reauthenticateWithCredential(user, credential);
  } catch (error: any) {
    console.error('Reauthentication error:', error);
    throw new Error('Invalid password. Please try again.');
  }
}

/**
 * Convert Firebase Auth error codes to user-friendly messages
 * @param errorCode - Firebase error code
 * @returns User-friendly error message
 */
function getAuthErrorMessage(errorCode: string): string {
  switch (errorCode) {
    case 'auth/email-already-in-use':
      return 'This email is already registered. Please sign in instead.';
    case 'auth/invalid-email':
      return 'Invalid email address. Please check and try again.';
    case 'auth/operation-not-allowed':
      return 'Email/password authentication is not enabled. Please contact support.';
    case 'auth/weak-password':
      return 'Password is too weak. Please use at least 6 characters.';
    case 'auth/user-disabled':
      return 'This account has been disabled. Please contact support.';
    case 'auth/user-not-found':
      return 'No account found with this email. Please sign up first.';
    case 'auth/wrong-password':
      return 'Incorrect password. Please try again.';
    case 'auth/invalid-credential':
      return 'Invalid email or password. Please try again.';
    case 'auth/too-many-requests':
      return 'Too many failed attempts. Please try again later.';
    case 'auth/network-request-failed':
      return 'Network error. Please check your connection and try again.';
    default:
      return 'An error occurred. Please try again.';
  }
}

