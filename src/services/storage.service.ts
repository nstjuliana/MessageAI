/**
 * Firebase Storage Service
 * Handles file uploads (profile photos, etc.)
 */

import { storage } from '@/config/firebase';
import { getDownloadURL, ref, uploadBytes } from 'firebase/storage';

/**
 * Upload a profile photo to Firebase Storage
 * @param userId - User ID
 * @param imageUri - Local image URI
 * @returns Download URL of uploaded image
 */
export async function uploadProfilePhoto(
  userId: string,
  imageUri: string
): Promise<string> {
  try {
    console.log('📤 Starting profile photo upload for user:', userId);
    
    // Convert image URI to blob
    const response = await fetch(imageUri);
    if (!response.ok) {
      throw new Error('Failed to fetch image from URI');
    }
    const blob = await response.blob();
    console.log('📦 Image blob created, size:', blob.size, 'bytes');

    // Create storage reference
    const storageRef = ref(storage, `profile-photos/${userId}.jpg`);

    // Upload image
    console.log('⬆️ Uploading to Firebase Storage...');
    await uploadBytes(storageRef, blob);

    // Get download URL
    console.log('🔗 Getting download URL...');
    const downloadURL = await getDownloadURL(storageRef);
    console.log('✅ Profile photo uploaded successfully:', downloadURL);

    return downloadURL;
  } catch (error: any) {
    console.error('❌ Failed to upload profile photo:', error);
    console.error('Error code:', error?.code);
    console.error('Error message:', error?.message);
    
    // Provide more specific error messages
    if (error?.code === 'storage/unauthorized') {
      throw new Error('You do not have permission to upload photos. Please check your account.');
    } else if (error?.code === 'storage/canceled') {
      throw new Error('Upload was canceled');
    } else if (error?.code === 'storage/unknown') {
      throw new Error('An unknown error occurred. Please check your internet connection.');
    } else {
      throw new Error(error?.message || 'Failed to upload profile photo');
    }
  }
}

/**
 * Delete a profile photo from Firebase Storage
 * @param userId - User ID
 */
export async function deleteProfilePhoto(userId: string): Promise<void> {
  try {
    const storageRef = ref(storage, `profile-photos/${userId}.jpg`);
    // Note: deleteObject is not imported yet, but this is for future use
    console.log('🗑️ Profile photo deletion requested');
  } catch (error) {
    console.error('Failed to delete profile photo:', error);
    // Don't throw - deletion failure shouldn't block other operations
  }
}

