/**
 * Media Cache Service
 * Handles caching of message media attachments to local file system
 * Similar to profile avatar caching but for message attachments
 */

import * as FileSystem from 'expo-file-system/legacy';

// Cache directory for message attachments
const MEDIA_CACHE_DIR = `${FileSystem.documentDirectory}message-media/`;

// Maximum cache size in bytes (100 MB)
const MAX_CACHE_SIZE = 100 * 1024 * 1024;

// Cache statistics
let cacheSize = 0;
let cacheInitialized = false;

/**
 * Initialize media cache directory
 */
export async function initMediaCache(): Promise<void> {
  if (cacheInitialized) return;
  
  try {
    const dirInfo = await FileSystem.getInfoAsync(MEDIA_CACHE_DIR);
    
    if (!dirInfo.exists) {
      await FileSystem.makeDirectoryAsync(MEDIA_CACHE_DIR, { intermediates: true });
      console.log('📁 Media cache directory created');
    }
    
    // Calculate initial cache size
    cacheSize = await calculateCacheSize();
    console.log(`📊 Media cache size: ${(cacheSize / 1024 / 1024).toFixed(2)} MB`);
    
    cacheInitialized = true;
  } catch (error) {
    console.error('❌ Failed to initialize media cache:', error);
    throw error;
  }
}

/**
 * Calculate total size of cached media
 */
async function calculateCacheSize(): Promise<number> {
  try {
    const files = await FileSystem.readDirectoryAsync(MEDIA_CACHE_DIR);
    let totalSize = 0;
    
    for (const file of files) {
      const fileInfo = await FileSystem.getInfoAsync(`${MEDIA_CACHE_DIR}${file}`);
      if (fileInfo.exists && !fileInfo.isDirectory) {
        totalSize += fileInfo.size || 0;
      }
    }
    
    return totalSize;
  } catch (error) {
    console.error('❌ Failed to calculate cache size:', error);
    return 0;
  }
}

/**
 * Generate local filename from media URL
 * Uses URL hash to avoid collisions and special characters
 */
function getLocalFilename(mediaUrl: string, mediaMime?: string): string {
  // Simple hash function
  let hash = 0;
  for (let i = 0; i < mediaUrl.length; i++) {
    const char = mediaUrl.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32-bit integer
  }
  
  const hashStr = Math.abs(hash).toString(36);
  
  // Determine file extension from MIME type
  let extension = '';
  if (mediaMime) {
    if (mediaMime.startsWith('image/')) {
      extension = mediaMime.split('/')[1] || 'jpg';
    } else if (mediaMime.startsWith('video/')) {
      extension = mediaMime.split('/')[1] || 'mp4';
    } else if (mediaMime.startsWith('audio/')) {
      extension = mediaMime.split('/')[1] || 'mp3';
    } else {
      extension = 'bin';
    }
  } else {
    // Try to extract from URL
    const urlExt = mediaUrl.split('.').pop()?.split('?')[0];
    extension = urlExt || 'jpg';
  }
  
  return `${hashStr}.${extension}`;
}

/**
 * Download and cache media file
 * Returns local file path
 */
export async function cacheMedia(
  mediaUrl: string,
  mediaMime?: string
): Promise<string | null> {
  try {
    if (!cacheInitialized) {
      await initMediaCache();
    }
    
    const filename = getLocalFilename(mediaUrl, mediaMime);
    const localPath = `${MEDIA_CACHE_DIR}${filename}`;
    
    // Check if already cached
    const fileInfo = await FileSystem.getInfoAsync(localPath);
    if (fileInfo.exists) {
      console.log('✅ Media already cached:', filename);
      return localPath;
    }
    
    // Check cache size before downloading
    if (cacheSize > MAX_CACHE_SIZE) {
      console.warn('⚠️ Cache size exceeded, cleaning up old files...');
      await cleanupOldFiles(MAX_CACHE_SIZE * 0.7); // Clean to 70% of max
    }
    
    console.log('⬇️ Downloading media:', mediaUrl);
    
    // Download file
    const downloadResult = await FileSystem.downloadAsync(mediaUrl, localPath);
    
    if (downloadResult.status !== 200) {
      console.error('❌ Failed to download media:', downloadResult.status);
      return null;
    }
    
    // Update cache size
    const newFileInfo = await FileSystem.getInfoAsync(localPath);
    if (newFileInfo.exists && !newFileInfo.isDirectory) {
      cacheSize += newFileInfo.size || 0;
    }
    
    console.log(`✅ Media cached: ${filename} (${((newFileInfo.exists ? newFileInfo.size : 0) / 1024).toFixed(2)} KB)`);
    
    return localPath;
  } catch (error) {
    console.error('❌ Failed to cache media:', error);
    return null;
  }
}

