# Product Requirements Document: MessageAI

## Project Overview

**Goal**: Build a production-quality cross-platform messaging app with intelligent AI features tailored to a specific user persona.

**Timeline**: 7-day sprint
- MVP Deadline: Tuesday (24 hours)
- Early Submission: Friday (4 days)
- Final Submission: Sunday (7 days)

**Tech Stack**:
- Frontend: React Native + Expo
- Backend: Firebase (Firestore, Cloud Functions, Auth, Cloud Messaging)
- AI: OpenAI GPT-4 / Anthropic Claude via Cloud Functions
- Agent Framework: AI SDK by Vercel / OpenAI Swarm / LangChain
- Local Storage: Expo SQLite
- Deployment: Expo Go

---

## Persona Selection (DECISION REQUIRED)

Choose ONE persona to build for:

| Persona | Target Users | Primary Use Case |
|---------|-------------|------------------|
| **Remote Team Professional** | Distributed engineering teams | Thread management, action tracking, decision logging |
| **International Communicator** | Multilingual families/colleagues | Real-time translation, cultural context |
| **Busy Parent/Caregiver** | Parents coordinating schedules | Calendar extraction, deadline tracking |
| **Content Creator/Influencer** | YouTubers managing DMs | Message categorization, response automation |

---

## Phase 1: MVP (24 Hours)

### MVP User Stories

**Authentication & Profiles**
- [ ] As a user, I can sign up with phone number/email so I can create an account
- [ ] As a user, I can set my display name and profile picture so others can identify me
- [ ] As a user, I can see my profile information

**One-on-One Messaging**
- [ ] As a user, I can start a direct message conversation with another user
- [ ] As a user, I can send text messages that appear instantly in my chat
- [ ] As a user, I can see when my message is sending/sent/delivered/read
- [ ] As a user, I can receive messages in real-time from other users
- [ ] As a user, I can see message timestamps
- [ ] As a user, I can see read receipts on my messages

**Presence & Status**
- [ ] As a user, I can see if other users are online/offline
- [ ] As a user, I can see when someone is typing
- [ ] As a user, my online status updates automatically

**Offline Support**
- [ ] As a user, I can view my chat history when offline
- [ ] As a user, messages I send while offline queue and send when I reconnect
- [ ] As a user, I receive messages sent while I was offline when I come back online

**Group Chat**
- [ ] As a user, I can create a group chat with 3+ participants
- [ ] As a user, I can send messages in a group chat
- [ ] As a user, I can see who sent each message in a group
- [ ] As a user, I can see delivery status for group messages

**Push Notifications**
- [ ] As a user, I receive notifications for new messages when in foreground
- [ ] As a user, I see notification badges for unread messages

### MVP Success Criteria

**Hard Gates (Must Pass)**:
- ✅ Two users can exchange messages in real-time
- ✅ Messages persist after app restart
- ✅ Optimistic UI updates (messages appear immediately)
- ✅ Online/offline indicators work correctly
- ✅ Message timestamps displayed
- ✅ User authentication functional
- ✅ Group chat with 3+ users working
- ✅ Read receipts visible
- ✅ Foreground push notifications working
- ✅ App runs on iOS Simulator AND Android Emulator
- ✅ Backend deployed to Firebase

**Performance Targets**:
- Message appears in sender's UI < 100ms
- Message delivered to recipient < 500ms (good connection)
- App launches and shows chat list < 2 seconds

**Testing Scenarios (Must All Pass)**:
1. Two devices chatting in real-time
2. One device offline → receives messages → comes online
3. Messages received while app is backgrounded
4. App force-quit and reopened (persistence test)
5. Airplane mode → send messages → reconnect
6. Send 20+ rapid-fire messages
7. Group chat with 3+ participants sending simultaneously

---

## Phase 2: Final Product (7 Days)

### Core Messaging Enhancement Stories

**Media Support**
- [ ] As a user, I can send images in chats
- [ ] As a user, I can view images sent by others
- [ ] As a user, images are cached locally for offline viewing

**Advanced Messaging**
- [ ] As a user, I can reply to specific messages
- [ ] As a user, I can see typing indicators for multiple users
- [ ] As a user, I can see message delivery status for each group member
- [ ] As a user, messages sent while offline show queued status

