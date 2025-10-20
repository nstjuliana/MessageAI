# MessageAI Task List

**Philosophy**: Get deployment working first, then build features incrementally with continuous deployment validation.

---

## Phase 0: Setup & Deployment Pipeline (Priority)

### Firebase & Deployment Setup
- [ ] Create Firebase project in console
- [ ] Enable Firebase Authentication (Email/Password provider)
- [ ] Create Firestore database (start in test mode)
- [ ] Set up Firestore security rules (basic read/write for authenticated users)
- [ ] Enable Firebase Storage for media uploads
- [ ] Download Firebase config files (`google-services.json`, `GoogleService-Info.plist`)
- [ ] Install Firebase SDK: `npm install firebase @react-native-firebase/app @react-native-firebase/auth @react-native-firebase/firestore`
- [ ] Create `src/config/firebase.ts` with Firebase initialization
- [ ] Add Firebase config to `.gitignore` and use environment variables

### Expo Configuration
- [ ] Update `app.json` with proper app metadata (name, slug, version, icon)
- [ ] Configure `app.json` for Firebase (google-services.json paths)
- [ ] Install Expo dev dependencies: `npx expo install expo-dev-client`
- [ ] Set up EAS (Expo Application Services): `npm install -g eas-cli && eas login`
- [ ] Configure EAS Build: `eas build:configure`
- [ ] Update `eas.json` for development builds
- [ ] Create development build for iOS: `eas build --profile development --platform ios`
- [ ] Create development build for Android: `eas build --profile development --platform android`
- [ ] Test app launches on both iOS simulator and Android emulator

### Project Structure Setup
- [ ] Create folder structure: `src/screens`, `src/components`, `src/services`, `src/utils`, `src/types`, `src/hooks`
- [ ] Set up TypeScript paths in `tsconfig.json` for clean imports (`@/components`, `@/screens`, etc.)
- [ ] Install essential dependencies: `expo-router`, `expo-sqlite`, `expo-notifications`, `@react-native-community/netinfo`
- [ ] Create basic navigation structure with Expo Router
- [ ] Set up environment variables with `expo-constants` and `app.config.js`

### Deployment Validation
- [ ] Deploy "Hello World" version to Expo Go
- [ ] Create simple auth screen that connects to Firebase (just to verify connection)
- [ ] Test on physical device via Expo Go
- [ ] Verify Firebase connection works on both platforms
- [ ] Set up Cloud Functions project: `firebase init functions`
- [ ] Deploy a test Cloud Function and verify it's callable from app

---

## Phase 1: MVP - Authentication & Basic Infrastructure (Hours 1-4)

### Authentication Flow
- [ ] Create `src/types/user.types.ts` with User interface
- [ ] Create `src/services/auth.service.ts` with Firebase Auth methods
- [ ] Build Sign Up screen (`app/auth/signup.tsx`) with email/password
- [ ] Build Login screen (`app/auth/login.tsx`) with email/password
- [ ] Implement authentication state management (Context or Zustand)
- [ ] Create protected route wrapper for authenticated screens
- [ ] Add logout functionality
- [ ] Handle authentication errors and display to user
- [ ] Persist auth state across app restarts

### User Profile Setup
- [ ] Create `users` collection schema in Firestore
- [ ] Build profile setup screen (display name, optional avatar)
- [ ] Create `src/services/user.service.ts` for user CRUD operations
- [ ] Implement profile creation on first sign up
- [ ] Add user presence tracking (online/offline/away)
- [ ] Update user's `lastSeen` timestamp on app activity

### SQLite Local Database
- [ ] Create `src/database/schema.ts` with SQLite table definitions
- [ ] Create `src/database/database.ts` with SQLite initialization
- [ ] Implement `messages` table with offline queue fields
- [ ] Implement `chats` table for chat list cache
- [ ] Implement `chat_participants` table for participant cache
- [ ] Create database migration system for schema updates
- [ ] Test database operations (insert, query, update, delete)

### Deployment Checkpoint #1
- [ ] Deploy auth flow to Expo Go
- [ ] Test sign up, login, logout on physical devices
- [ ] Verify Firestore user creation works
- [ ] Verify SQLite database initializes correctly

