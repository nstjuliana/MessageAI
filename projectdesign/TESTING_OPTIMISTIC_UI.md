# Testing Optimistic UI Feature

## Quick Start

### 1. Run the App
```bash
npm start
```

### 2. Test Scenarios

#### Scenario 1: Basic Message Sending (Online)
**Expected Behavior:**
1. Open a chat
2. Type a message
3. Press send
4. ✅ Message appears instantly with `○` (sending) indicator
5. ✅ Within 1-2 seconds, indicator changes to `✓` (sent)
6. ✅ Message appears in chat list with updated "last message"

**What to Look For:**
- Instant message appearance (no delay)
- Smooth status indicator transition
- Message persists after app restart

#### Scenario 2: Offline Message Sending
**Expected Behavior:**
1. Enable airplane mode on device
2. Open a chat
3. Type and send a message
4. ✅ Message appears instantly with `○` (sending) indicator
5. ✅ Message saved to SQLite
6. Disable airplane mode
7. ✅ Indicator should change to `✓` (sent) automatically

**What to Look For:**
- Message appears even without internet
- Message stays in "sending" state while offline
- Automatic sync when reconnected

#### Scenario 3: Failed Message
**Expected Behavior:**
1. Send a message with invalid permissions (or force error)
2. ✅ Message appears with `○` (sending) initially
3. ✅ After error, indicator changes to `!` (failed)
4. ✅ Message remains in chat with failed indicator
5. ✅ Can be retried later

**What to Look For:**
- Clear failed indicator
- Message doesn't disappear
- Retry capability (future feature)

#### Scenario 4: Chat Loading Performance
**Expected Behavior:**
1. Force quit the app
2. Reopen and navigate to a chat
3. ✅ Messages load instantly from SQLite
4. ✅ Firestore sync happens in background
5. ✅ Any new messages appear smoothly

**What to Look For:**
- Instant message display (from cache)
- No loading spinner for cached messages
- Smooth updates when new messages arrive

#### Scenario 5: Multiple Message Rapid Fire
**Expected Behavior:**
1. Send 5-10 messages rapidly
2. ✅ All messages appear instantly
3. ✅ All have sending indicators
4. ✅ Indicators update to sent one by one
5. ✅ All messages sync successfully

**What to Look For:**
- No UI lag
- All messages tracked correctly
- Proper ordering maintained
- No duplicates

#### Scenario 6: Real-time Sync Between Devices
**Expected Behavior:**
1. Open same chat on two devices
2. Send message from Device A
3. ✅ Message appears instantly on Device A
4. ✅ Message appears on Device B within 1-2 seconds
5. ✅ Both devices show consistent state

**What to Look For:**
- Real-time delivery
- Consistent message ordering
- No duplicate messages

## Debugging

### Check SQLite Database
```typescript
// Add to chat screen temporarily
import { getDatabaseStats } from '@/database/database';

// In useEffect:
getDatabaseStats().then(stats => {
  console.log('Database Stats:', stats);
});
```

### Check Message Status
```typescript
// Look for these console logs:
📤 Sending message (optimistic): { id, chatId, text }
✅ Message inserted into SQLite
✅ Message sent to Firestore
✅ Chat last message updated
✅ Message status updated to "sent"
```

### Check Failed Messages
```typescript
import { getFailedMessages } from '@/services/message.service';

// Get all failed messages
const failed = await getFailedMessages();
console.log('Failed messages:', failed);
```

### Check Queued Messages
```typescript
import { getQueuedMessages } from '@/services/message.service';

// Get all queued messages
const queued = await getQueuedMessages();
console.log('Queued messages:', queued);
```

## Common Issues

### Issue 1: Messages Not Appearing
**Possible Causes:**
- Database not initialized
- Firestore permissions issue
- Network error

**Debug Steps:**
1. Check console for errors
2. Verify Firestore security rules
3. Check network connectivity
4. Verify user is authenticated

### Issue 2: Status Not Updating
**Possible Causes:**
- Callback not registered
- State not updating
- Background task failed

**Debug Steps:**
1. Check if status change callback is firing
2. Verify SQLite update
3. Check Firestore write logs

### Issue 3: Duplicate Messages
**Possible Causes:**
- Multiple listeners
- ID collision
- Sync logic issue

**Debug Steps:**
1. Check for multiple Firestore listeners
2. Verify message deduplication in merge logic
3. Check ID generation

### Issue 4: Messages Lost on Restart
**Possible Causes:**
- SQLite not syncing
- Database cleared
- Read query issue

**Debug Steps:**
1. Check SQLite insert logs
2. Verify database persistence
3. Check read query

## Performance Benchmarks

### Target Metrics:
- **Message Send Latency:** < 50ms (to appear in UI)
- **Firestore Sync:** < 2 seconds (typical)
- **SQLite Read:** < 10ms (for 50 messages)
- **UI Update:** < 16ms (60 FPS)

### Measuring Performance:
```typescript
// Add timing logs
const start = performance.now();
await sendMessageOptimistic(data);
const end = performance.now();
console.log(`Message send took ${end - start}ms`);
```

## Test Coverage

### Unit Tests
Run message service tests:
```bash
npm test -- message.service.test.ts
```

Expected: All 8 tests passing ✅

### Integration Tests (Manual)
- [ ] Send message online
- [ ] Send message offline
- [ ] Rapid fire messages
- [ ] Failed message handling
- [ ] App restart persistence
- [ ] Two-device sync
- [ ] Status indicator updates

## Success Criteria

✅ Messages appear instantly (< 50ms)  
✅ Status indicators work correctly  
✅ Offline queueing works  
✅ Messages persist after restart  
✅ No duplicate messages  
✅ No linting errors  
✅ All tests passing  
✅ No console errors  

## Next Steps After Testing

1. **If all tests pass:** Move to tasks 80-85 (Receive Messages)
2. **If issues found:** Debug and fix before proceeding
3. **Performance issues:** Optimize SQLite queries or Firestore writes
4. **UX improvements:** Add retry button, better error messages, etc.

## Reporting Issues

When reporting issues, include:
1. Device type and OS version
2. Network condition (online/offline/slow)
3. Console logs
4. Steps to reproduce
5. Expected vs actual behavior
6. Screenshots/video if possible

---

**Ready to Test?** Start with Scenario 1 (Basic Message Sending) and work through each scenario systematically.

