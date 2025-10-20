# Database Strategy: Firestore vs Realtime Database

## Current Setup: Firestore Only ✅

Your project is configured with **Firestore**, which is sufficient for the entire MVP.

---

## When to Use Each Database

### Firestore (Primary Database)

**Use for:**
- ✅ Messages (with subcollections)
- ✅ Chats (DMs and groups)
- ✅ User profiles
- ✅ Read receipts
- ✅ Chat metadata
- ✅ AI results/cache

**Strengths:**
- Complex queries (WHERE, ORDER BY, pagination)
- Subcollections (messages nested under chats)
- Built-in offline persistence
- Better for structured data
- Easier security rules

**Latency:** ~100-300ms for updates

---

### Realtime Database (RTDB)

**Use for:**
- ⚡ Typing indicators
- ⚡ Online/offline presence
- ⚡ Active call status
- ⚡ Temporary ephemeral data

**Strengths:**
- Very low latency (<100ms)
- Built-in presence detection
- Simpler data structure (JSON tree)
- Cheaper for high-frequency writes
- Better for rapidly changing data

**Weakness:**
- Limited queries (no complex filtering)
- No subcollections
- Manual offline sync needed

---

## Recommended Approach

### For MVP (First 24 Hours): Firestore Only

**Stick with what you have.** Firestore can handle:

```typescript
// Typing indicators in Firestore
chats/{chatId}/typing/{userId}
  - isTyping: boolean
  - lastUpdated: timestamp

// Presence in Firestore  
users/{userId}
  - presence: "online" | "offline" | "away"
  - lastSeen: timestamp
```

**Pros:**
- Single database = simpler architecture
- Faster development
- Easier to secure
- Good enough for MVP

**Cons:**
- Slightly higher latency (~200ms vs <50ms)
- More Firestore writes (costs slightly more)

---

### Post-MVP: Hybrid Approach (Optional)

If you want optimal performance, use both:

**Firestore for persistent data:**
```
users/{userId} - profiles
chats/{chatId} - chat metadata
  └─ messages/{messageId} - message content
  └─ readReceipts/{userId} - read status
```

**RTDB for ephemeral real-time data:**
```
presence/
  └─ {userId}: { online: true, lastSeen: 1234567890 }

typing/
  └─ {chatId}/
      └─ {userId}: { isTyping: true, timestamp: 1234567890 }
```

This is what WhatsApp-scale apps do.

---

## Implementation Examples

### Typing Indicators

#### Firestore Approach (Current)

```typescript
// src/services/typing.service.ts
import { db } from '@/config/firebase';
import { doc, setDoc, deleteDoc, onSnapshot } from 'firebase/firestore';

export async function setTyping(chatId: string, userId: string, isTyping: boolean) {
  const typingRef = doc(db, `chats/${chatId}/typing/${userId}`);
  
  if (isTyping) {
    await setDoc(typingRef, {
      isTyping: true,
      timestamp: Date.now(),
    });
  } else {
    await deleteDoc(typingRef);
  }
}

export function listenToTyping(chatId: string, callback: (typingUsers: string[]) => void) {
  const typingRef = collection(db, `chats/${chatId}/typing`);
  
  return onSnapshot(typingRef, (snapshot) => {
    const typingUsers = snapshot.docs.map(doc => doc.id);
    callback(typingUsers);
  });
}
```

**Latency:** 100-300ms
**Firestore writes:** High (every keystroke debounced)

---

#### RTDB Approach (If Added)

```typescript
// src/services/typing.service.ts
import { rtdb } from '@/config/firebase';
import { ref, set, onValue, remove } from 'firebase/database';

export async function setTyping(chatId: string, userId: string, isTyping: boolean) {
  const typingRef = ref(rtdb, `typing/${chatId}/${userId}`);
  
  if (isTyping) {
    await set(typingRef, {
      isTyping: true,
      timestamp: Date.now(),
    });
  } else {
    await remove(typingRef);
  }
}

export function listenToTyping(chatId: string, callback: (typingUsers: string[]) => void) {
  const typingRef = ref(rtdb, `typing/${chatId}`);
  
  return onValue(typingRef, (snapshot) => {
    const data = snapshot.val();
    const typingUsers = data ? Object.keys(data) : [];
    callback(typingUsers);
  });
}
```