/**
 * Get cached media path if it exists
 */
export async function getCachedMediaPath(
  mediaUrl: string,
  mediaMime?: string
): Promise<string | null> {
  try {
    if (!cacheInitialized) {
      await initMediaCache();
    }
    
    const filename = getLocalFilename(mediaUrl, mediaMime);
    const localPath = `${MEDIA_CACHE_DIR}${filename}`;
    
    const fileInfo = await FileSystem.getInfoAsync(localPath);
    
    return fileInfo.exists ? localPath : null;
  } catch (error) {
    console.error('❌ Failed to get cached media path:', error);
    return null;
  }
}

/**
 * Delete a specific cached media file
 */
export async function deleteCachedMedia(localPath: string): Promise<void> {
  try {
    const fileInfo = await FileSystem.getInfoAsync(localPath);
    
    if (fileInfo.exists) {
      const fileSize = fileInfo.size || 0;
      await FileSystem.deleteAsync(localPath);
      cacheSize -= fileSize;
      console.log(`🗑️ Deleted cached media: ${localPath}`);
    }
  } catch (error) {
    console.error('❌ Failed to delete cached media:', error);
  }
}

/**
 * Clean up old cached files to reduce cache size
 * Removes oldest files first until target size is reached
 */
async function cleanupOldFiles(targetSize: number): Promise<void> {
  try {
    const files = await FileSystem.readDirectoryAsync(MEDIA_CACHE_DIR);
    
    // Get file info with modification times
    const fileInfos: Array<{ path: string; modTime: number; size: number }> = [];
    
    for (const file of files) {
      const filePath = `${MEDIA_CACHE_DIR}${file}`;
      const info = await FileSystem.getInfoAsync(filePath);
      
      if (info.exists && !info.isDirectory) {
        fileInfos.push({
          path: filePath,
          modTime: info.modificationTime || 0,
          size: info.size || 0,
        });
      }
    }
    
    // Sort by modification time (oldest first)
    fileInfos.sort((a, b) => a.modTime - b.modTime);
    
    // Delete oldest files until we reach target size
    let currentSize = cacheSize;
    for (const fileInfo of fileInfos) {
      if (currentSize <= targetSize) break;
      
      await FileSystem.deleteAsync(fileInfo.path);
      currentSize -= fileInfo.size;
      console.log(`🗑️ Cleaned up old media: ${fileInfo.path}`);
    }
    
    cacheSize = currentSize;
    console.log(`✅ Cache cleanup complete. New size: ${(cacheSize / 1024 / 1024).toFixed(2)} MB`);
  } catch (error) {
    console.error('❌ Failed to cleanup cache:', error);
  }
}

/**
 * Clear entire media cache
 */
export async function clearMediaCache(): Promise<void> {
  try {
    const dirInfo = await FileSystem.getInfoAsync(MEDIA_CACHE_DIR);
    
    if (dirInfo.exists) {
      await FileSystem.deleteAsync(MEDIA_CACHE_DIR, { idempotent: true });
      await FileSystem.makeDirectoryAsync(MEDIA_CACHE_DIR, { intermediates: true });
      cacheSize = 0;
      console.log('🗑️ Media cache cleared');
    }
  } catch (error) {
    console.error('❌ Failed to clear media cache:', error);
  }
}

/**
 * Get cache statistics
 */
export async function getCacheStats(): Promise<{
  size: number;
  sizeInMB: string;
  fileCount: number;
  maxSize: number;
  maxSizeInMB: string;
}> {
  try {
    if (!cacheInitialized) {
      await initMediaCache();
    }
    
    const files = await FileSystem.readDirectoryAsync(MEDIA_CACHE_DIR);
    
    return {
      size: cacheSize,
      sizeInMB: (cacheSize / 1024 / 1024).toFixed(2),
      fileCount: files.length,
      maxSize: MAX_CACHE_SIZE,
      maxSizeInMB: (MAX_CACHE_SIZE / 1024 / 1024).toFixed(2),
    };
  } catch (error) {
    console.error('❌ Failed to get cache stats:', error);
    return {
      size: 0,
      sizeInMB: '0.00',
      fileCount: 0,
      maxSize: MAX_CACHE_SIZE,
      maxSizeInMB: (MAX_CACHE_SIZE / 1024 / 1024).toFixed(2),
    };
  }
}