---

## Phase 2: MVP - Core Messaging (Hours 5-12)

### Chat List Screen
- [ ] Create `src/types/chat.types.ts` with Chat and Message interfaces
- [ ] Build Chat List screen (`app/(tabs)/chats.tsx`)
- [ ] Create chat list item component with last message preview
- [ ] Implement Firestore listener for user's chats
- [ ] Display unread message count badge
- [ ] Sort chats by most recent message
- [ ] Add pull-to-refresh for chat list
- [ ] Handle empty state (no chats yet)

### Start New Chat
- [ ] Build user search/selection screen for new chat
- [ ] Query Firestore for users (search by display name)
- [ ] Create new chat in Firestore when user selected
- [ ] Navigate to new chat conversation screen
- [ ] Handle duplicate chat prevention (don't create multiple DMs with same user)

### Chat Conversation Screen
- [ ] Build Chat screen UI (`app/chat/[chatId].tsx`)
- [ ] Create message bubble component (sent vs received styling)
- [ ] Implement message list with FlatList (inverted for chat UI)
- [ ] Create message input component (TextInput + Send button)
- [ ] Display message timestamps
- [ ] Show sender name/avatar for received messages
- [ ] Add pull-to-refresh for loading older messages

### Send Message (Optimistic UI)
- [ ] Create `src/services/message.service.ts`
- [ ] Implement optimistic UI: display message immediately
- [ ] Generate local message ID (UUID)
- [ ] Insert message into SQLite with status "sending"
- [ ] Attempt Firestore write to `chats/{chatId}/messages`
- [ ] Update message status to "sent" on success
- [ ] Mark as "failed" on error and add to retry queue
- [ ] Update chat's `lastMessage` fields in Firestore
- [ ] Show message status indicator (sending/sent/failed)

### Receive Messages (Real-time)
- [ ] Set up Firestore listener for new messages in chat
- [ ] Insert received messages into SQLite
- [ ] Update UI when new message arrives
- [ ] Auto-scroll to bottom on new message (if already at bottom)
- [ ] Play sound/haptic feedback on receive (optional)
- [ ] Implement "scroll to bottom" button when scrolled up

### Message Persistence & Offline Support
- [ ] Load last 20 messages from SQLite on chat open
- [ ] Sync messages from Firestore on first load
- [ ] Implement retry mechanism for failed messages
- [ ] Listen to network state changes with NetInfo
- [ ] Trigger message retry on reconnection
- [ ] Implement exponential backoff for retries
- [ ] Display offline indicator when network unavailable
- [ ] Queue messages sent while offline

### Deployment Checkpoint #2
- [ ] Deploy messaging functionality to Expo Go
- [ ] Test real-time messaging between two devices
- [ ] Test offline message queueing (airplane mode)
- [ ] Test message persistence (force quit and reopen)
- [ ] Verify messages sync correctly after reconnection

---

## Phase 3: MVP - Message Status & Read Receipts (Hours 13-16)

### Typing Indicators
- [ ] Add typing status to Firestore (`chats/{chatId}/typing/{userId}`)
- [ ] Update typing status on TextInput change (debounced)
- [ ] Clear typing status after 3 seconds of inactivity
- [ ] Listen for other users' typing status
- [ ] Display "User is typing..." indicator in chat
- [ ] Handle multiple users typing in groups

### Message Delivery Status (DM)
- [ ] Update message status to "delivered" when recipient receives
- [ ] Display checkmark indicators (single ✓ = sent, double ✓✓ = delivered)
- [ ] Listen for message status updates in real-time
- [ ] Update SQLite when status changes

### Read Receipts (DM)
- [ ] Track last read message ID per user
- [ ] Create `readReceipts` subcollection in Firestore
- [ ] Update read receipt when user views chat
- [ ] Update read receipt when new message received while viewing
- [ ] Mark message as "read" when recipient reads it
- [ ] Display triple ✓✓✓ or blue checkmarks for read messages
- [ ] Update sender's UI when message is read

### Online/Offline Presence
- [ ] Update user presence to "online" on app open
- [ ] Update presence to "offline" on app close/background
- [ ] Listen for presence changes for chat participants
- [ ] Display online/offline indicator in chat header
- [ ] Display "last seen" timestamp when offline
- [ ] Handle "away" status after 5 minutes of inactivity

### Deployment Checkpoint #3
- [ ] Deploy read receipts and presence to Expo Go
- [ ] Test typing indicators between devices
- [ ] Test read receipts update correctly
- [ ] Test presence indicators (online/offline/last seen)
- [ ] Verify message status updates work

---

## Phase 4: MVP - Group Chat (Hours 17-20)

### Create Group Chat
- [ ] Build "Create Group" screen with participant selection
- [ ] Allow selecting 2+ users for group
- [ ] Add group name and optional group photo
- [ ] Create group chat in Firestore with type "group"
- [ ] Add all participants to `participants` array
- [ ] Set creator as admin in `adminIds` array
- [ ] Navigate to new group chat

### Group Messaging
- [ ] Update message UI to show sender info in groups
- [ ] Display sender avatar and name for each message
- [ ] Update message send logic to handle group recipients
- [ ] Ensure all participants receive messages
- [ ] Show participant list in group chat header

### Group Read Receipts
- [ ] Track read receipts for each group member
- [ ] Implement "Seen by X" counter
- [ ] Show "Seen by all" when all members have read
- [ ] Add message details screen showing who's read (optional)
- [ ] Optimize for large groups (show count, not names)

### Group Info & Management
- [ ] Build Group Info screen (participant list, group name, etc.)
- [ ] Allow admins to add new participants
- [ ] Allow admins to remove participants
- [ ] Allow admins to change group name/photo
- [ ] Allow participants to leave group
- [ ] Handle group updates (new member joined, etc.) with system messages

### Deployment Checkpoint #4 (MVP Complete)
- [ ] Deploy group chat functionality to Expo Go
- [ ] Test group chat with 3+ participants
- [ ] Test group read receipts work correctly
- [ ] Test adding/removing group members
- [ ] Run through all MVP testing scenarios
- [ ] Fix any critical bugs found

---

## Phase 5: MVP - Push Notifications (Hours 21-24)

### Push Notification Setup
- [ ] Install expo-notifications: `npx expo install expo-notifications expo-device expo-constants`
- [ ] Configure notification channels for Android
- [ ] Request notification permissions on app start
- [ ] Register for Expo push tokens
- [ ] Store device tokens in Firestore user document
- [ ] Handle token refresh and updates

### Cloud Functions for Notifications
- [ ] Create Cloud Function: `sendMessageNotification`
- [ ] Trigger on new message created in Firestore
- [ ] Fetch recipient device tokens
- [ ] Get sender information for notification
- [ ] Send notification via Expo Push API
- [ ] Handle notification errors and invalid tokens
- [ ] Test function locally with Firebase emulator

### Notification Handling in App
- [ ] Configure notification handler (foreground behavior)
- [ ] Listen for foreground notifications
- [ ] Show in-app notification banner for foreground messages
- [ ] Handle notification tap to open specific chat
- [ ] Extract chatId from notification data
- [ ] Navigate to correct chat on notification tap
- [ ] Clear notification badge when chat opened

### Testing & Refinement
- [ ] Test foreground notifications on physical device
- [ ] Test background notifications on physical device
- [ ] Test closed app notifications on physical device
- [ ] Verify tapping notification opens correct chat
- [ ] Test notification sounds and vibration
- [ ] Handle edge cases (chat deleted, user blocked, etc.)

### Deployment Checkpoint #5 (MVP FINAL)
- [ ] Deploy complete MVP to Expo Go
- [ ] Verify all MVP requirements met
- [ ] Complete all 7 testing scenarios
- [ ] Fix any remaining bugs
- [ ] Record demo video showing MVP features
- [ ] Submit MVP checkpoint

---

## Phase 6: Post-MVP Enhancements (Days 2-4)

### Media Sharing - Images
- [ ] Install image picker: `npx expo install expo-image-picker`
- [ ] Add camera/gallery button to message input
- [ ] Request camera and media library permissions
- [ ] Implement image picker functionality
- [ ] Upload images to Firebase Storage
- [ ] Generate thumbnail for large images
- [ ] Update message schema to include mediaUrl
- [ ] Display images in message bubbles
- [ ] Add image preview/zoom functionality
- [ ] Cache images locally for offline viewing

### Message Reply Feature
- [ ] Add long-press menu on messages (reply, copy, delete)
- [ ] Implement reply UI showing quoted message
- [ ] Update message schema with `replyToId` field
- [ ] Send reply with reference to original message
- [ ] Display replied-to message in bubble
- [ ] Scroll to original message on reply tap

### Advanced Chat Features
- [ ] Add "Clear Chat History" functionality
- [ ] Implement message deletion (for everyone / for me)
- [ ] Add message edit capability (mark as edited)
- [ ] Implement message search within chat
- [ ] Add "starred/pinned" messages feature
- [ ] Show message reactions (emoji reactions)

### Enhanced Notifications
- [ ] Add notification preferences screen
- [ ] Allow muting chats (disable notifications)
- [ ] Add "Do Not Disturb" schedule
- [ ] Customize notification sounds per chat
- [ ] Group notifications by chat
- [ ] Add quick reply from notification (iOS/Android)

### UI/UX Polish
- [ ] Add loading skeletons for chat list
- [ ] Improve message animations (fade in, slide)
- [ ] Add swipe gestures (reply, delete)
- [ ] Implement dark mode support
- [ ] Add haptic feedback for interactions
- [ ] Optimize image loading and caching
- [ ] Improve typing indicator design
- [ ] Add empty states with helpful CTAs

### Performance Optimization
- [ ] Implement message pagination (load 20 at a time)
- [ ] Add lazy loading for older messages
- [ ] Optimize Firestore queries with indexes
- [ ] Implement message deduplication
- [ ] Add query cursors for efficient pagination
- [ ] Cache user profiles to reduce Firestore reads
- [ ] Implement background message sync
- [ ] Optimize image compression before upload

### Testing & Bug Fixes
- [ ] Test with poor network conditions (3G, throttled)
- [ ] Test rapid-fire messages (20+ quickly)
- [ ] Test with multiple chats open simultaneously
- [ ] Test edge cases (empty messages, very long messages)
- [ ] Fix memory leaks (unsubscribe listeners)
- [ ] Test app lifecycle (background, foreground, killed)
- [ ] Profile performance with React DevTools

---

## Phase 7: AI Features Implementation (Days 5-6)

**Note**: Tasks depend on chosen persona. Below are examples.

### AI Infrastructure
- [ ] Choose persona (Remote Team / International / Parent / Creator)
- [ ] Set up OpenAI or Anthropic API key in Cloud Functions
- [ ] Install AI SDK: `npm install ai` (Vercel AI SDK)
- [ ] Create Cloud Function: `callAI` (generic LLM endpoint)
- [ ] Implement rate limiting for AI calls
- [ ] Add cost tracking and logging
- [ ] Set up response caching strategy

### RAG Pipeline for Conversation Context
- [ ] Create Cloud Function: `getConversationContext`
- [ ] Fetch relevant messages from conversation history
- [ ] Format messages for LLM context
- [ ] Implement token counting to stay within limits
- [ ] Add semantic search over messages (vector embeddings - optional)
- [ ] Cache conversation summaries for efficiency

### AI Feature 1: [Based on Persona]
- [ ] Design UI for feature (button, modal, dedicated screen)
- [ ] Create Cloud Function endpoint
- [ ] Build prompt template with instructions
- [ ] Pass conversation context via RAG
- [ ] Display loading state while processing
- [ ] Show results in user-friendly format
- [ ] Handle errors gracefully
- [ ] Add retry mechanism
- [ ] Test with various conversation types
- [ ] Cache results to reduce API calls

### AI Feature 2-5: [Repeat for each required feature]
- [ ] Design UI
- [ ] Create Cloud Function
- [ ] Build prompt
- [ ] Implement feature logic
- [ ] Test and refine

### Advanced AI Feature (Choose One)
- [ ] Implement multi-step agent OR proactive assistant
- [ ] Set up agent framework (Swarm, LangChain, AI SDK)
- [ ] Define agent tools/functions
- [ ] Implement agent loop and state management
- [ ] Test agent with complex scenarios
- [ ] Add safety guardrails and limits

### AI Integration Polish
- [ ] Add AI settings screen (enable/disable features)
- [ ] Implement feedback mechanism (thumbs up/down)
- [ ] Add cost monitoring and usage limits
- [ ] Create AI onboarding tutorial
- [ ] Optimize prompts based on testing
- [ ] Add AI response streaming (if applicable)

---

## Phase 8: Final Polish & Submission (Day 7)

### Production Readiness
- [ ] Update Firestore security rules for production
- [ ] Implement proper error boundaries
- [ ] Add analytics tracking (Firebase Analytics)
- [ ] Set up error reporting (Sentry or Firebase Crashlytics)
- [ ] Add app version check and update prompts
- [ ] Implement proper loading states everywhere
- [ ] Remove all console.logs and debug code
- [ ] Update environment variables for production

### Deployment
- [ ] Create production build: `eas build --profile production --platform all`
- [ ] Test production build on physical devices
- [ ] Deploy Cloud Functions to production
- [ ] Verify all Firebase services are in production mode
- [ ] Create Expo Go link or deploy to TestFlight/internal testing
- [ ] Test complete app end-to-end on production

### Documentation
- [ ] Write comprehensive README.md with:
  - [ ] Project description
  - [ ] Tech stack details
  - [ ] Prerequisites
  - [ ] Installation instructions
  - [ ] Firebase setup steps
  - [ ] Environment variables needed
  - [ ] How to run locally
  - [ ] How to deploy
  - [ ] Known issues and troubleshooting
- [ ] Create 1-page Persona Brainlift document
- [ ] Document AI features and use cases
- [ ] Add screenshots to README
- [ ] Create architecture diagram (optional but impressive)

### Demo Video (5-7 minutes)
- [ ] Script out demo flow
- [ ] Record real-time messaging between two devices
- [ ] Show group chat with 3+ participants
- [ ] Demonstrate offline scenario (airplane mode test)
- [ ] Show app lifecycle handling
- [ ] Demo all 5 required AI features
- [ ] Demo advanced AI capability
- [ ] Add captions/annotations for clarity
- [ ] Edit and export video
- [ ] Upload to YouTube/Loom

### Social Media Post
- [ ] Write 2-3 sentence description
- [ ] Create thumbnail or screenshot
- [ ] Include key features and persona
- [ ] Tag @GauntletAI
- [ ] Post on X/Twitter or LinkedIn

### Final Submission
- [ ] Push all code to GitHub
- [ ] Create GitHub release/tag for submission
- [ ] Verify README has all setup instructions
- [ ] Test setup instructions on fresh machine (if possible)
- [ ] Submit all deliverables:
  - [ ] GitHub repository link
  - [ ] Demo video link
  - [ ] Deployed app link (Expo Go/TestFlight/APK)
  - [ ] Persona Brainlift PDF
  - [ ] Social media post link
- [ ] Submit before Sunday 10:59 PM CT

---

## Continuous Tasks (Throughout Development)

- [ ] Commit after each completed task with descriptive message
- [ ] Test on both iOS and Android after each feature
- [ ] Deploy to Expo Go regularly (at least daily)
- [ ] Keep dependencies updated
- [ ] Review and update Firestore security rules as needed
- [ ] Monitor Firebase usage and costs
- [ ] Document any blockers or issues
- [ ] Take breaks to avoid burnout!

---

## Emergency Debugging Checklist

If something breaks:
- [ ] Check Firebase console for errors
- [ ] Check Cloud Functions logs
- [ ] Check Expo logs: `npx expo start`
- [ ] Check device logs (Xcode/Android Studio)
- [ ] Verify Firebase config is correct
- [ ] Check network requests in Firebase console
- [ ] Test on fresh device install
- [ ] Clear SQLite database and re-sync
- [ ] Check Firestore security rules aren't blocking
- [ ] Verify all environment variables are set