**Enhanced Notifications**
- [ ] As a user, I receive push notifications when app is backgrounded
- [ ] As a user, I receive push notifications when app is closed
- [ ] As a user, tapping a notification opens the relevant chat

### AI Feature Stories (Depends on Persona)

**Required for ALL Personas (5 Features)**

Will vary based on chosen persona. Example for Remote Team Professional:

- [ ] As a user, I can summarize long conversation threads
- [ ] As a user, I can extract action items from conversations
- [ ] As a user, I can search conversations semantically (not just keywords)
- [ ] As a user, I get notified of priority/urgent messages
- [ ] As a user, I can track decisions made in conversations

**Advanced Feature (Choose 1)**

Example options for Remote Team Professional:
- [ ] Multi-Step Agent: Plans team offsites, coordinates schedules autonomously
- [ ] Proactive Assistant: Auto-suggests meeting times, detects scheduling needs

### AI Integration Requirements

- [ ] RAG pipeline for conversation history retrieval
- [ ] Function calling / tool use capabilities
- [ ] User preference storage and learning
- [ ] Memory/state management across sessions
- [ ] Error handling and graceful degradation
- [ ] Response caching to reduce API costs

### Final Product Success Criteria

**Messaging Infrastructure**:
- ✅ All MVP features working reliably
- ✅ Image sharing functional
- ✅ Message replies working
- ✅ Background/closed push notifications delivered
- ✅ Handles poor network conditions (3G, packet loss)
- ✅ No message loss scenarios (crash recovery works)

**AI Features**:
- ✅ All 5 required persona-specific AI features functional
- ✅ 1 advanced AI feature functional
- ✅ AI responses accurate and contextually relevant
- ✅ AI features integrate smoothly into UX (not clunky)
- ✅ Edge cases handled (empty conversations, mixed languages, etc.)

**Production Readiness**:
- ✅ Deployed via Expo Go (working link)
- ✅ Comprehensive README with setup instructions
- ✅ 5-7 minute demo video showing all scenarios
- ✅ 1-page Persona Brainlift document
- ✅ Social post published

**Performance**:
- Message delivery < 500ms on good connection
- App remains responsive with 1000+ messages in chat
- AI features respond within 5 seconds (non-blocking)
- Smooth scrolling through long chat histories

---

## Technical Architecture

### Frontend (React Native + Expo)

**Navigation**: Expo Router
- Auth screens (sign up, login)
- Chat list screen
- Chat conversation screen
- Group chat creation screen
- AI assistant interface screen
- Profile/settings screen

**State Management**: 
- React Context or Zustand for global state
- Real-time Firebase listeners for chat updates

**Local Storage**: 
- Expo SQLite for message persistence
- Cache conversation history
- Queue pending messages

**Real-time Sync**:
- Firebase Firestore listeners
- WebSocket fallback
- Offline queue with retry logic

### Backend (Firebase)

**Firestore Collections**:
- `users` - User profiles, presence, device tokens
- `chats` - Chat metadata
  - `messages` (subcollection) - Message content, status
  - `readReceipts` (subcollection) - Read tracking
- `aiResults` (optional) - Cached AI responses

**Cloud Functions**:
- `sendMessage` - Message delivery orchestration
- `updatePresence` - User online/offline status
- `sendPushNotification` - FCM notifications
- `aiSummarize` - AI summarization endpoint
- `aiExtractActions` - Action item extraction
- `aiTranslate` - Translation endpoint (if International persona)
- `aiCategorize` - Message categorization (if Creator persona)
- Additional endpoints per persona requirements

**Firebase Auth**: 
- Email/password or phone authentication
- Custom claims for user roles

**Firebase Cloud Messaging**: 
- Push notifications for new messages
- Background/foreground notification handling

### AI Integration

**LLM Provider**: OpenAI GPT-4 or Anthropic Claude

**Agent Framework**: AI SDK by Vercel / OpenAI Swarm / LangChain

**RAG Pipeline**:
- Vector embeddings of conversation history
- Semantic search over messages
- Context retrieval for AI prompts

**Tools/Functions**:
- `getConversationHistory(chatId, limit)`
- `searchMessages(query, chatId)`
- `getUserPreferences(userId)`
- `extractStructuredData(messages)`
- `sendMessage(chatId, text)` (for agent-initiated messages)

