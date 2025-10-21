# MessageAI Architecture & Features

**Last Updated:** October 21, 2025  
**Project Status:** Phase 1 - MVP Authentication & User Management Complete

---

## Table of Contents
1. [Overview](#overview)
2. [Tech Stack](#tech-stack)
3. [Key Features](#key-features)
4. [Architecture Layers](#architecture-layers)
5. [Data Models](#data-models)
6. [Service Layer](#service-layer)
7. [Security](#security)
8. [Real-Time Features](#real-time-features)
9. [Testing Strategy](#testing-strategy)

---

## Overview

MessageAI is a cross-platform messaging application built with React Native and Expo, featuring real-time chat capabilities and AI-powered features. The application follows a clean architecture pattern with clear separation between UI, business logic, and data layers.

**Target Persona:** Remote Team Professional  
**Core Mission:** Reliable messaging with intelligent AI features for team productivity

---

## Tech Stack

### Frontend
- **Framework:** React Native with Expo
- **Navigation:** Expo Router (file-based routing)
- **Language:** TypeScript
- **State Management:** React Context API
- **Local Storage:** Expo SQLite (planned)
- **UI Components:** React Native Core Components

### Backend
- **Database:** Firebase Firestore (NoSQL)
- **Authentication:** Firebase Auth (Email/Password)
- **Storage:** Firebase Storage (media files)
- **Functions:** Firebase Cloud Functions
- **Push Notifications:** Firebase Cloud Messaging + Expo Notifications

### AI/ML
- **LLM Provider:** OpenAI GPT-4 / Anthropic Claude
- **Agent Framework:** AI SDK by Vercel / LangChain
- **Pattern:** RAG (Retrieval-Augmented Generation) for conversation context

### Development Tools
- **Testing:** Jest + React Native Testing Library
- **Linting:** ESLint
- **Version Control:** Git + GitHub
- **CI/CD:** Expo EAS (planned)

---

## Key Features

### User Features (`user.service.ts`) ✅ **IMPLEMENTED**

#### User Management
```typescript
// CRUD operations for user profiles
createUser(userId, userData)      // Create user profile after Firebase Auth signup
getUserById(userId)                // Fetch full user data with all fields
getPublicProfile(userId)           // Fetch public data only (excludes sensitive info)
getUsersByIds([userIds])           // Batch fetch multiple users efficiently
updateUser(userId, updates)        // Update profile fields (name, bio, avatar, etc.)
deleteUser(userId)                 // Admin operation to remove user document
searchUsers(query, maxResults)     // Search users by display name
```

#### Presence & Activity Tracking
```typescript
// Track user online status and activity
updatePresence(userId, 'online')   // Set presence: "online" | "offline" | "away"
updateLastSeen(userId)             // Update activity timestamp
```

#### Device Token Management
```typescript
// Manage push notification device tokens
addDeviceToken(userId, token)      // Register device for notifications
removeDeviceToken(userId, token)   // Unregister device on logout/uninstall
```

#### Real-Time User Listeners
```typescript
// Live data synchronization for users
onUserSnapshot(userId, callback)            // Listen to user profile changes
onUsersPresenceSnapshot(userIds, callback)  // Listen to presence updates for multiple users
```

**User Feature Status:**
- ✅ Email/password authentication
- ✅ User profile creation and management
- ✅ Display name, avatar, bio, phone number
- ✅ Profile data persistence in Firestore
- ✅ Public vs private profile data separation
- ✅ User search functionality
- ✅ Online/Offline/Away status tracking
- ✅ Last seen timestamp
- ✅ Real-time presence updates
- ✅ Device token registration
- ✅ Multi-device support
- ✅ Automatic duplicate prevention
- 🔄 Profile setup screen (in progress)
- 🔄 Avatar upload and management (planned)
- 🔄 "Last seen" display formatting (planned)
- 🔄 Auto-away after 5 minutes inactivity (planned)

---

### Chat Features (`chat.service.ts`) 🔄 **PLANNED**

#### Chat Management
```typescript
// CRUD operations for chats (DM and group)
createChat(participants, type)     // Create new DM or group chat
getChatById(chatId)                // Fetch chat details
getUserChats(userId)               // Get all chats for a user
updateChat(chatId, updates)        // Update chat info (name, photo, etc.)
deleteChat(chatId)                 // Delete chat (admin only)
addParticipant(chatId, userId)     // Add user to group chat
removeParticipant(chatId, userId)  // Remove user from group chat
```

#### Chat Metadata
```typescript
// Track chat-level information
updateLastMessage(chatId, message) // Update last message preview
getChatParticipants(chatId)        // Get list of participants
markChatAsRead(chatId, userId)     // Mark all messages as read
archiveChat(chatId, userId)        // Archive chat for user
```

#### Real-Time Chat Listeners
```typescript
// Live chat synchronization
onChatSnapshot(chatId, callback)         // Listen to chat updates
onUserChatsSnapshot(userId, callback)    // Listen to user's chat list
onTypingSnapshot(chatId, callback)       // Listen to typing indicators
```

**Chat Feature Status:**
- 🔄 DM (direct message) chat creation (planned)
- 🔄 Group chat creation (planned)
- 🔄 Chat list display (planned)
- 🔄 Last message preview (planned)
- 🔄 Unread message count (planned)
- 🔄 Chat sorting by recent activity (planned)
- 🔄 Group chat management (planned)
- 🔄 Typing indicators (planned)
- 🔄 Chat archiving (planned)

---

### Message Features (`message.service.ts`) 🔄 **PLANNED**

#### Message Management
```typescript
// CRUD operations for messages
sendMessage(chatId, message)       // Send new message with optimistic UI
loadMessages(chatId, limit)        // Load message history (paginated)
loadOlderMessages(chatId, before)  // Load previous messages
updateMessage(messageId, updates)  // Edit message text
deleteMessage(messageId, mode)     // Delete for everyone / for me
```

#### Message Status & Delivery
```typescript
// Track message delivery and read status
updateMessageStatus(messageId, status)     // Update: sending → sent → delivered → read
markMessageAsDelivered(messageId, userId)  // Mark delivered for user
markMessageAsRead(messageId, userId)       // Mark read for user
getMessageStatus(messageId)                // Get delivery status for all recipients
```

#### Message Features
```typescript
// Additional message capabilities
addReaction(messageId, emoji, userId)      // React to message
removeReaction(messageId, emoji, userId)   // Remove reaction
replyToMessage(chatId, replyToId, message) // Reply to specific message
forwardMessage(messageId, toChatIds)       // Forward to other chats
```

#### Real-Time Message Listeners
```typescript
// Live message synchronization
onMessagesSnapshot(chatId, callback)       // Listen to new messages
onMessageStatusSnapshot(messageId, callback) // Listen to status updates
```

**Message Feature Status:**
- 🔄 Send text messages (planned)
- 🔄 Optimistic UI updates (planned)
- 🔄 Message persistence (SQLite) (planned)
- 🔄 Message delivery status (planned)
- 🔄 Read receipts (DM) (planned)
- 🔄 Read receipts (group) (planned)
- 🔄 Message editing (planned)
- 🔄 Message deletion (planned)
- 🔄 Message reactions (planned)
- 🔄 Reply to messages (planned)
- 🔄 Message pagination (planned)
- 🔄 Offline message queue (planned)

---

### Media Features (`media.service.ts`) 🔄 **PLANNED**

#### Media Upload & Management
```typescript
// Handle media files (images, videos, documents)
uploadImage(file, chatId)          // Upload image to Firebase Storage
uploadVideo(file, chatId)          // Upload video
uploadDocument(file, chatId)       // Upload document
generateThumbnail(mediaUrl)        // Generate image thumbnail
downloadMedia(mediaUrl)            // Download for offline viewing
```

**Media Feature Status:**
- 🔄 Image sharing (planned)
- 🔄 Image preview/zoom (planned)
- 🔄 Video sharing (planned)
- 🔄 Document sharing (planned)
- 🔄 Thumbnail generation (planned)
- 🔄 Media compression (planned)
- 🔄 Offline media caching (planned)

---

### Notification Features (`notification.service.ts`) 🔄 **PLANNED**

#### Push Notification Management
```typescript
// Handle push notifications
sendNotification(userId, notification)     // Send push notification
scheduleNotification(userId, notification, time) // Schedule notification
cancelNotification(notificationId)         // Cancel scheduled notification
updateNotificationPreferences(userId, prefs) // Update user preferences
```

**Notification Feature Status:**
- 🔄 Foreground notifications (planned)
- 🔄 Background notifications (planned)
- 🔄 Notification on app closed (planned)
- 🔄 Tap to open specific chat (planned)
- 🔄 Badge count management (planned)
- 🔄 Notification muting per chat (planned)
- 🔄 Do Not Disturb mode (planned)

---

## Architecture Layers

### 1. Presentation Layer (`app/`, `components/`)
```
app/
├── index.tsx                      # Root entry point
├── _layout.tsx                    # Root layout with auth provider
├── auth/
│   ├── login.tsx                  # Login screen
│   └── signup.tsx                 # Signup screen
└── (authenticated)/
    ├── _layout.tsx                # Protected routes layout
    └── chats.tsx                  # Chat list screen
```

**Responsibilities:**
- React Native UI components
- User interaction handling
- Navigation flow
- Screen layouts and styling
- Form validation
- Loading states and error display

### 2. Business Logic Layer (`src/contexts/`, `src/hooks/`)
```
src/
├── contexts/
│   ├── AuthContext.tsx            # Authentication state (Firebase Auth only)
│   └── UserContext.tsx            # User profile state (Firestore data)
└── hooks/
    ├── use-color-scheme.ts        # Theme hook
    └── use-theme-color.ts         # Color management
```

**Responsibilities:**
- State management (Context API)
- Business rules and validation
- Cross-cutting concerns
- Custom hooks for reusable logic
- App lifecycle management

**Context Separation:**
- `AuthContext` → Firebase Authentication only (signUp, signIn, logOut, user state)
- `UserContext` → Firestore user profile (displayName, bio, presence, profile updates)
- Clean separation of concerns following Single Responsibility Principle

### 3. Service Layer (`src/services/`)
```
src/services/
├── auth.service.ts                # Firebase Auth operations
└── user.service.ts                # User CRUD operations
```

**Responsibilities:**
- Firebase SDK interactions
- API calls and data fetching
- Error handling and retry logic
- Data transformation
- Network request management

### 4. Data Layer (`src/types/`, `src/database/`)
```
src/
├── types/
│   └── user.types.ts              # TypeScript interfaces
└── database/
    └── (SQLite schemas - planned)
```

**Responsibilities:**
- Type definitions
- Data models and schemas
- Local database operations
- Data validation schemas
- Firestore document structures

### 5. Configuration (`src/config/`)
```
src/config/
└── firebase.ts                    # Firebase initialization
```

**Responsibilities:**
- Firebase SDK setup
- Environment variable management
- Service initialization
- Configuration constants

---

## Context Architecture

### Separation of Concerns

The application uses a **dual-context architecture** that cleanly separates authentication concerns from user profile management:

```
App Root
  ↓
AuthProvider (Authentication Layer)
  ├─ Manages Firebase Auth state
  ├─ Handles signUp, signIn, logOut
  ├─ Provides: user, loading, auth functions
  ↓
UserProvider (Profile Data Layer)
  ├─ Manages Firestore user profile
  ├─ Handles profile updates, presence
  ├─ Provides: userProfile, profileLoading, profile functions
  ↓
Application Components
  ├─ Use useAuth() for authentication
  └─ Use useUser() for profile data
```

### AuthContext - Authentication Only

**Purpose:** Manage Firebase Authentication state exclusively

**Provides:**
```typescript
{
  user: FirebaseUser | null;        // Firebase Auth user
  loading: boolean;                   // Auth initialization loading
  signUp: (email, password) => Promise<FirebaseUser>;
  signIn: (email, password) => Promise<FirebaseUser>;
  logOut: () => Promise<void>;
}
```

**Responsibilities:**
- ✅ Firebase Auth state management
- ✅ Sign up / sign in / log out operations
- ✅ Auth state persistence
- ✅ Redirect logic on logout
- ❌ Does NOT handle user profile data
- ❌ Does NOT interact with Firestore

**Usage:**
```typescript
function LoginScreen() {
  const { signIn, loading } = useAuth();
  // Handle authentication only
}
```

### UserContext - Profile Data Only

**Purpose:** Manage Firestore user profile data exclusively

**Provides:**
```typescript
{
  userProfile: User | null;           // Firestore user document
  profileLoading: boolean;             // Profile fetch loading
  updateProfile: (updates) => Promise<void>;
  setPresence: (presence) => Promise<void>;
  refreshProfile: () => Promise<void>;
}
```

**Responsibilities:**
- ✅ Firestore user profile state
- ✅ Real-time profile updates (via listener)
- ✅ Profile CRUD operations
- ✅ Presence management
- ❌ Does NOT handle authentication
- ❌ Does NOT manage Firebase Auth user

**Usage:**
```typescript
function ProfileScreen() {
  const { userProfile, updateProfile } = useUser();
  // Handle profile data only
}
```

**Usage with Both:**
```typescript
function ChatScreen() {
  const { user, logOut } = useAuth();        // Auth operations
  const { userProfile } = useUser();         // Profile data
  
  return (
    <View>
      <Text>Welcome, {userProfile?.displayName}!</Text>
      <Button onPress={logOut}>Log Out</Button>
    </View>
  );
}
```

### Benefits of Separation

#### 1. Single Responsibility Principle
- Each context has ONE clear purpose
- Easier to understand and maintain
- Changes to auth don't affect profile logic

#### 2. Better Testability
- Test authentication independently
- Test profile management independently
- Clearer test organization

#### 3. Reduced Coupling
- Components can use just what they need
- Login screen only needs `useAuth()`
- Profile screen only needs `useUser()`

#### 4. Cleaner Code
```typescript
// BEFORE (Coupled):
const { user, userProfile, signIn, updateProfile } = useAuth();
// Everything mixed together!

// AFTER (Separated):
const { user, signIn } = useAuth();              // Auth only
const { userProfile, updateProfile } = useUser(); // Profile only
// Clear separation!
```

#### 5. Easier to Extend
- Add features to auth without touching profile
- Add profile features without touching auth
- Can add more contexts (settings, notifications) easily

### Provider Nesting Order

**Critical:** UserProvider MUST be inside AuthProvider:

```typescript
// ✅ CORRECT
<AuthProvider>
  <UserProvider>
    <App />
  </UserProvider>
</AuthProvider>

// ❌ WRONG - UserContext needs auth state!
<UserProvider>
  <AuthProvider>
    <App />
  </AuthProvider>
</UserProvider>
```

**Why:** UserContext needs to know when user is authenticated to load their profile.

### Loading States

Both contexts have independent loading states:

```typescript
const { user, loading } = useAuth();                    // Auth loading
const { userProfile, profileLoading } = useUser();      // Profile loading

// Typical loading sequence:
// 1. loading=true, profileLoading=false     → Checking auth
// 2. loading=false, profileLoading=true     → Auth done, loading profile
// 3. loading=false, profileLoading=false    → Fully loaded
```

**Handle both:**
```typescript
if (loading) return <AuthLoadingScreen />;
if (!user) return <LoginScreen />;
if (profileLoading) return <ProfileLoadingScreen />;
return <MainApp />;
```

### Real-Time Synchronization

**UserContext** automatically subscribes to profile updates:

```typescript
// In UserContext:
useEffect(() => {
  if (!user) return;
  
  // Real-time listener
  const unsubscribe = onUserSnapshot(user.uid, (profile) => {
    setUserProfile(profile);
  });
  
  return unsubscribe; // Cleanup on logout
}, [user]);
```

**Benefits:**
- Profile changes appear instantly everywhere
- Single Firestore listener (cost-efficient)
- All components stay in sync automatically

---

## Data Models

### User Model
```typescript
interface User {
  id: string;                      // Firebase Auth UID
  displayName: string;             // Required display name
  phoneNumber?: string;            // Optional phone number
  email?: string;                  // Email from Firebase Auth
  avatarUrl?: string;              // Profile picture URL
  bio?: string;                    // User bio/status
  lastSeen: number;                // Unix timestamp (milliseconds)
  presence: UserPresence;          // "online" | "offline" | "away"
  deviceTokens: string[];          // Push notification tokens
  createdAt: number;               // Account creation timestamp
  updatedAt: number;               // Last profile update timestamp
}
```

### Public User Profile
```typescript
interface PublicUserProfile {
  id: string;
  displayName: string;
  avatarUrl?: string;
  bio?: string;
  presence: UserPresence;
  lastSeen: number;
  // Note: Excludes email, phoneNumber, deviceTokens for privacy
}
```

### Chat Model (Planned)
```typescript
interface Chat {
  id: string;
  type: "dm" | "group";
  participants: string[];          // User IDs
  adminIds?: string[];             // For group chats
  lastMessageId?: string;
  lastMessageText?: string;
  lastMessageAt: number;
  createdAt: number;
  updatedAt: number;
}
```

### Message Model (Planned)
```typescript
interface Message {
  id: string;
  chatId: string;
  senderId: string;
  text?: string;
  mediaUrl?: string;
  mediaMime?: string;
  replyToId?: string;
  status: "sending" | "sent" | "delivered" | "read";
  createdAt: number;
  edited: boolean;
  reactions?: { [emoji: string]: string[] };
}
```

---

## Service Layer

### Authentication Service (`auth.service.ts`)
**Status:** ✅ Complete with tests

**Core Functions:**
- `signUp(email, password)` - Create new Firebase Auth account
- `signIn(email, password)` - Sign in existing user
- `logOut()` - Sign out current user
- `getCurrentUser()` - Get current auth user
- `onAuthStateChange(callback)` - Listen to auth state
- `updateUserProfile(displayName, photoURL)` - Update Firebase Auth profile
- `sendPasswordReset(email)` - Send password reset email
- `changeEmail(newEmail)` - Update user email
- `changePassword(newPassword)` - Update user password
- `reauthenticate(currentPassword)` - Re-authenticate for sensitive operations

**Error Handling:**
- User-friendly error messages
- Firebase error code translation
- Network error handling
- Rate limiting protection

**Test Coverage:** 100% (all functions tested)

### User Service (`user.service.ts`)
**Status:** ✅ Complete with tests

**Core Functions:**
See [Key Features](#key-features) section above for detailed API

**Features:**
- Firestore CRUD operations
- Real-time data synchronization
- Presence tracking
- Device token management
- User search
- Batch operations

**Error Handling:**
- Critical operations throw errors
- Non-critical operations fail silently
- Network resilience
- Data validation

**Test Coverage:** 100% (33 tests passing)

### Message Service (Planned)
**Status:** 🔄 Not yet implemented

**Planned Functions:**
- `sendMessage(chatId, message)` - Send new message
- `updateMessageStatus(messageId, status)` - Update delivery status
- `loadMessages(chatId, limit)` - Load message history
- `deleteMessage(messageId)` - Delete message
- `editMessage(messageId, newText)` - Edit message
- `addReaction(messageId, emoji)` - React to message

---

## Security

### Authentication
- ✅ Firebase Auth with email/password
- ✅ Protected routes (authenticated layout)
- ✅ Auth state persistence across app restarts
- ✅ Secure token management
- 🔄 Password strength requirements (planned)
- 🔄 Email verification (planned)

### Data Privacy
- ✅ Public vs private profile separation
- ✅ Sensitive data excluded from public profiles
- ✅ User ID-based access control
- 🔄 Firestore security rules (basic rules in place)
- 🔄 Production security rules (planned)

### Firestore Security Rules (Current - Test Mode)
```javascript
// Current: Allow authenticated users to read/write
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /{document=**} {
      allow read, write: if request.auth != null;
    }
  }
}
```

### Firestore Security Rules (Planned - Production)
```javascript
// Planned: Granular access control
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Users can read their own data and update specific fields
    match /users/{userId} {
      allow read: if request.auth != null;
      allow create: if request.auth.uid == userId;
      allow update: if request.auth.uid == userId 
        && request.resource.data.diff(resource.data).affectedKeys()
        .hasOnly(['displayName', 'bio', 'avatarUrl', 'phoneNumber', 'presence', 'lastSeen', 'deviceTokens', 'updatedAt']);
      allow delete: if false; // Only via Cloud Functions
    }
    
    // Chat and message rules (to be defined)
    match /chats/{chatId} {
      allow read: if request.auth != null 
        && request.auth.uid in resource.data.participants;
      // Additional rules for create, update, delete
    }
  }
}
```

---

## Real-Time Features

### Firestore Real-Time Listeners
```typescript
// User data synchronization
const unsubscribe = onUserSnapshot(userId, (user) => {
  // Automatically called when user data changes
  setUserState(user);
});

// Presence tracking for chat participants
const unsubscribe = onUsersPresenceSnapshot(
  [user1, user2, user3],
  (presenceMap) => {
    // Update UI with online/offline status
    presenceMap.forEach((presence, userId) => {
      updateUserPresence(userId, presence);
    });
  }
);
```

### Optimistic UI Updates (Planned)
- Messages appear instantly before server confirmation
- Local state updates with pending status
- Rollback on failure
- Retry queue for failed operations

### Offline Support (Planned)
- SQLite for local message persistence
- Message queue for offline sends
- Automatic sync on reconnection
- Offline-first architecture

---

## Testing Strategy

### Unit Tests
**Framework:** Jest + React Native Testing Library

**Current Coverage:**
- ✅ `auth.service.ts` - 100% coverage
- ✅ `user.service.ts` - 100% coverage (33 tests)
- ✅ `AuthContext.tsx` - Integration tests

**Test Categories:**
1. **Happy Path** - Successful operations
2. **Error Cases** - Network failures, invalid data
3. **Edge Cases** - Empty data, null values, duplicates
4. **Silent Failures** - Non-critical operations
5. **Real-Time** - Snapshot listeners and callbacks

### Integration Tests
- ✅ AuthContext with Firebase Auth
- 🔄 End-to-end auth flow (planned)
- 🔄 Message send/receive flow (planned)

### E2E Tests (Planned)
- User registration and login flow
- Send message between two devices
- Offline message queueing
- Push notification delivery

### Test Mocking Strategy
```typescript
// Firebase mocks
jest.mock('firebase/auth');
jest.mock('firebase/firestore');
jest.mock('@/config/firebase');

// Mock implementations
- createUserWithEmailAndPassword
- signInWithEmailAndPassword
- onAuthStateChanged
- doc, getDoc, setDoc, updateDoc, deleteDoc
- onSnapshot (real-time listeners)
- Timestamp.fromMillis()
```

---

## Performance Considerations

### Current Optimizations
- ✅ Batch user fetching (`getUsersByIds`)
- ✅ Duplicate device token prevention
- ✅ Efficient Firestore queries with indexes
- ✅ Server-side timestamps for consistency

### Planned Optimizations
- 🔄 Message pagination (load 20 at a time)
- 🔄 Lazy loading for chat list
- 🔄 Image compression before upload
- 🔄 User profile caching
- 🔄 Debounced search queries
- 🔄 Query result caching

---

## Deployment Pipeline

### Current Setup
- ✅ Expo Go for development
- ✅ Firebase project configured
- ✅ Environment variables setup
- ✅ Git version control

### Planned Deployment
- 🔄 EAS Build for production builds
- 🔄 TestFlight (iOS) / Internal Testing (Android)
- 🔄 Expo OTA updates
- 🔄 CI/CD with GitHub Actions
- 🔄 Automated testing on PR
- 🔄 Cloud Functions deployment

---

## Next Development Phases

### Phase 2: Core Messaging (Current Sprint)
- [ ] SQLite local database setup
- [ ] Chat list screen and UI
- [ ] Chat conversation screen
- [ ] Send/receive messages with optimistic UI
- [ ] Message persistence and offline queue
- [ ] Real-time message delivery

### Phase 3: Message Status & Read Receipts
- [ ] Typing indicators
- [ ] Message delivery status
- [ ] Read receipts (DM and group)
- [ ] Online/offline presence indicators
- [ ] "Last seen" display

### Phase 4: Group Chat
- [ ] Create group chat
- [ ] Group messaging
- [ ] Group read receipts
- [ ] Add/remove participants
- [ ] Group info and management

### Phase 5: Push Notifications
- [ ] Notification setup and permissions
- [ ] Cloud Functions for notifications
- [ ] Foreground/background/closed app handling
- [ ] Notification tap to open chat
- [ ] Badge count management

### Phase 6: Media & Advanced Features
- [ ] Image sharing
- [ ] Message reply feature
- [ ] Message deletion
- [ ] Message editing
- [ ] Reactions
- [ ] Message search

### Phase 7: AI Features (Remote Team Persona)
- [ ] Thread summarization
- [ ] Action item extraction
- [ ] Smart search
- [ ] Priority message detection
- [ ] Decision tracking
- [ ] Advanced: Multi-step agent or proactive assistant

---

## Status Legend
- ✅ Complete and tested
- 🔄 In progress
- 📝 Planned
- ⚠️ Blocked/Issues
- ❌ Deprecated/Removed

---

## Document Maintenance

**Owner:** Development Team  
**Review Frequency:** After each major feature completion  
**Last Reviewed:** October 21, 2025

**Change Log:**
- 2025-10-21: Initial architecture document created
- 2025-10-21: Added User Service implementation details
- 2025-10-21: Added Key Features section with full API reference
- 2025-10-21: **ARCHITECTURE REFACTOR** - Separated AuthContext and UserContext
  - Created UserContext for Firestore profile management
  - AuthContext now handles ONLY Firebase Authentication
  - Implemented clean separation of concerns
  - Added comprehensive Context Architecture section
  - Updated all components to use dual-context pattern

