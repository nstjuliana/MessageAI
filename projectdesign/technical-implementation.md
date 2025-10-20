# Technical Implementation Guide

## Offline Message Queue System

### Architecture Overview

```
User sends message
    ↓
[1] Optimistic UI Update (instant display)
    ↓
[2] Write to SQLite Queue (with status: "sending")
    ↓
[3] Attempt Firestore Write
    ↓
   Success? ──YES→ Update SQLite status to "sent" → Update UI
    ↓ NO
[4] Mark as "Not Delivered" in SQLite
    ↓
[5] Retry on reconnect (with order preservation)
```

### SQLite Schema for Message Queue

```sql
-- Local messages table
CREATE TABLE messages (
  id TEXT PRIMARY KEY,              -- UUID generated locally
  chatId TEXT NOT NULL,
  senderId TEXT NOT NULL,
  text TEXT,
  mediaUrl TEXT,
  status TEXT NOT NULL,             -- 'sending' | 'sent' | 'delivered' | 'read' | 'failed'
  createdAt INTEGER NOT NULL,       -- Unix timestamp
  sequenceNumber INTEGER NOT NULL,  -- For ordering retry attempts
  retryCount INTEGER DEFAULT 0,
  lastRetryAt INTEGER,
  firestoreId TEXT,                 -- Set once successfully written to Firestore
  FOREIGN KEY (chatId) REFERENCES chats(id)
);

CREATE INDEX idx_messages_chat ON messages(chatId, createdAt);
CREATE INDEX idx_messages_status ON messages(status);

-- Chat list table
CREATE TABLE chats (
  id TEXT PRIMARY KEY,
  type TEXT NOT NULL,               -- 'dm' | 'group'
  lastMessageText TEXT,
  lastMessageAt INTEGER,
  unreadCount INTEGER DEFAULT 0
);

-- Participants cache
CREATE TABLE chat_participants (
  chatId TEXT NOT NULL,
  userId TEXT NOT NULL,
  displayName TEXT,
  avatarUrl TEXT,
  PRIMARY KEY (chatId, userId)
);
```

### Message Send Flow (Detailed)

```typescript
async function sendMessage(chatId: string, text: string) {
  const localMessageId = generateUUID();
  const timestamp = Date.now();
  
  // 1. Optimistic UI - insert into SQLite immediately
  await db.runAsync(
    `INSERT INTO messages (id, chatId, senderId, text, status, createdAt, sequenceNumber)
     VALUES (?, ?, ?, ?, 'sending', ?, ?)`,
    [localMessageId, chatId, currentUserId, text, timestamp, timestamp]
  );
  
  // 2. Update UI (trigger re-render)
  notifyUIUpdate(chatId);
  
  // 3. Attempt Firestore write
  try {
    const firestoreDoc = await firestore
      .collection('chats')
      .doc(chatId)
      .collection('messages')
      .add({
        senderId: currentUserId,
        text,
        status: 'sent',
        createdAt: firebase.firestore.FieldValue.serverTimestamp(),
        edited: false
      });
    
    // 4. Update SQLite with Firestore ID and status
    await db.runAsync(
      `UPDATE messages SET status = 'sent', firestoreId = ? WHERE id = ?`,
      [firestoreDoc.id, localMessageId]
    );
    
    // 5. Update UI with success state
    notifyUIUpdate(chatId);
    
  } catch (error) {
    console.error('Failed to send message:', error);
    
    // 6. Mark as failed in SQLite
    await db.runAsync(
      `UPDATE messages SET status = 'failed', retryCount = retryCount + 1, lastRetryAt = ?
       WHERE id = ?`,
      [Date.now(), localMessageId]
    );
    
    // 7. Update UI to show "Not Delivered"
    notifyUIUpdate(chatId);
  }
}
```

### Retry Mechanism

