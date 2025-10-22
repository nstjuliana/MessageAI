# Notification System Debug Guide

## Step-by-Step Testing Process

### 1. Check Console Logs on App Start

When you open the app, you should see:
```
🔔 Setting up global in-app notification listener
📬 Chat update received: X chat(s)
🔄 Initial load - recording timestamps for X chats
  - Chat xxx: timestamp xxx, senderId: xxx
📱 Initial chat load complete, notifications armed
💡 Current activeChatId: null
```

**If you DON'T see these logs:**
- The NotificationProvider isn't initialized
- The useInAppNotifications hook isn't being called
- Check that you're logged in

### 2. Navigate to Chat List Screen

Make sure you're on the main chat list (NOT inside a chat).

Console should show:
```
💡 Current activeChatId: null
```

**If activeChatId is not null:**
- You're still registered in a chat
- Navigate back to the chat list

### 3. Have Another User Send a Message

From a different device/account, send a message to you.

You should see these logs:
```
📬 Chat update received: X chat(s)
🔍 Checking for new messages...
  📋 Chat xxx: { lastMessageAt: xxx, lastTimestamp: xxx, isNew: true, senderId: xxx, activeChatId: null }
✨ NEW MESSAGE DETECTED in chat: xxx
🔔 Triggering notification for message from: John Doe
🎯 showNotification called with: { senderName: 'John Doe', chatId: 'xxx', activeChatId: null, messageText: 'Hello...' }
🔔 ✅ SHOWING IN-APP NOTIFICATION: John Doe
```

**Then the notification banner should appear!**

## Common Issues & Solutions

### Issue 1: "Initial load" logs appear on every message
**Problem:** `isInitialLoad` flag keeps resetting
**Solution:** Check if the hook is being remounted repeatedly

### Issue 2: "Skipping notification - user is viewing chat"
**Problem:** You're testing while inside a chat
**Solution:** Navigate to the chat list screen before testing

### Issue 3: "Skipping notification - own message"
**Problem:** You're sending yourself a message
**Solution:** Use a different account or have someone else send you a message

### Issue 4: "Skipping notification - no sender ID"
**Problem:** Old chat documents don't have `lastMessageSenderId`
**Solution:** Send a NEW message (which will update the field)

### Issue 5: No logs at all
**Problem:** Hook not initialized
**Solution:** Check that NotificationProvider is wrapping your app

### Issue 6: "NEW MESSAGE DETECTED" but no notification shows
**Problem:** Component not rendering or styling issue
**Solution:** Check InAppNotification component is in the layout

## Manual Verification Checklist

- [ ] NotificationProvider wraps authenticated content
- [ ] useInAppNotifications() is called in AuthenticatedContent
- [ ] InAppNotification component is rendered in layout
- [ ] You're logged in with a valid account
- [ ] You're on the Chat List screen (not inside a chat)
- [ ] Message is from ANOTHER user (not yourself)
- [ ] Message is NEW (sent after app opened)

## Quick Test Commands

Open browser console and look for:
1. `🔔` - Notification setup
2. `📱` - Initial load complete
3. `✨` - New message detected
4. `🔔 ✅` - Notification showing

## Testing Scenarios

### Scenario A: Simple Test (Recommended)
1. Open app → Navigate to Chat List
2. Have friend send message from different device
3. Watch console and screen

### Scenario B: Self Test
1. Open app on Device A → Navigate to Chat List
2. Open app on Device B → Open a chat with Device A
3. Send message from Device B
4. Watch Device A for notification

### Scenario C: Group Chat Test
1. Create a group chat with 3+ people
2. Navigate to Chat List on your device
3. Have another member send a message
4. Watch for notification

## Next Steps

Copy your console logs and share them to diagnose the issue!

