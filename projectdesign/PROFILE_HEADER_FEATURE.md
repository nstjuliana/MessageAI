# Profile Picture Header with Status Indicator

## Overview
The chat screen header now displays a circular profile picture with a real-time status indicator instead of just text.

## Implementation

### Features Added
1. **Circular Profile Picture**: Shows the first letter of the user's name in a styled avatar
2. **Status Indicator**: Small colored dot showing presence status
   - 🟢 Green: Online
   - 🟠 Orange: Away
   - ⚪ Gray: Offline
3. **Name Display**: User's name appears below the avatar
4. **Group Chat Support**: Group chats still show group name with participant count

### Visual Design
```
┌─────────────────────────┐
│  ‹ Back    [N]     ⋯    │  ← Header with circular avatar
│            Noah          │  ← Name below avatar
│            🟢           │  ← Status indicator (bottom-right of avatar)
└─────────────────────────┘
```

### Status Colors
- **Online** (`#34C759`): Green - User is actively using the app
- **Away** (`#FF9500`): Orange - User is idle/inactive for 5+ minutes
- **Offline** (`#8E8E93`): Gray - User is not connected

### Components Modified

#### `app/chat/[chatId].tsx`
1. **New Imports**:
   ```typescript
   import { doc, onSnapshot } from 'firebase/firestore';
   import { db } from '@/config/firebase';
   ```

2. **New Helper Functions**:
   ```typescript
   getOtherParticipant(): Returns the other participant in a DM
   getPresenceColor(presence): Returns the appropriate color for status
   ```

3. **Real-time Presence Listener** (NEW):
   - Separate `useEffect` hook that listens for presence changes
   - Uses Firestore's `onSnapshot` on the user document
   - Updates `participants` state when presence changes
   - Automatically updates the UI (status dot color)
   - Only runs for DM chats (not groups)
   - Properly cleans up listener on unmount

4. **Updated Header JSX**:
   - DM chats: Show circular avatar with status dot
   - Group chats: Show group name with participant count
   
5. **New Styles**:
   - `headerAvatarContainer`: Container for avatar and name
   - `headerAvatar`: 40x40 circular avatar with relative positioning
   - `headerAvatarText`: White text for initial letter
   - `statusDot`: 12x12 absolute-positioned status indicator
   - `headerName`: Name text below avatar
   - `headerTextContainer`: Container for group chat info
   - `headerSubtitle`: Participant count text

### Status Indicator Position
The status dot is positioned at the **bottom-right** of the avatar using:
```typescript
position: 'absolute',
bottom: 0,
right: 0,
borderWidth: 2,      // White border for visibility
borderColor: '#fff'
```

## How Real-time Updates Work

The status indicator updates in real-time thanks to Firestore's `onSnapshot` listener:

1. **Setup**: When a DM chat loads, a listener is attached to the other user's document
2. **Listen**: Firestore sends updates whenever the `presence` field changes
3. **Update**: The `participants` state is updated with the new presence value
4. **Render**: React re-renders the header with the new status dot color
5. **Cleanup**: Listener is removed when leaving the chat (component unmount)

**Console Logs:**
- `👁️ Setting up presence listener for user: <userId>` - Listener created
- `🔄 Presence updated for <userId>: <status>` - Status changed
- `👋 Cleaning up presence listener for user: <userId>` - Listener removed

## Future Enhancements
- **Profile Pictures**: Use actual uploaded profile pictures instead of initials
- **Tap to View Profile**: Make the header avatar tappable to view full profile
- **Custom Status Messages**: "Busy", "In a meeting", etc.
- **Group Presence**: Show online count for group chats

## Related Tasks
- ✅ Visual header improvement (current task)
- ⏳ Task 116-121: Online/Offline Presence tracking
- ⏳ Task 179: Display online/offline indicator in chat header
- ⏳ Task 180: Display "last seen" timestamp when offline

## Testing
1. Open any DM chat
2. Verify circular avatar appears with first letter of name
3. Check status indicator is visible at bottom-right
4. Verify name appears below avatar
5. Test with group chats - should show group name + participant count

## Notes
- Currently uses the `presence` field from user data
- If no presence data exists, defaults to "offline" (gray)
- Avatar color is `#007AFF` (iOS blue) to match app theme
- Works for both iOS and Android