```typescript
// Called when network connection is restored
async function retryFailedMessages() {
  // Get all failed messages, ordered by sequence number
  const failedMessages = await db.getAllAsync(
    `SELECT * FROM messages 
     WHERE status = 'failed' 
     ORDER BY sequenceNumber ASC`
  );
  
  for (const message of failedMessages) {
    // Exponential backoff based on retry count
    const backoffMs = Math.min(1000 * Math.pow(2, message.retryCount), 30000);
    
    if (Date.now() - message.lastRetryAt < backoffMs) {
      continue; // Skip if within backoff period
    }
    
    try {
      // Update status to sending
      await db.runAsync(
        `UPDATE messages SET status = 'sending' WHERE id = ?`,
        [message.id]
      );
      
      // Attempt Firestore write
      const firestoreDoc = await firestore
        .collection('chats')
        .doc(message.chatId)
        .collection('messages')
        .add({
          senderId: message.senderId,
          text: message.text,
          status: 'sent',
          createdAt: firebase.firestore.FieldValue.serverTimestamp(),
          edited: false
        });
      
      // Success - update SQLite
      await db.runAsync(
        `UPDATE messages SET status = 'sent', firestoreId = ? WHERE id = ?`,
        [firestoreDoc.id, message.id]
      );
      
      notifyUIUpdate(message.chatId);
      
    } catch (error) {
      // Failed again - update retry count
      await db.runAsync(
        `UPDATE messages SET status = 'failed', retryCount = retryCount + 1, lastRetryAt = ?
         WHERE id = ?`,
        [Date.now(), message.id]
      );
    }
  }
}

// Listen for network state changes
NetInfo.addEventListener(state => {
  if (state.isConnected) {
    retryFailedMessages();
  }
});
```

### Message Ordering Guarantees

- **sequenceNumber**: Timestamp when message was created locally
- Messages retry in order of `sequenceNumber` (not retry time)
- This ensures chronological order is preserved
- If message #2 fails but #3 succeeds, #2 will retry before #4 is sent

---

## Push Notifications Setup

### Important: React Native Does NOT Include Push Notifications by Default

React Native does not have built-in push notification support. You need to add it manually.

### Required Setup for Expo

**1. Install Expo Notifications**
```bash
npx expo install expo-notifications expo-device expo-constants
```

**2. Configure Firebase Cloud Messaging (FCM)**
- FCM is required for both iOS and Android push notifications in Expo
- Create Firebase project (if not already done)
- Download `google-services.json` (Android) and `GoogleService-Info.plist` (iOS)
- Add to your Expo app config

**3. Update app.json**
```json
{
  "expo": {
    "plugins": [
      [
        "expo-notifications",
        {
          "icon": "./assets/images/notification-icon.png",
          "color": "#ffffff"
        }
      ]
    ],
    "android": {
      "googleServicesFile": "./google-services.json"
    },
    "ios": {
      "googleServicesFile": "./GoogleService-Info.plist"
    }
  }
}
```

### Device Token Registration Flow

```typescript
import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import { Platform } from 'react-native';

// Configure notification behavior
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

async function registerForPushNotifications() {
  let token;

  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('default', {
      name: 'default',
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#FF231F7C',
    });
  }

  if (Device.isDevice) {
    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;
    
    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }
    
    if (finalStatus !== 'granted') {
      alert('Failed to get push token for push notification!');
      return;
    }
    
    // Get Expo push token
    token = (await Notifications.getExpoPushTokenAsync({
      projectId: 'your-project-id' // From app.json
    })).data;
    
  } else {
    alert('Must use physical device for Push Notifications');
  }

  return token;
}

// Store token in Firestore
async function saveDeviceToken(userId: string, token: string) {
  await firestore
    .collection('users')
    .doc(userId)
    .update({
      deviceTokens: firebase.firestore.FieldValue.arrayUnion(token)
    });
}

// Usage on login
const token = await registerForPushNotifications();
if (token) {
  await saveDeviceToken(currentUser.uid, token);
}
```

### Sending Push Notifications from Firebase Cloud Functions

```typescript
// Firebase Cloud Function
import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';

export const sendMessageNotification = functions.firestore
  .document('chats/{chatId}/messages/{messageId}')
  .onCreate(async (snap, context) => {
    const message = snap.data();
    const { chatId } = context.params;
    
    // Get chat participants (excluding sender)
    const chatDoc = await admin.firestore().collection('chats').doc(chatId).get();
    const participants = chatDoc.data()?.participants || [];
    const recipients = participants.filter((id: string) => id !== message.senderId);
    
    // Get sender info
    const senderDoc = await admin.firestore().collection('users').doc(message.senderId).get();
    const senderName = senderDoc.data()?.displayName || 'Someone';
    
    // Get device tokens for all recipients
    const recipientDocs = await Promise.all(
      recipients.map(id => admin.firestore().collection('users').doc(id).get())
    );
    
    const tokens: string[] = [];
    recipientDocs.forEach(doc => {
      const deviceTokens = doc.data()?.deviceTokens || [];
      tokens.push(...deviceTokens);
    });
    
    if (tokens.length === 0) {
      return null;
    }
    
    // Send notification via Expo Push API
    const messages = tokens.map(token => ({
      to: token,
      sound: 'default',
      title: senderName,
      body: message.text,
      data: { chatId, messageId: snap.id },
    }));
    
    const response = await fetch('https://exp.host/--/api/v2/push/send', {
      method: 'POST',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(messages),
    });
    
    return response.json();
  });
```

