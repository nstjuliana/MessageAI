# MVP Scope - 24 Hour Deadline

**Goal**: Prove your messaging infrastructure is solid. Reliable message delivery > fancy features.

---

## ✅ IN SCOPE - Must Have

### 1. User Authentication
- Email/password sign up
- Email/password login
- Profile creation (display name, optional avatar)
- Logout functionality
- Auth state persistence

### 2. One-on-One Messaging
- Start new DM with any user
- Send text messages
- Receive messages in real-time
- Message timestamps
- Optimistic UI (message appears instantly)
- Message status: sending → sent → delivered → read
- Read receipts (checkmarks)
- Offline message persistence (survives app restart)
- Offline message queue (send when reconnected)

### 3. Chat List Screen
- List of all conversations (DMs + groups)
- Last message preview
- Timestamp of last message
- Sort by most recent
- Navigate to conversation on tap

### 4. Presence & Status
- Online/offline indicators
- "Last seen" timestamp when offline
- Typing indicators ("User is typing...")
- Auto-update presence based on app state

### 5. Group Chat
- Create group with 3+ participants
- Send messages in group
- See who sent each message (sender name/avatar)
- Message delivery tracking
- Basic "seen by" functionality

### 6. Push Notifications
- Foreground notifications (message arrives while app is open)
- Notification shows sender name and message preview
- Tapping notification opens the relevant chat

### 7. Offline Support
- View chat history when offline
- Send messages while offline (queued)
- Receive missed messages on reconnect
- SQLite local storage (last 20 messages per chat)
- Network state detection

### 8. Deployment
- App runs on iOS Simulator
- App runs on Android Emulator
- Firebase backend deployed (Auth, Firestore, Storage, Functions)
- Deployable to Expo Go (for physical device testing)

---

## ❌ OUT OF SCOPE - NOT for MVP

### Features to Skip (Save for Post-MVP)
- ❌ Image/media sharing
- ❌ Message replies (quote/reply to specific message)
- ❌ Message editing
- ❌ Message deletion
- ❌ Message reactions (emoji reactions)
- ❌ Voice messages
- ❌ Video messages
- ❌ File attachments
- ❌ Message forwarding
- ❌ Starred/pinned messages
- ❌ Message search
- ❌ Chat archiving
- ❌ Contact blocking
- ❌ Group admin features (beyond basic creation)
- ❌ Group invites/links
- ❌ User profiles (beyond basic name/avatar)
- ❌ Settings screens (beyond logout)
- ❌ Dark mode
- ❌ Custom themes
- ❌ Background notifications (foreground only for MVP)
- ❌ Notification sound customization
- ❌ Any AI features (these come in final phase)

### Technical Features to Skip
- ❌ End-to-end encryption
- ❌ Message backup/export
- ❌ Multi-device sync
- ❌ Voice/video calls
- ❌ Sophisticated caching strategies
- ❌ Advanced performance optimizations
- ❌ Analytics tracking
- ❌ Error reporting (Sentry/Crashlytics)
- ❌ App onboarding/tutorial
- ❌ Rate limiting
- ❌ Spam detection

---

## 🎯 MVP Success Criteria (Hard Gates)

All of these MUST work:

1. ✅ **Two users can chat in real-time**
   - Send message from Device A → appears on Device B within 500ms

2. ✅ **Messages persist after restart**
   - Force quit app → reopen → chat history still there

3. ✅ **Optimistic UI works**
   - Send message → appears immediately (before server confirms)
   - Updates with delivery status (sending → sent → delivered)

4. ✅ **Online/offline indicators work**
   - User goes offline → status updates for other users
   - Shows "last seen" timestamp

5. ✅ **Message timestamps display correctly**
   - Every message shows time sent

6. ✅ **User authentication functional**
   - Can sign up, login, logout
   - Auth state persists

7. ✅ **Group chat works with 3+ users**
   - Create group → all members receive messages
   - Shows sender info for each message

8. ✅ **Read receipts visible**
   - DM: Single/double checkmarks
   - Group: "Seen by X" or "Seen by all"

9. ✅ **Foreground push notifications work**
   - Receive notification when app is open
   - Tap notification → opens correct chat