---

## Key Areas of Concern

### Critical Technical Challenges

1. **Offline Message Queue Reliability**
   - How do we ensure messages never get lost?
   - What happens if user sends 50 messages offline?
   - How do we handle conflicts if message order changes?

2. **Real-time Sync Performance**
   - How do we efficiently sync 1000+ messages on first load?
   - Do we paginate or lazy load?
   - How do we handle rapid-fire messages without UI lag?

3. **Push Notification Reliability**
   - FCM setup for both iOS and Android
   - Device token management and refresh
   - Testing closed-app notifications on physical devices

4. **Group Chat Complexity**
   - Read receipts with multiple participants (expensive?)
   - Typing indicators for 10+ users
   - Delivery status tracking per recipient

5. **AI Response Time**
   - LLM calls can take 3-10 seconds
   - How do we show progress/loading states?
   - Do we cache common requests?
   - Rate limiting and cost management

6. **Local Storage Size**
   - SQLite can grow large with many chats
   - Do we prune old messages?
   - How do we handle media caching?

### Decisions Made

**Persona Selection**:
- ✅ Deferred until post-MVP (focus on core messaging first)

**Offline Message Queue Strategy**:
- ✅ Optimistic UI updates (message appears immediately)
- ✅ Attempt Firestore write
- ✅ On failure: mark as "Not Delivered" + store in SQLite queue
- ✅ Track message order for sequential retry on reconnect
- ✅ Retry mechanism with exponential backoff

**Local Storage Strategy**:
- ✅ SQLite stores last 20 messages per conversation
- ✅ Infinite scroll loads previous 20 from Firestore on scroll up
- ✅ On return to chat, reset to latest 20 messages

**Group Chat Read Receipts**:
- ✅ Show "Seen by all" indicator when all participants have read
- ✅ Current DB schema supports this via `readReceipts` subcollection
- ✅ Check if all participant IDs have `lastReadMessageId >= currentMessageId`

### Open Questions

**Push Notifications**:
- ❓ Need to implement Expo Notifications + Firebase Cloud Messaging
- ❓ Device token registration and refresh strategy
- ❓ Foreground vs background notification handling
- ❓ Testing on physical devices required

**Group Chat Scope**:
- ❓ Maximum group size? (10? 50? 100?)
- ❓ Group admin features needed? (remove users, change name/photo)
- ❓ Group invites or direct add?

**Media Features**:
- ❓ Image only or also video/audio/documents?
- ❓ File size limits?
- ❓ Firebase Storage or external CDN?

**Authentication**:
- ❓ Phone number (requires SMS verification) or email/password?
- ❓ Social login (Google/Apple)?

**Deployment**:
- ❓ Target internal testing only or public TestFlight/Play Store?
- ❓ Custom dev client needed for any native modules?

### Testing Strategy Gaps

- ❓ How do we test with 2+ physical devices simultaneously?
- ❓ Do we need automated tests or manual QA sufficient for 1-week sprint?
- ❓ Network condition simulation on emulators vs real devices?

### Cost Considerations

- ❓ Firestore read/write pricing at scale
- ❓ OpenAI API costs (caching strategy?)
- ❓ Firebase Storage costs for media
- ❓ Cloud Functions invocation pricing

---

## Success Metrics

**MVP (24 hours)**:
- ✅ Pass all testing scenarios
- ✅ Zero message loss in tests
- ✅ < 1 second message delivery (good network)

**Final (7 days)**:
- ✅ All AI features demonstrably useful (not gimmicks)
- ✅ Smooth UX with no janky transitions
- ✅ Video demo impresses reviewers
- ✅ README allows reviewers to run app in < 10 minutes

**North Star**: 
> "Build something people would actually want to use every day."

---

## Next Steps

1. **Decide on persona** (blocks AI feature planning)
2. **Set up Firebase project** (Firestore, Auth, Functions, FCM)
3. **Implement authentication flow**
4. **Build core messaging MVP** (vertical slice: send message end-to-end)
5. **Test offline scenarios**
6. **Add group chat**
7. **Implement AI features** (after messaging is solid)
8. **Polish UX**
9. **Create demo video**
10. **Deploy and submit**

