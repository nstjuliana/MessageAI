# Navigation Structure

**Style**: Single main screen (WhatsApp-style) with settings button in header

---

## App Navigation Flow

```
┌─────────────────────────────────────┐
│  Auth Flow (Not Authenticated)     │
└─────────────────────────────────────┘
         │
         ├─→ Sign Up
         ├─→ Login
         └─→ (Profile Setup - first time only)
         │
         ↓
┌─────────────────────────────────────┐
│  Main App (Authenticated)           │
└─────────────────────────────────────┘
         │
         ├─→ Chat List (Main Screen)
         │   ├─→ Settings (modal from header)
         │   └─→ New Chat (modal/screen)
         │
         ├─→ Chat Conversation [chatId]
         │   └─→ Group Info (modal - if group)
         │
         └─→ Create Group Chat
```

---

## Expo Router File Structure

```
app/
├── _layout.tsx                    # Root layout with auth state check
├── (auth)/
│   ├── _layout.tsx               # Auth flow layout
│   ├── login.tsx                 # Login screen
│   ├── signup.tsx                # Sign up screen
│   └── profile-setup.tsx         # Profile setup (first-time users)
│
├── (main)/
│   ├── _layout.tsx               # Main app layout (requires auth)
│   ├── index.tsx                 # Chat List (Main Screen)
│   ├── chat/
│   │   └── [chatId].tsx          # Chat conversation screen
│   ├── new-chat.tsx              # New chat / user search
│   └── create-group.tsx          # Create group chat
│
└── (modals)/
    ├── settings.tsx              # Settings modal
    └── group-info.tsx            # Group info modal
```

---

## Screen Descriptions

### Main Screen: Chat List (`app/(main)/index.tsx`)

**Header:**
- Title: "MessageAI" or "Chats"
- Right button: Settings icon (gear/cog)
- Right button: New chat icon (compose/plus)

**Content:**
- FlatList of chats (DMs and groups)
- Each item shows:
  - Avatar
  - Name
  - Last message preview
  - Timestamp
  - Unread badge
  - Online status (for DMs)

**Empty State:**
- Illustration
- "No conversations yet"
- "Tap the + icon to start chatting"

**Actions:**
- Tap chat → Navigate to conversation
- Tap settings → Open settings modal
- Tap new chat → Navigate to user search

---

### Chat Conversation (`app/(main)/chat/[chatId].tsx`)

**Header:**
- Left button: Back arrow
- Title: Contact name / Group name
- Subtitle: Online status / "X participants"
- Right button: Info icon (for group info)

**Content:**
- Inverted FlatList of messages
- Message input at bottom
- Typing indicators
- Date separators

**Actions:**
- Tap info → Open group info modal (groups only)
- Long press message → Reply/Copy/Delete menu

---

### Settings Modal (`app/(modals)/settings.tsx`)

**Content:**
- User profile section
  - Avatar
  - Display name
  - Bio
  - Edit profile button
- Preferences
  - Notifications
  - Theme (if implementing dark mode)
- Account
  - Logout button
  - Delete account

**Presentation:**
- Modal with close button in header
- Or slide-in from right (like Settings in iOS)

---

### New Chat (`app/(main)/new-chat.tsx`)

**Header:**
- Left button: Back arrow
- Title: "New Chat"
- Right button: "Create Group" text button

**Content:**
- Search bar
- List of all users (excluding current user)
- Alphabet index on right (iOS-style)

**Actions:**
- Tap user → Create/open DM conversation
- Tap "Create Group" → Navigate to group creation

---

### Create Group (`app/(main)/create-group.tsx`)

**Flow:**
1. **Select Participants** (first screen)
   - Multi-select user list
   - "Next" button

2. **Group Details** (second screen)
   - Group name (required)
   - Group photo (optional)
   - "Create" button

---

## Navigation Implementation Examples

### Root Layout (`app/_layout.tsx`)

```tsx
import { Stack } from 'expo-router';
import { AuthProvider } from '@/contexts/auth-context';

export default function RootLayout() {
  return (
    <AuthProvider>
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="(auth)" />
        <Stack.Screen name="(main)" />
        <Stack.Screen 
          name="(modals)" 
          options={{ presentation: 'modal' }}
        />
      </Stack>
    </AuthProvider>
  );
}
```

### Main Layout (`app/(main)/_layout.tsx`)

```tsx
import { Stack } from 'expo-router';
import { useAuth } from '@/contexts/auth-context';
import { Redirect } from 'expo-router';

export default function MainLayout() {
  const { user, loading } = useAuth();

  if (loading) {
    return <LoadingScreen />;
  }

  if (!user) {
    return <Redirect href="/(auth)/login" />;
  }

  return (
    <Stack>
      <Stack.Screen 
        name="index" 
        options={{
          title: 'MessageAI',
          headerRight: () => <HeaderButtons />,
        }}
      />
      <Stack.Screen 
        name="chat/[chatId]" 
        options={{ headerShown: false }} // Custom header in component
      />
      <Stack.Screen 
        name="new-chat"
        options={{ title: 'New Chat' }}
      />
      <Stack.Screen 
        name="create-group"
        options={{ title: 'Create Group' }}
      />
    </Stack>
  );
}
```

### Chat List with Header Buttons (`app/(main)/index.tsx`)

```tsx
import { View, FlatList, TouchableOpacity } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

export default function ChatListScreen() {
  // Set header buttons
  useLayoutEffect(() => {
    navigation.setOptions({
      headerRight: () => (
        <View style={{ flexDirection: 'row', gap: 16, marginRight: 16 }}>
          <TouchableOpacity onPress={() => router.push('/(modals)/settings')}>
            <Ionicons name="settings-outline" size={24} />
          </TouchableOpacity>
          <TouchableOpacity onPress={() => router.push('/new-chat')}>
            <Ionicons name="create-outline" size={24} />
          </TouchableOpacity>
        </View>
      ),
    });
  }, [navigation]);

  return (
    <View style={{ flex: 1 }}>
      {chats.length === 0 ? (
        <EmptyState />
      ) : (
        <FlatList
          data={chats}
          renderItem={({ item }) => <ChatListItem chat={item} />}
          keyExtractor={(item) => item.id}
        />
      )}
    </View>
  );
}
```

---

## Key Navigation Patterns

### Opening a Chat
```tsx
// From chat list
router.push(`/chat/${chatId}`);
```

### Creating a New Chat
```tsx
// After selecting user in new-chat screen
const chatId = await createOrGetDMChat(currentUserId, selectedUserId);
router.replace(`/chat/${chatId}`);
```

### Opening Settings
```tsx
// From header button
router.push('/(modals)/settings');
```

### Logout
```tsx
// From settings modal
await signOut();
router.replace('/(auth)/login');
```

---

## Benefits of This Structure

✅ **Simple & Clean**: No unnecessary tabs
✅ **Familiar**: Matches WhatsApp/Telegram UX
✅ **Focused**: Chat list is always the main screen
✅ **Scalable**: Easy to add AI features later (as modal or new screen)
✅ **Fast**: No tab switching overhead

---

## AI Features Integration (Post-MVP)

When you add AI features, you have options:

### Option 1: AI as Special Chat
- AI assistant appears as a chat in the list
- "MessageAI Assistant" pinned to top
- Users chat with it like any other contact

### Option 2: AI as Header Button
- Add third button in header (sparkle icon)
- Opens AI assistant modal
- Context-aware based on current screen

### Option 3: AI as Long-Press Actions
- Long press message → "Summarize", "Translate", etc.
- AI actions integrated into message context menu
- Results shown in modal or inline

All three approaches work with the single-screen structure!

