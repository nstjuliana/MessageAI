# Auto-Retry Implementation

**Feature:** Automatically retry queued messages when network reconnects

## 🎯 How It Works

### 1. Network Detection
- Monitors network state using `@react-native-community/netinfo`
- Detects when device comes back online

### 2. Message Queue
- Messages sent offline stay in "sending" (○) state
- Stored in SQLite with `queuedAt` timestamp
- Not marked as "failed" - just queued

### 3. Auto-Retry on Reconnect
- When network comes back online → triggers retry
- Fetches all queued messages from SQLite
- Attempts to send each one to Firestore
- Updates status based on result

### 4. UI Update
- After retry completes → reloads messages from SQLite
- Status indicators update automatically
- User sees messages change from ○ to ✓

## 📁 Implementation Files

### `src/hooks/useNetworkRetry.ts` (NEW)
```typescript
- Listens to network state changes
- Calls getQueuedMessages() when online
- Retries each queued message
- Triggers callback to refresh UI
```

### `src/services/message.service.ts` (UPDATED)
```typescript
- Network check before Firestore write
- Messages stay "sending" when offline
- retryFailedMessage() now handles "sending" state
- 10-second timeout protection
```

### `app/chat/[chatId].tsx` (UPDATED)
```typescript
- Uses useNetworkRetry() hook
- Reloads messages after retry completes
- Status updates reflected in UI
```

## 🔄 Message Flow

### Offline → Send Message:
```
1. User sends message
2. Check network → Offline
3. Insert to SQLite with status "sending"
4. Return to UI (shows ○)
5. Skip Firestore write
```

### Reconnect → Auto Retry:
```
1. Network reconnects
2. NetInfo listener fires
3. Get queued messages from SQLite
4. For each message:
   - Try Firestore write
   - Update status to "sent" or "failed"
5. Reload messages from SQLite
6. UI updates (○ → ✓)
```

### Online → Send Message:
```
1. User sends message
2. Check network → Online
3. Insert to SQLite with status "sending"
4. Return to UI (shows ○)
5. Write to Firestore
6. Update status to "sent"
7. UI updates (○ → ✓)
```

## 🧪 Testing

### Test 1: Offline Queue
```
1. Enable airplane mode
2. Send a message
3. See: ○ (sending/queued)
4. Stays as ○ (not changing)
```

### Test 2: Auto-Retry
```
1. (While offline with queued message)
2. Disable airplane mode
3. Wait 1-2 seconds
4. Console shows: "🌐 Network connected - checking for queued messages..."
5. Console shows: "📤 Retrying X queued messages..."
6. Message updates: ○ → ✓
```

### Test 3: Multiple Messages
```
1. Enable airplane mode
2. Send 3 messages
3. All show: ○ (queued)
4. Disable airplane mode
5. All retry automatically
6. All update: ○ → ✓
```

## 📊 Console Logs to Watch For

### When Going Offline:
```
📴 Offline - message queued
```

### When Reconnecting:
```
🌐 Network connected - checking for queued messages...
📤 Retrying 3 queued messages...
✅ Message local_xxx retry successful
✅ Message local_yyy retry successful
✅ Message local_zzz retry successful
🔄 Reloading messages from SQLite...
```

## ⚡ Performance

- **Small delay between retries:** 100ms
- **Prevents Firestore overload:** Retries sequentially
- **UI updates after all retries:** Single batch update
- **Network listener:** Lightweight, minimal battery impact

## 🔧 Configuration

### Retry Delay (in hook):
```typescript
await new Promise(resolve => setTimeout(resolve, 100)); // 100ms
```

### Timeout (in message service):
```typescript
setTimeout(() => reject(new Error('Firestore write timeout')), 10000) // 10s
```

## 🎯 Status Indicators

| Icon | Status | Meaning |
|------|--------|---------|
| ○ | sending | Queued (offline) or in progress |
| ✓ | sent | Successfully sent to Firestore |
| ! | failed | Timeout or permanent error |

## 🚀 Future Enhancements

### Not Yet Implemented:
1. **Exponential Backoff:** Increase delay between retry attempts
2. **Max Retry Count:** Stop after X failed attempts
3. **Retry Button:** Manual retry for failed messages
4. **Batch Retry API:** Send multiple messages in one request
5. **Priority Queue:** Retry recent messages first

## ✅ Summary

**Before:**
- Messages showed ✓ even when offline (false positive)
- No automatic retry on reconnect
- User had to manually resend

**After:**
- Messages show ○ when offline (accurate)
- Automatic retry when back online
- Seamless user experience
- No manual intervention needed

---

**Result:** Professional, production-ready offline messaging system! 🎉

