# Exponential Backoff Retry Implementation

## Overview
Implemented intelligent retry mechanism with exponential backoff for failed messages, preventing network/Firestore overload while ensuring reliable message delivery.

## Configuration

### Constants
- **MAX_RETRY_ATTEMPTS**: `5` - Maximum number of retry attempts
- **BASE_RETRY_DELAY**: `1000ms` (1 second) - Initial retry delay
- **MAX_RETRY_DELAY**: `60000ms` (60 seconds) - Maximum retry delay cap
- **RETRY_CHECK_INTERVAL**: `5000ms` (5 seconds) - How often to check for messages to retry

## Exponential Backoff Formula

```typescript
delay = min(BASE_DELAY * 2^retryCount, MAX_DELAY)
```

### Retry Schedule:
| Attempt | Delay     | Total Wait Time |
|---------|-----------|-----------------|
| 1       | 1 second  | 1s             |
| 2       | 2 seconds | 3s             |
| 3       | 4 seconds | 7s             |
| 4       | 8 seconds | 15s            |
| 5       | 16 seconds| 31s            |
| 6+      | 60 seconds (capped) | -     |

## How It Works

### 1. Message Fails to Send
```typescript
// First failure
retryCount = 0
lastRetryAt = null
status = 'failed'
→ Can retry immediately
```

### 2. First Retry Attempt
```typescript
// After 1 second
retryCount = 1
lastRetryAt = Date.now()
status = 'sending' → attempts → 'failed'
→ Must wait 2 seconds before next retry
```

### 3. Subsequent Retries
```typescript
// Each failure doubles the wait time
retryCount = 2 → wait 4 seconds
retryCount = 3 → wait 8 seconds
retryCount = 4 → wait 16 seconds
retryCount = 5 → STOP (max attempts reached)
```

### 4. shouldRetryMessage() Logic
```typescript
function shouldRetryMessage(retryCount: number, lastRetryAt: number | null): boolean {
  // Never retried? Go ahead!
  if (!lastRetryAt) return true;
  
  // Max attempts reached? Stop!
  if (retryCount >= MAX_RETRY_ATTEMPTS) return false;
  
  // Calculate required delay
  const requiredDelay = calculateBackoffDelay(retryCount);
  const timeSinceLastRetry = Date.now() - lastRetryAt;
  
  // Only retry if enough time has passed
  return timeSinceLastRetry >= requiredDelay;
}
```

## Network Retry Hook

### Periodic Check (Every 5 seconds)
```typescript
// Check for queued messages every 5 seconds
setInterval(processQueuedMessages, 5000);

// For each queued message:
//  - Check if enough time has passed (exponential backoff)
//  - If yes, attempt retry
//  - If no, skip and check again in 5 seconds
```

### Network Reconnection (Immediate)
```typescript
// When network comes back online
NetInfo.addEventListener((state) => {
  if (state.isConnected) {
    processQueuedMessages(); // Try immediately
  }
});
```

## Console Logs

### During Retry
```
🔄 Retrying message local_123_abc (attempt 2/5)
```

### Backoff Active
```
⏳ Message local_123_abc - retry 3/5 in 4s
```

### Success
```
✅ Message retry successful
```

### Failure with More Retries Available
```
❌ Message retry failed: [error]
⏳ Will retry again in 8s (attempt 4/5)
```

### Max Attempts Reached
```
❌ Message retry failed: [error]
❌ Max retry attempts reached (5). Message will not be retried.
```

## Benefits

### Before (No Backoff)
```
❌ Retry immediately → FAIL
❌ Retry immediately → FAIL
❌ Retry immediately → FAIL
❌ Retry immediately → FAIL
❌ Retry immediately → FAIL (gave up, wasted network)
```

### After (Exponential Backoff)
```
❌ Retry now → FAIL
⏳ Wait 1s
❌ Retry → FAIL
⏳ Wait 2s
❌ Retry → FAIL
⏳ Wait 4s
✅ Retry → SUCCESS! (issue resolved, message sent)
```

## Edge Cases Handled

### 1. Offline → Online Transition
- Immediate retry attempt when network restored
- Respects backoff if previous retry was recent

### 2. App Restart
- `lastRetryAt` and `retryCount` persist in SQLite
- Resumes backoff schedule after restart
- Doesn't reset retry count

### 3. Max Retries Reached
- Message stays in "failed" state
- No more automatic retry attempts
- User can manually retry if needed

### 4. Multiple Messages
- Each message has independent retry schedule
- 100ms delay between processing different messages
- Prevents Firestore overload

## Database Schema

### Messages Table Columns Used
```sql
retryCount INTEGER DEFAULT 0    -- Number of retry attempts
lastRetryAt INTEGER            -- Timestamp of last retry (ms)
queuedAt INTEGER               -- When message was first queued
syncedToFirestore INTEGER      -- 0 = not synced, 1 = synced
```

## Performance Impact

### Network Usage
- **Reduced**: Fewer unnecessary retry attempts
- **Smarter**: Waits for transient issues to resolve

### Firestore Costs
- **Lower**: Exponentially fewer write attempts
- **Efficient**: Most messages succeed within 1-3 attempts

### User Experience
- **Better**: Messages eventually send even with poor connectivity
- **Transparent**: Clear status indicators (⏱, ✓, !)
- **Reliable**: Automatic recovery from temporary failures

## Testing Scenarios

### Test 1: Temporary Network Glitch
1. Send message → Fails (timeout)
2. Wait 1s → Auto-retry → Success ✅

### Test 2: Extended Outage
1. Send message → Fails (offline)
2. Wait 1s → Retry → Fails
3. Wait 2s → Retry → Fails
4. Wait 4s → Retry → Fails
5. Network restored → Retry → Success ✅

### Test 3: Persistent Failure
1. Send message → Fails (invalid data)
2. Retry 5 times with exponential backoff
3. After attempt 5 → Stops retrying
4. Message marked as permanently failed
5. User can manually investigate/retry

## Configuration Tuning

### For Faster Retries
```typescript
const BASE_RETRY_DELAY = 500;  // 0.5s, 1s, 2s, 4s, 8s
```

### For More Patient Retries
```typescript
const BASE_RETRY_DELAY = 2000; // 2s, 4s, 8s, 16s, 32s
```

### For More Attempts
```typescript
const MAX_RETRY_ATTEMPTS = 10; // Up to 10 attempts
```

### For Less Frequent Checks
```typescript
const RETRY_CHECK_INTERVAL = 10000; // Check every 10 seconds
```

## Files Modified

1. **`src/services/message.service.ts`**
   - Added backoff configuration constants
   - Added `calculateBackoffDelay()` function
   - Added `shouldRetryMessage()` function
   - Updated `retryFailedMessage()` to use backoff
   - Enhanced logging with retry count/schedule

2. **`src/hooks/useNetworkRetry.ts`**
   - Added periodic retry check (every 5s)
   - Maintains network state listener
   - Respects backoff when checking messages
   - Prevents overwhelming Firestore

## Related Tasks

- ✅ Task 88: Implement retry mechanism
- ✅ Task 89: Listen to network state changes
- ✅ Task 90: Trigger retry on reconnection
- ✅ Task 91: Implement exponential backoff ← **THIS TASK**
- ⏳ Task 92: Display offline indicator

