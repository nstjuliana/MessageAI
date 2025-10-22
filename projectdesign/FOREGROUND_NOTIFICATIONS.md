# Foreground Notifications Implementation

## Overview

Foreground notifications display in-app banner notifications when a new message arrives while the user is actively using the app, but not viewing the specific chat where the message was sent.

## Architecture

### Components

#### 1. `InAppNotification` Component (`src/components/InAppNotification.tsx`)
- **Purpose**: Displays an animated banner at the top of the screen
- **Features**:
  - Slides down from top with smooth animation
  - Shows sender avatar, name, and message preview
  - Auto-dismisses after 4 seconds (configurable)
  - Tappable to navigate to the chat
  - Manual dismiss button
  - Shadow and elevation for visual prominence

#### 2. `NotificationContext` (`src/contexts/NotificationContext.tsx`)
- **Purpose**: Manages notification state and tracks the active chat
- **Key State**:
  - `currentNotification`: The notification being displayed
  - `activeChatId`: The chat the user is currently viewing
  - `lastProcessedMessageId`: Prevents duplicate notifications
- **Key Methods**:
  - `showNotification(notification)`: Display a notification (with auto-suppression)
  - `dismissNotification()`: Clear current notification
  - `setActiveChatId(chatId)`: Register which chat is active

#### 3. `useInAppNotifications` Hook (`src/hooks/useInAppNotifications.ts`)
- **Purpose**: Listens for new messages across all user's chats
- **Logic**:
  1. Listens to `onUserChatsSnapshot` for all user's chats
  2. Tracks `lastMessageTimestamp` for each chat
  3. Detects new messages by comparing timestamps
  4. Skips notifications for:
     - Initial load (existing messages)
     - Messages from the current user
     - Messages in the active chat
  5. Fetches sender info and triggers notification

### Integration

#### Authenticated Layout (`app/(authenticated)/_layout.tsx`)
```tsx
<NotificationProvider>
  <AuthenticatedContent />
    {/* Stack navigation */}
    <InAppNotification
      notification={currentNotification}
      onDismiss={dismissNotification}
    />
</NotificationProvider>
```

- `NotificationProvider` wraps the entire authenticated section
- `useInAppNotifications()` is called once at the app level
- `InAppNotification` component is rendered at the top level (floats over all screens)

#### Chat Screen (`app/(authenticated)/chat/[chatId].tsx`)
```tsx
const { setActiveChatId } = useNotifications();

useEffect(() => {
  if (chatId) {
    setActiveChatId(chatId); // Register as active
  }
  return () => {
    setActiveChatId(null); // Unregister on unmount
  };
}, [chatId]);
```

- Registers the chat as "active" when mounted
- Unregisters when unmounted (user leaves chat)
- This suppresses notifications for the active chat

## Notification Flow

### Scenario 1: User in Chat A, Receives Message in Chat B
```
1. Message arrives in Chat B
2. useInAppNotifications detects new message
3. Checks: activeChatId !== chatId ✓
4. Fetches sender info
5. Calls showNotification()
6. InAppNotification banner slides down
7. User can tap to navigate or wait for auto-dismiss
```

### Scenario 2: User in Chat A, Receives Message in Chat A
```
1. Message arrives in Chat A
2. useInAppNotifications detects new message
3. Checks: activeChatId === chatId ✗
4. Notification suppressed (user is already viewing)
5. Message just appears in chat UI
```

### Scenario 3: User on Chat List Screen
```
1. Message arrives in any chat
2. useInAppNotifications detects new message
3. Checks: activeChatId === null ✓ (no active chat)
4. Banner notification shown
5. Chat list updates with new message
```

## Smart Suppression Logic

The notification system intelligently suppresses notifications when:

1. **Active Chat**: User is viewing the chat where the message arrived
   - Checked via `activeChatId === notification.chatId`
   - Set in chat screen's `useEffect` on mount

2. **Own Messages**: User's own messages
   - Checked via `chat.lastMessageSenderId === user.uid`

3. **Duplicate Messages**: Same message processed twice
   - Tracked via `lastProcessedMessageId` ref

4. **Initial Load**: Existing messages on app load
   - Tracked via `isInitialLoad` ref flag

## Configuration

### Auto-Dismiss Delay
```tsx
<InAppNotification
  notification={currentNotification}
  onDismiss={dismissNotification}
  autoDismissDelay={4000} // 4 seconds (default)
/>
```

