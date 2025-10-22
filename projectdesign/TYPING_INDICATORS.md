# Typing Indicators Implementation

## Overview
Real-time typing indicators show when other users are actively typing in a chat, with smart debouncing and auto-clear functionality.

## Features

### ✅ Implemented (Tasks 99-104)
1. ✅ **Firestore Typing Status** - `chats/{chatId}/typing/{userId}` documents
2. ✅ **Debounced Updates** - Only updates Firestore once per second max
3. ✅ **Auto-Clear** - Clears typing status after 3 seconds of inactivity
4. ✅ **Real-time Listening** - Listens for other users' typing status
5. ✅ **UI Display** - Shows "User is typing..." indicator
6. ✅ **Multiple Users** - Handles multiple users typing in groups

## Architecture

### Services

#### `src/services/typing.service.ts`
```typescript
// Set user as typing
setUserTyping(chatId, userId)

// Clear user's typing status  
clearUserTyping(chatId, userId)

// Listen to typing status changes
onTypingStatusChange(chatId, currentUserId, callback)
```

### Hooks

#### `src/hooks/useTypingIndicator.ts`
```typescript
const { onTypingStart, clearTyping } = useTypingIndicator(chatId, userId);

// Call on TextInput change
onTypingStart();

// Call when sending message
clearTyping();
```

**Features:**
- **Debouncing**: Updates Firestore max once per second
- **Auto-clear**: Clears typing status after 3s of inactivity
- **Cleanup**: Clears typing status when leaving chat

## Configuration

### Timing Constants
```typescript
TYPING_TIMEOUT = 1000ms       // Clear after 3 seconds
TYPING_DEBOUNCE = 1000ms      // Update Firestore max once per second
```

## Firestore Structure

### Typing Document
```typescript
chats/{chatId}/typing/{userId}
{
  isTyping: true,
  updatedAt: serverTimestamp()
}
```

**Lifecycle:**
- Created when user starts typing
- Deleted when user stops typing (3s timeout or sends message)
- Temporary - automatically cleaned up

## Security Rules

```javascript
match /typing/{userId} {
  // Participants can read all typing statuses in their chats
  allow read: if isAuthenticated() && 
                 request.auth.uid in get(/databases/$(database)/documents/chats/$(chatId)).data.participantIds;
  
  // Users can only write their own typing status
  allow write: if isOwner(userId);
}
```

## UI Display

### Single User
```
"Noah is typing..."
```

### Two Users
```
"Noah and Sarah are typing..."
```

### Multiple Users (3+)
```
"3 people are typing..."
```

### Styling
```typescript
{
  fontSize: 13,
  color: '#8E8E93',      // Light gray
  fontStyle: 'italic',   // Italic text
  paddingHorizontal: 20,
  paddingVertical: 8,
}
```

## Integration in Chat Screen

### 1. Hook Setup
```typescript
const { onTypingStart, clearTyping } = useTypingIndicator(chatId, userId);
const [typingUserIds, setTypingUserIds] = useState<string[]>([]);
```

### 2. Listen for Typing Status
```typescript
useEffect(() => {
  const unsubscribe = onTypingStatusChange(chatId, user.uid, (typingIds) => {
    setTypingUserIds(typingIds);
  });
  return () => unsubscribe();
}, [chatId, user]);
```

### 3. TextInput Integration
```typescript
<TextInput
  onChangeText={(text) => {
    setMessageText(text);
    onTypingStart();  // Trigger typing status
  }}
/>
```

### 4. Clear on Send
```typescript
const handleSend = async () => {
  clearTyping();  // Clear typing status
  // ... send message
};
```

### 5. Display Indicator
```typescript
{typingUserIds.length > 0 && (
  <View style={styles.typingIndicator}>
    <Text style={styles.typingText}>
      {getTypingText()}
    </Text>
  </View>
)}
```

## How It Works

### User Starts Typing
1. User types in TextInput
2. `onTypingStart()` called (debounced)
3. After 1s, `setUserTyping()` writes to Firestore
4. Timer set to auto-clear after 3s

### User Continues Typing
1. User types more
2. `onTypingStart()` called again
3. If < 1s since last update: only reset 3s timer
4. If ≥ 1s since last update: update Firestore + reset timer

