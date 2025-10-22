# Comprehensive Activity Detection for Presence Tracking

## Overview
The presence tracking system now detects **ANY user interaction** across the app and automatically updates the user's status to "online", resetting the away timer.

## Problem Fixed
**Before:** Users would go to "away" status even while actively using the app if they were only scrolling, reading messages, or interacting with the UI without typing.

**After:** ANY interaction (scrolling, tapping, typing, refreshing, navigating) immediately resets the user to "online" status.

## Implementation

### 1. Core Hook: `usePresenceTracking.ts`

#### Away Timer Fixed
- **Before:** Set to 10 seconds (bug in code comment)
- **After:** Correctly set to 5 minutes (300000ms)

#### Activity Detection
The `resetActivityTimer()` function now:
1. Logs activity detection: `👆 User activity detected - resetting to online`
2. Sets user status to "online"
3. Resets the 5-minute away timer
4. Updates `lastSeen` timestamp

```typescript
const resetActivityTimer = () => {
  if (!user) return;
  
  console.log('👆 User activity detected - resetting to online');
  
  // Set user back to online
  updatePresence(user.uid, 'online');
  
  // Clear existing timer and start new one
  startAwayTimer();
  
  // Update lastSeen on activity
  updateLastSeen(user.uid);
};
```

### 2. Chat Screen Activity Detection

Added activity detection for:

#### a. **Scrolling Messages**
```typescript
<FlatList
  onScroll={resetActivityTimer}
  scrollEventThrottle={1000}  // Throttle to once per second
  // ...
/>
```

#### b. **Any Touch on Screen**
```typescript
<KeyboardAvoidingView
  onStartShouldSetResponder={() => {
    resetActivityTimer();
    return false; // Don't capture the event, just track it
  }}
>
```

#### c. **Pull to Refresh**
```typescript
const handleRefresh = async () => {
  resetActivityTimer();
  setRefreshing(true);
  // ...
};
```

#### d. **Typing in Input** (Already existed)
```typescript
<TextInput
  onFocus={resetActivityTimer}
  // ...
/>
```

#### e. **Sending Messages** (Already existed)
```typescript
const handleSend = async () => {
  resetActivityTimer();
  // ...
};
```

### 3. Chats List Screen Activity Detection

Added activity detection for:

#### a. **Scrolling Chat List**
```typescript
<FlatList
  onScroll={resetActivityTimer}
  scrollEventThrottle={1000}
  // ...
/>
```

#### b. **Tapping on a Chat** (Already existed)
```typescript
<TouchableOpacity
  onPress={() => {
    resetActivityTimer();
    router.push(`/chat/${item.id}`);
  }}
>
```

#### c. **Pull to Refresh**
```typescript
const handleRefresh = async () => {
  resetActivityTimer();
  setRefreshing(true);
  // ...
};
```

#### d. **Tapping New Chat Button** (Already existed)
```typescript
<TouchableOpacity
  onPress={() => {
    resetActivityTimer();
    router.push('/(authenticated)/new-chat');
  }}
>
```

## Activity Detection Hierarchy

### Global (App-wide)
1. **App foreground/background changes** - Tracked by `usePresenceTracking` hook
2. **App initialization** - Sets user online when hook mounts

### Screen-level
1. **Any touch on screen** - `onStartShouldSetResponder` on KeyboardAvoidingView
2. **Scrolling** - `onScroll` on FlatLists (throttled to 1/second)
3. **Pull-to-refresh** - `handleRefresh` functions
4. **Button taps** - All major interaction points
5. **Text input focus** - When user starts typing

## Console Logs for Debugging

### Activity Detection
- `👆 User activity detected - resetting to online` - Any interaction detected
- `⏰ User inactive for 5 minutes - setting status to away` - User went away

### App State Changes
- `App came to foreground - setting user online` - App opened
- `App went to background - setting user offline` - App minimized

### Presence Updates
- `👁️ Setting up presence listener for user: <userId>` - Listening for other user's status
- `🔄 Presence updated for <userId>: <status>` - Other user's status changed
- `👋 Cleaning up presence listener for user: <userId>` - Stopped listening

## Testing

### Test Scenario 1: Chat Scrolling
1. Open a chat
2. Wait 5 minutes (or temporarily reduce away timer to 10 seconds for testing)
3. User status should go to "away" (🟠 orange dot)
4. Scroll the chat messages
5. ✅ User status should immediately go back to "online" (🟢 green dot)

### Test Scenario 2: Chat List Scrolling
1. Be on the chats list screen
2. Wait 5 minutes
3. User status should go to "away"
4. Scroll the chat list
5. ✅ User status should immediately go back to "online"

### Test Scenario 3: Just Looking at Messages
1. Open a chat and read messages without scrolling
2. Wait 5 minutes
3. User status should go to "away"
4. Tap anywhere on the screen
5. ✅ User status should immediately go back to "online"

### Test Scenario 4: Pull to Refresh
1. Be on any screen with pull-to-refresh
2. Wait 5 minutes
3. User status should go to "away"
4. Pull down to refresh
5. ✅ User status should immediately go back to "online"

## Performance Considerations

### Scroll Throttling
- Scroll events are throttled to once per second (`scrollEventThrottle={1000}`)
- Prevents excessive Firestore writes
- Still responsive enough for good UX

### onStartShouldSetResponder
- Returns `false` so it doesn't interfere with other touch handlers
- Only tracks the touch, doesn't capture it
- Minimal performance impact

## Future Enhancements

1. **More Granular Activity Types**
   - Track what type of activity (typing, scrolling, tapping)
   - Could be useful for analytics

2. **Adjustable Away Timer**
   - User preference for away timeout (1min, 5min, 15min, never)
   - Currently hardcoded to 5 minutes

3. **"Do Not Disturb" Mode**
   - User can manually set status and prevent auto-updates
   - Useful for focused work

4. **Custom Status Messages**
   - "In a meeting", "Busy", "Available", etc.
   - Rich presence beyond online/away/offline

## Related Files

- `src/hooks/usePresenceTracking.ts` - Core presence tracking logic
- `app/chat/[chatId].tsx` - Chat screen with activity detection
- `app/(authenticated)/chats.tsx` - Chats list with activity detection
- `src/services/user.service.ts` - Firestore presence update functions

## Related Tasks

- ✅ Activity detection on all interactions (current)
- ✅ Fix away timer (was 10s, now 5min)
- ⏳ Task 116-121: Complete presence system implementation
- ⏳ Task 179: Display online/offline indicator in chat header (partially done)
- ⏳ Task 180: Display "last seen" timestamp when offline