**Latency:** <50ms
**RTDB writes:** Cheaper for high frequency

---

### Presence Detection

#### Firestore Approach (Current)

```typescript
// src/services/presence.service.ts
import { db } from '@/config/firebase';
import { doc, setDoc, onSnapshot } from 'firebase/firestore';
import { AppState } from 'react-native';

export async function setPresence(userId: string, status: 'online' | 'offline' | 'away') {
  const userRef = doc(db, `users/${userId}`);
  
  await setDoc(userRef, {
    presence: status,
    lastSeen: Date.now(),
  }, { merge: true });
}

export function setupPresence(userId: string) {
  // Set online on app open
  setPresence(userId, 'online');
  
  // Update on app state changes
  AppState.addEventListener('change', (state) => {
    if (state === 'active') {
      setPresence(userId, 'online');
    } else {
      setPresence(userId, 'away');
    }
  });
  
  // Set offline on app close (use beforeunload or similar)
  return () => setPresence(userId, 'offline');
}
```

**Issue:** If app crashes, user stays "online" until manual offline update

---

#### RTDB Approach (Better)

```typescript
// src/services/presence.service.ts
import { rtdb } from '@/config/firebase';
import { ref, set, onDisconnect } from 'firebase/database';

export function setupPresence(userId: string) {
  const presenceRef = ref(rtdb, `presence/${userId}`);
  
  // Set online
  set(presenceRef, {
    online: true,
    lastSeen: Date.now(),
  });
  
  // Auto-set offline on disconnect (built-in RTDB feature!)
  onDisconnect(presenceRef).set({
    online: false,
    lastSeen: Date.now(),
  });
}
```

**Advantage:** RTDB automatically handles disconnects (app crash, network loss)

---

## Cost Comparison

### Firestore
- Reads: $0.06 per 100K reads
- Writes: $0.18 per 100K writes
- Storage: $0.18/GB/month

**For typing indicators:** 
- 1 chat with 2 users typing = ~60 writes/minute = $15/month for 1M users typing constantly
- Too expensive for high-frequency updates

### RTDB
- Storage: $5/GB/month
- Bandwidth: $1/GB downloaded
- No charge per operation

**For typing indicators:**
- Same scenario = ~$5/month for 1M users
- Much better for high-frequency updates

---

## Recommendation

### MVP (Days 1-2): ✅ Firestore Only

Use Firestore for everything:
- Messages
- Presence (manual updates)
- Typing indicators (debounced to 1 update/3 seconds)
- Read receipts

**Why:** Get MVP working fast. Slightly higher latency is acceptable.

### Post-MVP (Days 3-4): Consider RTDB

If users complain about lag, add RTDB for:
- Typing indicators (instant feel)
- Presence (automatic disconnect detection)

**Migration:** Move only typing and presence to RTDB, keep everything else in Firestore.

---

## How to Add RTDB Later

If you decide to add it:

1. **Enable in Firebase Console:**
   - Realtime Database → Create Database → Same region as Firestore

2. **Add to .env:**
   ```env
   EXPO_PUBLIC_FIREBASE_DATABASE_URL=https://your-project.firebaseio.com
   ```

3. **Update firebase.ts:**
   ```typescript
   import { getDatabase } from 'firebase/database';
   const rtdb = getDatabase(app);
   export { app, auth, db, rtdb, storage };
   ```

4. **Update security rules** in Firebase Console.

---

## Final Verdict

**For your 7-day sprint:**

✅ **Use Firestore only**
- Simpler = faster development
- Good enough for MVP
- You can always add RTDB later if needed

🚫 **Don't add RTDB yet**
- Adds complexity
- Not required for MVP deadline
- Premature optimization

Focus on getting features working, not on micro-optimizations. You can optimize later if needed.