10. ✅ **Runs on both platforms**
    - iOS Simulator works
    - Android Emulator works

11. ✅ **Backend deployed**
    - Firebase services active
    - Cloud Functions deployed

---

## 🧪 Testing Scenarios (All Must Pass)

Before submitting MVP, test these:

1. **Real-time messaging**
   - Two devices (or emulator + physical device)
   - Send messages back and forth
   - Both should receive instantly

2. **Offline → Online**
   - Device A goes offline (airplane mode)
   - Device B sends messages
   - Device A comes back online
   - Device A receives all missed messages

3. **Backgrounded app**
   - App in background
   - Receive new message
   - Foreground notification appears

4. **Persistence test**
   - Send several messages
   - Force quit app (swipe away)
   - Reopen app
   - All messages still visible

5. **Offline send**
   - Go offline (airplane mode)
   - Send 5 messages
   - Messages show "sending" or "not delivered"
   - Go back online
   - All messages send successfully

6. **Rapid-fire messages**
   - Send 20+ messages quickly
   - All appear in correct order
   - All sync to other device
   - No messages lost

7. **Group chat**
   - Create group with 3+ people
   - All members send messages
   - Everyone receives all messages
   - "Seen by" status updates correctly

---

## 📊 Performance Targets

- **Optimistic UI**: Message appears in sender's UI < 100ms
- **Message delivery**: Recipient receives within 500ms (good network)
- **App launch**: Shows chat list within 2 seconds
- **Typing indicator**: Updates within 1 second

---

## 🏗️ Technical Architecture (MVP)

### Frontend
- React Native + Expo
- Expo Router (single main screen)
- SQLite (local storage)
- NetInfo (network detection)
- Expo Notifications (foreground only)

### Backend
- Firebase Auth (email/password)
- Firestore (messages, chats, users)
- Firebase Storage (profile pictures only)
- Firebase Cloud Functions (push notifications)
- Firebase Cloud Messaging (FCM)

### Data Storage
- **Firestore**: Persistent data (messages, chats, users)
- **SQLite**: Local cache (last 20 messages per chat)
- **AsyncStorage**: Auth persistence

---

## 📱 Screens Required for MVP

1. **Auth Screens**
   - Login
   - Sign Up
   - Profile Setup (first-time users)

2. **Main App Screens**
   - Chat List (main screen)
   - Chat Conversation
   - New Chat (user search)
   - Create Group Chat

3. **Modals**
   - Settings (minimal - just logout)

---

## 🚀 Build Order (Recommended)

1. **Phase 0**: Firebase + deployment setup (DONE)
2. **Phase 1**: Auth + profile setup
3. **Phase 2**: Chat list + conversation UI
4. **Phase 3**: Send/receive messages (real-time)
5. **Phase 4**: Offline support + persistence
6. **Phase 5**: Group chat
7. **Phase 6**: Read receipts + typing indicators
8. **Phase 7**: Push notifications
9. **Phase 8**: Testing + bug fixes

---

## ⏰ Time Budget (24 Hours)

- Setup & Auth: 4 hours
- Core messaging: 8 hours
- Group chat: 4 hours
- Notifications: 4 hours
- Testing & fixes: 4 hours

---

## 💡 Key Principles

1. **Vertical slices**: Finish one feature completely before starting another
2. **Test as you go**: Test on real devices frequently
3. **Simple first**: Get basic version working, then improve
4. **No premature optimization**: Focus on working, not perfect
5. **Cut scope aggressively**: If running out of time, drop group chat or notifications (but keep core messaging)

---

## 🎯 Minimum Viable MVP

If you're REALLY short on time, the absolute minimum is:

- ✅ Auth (login/signup)
- ✅ One-on-one messaging (real-time)
- ✅ Message persistence (offline support)
- ✅ Basic presence (online/offline)
- ✅ Message timestamps

Everything else can technically be added post-MVP, but aim for the full list above!

---

## What Comes After MVP

See `projectdesign/PRD.md` for the full 7-day plan:
- Days 2-4: Media sharing, message replies, UI polish
- Days 5-6: AI features (based on chosen persona)
- Day 7: Final polish, demo video, submission

