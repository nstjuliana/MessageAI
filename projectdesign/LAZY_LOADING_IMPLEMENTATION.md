# Lazy Loading & Media Caching Implementation

## Overview

This document describes the new lazy loading and media caching architecture that optimizes app performance by:
- Caching all messages in SQLite
- Storing media attachments in local filesystem
- Preloading only the 20 most recent chats on login
- Gradually syncing remaining chats in the background

## Architecture

### 1. Database Schema (v8)

#### Messages Table
Added `localMediaPath` column to store the local filesystem path of cached media attachments.

```sql
CREATE TABLE messages (
  ...
  mediaUrl TEXT,
  mediaMime TEXT,
  localMediaPath TEXT,  -- NEW: Local path to cached media
  ...
);
```

#### Chats Table
Added sync tracking columns to manage background sync:

```sql
CREATE TABLE chats (
  ...
  syncStatus TEXT DEFAULT 'pending',  -- NEW: 'pending' | 'syncing' | 'synced' | 'failed'
  lastSyncedAt INTEGER,                -- NEW: Timestamp of last sync
  messageCount INTEGER DEFAULT 0       -- NEW: Number of messages synced
);
```

### 2. Services

#### Media Cache Service (`media-cache.service.ts`)

Manages local caching of message attachments (images, videos, audio files).

**Key Features:**
- Downloads and caches media files to `${FileSystem.documentDirectory}message-media/`
- Automatic cache size management (default 100MB limit)
- Cleanup of old files when cache is full
- Fast lookup of cached media

**Usage:**
```typescript
import { cacheMedia, getCachedMediaPath } from '@/services/media-cache.service';

// Cache a media file
const localPath = await cacheMedia(mediaUrl, mediaMime);

// Check if already cached
const cachedPath = await getCachedMediaPath(mediaUrl, mediaMime);

// Get cache statistics
const stats = await getCacheStats();
console.log(`Cache: ${stats.sizeInMB} MB (${stats.fileCount} files)`);
```

#### Chat Sync Service (`chat-sync.service.ts`)

Manages background synchronization of chats and messages.

**Key Features:**
- Preloads top 20 most recent chats on login
- Background sync of remaining chats (one at a time)
- Automatic media caching during sync
- Sync status tracking in SQLite
- Pause/resume support

**Usage:**
```typescript
import { 
  preloadRecentChats, 
  startBackgroundSync,
  getSyncStats 
} from '@/services/chat-sync.service';

// Preload recent chats (called automatically on login)
await preloadRecentChats(userId);

// Start background sync for remaining chats
await startBackgroundSync();

// Get sync statistics
const stats = await getSyncStats();
console.log(`Synced ${stats.syncedChats} of ${stats.totalChats} chats`);
```

#### Updated Message Service

The `message.service.ts` now automatically caches media when syncing messages:

```typescript
// When receiving a message from Firestore
export async function syncMessageToSQLite(message: Message) {
  // ... sync message to SQLite ...
  
  // Automatically cache media if present
  if (message.mediaUrl) {
    const localPath = await cacheMedia(message.mediaUrl, message.mediaMime);
    // Update message with local path
    await executeStatement(
      'UPDATE messages SET localMediaPath = ? WHERE id = ?',
      [localPath, message.id]
    );
  }
}
```

### 3. Context

#### ChatSyncContext

React context that manages sync state and provides sync control to the app.

**Provides:**
- `isSyncing`: Boolean indicating if background sync is running
- `isPreloading`: Boolean indicating if initial preload is happening
- `syncProgress`: Percentage (0-100) of chats synced
- `syncStats`: Sync statistics (total, synced, pending, failed)
- `cacheStats`: Media cache statistics
- `startSync()`: Manually trigger background sync
- `stopSync()`: Stop background sync
- `refreshStats()`: Refresh statistics

**Integration:**
```tsx
import { ChatSyncProvider, useChatSync } from '@/contexts/ChatSyncContext';

// In app layout
<ChatSyncProvider>
  <YourApp />
</ChatSyncProvider>

// In a component
function SyncIndicator() {
  const { syncProgress, isSyncing } = useChatSync();
  
  return (
    <View>
      {isSyncing && <Text>Syncing: {syncProgress}%</Text>}
    </View>
  );
}
```

### 4. Utilities

#### Media Utilities (`media.utils.ts`)

Helper functions for media file management:

```typescript
import { 
  formatBytes, 
  getFileSize, 
  fileExists,
  isFileSizeValid,
  hasEnoughStorage 
} from '@/utils/media.utils';

// Format bytes for display
formatBytes(1024 * 1024); // "1 MB"

// Check if file exists
const exists = await fileExists(localPath);

// Validate file size
const valid = isFileSizeValid(fileSize, 10); // Max 10MB

// Check available storage
const hasSpace = await hasEnoughStorage(requiredBytes);
```

## Flow

### Login Flow

1. **User logs in** → AuthContext authenticates user
2. **App initializes** → SQLite database initialized/migrated to v8
3. **Preload starts** → ChatSyncContext calls `preloadRecentChats()`
   - Fetches top 20 chats from Firestore (sorted by lastMessageAt)
   - For each chat:
     - Marks chat as 'syncing' in SQLite
     - Fetches up to 100 messages from Firestore
     - Stores messages in SQLite
     - Caches any media attachments
     - Marks chat as 'synced'
4. **Background sync starts** → After 2-second delay
   - Queries SQLite for chats with `syncStatus = 'pending'`
   - Syncs chats one at a time with 2-second delays
   - Continues until all chats are synced or user goes offline

