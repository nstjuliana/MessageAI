/**
 * Media Utilities
 * Helper functions for media file management
 */

import * as FileSystem from 'expo-file-system/legacy';

/**
 * Format bytes to human-readable string
 */
export function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 Bytes';
  
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
}

/**
 * Get file size from local path
 */
export async function getFileSize(localPath: string): Promise<number> {
  try {
    const fileInfo = await FileSystem.getInfoAsync(localPath);
    return fileInfo.exists && !fileInfo.isDirectory ? (fileInfo.size || 0) : 0;
  } catch (error) {
    console.error('❌ Failed to get file size:', error);
    return 0;
  }
}

/**
 * Check if file exists
 */
export async function fileExists(localPath: string): Promise<boolean> {
  try {
    const fileInfo = await FileSystem.getInfoAsync(localPath);
    return fileInfo.exists;
  } catch (error) {
    return false;
  }
}

/**
 * Get MIME type from file extension
 */
export function getMimeTypeFromExtension(extension: string): string {
  const mimeTypes: Record<string, string> = {
    // Images
    jpg: 'image/jpeg',
    jpeg: 'image/jpeg',
    png: 'image/png',
    gif: 'image/gif',
    webp: 'image/webp',
    svg: 'image/svg+xml',
    
    // Videos
    mp4: 'video/mp4',
    webm: 'video/webm',
    mov: 'video/quicktime',
    avi: 'video/x-msvideo',
    
    // Audio
    mp3: 'audio/mpeg',
    wav: 'audio/wav',
    ogg: 'audio/ogg',
    m4a: 'audio/mp4',
    
    // Documents
    pdf: 'application/pdf',
    doc: 'application/msword',
    docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    txt: 'text/plain',
  };
  
  return mimeTypes[extension.toLowerCase()] || 'application/octet-stream';
}

/**
 * Get file extension from MIME type
 */
export function getExtensionFromMimeType(mimeType: string): string {
  const extensions: Record<string, string> = {
    // Images
    'image/jpeg': 'jpg',
    'image/png': 'png',
    'image/gif': 'gif',
    'image/webp': 'webp',
    'image/svg+xml': 'svg',
    
    // Videos
    'video/mp4': 'mp4',
    'video/webm': 'webm',
    'video/quicktime': 'mov',
    'video/x-msvideo': 'avi',
    
    // Audio
    'audio/mpeg': 'mp3',
    'audio/wav': 'wav',
    'audio/ogg': 'ogg',
    'audio/mp4': 'm4a',
    
    // Documents
    'application/pdf': 'pdf',
    'application/msword': 'doc',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'docx',
    'text/plain': 'txt',
  };
  
  return extensions[mimeType] || 'bin';
}

/**
 * Check if media type is supported
 */
export function isSupportedMediaType(mimeType: string): boolean {
  return (
    mimeType.startsWith('image/') ||
    mimeType.startsWith('video/') ||
    mimeType.startsWith('audio/')
  );
}

/**
 * Get media type category
 */
export function getMediaCategory(mimeType: string): 'image' | 'video' | 'audio' | 'document' | 'other' {
  if (mimeType.startsWith('image/')) return 'image';
  if (mimeType.startsWith('video/')) return 'video';
  if (mimeType.startsWith('audio/')) return 'audio';
  if (mimeType.startsWith('application/') || mimeType.startsWith('text/')) return 'document';
  return 'other';
}

/**
 * Validate file size against limit
 */
export function isFileSizeValid(sizeInBytes: number, maxSizeInMB: number = 10): boolean {
  const maxSizeInBytes = maxSizeInMB * 1024 * 1024;
  return sizeInBytes <= maxSizeInBytes;
}

/**
 * Get available device storage
 */
export async function getAvailableStorage(): Promise<number> {
  try {
    const freeDiskStorage = await FileSystem.getFreeDiskStorageAsync();
    return freeDiskStorage;
  } catch (error) {
    console.error('❌ Failed to get available storage:', error);
    return 0;
  }
}

/**
 * Check if there's enough storage for a file
 */
export async function hasEnoughStorage(requiredBytes: number, bufferMB: number = 100): Promise<boolean> {
  try {
    const availableStorage = await getAvailableStorage();
    const bufferBytes = bufferMB * 1024 * 1024;
    return availableStorage > (requiredBytes + bufferBytes);
  } catch (error) {
    console.error('❌ Failed to check storage:', error);
    return false;
  }
}

/**
 * Generate thumbnail path from media path
 */
export function getThumbnailPath(mediaPath: string): string {
  const parts = mediaPath.split('.');
  const extension = parts.pop();
  return `${parts.join('.')}_thumb.${extension}`;
}

/**
 * Delete file safely
 */
export async function deleteFile(localPath: string): Promise<boolean> {
  try {
    const fileInfo = await FileSystem.getInfoAsync(localPath);
    
    if (fileInfo.exists) {
      await FileSystem.deleteAsync(localPath, { idempotent: true });
      return true;
    }
    
    return false;
  } catch (error) {
    console.error('❌ Failed to delete file:', error);
    return false;
  }
}

/**
 * Copy file to new location
 */
export async function copyFile(sourcePath: string, destinationPath: string): Promise<boolean> {
  try {
    await FileSystem.copyAsync({
      from: sourcePath,
      to: destinationPath,
    });
    return true;
  } catch (error) {
    console.error('❌ Failed to copy file:', error);
    return false;
  }
}

/**
 * Move file to new location
 */
export async function moveFile(sourcePath: string, destinationPath: string): Promise<boolean> {
  try {
    await FileSystem.moveAsync({
      from: sourcePath,
      to: destinationPath,
    });
    return true;
  } catch (error) {
    console.error('❌ Failed to move file:', error);
    return false;
  }
}