### Handling Notifications in App

```typescript
// Listen for notifications when app is in foreground
useEffect(() => {
  const subscription = Notifications.addNotificationReceivedListener(notification => {
    console.log('Notification received:', notification);
    // Update UI, show in-app notification, etc.
  });

  return () => subscription.remove();
}, []);

// Handle notification tap (opens app)
useEffect(() => {
  const subscription = Notifications.addNotificationResponseReceivedListener(response => {
    const chatId = response.notification.request.content.data.chatId;
    // Navigate to chat screen
    navigation.navigate('Chat', { chatId });
  });

  return () => subscription.remove();
}, []);
```

### Testing Push Notifications

**Foreground (Easiest)**:
- App is open
- Send message from another device
- Notification appears as banner

**Background (Medium)**:
- App is minimized
- Send message from another device
- Notification appears in notification tray
- Tap to open app to specific chat

**Closed App (Hardest)**:
- Force quit app
- Send message from another device
- Notification appears in notification tray
- Tap to launch app to specific chat

**⚠️ Important**: 
- Push notifications only work on physical devices (not simulators/emulators)
- You'll need 2 physical devices to test properly
- Or use Expo Go on one device + emulator on another

---

## Group Chat "Seen by All" Implementation

### Current DB Schema Support

The `readReceipts` subcollection already supports this:

```
chats/{chatId}/readReceipts/{userId}
  - lastReadMessageId: string
  - lastReadAt: timestamp
```

### Implementation Logic

```typescript
interface Message {
  id: string;
  senderId: string;
  text: string;
  createdAt: Date;
}

interface ReadReceipt {
  userId: string;
  lastReadMessageId: string;
  lastReadAt: Date;
}

async function getReadReceiptsForMessage(
  chatId: string, 
  messageId: string,
  participants: string[]
): Promise<{seenBy: string[], seenByAll: boolean}> {
  
  // Get all read receipts for this chat
  const receiptsSnapshot = await firestore
    .collection('chats')
    .doc(chatId)
    .collection('readReceipts')
    .get();
  
  const receipts: ReadReceipt[] = receiptsSnapshot.docs.map(doc => ({
    userId: doc.id,
    ...doc.data()
  }));
  
  // Get the creation time of the target message
  const messageDoc = await firestore
    .collection('chats')
    .doc(chatId)
    .collection('messages')
    .doc(messageId)
    .get();
  
  const messageTime = messageDoc.data()?.createdAt.toDate();
  
  // Check which participants have read past this message
  const seenBy = receipts
    .filter(receipt => {
      // User has read if their lastReadAt is after this message's createdAt
      return receipt.lastReadAt.toDate() >= messageTime;
    })
    .map(receipt => receipt.userId);
  
  // Check if all participants (except sender) have seen it
  const sender = messageDoc.data()?.senderId;
  const expectedReaders = participants.filter(p => p !== sender);
  const seenByAll = expectedReaders.every(userId => seenBy.includes(userId));
  
  return { seenBy, seenByAll };
}

// Usage in UI
function MessageReadStatus({ message, chatType, participants }) {
  const [readStatus, setReadStatus] = useState({ seenBy: [], seenByAll: false });
  
  useEffect(() => {
    if (chatType === 'group') {
      getReadReceiptsForMessage(message.chatId, message.id, participants)
        .then(setReadStatus);
    }
  }, [message.id]);
  
  if (chatType === 'dm') {
    return <Text>{message.status === 'read' ? '✓✓' : '✓'}</Text>;
  }
  
  if (chatType === 'group') {
    if (readStatus.seenByAll) {
      return <Text>Seen by all</Text>;
    } else if (readStatus.seenBy.length > 0) {
      return <Text>Seen by {readStatus.seenBy.length}</Text>;
    } else {
      return <Text>Delivered</Text>;
    }
  }
}
```

### Optimization for Large Groups

For groups > 20 people, checking every read receipt can be expensive. Consider:

1. **Lazy loading**: Only check read receipts when user taps "View Details"
2. **Aggregation**: Use Cloud Functions to maintain a count field
3. **Simplified UI**: Show "Seen by 15" instead of listing names

```typescript
// Optimized version for large groups
function MessageReadStatusOptimized({ message, participantCount }) {
  const [seenCount, setSeenCount] = useState(0);
  
  useEffect(() => {
    // Just count receipts, don't load full data
    const unsubscribe = firestore
      .collection('chats')
      .doc(message.chatId)
      .collection('readReceipts')
      .where('lastReadAt', '>=', message.createdAt)
      .onSnapshot(snapshot => {
        setSeenCount(snapshot.size);
      });
    
    return unsubscribe;
  }, [message.id]);
  
  const totalRecipients = participantCount - 1; // Exclude sender
  
  if (seenCount === totalRecipients) {
    return <Text>✓✓ Seen by all</Text>;
  } else if (seenCount > 0) {
    return <Text>✓ Seen by {seenCount}</Text>;
  } else {
    return <Text>✓ Delivered</Text>;
  }
}
```