### Message Receive Flow

1. **New message arrives** → Firestore listener receives message
2. **Sync to SQLite** → `syncMessageToSQLite()` called
3. **Check media** → If message has `mediaUrl`:
   - Check if already cached
   - If not, download and cache in background
   - Update message record with `localMediaPath`
4. **UI updates** → Message displayed immediately
5. **Media loads** → Local media path used if available, falls back to URL

### Message Send Flow

1. **User sends message** → `sendMessageOptimistic()` called
2. **Optimistic UI** → Message appears immediately with 'sending' status
3. **Store in SQLite** → Message stored locally with queue timestamp
4. **Upload to Firestore** → Background upload to Firestore
5. **Status update** → On success, status changes to 'sent'

## Usage Examples

### Display a Message with Media

```tsx
function MessageItem({ message }: { message: Message }) {
  const imageSource = message.localMediaPath 
    ? { uri: message.localMediaPath }  // Use cached local file
    : message.mediaUrl 
    ? { uri: message.mediaUrl }        // Fallback to network URL
    : null;
  
  return (
    <View>
      {message.text && <Text>{message.text}</Text>}
      {imageSource && (
        <Image 
          source={imageSource} 
          style={{ width: 200, height: 200 }}
        />
      )}
    </View>
  );
}
```

### Show Sync Progress

```tsx
function SyncStatus() {
  const { isSyncing, syncProgress, syncStats } = useChatSync();
  
  if (!isSyncing) return null;
  
  return (
    <View style={styles.syncBanner}>
      <Text>
        Syncing chats: {syncStats?.syncedChats}/{syncStats?.totalChats} ({syncProgress}%)
      </Text>
      <ProgressBar progress={syncProgress / 100} />
    </View>
  );
}
```

### Manual Sync Control

```tsx
function SettingsScreen() {
  const { startSync, stopSync, isSyncing, cacheStats } = useChatSync();
  
  return (
    <View>
      <Button 
        title={isSyncing ? "Stop Sync" : "Start Sync"}
        onPress={isSyncing ? stopSync : startSync}
      />
      
      <Text>Cache Size: {cacheStats?.sizeInMB} MB</Text>
      <Text>Cached Files: {cacheStats?.fileCount}</Text>
    </View>
  );
}
```

## Configuration

### Adjustable Parameters

In `chat-sync.service.ts`:
```typescript
const PRELOAD_CHAT_COUNT = 20;          // Number of chats to preload
const BACKGROUND_SYNC_DELAY = 2000;     // Delay between syncing chats (ms)
const MAX_MESSAGES_PER_CHAT = 100;      // Max messages to sync per chat
```

In `media-cache.service.ts`:
```typescript
const MAX_CACHE_SIZE = 100 * 1024 * 1024;  // 100 MB cache limit
```

## Performance Benefits

1. **Instant Chat List**: Chat list loads instantly from SQLite
2. **Fast Message Load**: Messages load instantly from SQLite (no network delay)
3. **Offline Support**: Full offline support for cached chats
4. **Reduced Data Usage**: Media only downloaded once, then cached
5. **Battery Efficient**: Background sync is throttled with delays
6. **Reduced Memory**: Only loads data as needed (lazy loading)

## Migration Notes

### Database Migration (v7 → v8)

The migration automatically:
- Adds `localMediaPath` column to `messages` table
- Adds `syncStatus`, `lastSyncedAt`, `messageCount` columns to `chats` table
- Preserves all existing data

Users will see:
- Normal app startup
- Background sync will automatically start after login
- Media will be cached as messages are synced

### Breaking Changes

None! The system is backward compatible:
- Old message records work fine (localMediaPath is NULL)
- Old chat records work fine (syncStatus defaults to 'pending')

## Testing

### Test Preload
```typescript
// In dev, you can force preload
import { preloadRecentChats } from '@/services/chat-sync.service';
await preloadRecentChats(userId);
```

### Test Background Sync
```typescript
import { startBackgroundSync, getSyncStats } from '@/services/chat-sync.service';

// Start sync
await startBackgroundSync();

// Check progress
const stats = await getSyncStats();
console.log(stats);
```

### Test Media Cache
```typescript
import { cacheMedia, getCacheStats } from '@/services/media-cache.service';

// Cache a file
const localPath = await cacheMedia(
  'https://example.com/image.jpg',
  'image/jpeg'
);

// Check cache
const stats = await getCacheStats();
console.log('Cache size:', stats.sizeInMB);
```

## Future Enhancements

Potential improvements:
1. **Smart Preload**: Prioritize chats based on message frequency
2. **Bandwidth Detection**: Adjust sync speed based on connection quality
3. **User Preferences**: Let users choose how many chats to preload
4. **Analytics**: Track cache hit rates and sync performance
5. **Compression**: Compress cached media to save space
6. **Background Tasks**: Use Expo's background tasks for sync when app is closed

## Troubleshooting

### Sync Not Starting
- Check if user is logged in (`user !== null`)
- Check if device is online (`isConnected === true`)
- Check console for error messages

### Media Not Caching
- Check Firebase Storage rules (must allow read)
- Check available device storage
- Check network connectivity
- Check console for download errors

### High Cache Usage
- Adjust `MAX_CACHE_SIZE` in `media-cache.service.ts`
- Call `clearMediaCache()` to reset cache
- Implement periodic cleanup

### Sync Stuck
- Call `stopBackgroundSync()` to reset
- Check Firestore connection
- Check for rate limiting errors

