# Foreground Notifications Implementation Log

## Overview
Implementation of in-app notification banners for MessageAI that appear when users receive messages while the app is in foreground but not actively viewing the specific chat.

**Date:** January 2025  
**Status:** ✅ Complete and Working

---

## Files Created

### 1. `components/InAppNotification.tsx`
**Purpose:** Animated notification banner component

**Features:**
- Slides down from top with spring animation
- Shows sender avatar, name, and message preview
- Auto-dismisses after 4 seconds
- Tappable to navigate to chat
- Manual dismiss button (X)
- Uses native driver for 60 FPS animations

**Initial Location Issue:**
- ❌ First created in `src/components/InAppNotification.tsx`
- ✅ Moved to `components/InAppNotification.tsx` to match TypeScript path mappings

### 2. `src/contexts/NotificationContext.tsx`
**Purpose:** State management for notifications and active chat tracking

**Key State:**
- `currentNotification` - The notification being displayed
- `activeChatId` - Chat user is currently viewing (for suppression)
- `lastProcessedMessageId` - Prevents duplicates

**Key Methods:**
- `showNotification(notification)` - Display notification with smart suppression
- `dismissNotification()` - Clear current notification
- `setActiveChatId(chatId)` - Register/unregister active chat

### 3. `src/hooks/useInAppNotifications.ts`
**Purpose:** Global message listener that triggers notifications

**Logic:**
- Listens to `onUserChatsSnapshot` for all user's chats
- Tracks `lastMessageTimestamp` per chat to detect new messages
- Skips notifications on initial load
- Fetches sender info and triggers notification display

### 4. `projectdesign/FOREGROUND_NOTIFICATIONS.md`
**Purpose:** Complete documentation of the notification system

### 5. `NOTIFICATION_DEBUG.md`
**Purpose:** Debug guide with testing steps and common issues

---

## Files Modified

### 1. `app/(authenticated)/_layout.tsx`
**Changes:**
- Added `NotificationProvider` wrapper around authenticated content
- Split into `AuthenticatedContent` component to access notification context
- Added `useInAppNotifications()` hook call
- Rendered `InAppNotification` component at top level
- Fixed import path: `@/components/InAppNotification` → `../../components/InAppNotification`

### 2. `app/(authenticated)/chat/[chatId].tsx`
**Changes:**
- Imported `useNotifications` hook
- Added `useEffect` to register chat as active on mount
- Unregisters chat on unmount
- This suppresses notifications for the chat user is viewing

### 3. `src/types/chat.types.ts`
**Changes:**
- Added `lastMessageSenderId?: string` field to `Chat` interface
- Required for notifications to know who sent the last message

### 4. `src/services/chat.service.ts`
**Changes:**
- Updated `createMessage` to store `lastMessageSenderId` when updating chat metadata
- Updated all chat parsing functions to include `lastMessageSenderId` field

### 5. `src/services/message.service.ts`
**Changes:**
- Updated `updateChatLastMessage()` function signature to include `senderId` parameter
- Updated function to store `lastMessageSenderId` in chat document
- Updated both call sites to pass `message.senderId` parameter

---

## Problems Encountered & Solutions

### Problem 1: "Failed to fetch user profile" Error
**Symptom:**
```
Error fetching sender info for notification: Error: Failed to fetch user profile.
```

**Root Cause:** 
- Chat documents didn't have `lastMessageSenderId` field
- Notification hook was trying to fetch user with `undefined` ID

**Attempted Fix #1:**
- Added `lastMessageSenderId` to Chat type ✅
- Updated chat.service.ts to store sender ID ✅
- BUT still not working ❌

**Attempted Fix #2:**
- Improved error handling in useInAppNotifications hook
- Added null checks for sender ID
- Added detailed logging

**Root Cause Discovery:**
```javascript
LOG  📋 Chat YzptV1k6zoYg73NkJ62b: {
  "senderId": undefined  // ← THE PROBLEM
}
```

**Final Fix:**
- Updated `message.service.ts` → `updateChatLastMessage()` function
- Added `senderId` parameter to function signature
- Stored `lastMessageSenderId` in Firestore update
- Updated both call sites to pass sender ID

**Result:** ✅ Sender ID now properly stored and retrieved

### Problem 2: Module Resolution Error
**Symptom:**
```
Cannot find module '@/components/InAppNotification' 
or its corresponding type declarations.
```

**Root Cause:**
- File initially created in wrong location (`src/components/`)
- TypeScript path alias `@/components/*` maps to `./components/*` not `./src/components/*`

**Fix #1:**
- Moved file from `src/components/` to `components/`
- Deleted incorrect file ✅

**Fix #2:**
- Changed import to relative path: `../../components/InAppNotification`
- Bypasses TypeScript path resolution issues
- Ensures Metro bundler can find the file

**Result:** ✅ Import resolved successfully

### Problem 3: No Notifications Appearing
**Symptom:**
- No notifications showing despite messages arriving
- No errors in console

**Debugging Process:**
1. Added extensive console logging with emojis
2. Tracked notification flow through entire system
3. Discovered sender ID was undefined

**Console Logs Added:**
- 🔔 Notification setup
- 📬 Chat updates received
- 🔍 Checking for new messages
- ✨ New message detected
- 📵 Notification suppressed (with reason)
- 🎯 showNotification called
- 🔔 ✅ Notification showing