---

## Message Pagination Strategy

### SQLite + Firestore Hybrid

```typescript
const MESSAGES_PER_PAGE = 20;

async function loadChatMessages(chatId: string, page: number = 0) {
  if (page === 0) {
    // First load: get latest 20 from SQLite
    const localMessages = await db.getAllAsync(
      `SELECT * FROM messages 
       WHERE chatId = ? 
       ORDER BY createdAt DESC 
       LIMIT ${MESSAGES_PER_PAGE}`,
      [chatId]
    );
    
    // If we have less than 20, fetch from Firestore
    if (localMessages.length < MESSAGES_PER_PAGE) {
      const firestoreMessages = await fetchFromFirestore(chatId, MESSAGES_PER_PAGE);
      
      // Store in SQLite
      await saveMessagesToSQLite(firestoreMessages);
      
      return firestoreMessages;
    }
    
    return localMessages.reverse(); // Oldest to newest for display
  } else {
    // Pagination: always fetch from Firestore
    const oldestLocalMessage = await db.getFirstAsync(
      `SELECT * FROM messages WHERE chatId = ? ORDER BY createdAt ASC LIMIT 1`,
      [chatId]
    );
    
    const olderMessages = await firestore
      .collection('chats')
      .doc(chatId)
      .collection('messages')
      .orderBy('createdAt', 'desc')
      .startAfter(oldestLocalMessage.createdAt)
      .limit(MESSAGES_PER_PAGE)
      .get();
    
    const messages = olderMessages.docs.map(doc => doc.data());
    
    // Optionally cache in SQLite (with cleanup strategy)
    // await saveMessagesToSQLite(messages);
    
    return messages.reverse();
  }
}

// React component with infinite scroll
function ChatScreen({ chatId }) {
  const [messages, setMessages] = useState([]);
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  
  const loadMore = async () => {
    const newMessages = await loadChatMessages(chatId, page);
    
    if (newMessages.length < MESSAGES_PER_PAGE) {
      setHasMore(false);
    }
    
    setMessages([...newMessages, ...messages]);
    setPage(page + 1);
  };
  
  useEffect(() => {
    loadMore();
  }, []);
  
  return (
    <FlatList
      data={messages}
      onEndReached={hasMore ? loadMore : undefined}
      onEndReachedThreshold={0.5}
      inverted // Show newest at bottom
      renderItem={({ item }) => <MessageBubble message={item} />}
    />
  );
}
```

### SQLite Cleanup Strategy

Since we only keep last 20 messages per chat:

```typescript
async function cleanupOldMessages(chatId: string) {
  // Keep only the latest 20 messages
  await db.runAsync(
    `DELETE FROM messages 
     WHERE chatId = ? 
     AND id NOT IN (
       SELECT id FROM messages 
       WHERE chatId = ? 
       ORDER BY createdAt DESC 
       LIMIT ${MESSAGES_PER_PAGE}
     )`,
    [chatId, chatId]
  );
}

// Call after successful message send or receive
await cleanupOldMessages(chatId);
```

---

## Summary

### ✅ Your Offline Queue Approach is Solid

The approach you described is exactly right:
1. Optimistic UI ✓
2. Try Firestore write ✓
3. On fail, mark "Not Delivered" + queue in SQLite ✓
4. Track order and retry on reconnect ✓

**Key additions**:
- Add `sequenceNumber` field for ordering
- Implement exponential backoff for retries
- Listen to `NetInfo` for connection changes

### ⚠️ Push Notifications Require Setup

React Native does **NOT** include push notifications by default. You must:
1. Install `expo-notifications`
2. Set up Firebase Cloud Messaging
3. Register device tokens
4. Send notifications from Cloud Functions
5. Test on **physical devices** (not emulators)

### ✅ Group Chat "Seen by All" Supported

Current DB schema supports this via `readReceipts` subcollection. Implementation:
- Query read receipts for all participants
- Check if `lastReadAt >= messageCreatedAt` for each
- Show "Seen by all" when all participants (except sender) have read

### ✅ Message Pagination Strategy is Good

- Keep last 20 in SQLite
- Load more from Firestore on scroll
- Reset to latest 20 on return to chat
- Consider cleanup job to prevent SQLite bloat

