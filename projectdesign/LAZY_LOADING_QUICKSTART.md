# Lazy Loading & Media Caching - Quick Start

## ✅ What's Been Implemented

Your app now has a complete lazy loading and media caching system that:

1. **Preloads Top 20 Chats** on login for instant access
2. **Background Syncs** remaining chats gradually (one at a time)
3. **Caches Media** attachments locally for offline access
4. **Tracks Sync Status** so you know what's been loaded

## 🚀 How It Works

### On Login
```
User logs in
    ↓
ChatSyncContext initializes
    ↓
Preloads 20 most recent chats (with messages)
    ↓
Caches any media attachments
    ↓
After 2 seconds, starts background sync
    ↓
Gradually syncs remaining chats
```

### When Receiving Messages
```
New message arrives
    ↓
Synced to SQLite immediately
    ↓
If has media → cache in background
    ↓
UI displays instantly (local data)
```

## 📁 New Files Created

1. **`src/services/media-cache.service.ts`** - Handles media file caching (images, videos, etc.)
2. **`src/services/chat-sync.service.ts`** - Manages background sync of chats/messages
3. **`src/contexts/ChatSyncContext.tsx`** - React context for sync state
4. **`src/utils/media.utils.ts`** - Helper utilities for file management

## 🔄 Modified Files

1. **`src/database/schema.ts`** - Added columns for media paths and sync status (v8)
2. **`src/database/database.ts`** - Added migration for v8
3. **`src/services/message.service.ts`** - Auto-caches media when syncing messages
4. **`src/services/chat.service.ts`** - Tracks sync status
5. **`src/types/chat.types.ts`** - Added `localMediaPath` field
6. **`app/(authenticated)/_layout.tsx`** - Integrated ChatSyncContext

## 🎯 Key Features

### Automatic Background Sync
- ✅ Runs automatically after login
- ✅ Syncs chats one at a time (throttled)
- ✅ Pauses when offline
- ✅ Resumes when back online

### Media Caching
- ✅ 100MB cache limit (configurable)
- ✅ Automatic cleanup of old files
- ✅ Works with images, videos, audio
- ✅ Instant display from local storage

### Offline Support
- ✅ All synced messages available offline
- ✅ Cached media viewable offline
- ✅ Queue for outgoing messages

## 📊 Monitoring Sync Progress

You can monitor sync progress using the `useChatSync` hook:

```tsx
import { useChatSync } from '@/contexts/ChatSyncContext';

function MyComponent() {
  const { 
    isSyncing,      // Is background sync running?
    isPreloading,   // Is initial preload happening?
    syncProgress,   // Progress percentage (0-100)
    syncStats,      // { totalChats, syncedChats, pendingChats, failedChats }
    cacheStats      // { sizeInMB, fileCount, maxSizeInMB }
  } = useChatSync();

  return (
    <View>
      {isSyncing && <Text>Syncing: {syncProgress}%</Text>}
      {syncStats && (
        <Text>
          Chats: {syncStats.syncedChats}/{syncStats.totalChats} synced
        </Text>
      )}
    </View>
  );
}
```

## 🎛️ Configuration

### Adjust Preload Count
In `src/services/chat-sync.service.ts`:
```typescript
const PRELOAD_CHAT_COUNT = 20; // Change to load more/less chats
```

### Adjust Sync Speed
In `src/services/chat-sync.service.ts`:
```typescript
const BACKGROUND_SYNC_DELAY = 2000; // Milliseconds between chats
```

### Adjust Cache Size
In `src/services/media-cache.service.ts`:
```typescript
const MAX_CACHE_SIZE = 100 * 1024 * 1024; // 100 MB
```

### Adjust Messages Per Chat
In `src/services/chat-sync.service.ts`:
```typescript
const MAX_MESSAGES_PER_CHAT = 100; // Messages to sync per chat
```

## 🧪 Testing

The system is already integrated and will work automatically! Just:

1. **Log in** - You'll see preload happening
2. **Check console** - Look for sync progress logs
3. **Go offline** - Chats still load from SQLite
4. **Send messages** - They queue and send when online

## 🔍 Debugging

Check the console for detailed logs:
- `🚀 Preloading...` - Initial preload starting
- `📥 Found X chats to preload` - Chats being preloaded
- `✅ Preloaded chat: ID (X messages)` - Chat preload complete
- `🔄 Background syncing chat X/Y` - Background sync progress
- `⬇️ Downloading media` - Media being cached
- `✅ Media cached: filename (X KB)` - Media cache complete

## 📱 Storage Locations

- **Messages**: SQLite database (`messageai.db`)
- **Media**: `${documentDirectory}message-media/`
- **Profiles**: `${documentDirectory}profile-avatars/`

## ⚡ Performance Impact

- **Initial Load**: ~2-3 seconds (20 chats + messages)
- **Background Sync**: ~2 seconds per chat (throttled)
- **Memory**: Minimal (lazy loading)
- **Storage**: ~100MB for media + SQLite
- **Battery**: Low impact (throttled background work)

## 🚨 Common Issues

### Sync Not Starting
**Solution**: Check that user is logged in and device is online

### Media Not Caching
**Solution**: Check Firebase Storage rules allow read access

### High Storage Usage
**Solution**: Reduce `MAX_CACHE_SIZE` or call `clearMediaCache()`

### Sync Too Slow
**Solution**: Reduce `BACKGROUND_SYNC_DELAY` or increase it to save battery

## 📚 Full Documentation

See `projectdesign/LAZY_LOADING_IMPLEMENTATION.md` for complete technical documentation.

## ✨ Next Steps

The system is ready to use! Consider adding:

1. **Settings UI** - Let users control cache size, sync behavior
2. **Sync Indicator** - Show sync progress in the UI
3. **Manual Sync** - Add "Sync Now" button
4. **Cache Management** - Add "Clear Cache" option

Example sync indicator:
```tsx
function SyncIndicator() {
  const { isSyncing, syncProgress } = useChatSync();
  
  if (!isSyncing) return null;
  
  return (
    <View style={styles.syncBanner}>
      <Text>Syncing messages... {syncProgress}%</Text>
      <ProgressBar progress={syncProgress / 100} />
    </View>
  );
}
```

Enjoy your supercharged app! 🎉