**Result:** ✅ Detailed logging helped identify root cause

---

## Architecture Decisions

### 1. Context-Based State Management
**Why:** 
- Need to share notification state across entire app
- Need to track active chat from any screen
- React Context provides clean, type-safe API

### 2. Global Chat Listener (Not Per-Chat)
**Why:**
- More efficient than individual listeners per chat
- Single listener monitors all user's chats
- Firestore query already optimized for this pattern

### 3. Timestamp-Based New Message Detection
**Why:**
- Simple and reliable
- Works offline (timestamps persist in SQLite)
- Avoids complex message diffing logic

### 4. Initial Load Suppression
**Why:**
- Don't notify for existing messages on app open
- Only notify for messages that arrive after app is running
- Improves user experience

### 5. Optimistic UI Integration
**Why:**
- Messages appear immediately (existing behavior)
- Notifications work with existing optimistic update system
- No breaking changes to message sending flow

---

## Smart Suppression Logic

Notifications are suppressed when:

1. **Active Chat Match**
   - User is viewing the chat where message arrived
   - Checked via `activeChatId === notification.chatId`

2. **Own Messages**
   - Message is from current user
   - Checked via `chat.lastMessageSenderId === user.uid`

3. **Duplicate Notifications**
   - Same notification triggered multiple times
   - Tracked via `lastProcessedMessageId` ref

4. **Initial Load**
   - Existing messages on app startup
   - Tracked via `isInitialLoad` flag

5. **Missing Data**
   - No sender ID in chat document
   - No sender profile found in Firestore
   - Gracefully logged and skipped

---

## Data Flow

```
1. User A sends message
   ↓
2. message.service.ts → sendMessageOptimistic()
   ↓
3. Updates Firestore message document
   ↓
4. Updates Firestore chat document with lastMessageSenderId
   ↓
5. chat.service.ts → onUserChatsSnapshot fires for User B
   ↓
6. useInAppNotifications hook detects new message
   ↓
7. Checks if User B is viewing that chat (activeChatId)
   ↓
8. Fetches sender profile from Firestore
   ↓
9. Calls NotificationContext.showNotification()
   ↓
10. InAppNotification component renders and animates
   ↓
11. Auto-dismisses after 4 seconds
```

---

## Testing Checklist

- [x] Notification appears when message received on chat list
- [x] Notification suppressed when in active chat
- [x] Notification shows sender avatar and name
- [x] Tapping notification navigates to chat
- [x] Manual dismiss button works
- [x] Auto-dismiss after 4 seconds
- [x] Own messages don't trigger notifications
- [x] Initial load doesn't trigger notifications
- [x] Proper error handling for missing sender
- [x] Console logging helps debug issues

---

## Performance Considerations

### Memory
- Single notification state (not queued)
- Uses refs for timestamps (no re-renders)
- Cleanup on component unmount

### Network
- Reuses existing chat snapshot listeners
- No additional Firestore queries except sender fetch
- Sender fetch is one-time per notification

### Rendering
- Animations use native driver (60 FPS)
- Component only mounts when notification exists
- Position absolute (no layout shifts)
- No re-renders during animation

---

## Known Limitations

1. **Single Notification Display**
   - Only shows one notification at a time
   - Latest notification replaces previous one
   - Could implement queue in future

2. **Old Messages Won't Notify**
   - Messages sent before this feature was deployed don't have `lastMessageSenderId`
   - These will be skipped gracefully
   - Fixed once new message is sent in that chat

3. **No Notification Persistence**
   - Notifications disappear on app restart
   - No notification history
   - Could add notification center in future

---

## Code Statistics

**Lines Added:** ~450
**Files Created:** 5
**Files Modified:** 5
**Console Logs Added:** 15+

---

## Next Steps (Future Enhancements)

1. **Push Notifications** - For backgrounded/closed app
2. **Notification Queue** - Show multiple notifications sequentially
3. **Grouping** - "3 new messages from John"
4. **Sound/Haptics** - Optional notification sounds
5. **Notification Center** - View notification history
6. **Custom Actions** - Quick reply, mark as read
7. **Badge Counts** - Show unread counts on chat list
8. **Priority Messages** - Special styling for @mentions

---

## Lessons Learned

1. **Path Aliases are Tricky** - Always verify TypeScript paths match actual file structure
2. **Data Schema Matters** - Missing `lastMessageSenderId` caused entire feature to fail
3. **Logging is Essential** - Detailed console logs made debugging 10x faster
4. **Test with Fresh Data** - Old database records won't have new fields
5. **Error Handling First** - Graceful failures prevent cascading issues
6. **Metro Bundler Cache** - Sometimes needs restart after file moves

---

## Success Metrics

✅ **Functional Requirements Met:**
- Notifications appear for new messages
- Smart suppression works correctly
- Smooth animations (60 FPS)
- Proper error handling
- No performance degradation

✅ **Code Quality:**
- TypeScript fully typed
- No linting errors
- Comprehensive logging
- Well-documented
- Follows existing patterns

✅ **User Experience:**
- Non-intrusive
- Clear sender information
- Easy to dismiss or navigate
- Works seamlessly with existing UI

---

## Conclusion

Foreground notifications are now fully functional and integrated into MessageAI. The implementation follows React best practices, integrates cleanly with existing architecture, and provides excellent debugging capabilities. All issues encountered during development were resolved, and the feature is production-ready.