### Notification Data Structure
```typescript
interface NotificationData {
  id: string;              // Unique notification ID
  chatId: string;          // Chat where message arrived
  senderName: string;      // Display name of sender
  senderAvatarUrl?: string; // Avatar URL (optional)
  messageText: string;     // Message preview
  timestamp: number;       // Message timestamp
}
```

## Testing Scenarios

### Test 1: Basic Notification
1. Open app, navigate to Chat List
2. Have another user send a message
3. **Expected**: Banner notification appears at top
4. **Expected**: Auto-dismisses after 4 seconds

### Test 2: Active Chat Suppression
1. Open Chat A
2. Have another user send a message in Chat A
3. **Expected**: NO banner notification
4. **Expected**: Message appears directly in chat

### Test 3: Navigation
1. Open Chat List
2. Have another user send a message in Chat B
3. Tap the notification banner
4. **Expected**: Navigate to Chat B
5. **Expected**: Banner dismisses

### Test 4: Rapid Messages
1. Open Chat List
2. Have another user send 3 messages rapidly
3. **Expected**: Banner updates with latest message
4. **Expected**: Only one banner visible at a time

### Test 5: Manual Dismiss
1. Open Chat List
2. Have another user send a message
3. Tap the X button on banner
4. **Expected**: Banner slides up and disappears

## Future Enhancements

### Notification Queue
- Currently shows one notification at a time
- Could implement a queue to show multiple notifications sequentially

### Grouping
- Group multiple messages from same chat
- Show "3 new messages from John" instead of individual messages

### Persistent Badges
- Add badge count to chat list items
- Show unread message count

### Sounds & Haptics
- Add subtle notification sound (optional)
- Haptic feedback on notification arrival

### Custom Actions
- "Mark as Read" button
- "Reply" quick action
- "Mute" button for specific chats

### Priority Messages
- Special styling for @mentions in groups
- Urgent message indicators

## Integration with Push Notifications

When push notifications are implemented:

```typescript
// Foreground: Show in-app banner
if (appState === 'active') {
  showInAppNotification(notification);
}

// Background/Closed: Send push notification
if (appState === 'background' || appState === 'closed') {
  sendPushNotification(deviceToken, notification);
}
```

The foreground notification system will work seamlessly alongside push notifications:
- **App Active**: In-app banner (current implementation)
- **App Backgrounded**: System push notification (to be implemented)
- **App Closed**: System push notification (to be implemented)

## Performance Considerations

### Memory
- Only tracks one notification at a time
- Uses refs for timestamps (no re-renders)
- Cleans up listeners on unmount

### Network
- Reuses existing chat snapshot listeners
- No additional Firestore reads
- Sender info fetched once per notification

### Rendering
- Notification component only mounts when needed
- Animations use native driver (60 FPS)
- No layout shifts (position: absolute)

## Known Limitations

1. **Single Notification**: Only shows one notification at a time
   - Latest message replaces previous notification

2. **Web Events**: Uses `window.dispatchEvent` (may not work on all platforms)
   - Consider refactoring to use a more React-native approach

3. **No Persistence**: Notifications disappear on app restart
   - Could store unread notifications in local storage

4. **No Notification History**: Can't view past notifications
   - Could add a notification center screen

## Debugging

### Enable Notification Logs
All notification actions are logged with emojis:
- 🔔 "Setting up notification listener"
- 🔔 "Showing in-app notification"
- 📵 "Suppressing notification"
- 📱 "Registering active chat"
- 👋 "Cleaning up listeners"

### Common Issues

**Issue**: Notifications not appearing
- Check: Is `useInAppNotifications()` called in authenticated layout?
- Check: Is chat registered as active (`setActiveChatId` called)?
- Check: Are console logs showing "Suppressing notification"?

**Issue**: Duplicate notifications
- Check: Is `lastProcessedMessageId` being updated?
- Check: Are multiple listeners set up?

**Issue**: Notification persists after dismissing
- Check: Is `dismissNotification()` being called?
- Check: Is animation completing?

## Code Checklist

✅ InAppNotification component created
✅ NotificationContext created
✅ useInAppNotifications hook created
✅ Integrated into authenticated layout
✅ Chat screen registers active chat
✅ No linting errors
✅ TypeScript types defined
✅ Smart suppression logic
✅ Auto-dismiss functionality
✅ Tap-to-navigate functionality
✅ Animation with native driver
✅ Cleanup on unmount

## Next Steps

1. **Test on Physical Devices**: Test on iOS and Android
2. **Implement Push Notifications**: For background/closed app states
3. **Add Notification Preferences**: Allow users to customize behavior
4. **Add Sounds**: Optional notification sounds
5. **Add Badge Counts**: Show unread message counts