### User Stops Typing
1. 3 seconds pass with no typing
2. Timer fires → `clearUserTyping()` called
3. Firestore document deleted
4. Other users no longer see typing indicator

### User Sends Message
1. `handleSend()` called
2. `clearTyping()` immediately called
3. Firestore document deleted
4. Message sent

### Other Users See Typing
1. Firestore listener detects new typing document
2. `onTypingStatusChange` callback fired
3. `setTypingUserIds()` updates state
4. UI renders typing indicator
5. After 3s or when deleted, indicator disappears

## Performance Optimizations

### 1. Debouncing
- Prevents excessive Firestore writes
- Updates max once per second
- Reduces costs significantly

### 2. Auto-Clear
- Automatic cleanup after 3s
- No manual intervention needed
- Handles edge cases (user closes app, loses connection)

### 3. Non-Critical
- Errors don't throw
- Silent failures (typing not critical)
- Doesn't block message sending

### 4. Efficient Queries
- Only listens to typing subcollection
- Filters out current user
- Small documents (2 fields)

## Error Handling

### Permission Errors
```typescript
try {
  await setUserTyping(chatId, userId);
} catch (error) {
  console.error('Failed to set typing status:', error);
  // Don't throw - typing indicators are not critical
}
```

### Network Failures
- Typing status may not update
- Auto-clears after 3s anyway
- Doesn't affect messaging functionality

### Edge Cases
- **User closes app**: Firestore cleans up stale data
- **Connection lost**: Status auto-clears after 3s
- **Multiple devices**: Each device has separate typing doc

## Testing

### Test 1: Basic Typing
1. User A opens chat
2. User B starts typing
3. User A should see "User B is typing..."
4. User B stops typing
5. After 3s, indicator disappears

### Test 2: Message Send
1. User B starts typing
2. User A sees typing indicator
3. User B sends message
4. Indicator disappears immediately

### Test 3: Multiple Users (Group)
1. User A, B, C in group chat
2. User B starts typing
3. User A and C see "User B is typing..."
4. User C starts typing
5. User A sees "User B and User C are typing..."

### Test 4: Debouncing
1. User B types rapidly
2. Check Firestore console
3. Should see max 1 update per second
4. Not 1 update per keystroke

## Console Logs

```typescript
// When user starts typing
✍️ Set typing status for user abc123 in chat xyz789

// When user stops typing
🛑 Cleared typing status for user abc123 in chat xyz789

// When listening starts
👀 Setting up typing status listener for chat: xyz789

// When typing detected
👀 Typing users in chat xyz789: ['abc123', 'def456']

// When listener cleaned up
👋 Cleaning up typing status listener for chat: xyz789
```

## Files Created/Modified

### New Files
1. `src/services/typing.service.ts` - Typing status management
2. `src/hooks/useTypingIndicator.ts` - Typing indicator hook
3. `projectdesign/TYPING_INDICATORS.md` - This documentation

### Modified Files
1. `app/chat/[chatId].tsx` - Integrated typing indicators
2. `firestore.rules` - Added typing subcollection rules
3. `projectdesign/task-list.md` - Marked tasks 99-104 complete

## Next Steps

- ⏳ Task 105-108: Message delivery status
- ⏳ Task 109-115: Read receipts
- ⏳ Task 116-121: Online/offline presence

## Cost Considerations

### Firestore Operations
- **Write**: 1 per second max while typing
- **Delete**: 1 per message sent or 3s timeout
- **Read**: Real-time listener (minimal cost)

### Example Cost (Heavy Usage)
- User types for 30 seconds = 30 writes
- User sends message = 1 delete
- 5 chats active simultaneously = 5 listeners
- Very low cost due to debouncing and auto-cleanup

## Related Tasks
- ✅ Task 99: Add typing status to Firestore
- ✅ Task 100: Update typing status on TextInput change (debounced)
- ✅ Task 101: Clear typing status after 3s inactivity
- ✅ Task 102: Listen for other users' typing status
- ✅ Task 103: Display "User is typing..." indicator
- ✅ Task 104: Handle multiple users typing in groups

