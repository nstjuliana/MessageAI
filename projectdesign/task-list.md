# MessageAI Task List

**Philosophy**: Get deployment working first, then build features incrementally with continuous deployment validation.

---

## Phase 0: Setup & Deployment Pipeline (Priority)

### Firebase & Deployment Setup
1. [x] Create Firebase project in console
2. [x] Enable Firebase Authentication (Email/Password provider)
3. [x] Create Firestore database (start in test mode)
4. [x] Set up Firestore security rules (basic read/write for authenticated users)
5. [x] Enable Firebase Storage for media uploads
6. [x] Download Firebase config files (`google-services.json`, `GoogleService-Info.plist`)
7. [x] Install Firebase SDK: `npm install firebase @react-native-firebase/app @react-native-firebase/auth @react-native-firebase/firestore`
8. [x] Create `src/config/firebase.ts` with Firebase initialization
9. [x] Add Firebase config to `.gitignore` and use environment variables

### Expo Configuration
10. [x] Update `app.json` with proper app metadata (name, slug, version, icon)
11. [x] Configure `app.json` for Firebase (google-services.json paths)
<!-- Skip for now -->
<!-- - [ ] Install Expo dev dependencies: `npx expo install expo-dev-client`
- [ ] Set up EAS (Expo Application Services): `npm install -g eas-cli && eas login`
- [ ] Configure EAS Build: `eas build:configure`
- [ ] Update `eas.json` for development builds
- [ ] Create development build for iOS: `eas build --profile development --platform ios`
- [ ] Create development build for Android: `eas build --profile development --platform android`-->
12. [x] Test app launches on both iOS simulator and Android emulator 

### Project Structure Setup
13. [x] Create folder structure: `src/screens`, `src/components`, `src/services`, `src/utils`, `src/types`, `src/hooks`
14. [x] Set up TypeScript paths in `tsconfig.json` for clean imports (`@/components`, `@/screens`, etc.)
15. [x] Install essential dependencies: `expo-router`, `expo-sqlite`, `expo-notifications`, `@react-native-community/netinfo`
16. [x] Remove tab navigation structure (delete `app/(tabs)` folder)
17. [x] Create basic navigation structure with Expo Router (single main screen)
18. [x] Set up environment variables with `expo-constants` and `app.config.js`

### Deployment Validation
19. [ ] Deploy "Hello World" version to Expo Go
20. [ ] Create simple auth screen that connects to Firebase (just to verify connection)
21. [ ] Test on physical device via Expo Go
22. [ ] Verify Firebase connection works on both platforms
23. [ ] Set up Cloud Functions project: `firebase init functions`
24. [ ] Deploy a test Cloud Function and verify it's callable from app

---

## Phase 1: MVP - Authentication & Basic Infrastructure (Hours 1-4)

### Authentication Flow
25. [ ] Create `src/types/user.types.ts` with User interface
26. [ ] Create `src/services/auth.service.ts` with Firebase Auth methods
27. [ ] Build Sign Up screen (`app/auth/signup.tsx`) with email/password
28. [ ] Build Login screen (`app/auth/login.tsx`) with email/password
29. [ ] Implement authentication state management (Context or Zustand)
30. [ ] Create protected route wrapper for authenticated screens
31. [ ] Add logout functionality
32. [ ] Handle authentication errors and display to user
33. [ ] Persist auth state across app restarts

### User Profile Setup
34. [ ] Create `users` collection schema in Firestore
35. [ ] Build profile setup screen (display name, optional avatar)
36. [ ] Create `src/services/user.service.ts` for user CRUD operations
37. [ ] Implement profile creation on first sign up
38. [ ] Add user presence tracking (online/offline/away)
39. [ ] Update user's `lastSeen` timestamp on app activity

### SQLite Local Database
40. [ ] Create `src/database/schema.ts` with SQLite table definitions
41. [ ] Create `src/database/database.ts` with SQLite initialization
42. [ ] Implement `messages` table with offline queue fields
43. [ ] Implement `chats` table for chat list cache
44. [ ] Implement `chat_participants` table for participant cache
45. [ ] Create database migration system for schema updates
46. [ ] Test database operations (insert, query, update, delete)

### Deployment Checkpoint #1
47. [ ] Deploy auth flow to Expo Go
48. [ ] Test sign up, login, logout on physical devices
49. [ ] Verify Firestore user creation works
50. [ ] Verify SQLite database initializes correctly

---

## Phase 2: MVP - Core Messaging (Hours 5-12)

### Chat List Screen
51. [ ] Create `src/types/chat.types.ts` with Chat and Message interfaces
52. [ ] Build Chat List screen (`app/(tabs)/chats.tsx`)
53. [ ] Create chat list item component with last message preview
54. [ ] Implement Firestore listener for user's chats
55. [ ] Display unread message count badge
56. [ ] Sort chats by most recent message
57. [ ] Add pull-to-refresh for chat list
58. [ ] Handle empty state (no chats yet)

### Start New Chat
59. [ ] Build user search/selection screen for new chat
60. [ ] Query Firestore for users (search by display name)
61. [ ] Create new chat in Firestore when user selected
62. [ ] Navigate to new chat conversation screen
63. [ ] Handle duplicate chat prevention (don't create multiple DMs with same user)

### Chat Conversation Screen
64. [ ] Build Chat screen UI (`app/chat/[chatId].tsx`)
65. [ ] Create message bubble component (sent vs received styling)
66. [ ] Implement message list with FlatList (inverted for chat UI)
67. [ ] Create message input component (TextInput + Send button)
68. [ ] Display message timestamps
69. [ ] Show sender name/avatar for received messages
70. [ ] Add pull-to-refresh for loading older messages

### Send Message (Optimistic UI)
71. [ ] Create `src/services/message.service.ts`
72. [ ] Implement optimistic UI: display message immediately
73. [ ] Generate local message ID (UUID)
74. [ ] Insert message into SQLite with status "sending"
75. [ ] Attempt Firestore write to `chats/{chatId}/messages`
76. [ ] Update message status to "sent" on success
77. [ ] Mark as "failed" on error and add to retry queue
78. [ ] Update chat's `lastMessage` fields in Firestore
79. [ ] Show message status indicator (sending/sent/failed)

### Receive Messages (Real-time)
80. [ ] Set up Firestore listener for new messages in chat
81. [ ] Insert received messages into SQLite
82. [ ] Update UI when new message arrives
83. [ ] Auto-scroll to bottom on new message (if already at bottom)
84. [ ] Play sound/haptic feedback on receive (optional)
85. [ ] Implement "scroll to bottom" button when scrolled up

### Message Persistence & Offline Support
86. [ ] Load last 20 messages from SQLite on chat open
87. [ ] Sync messages from Firestore on first load
88. [ ] Implement retry mechanism for failed messages
89. [ ] Listen to network state changes with NetInfo
90. [ ] Trigger message retry on reconnection
91. [ ] Implement exponential backoff for retries
92. [ ] Display offline indicator when network unavailable
93. [ ] Queue messages sent while offline

### Deployment Checkpoint #2
94. [ ] Deploy messaging functionality to Expo Go
95. [ ] Test real-time messaging between two devices
96. [ ] Test offline message queueing (airplane mode)
97. [ ] Test message persistence (force quit and reopen)
98. [ ] Verify messages sync correctly after reconnection

---

## Phase 3: MVP - Message Status & Read Receipts (Hours 13-16)

### Typing Indicators
99. [ ] Add typing status to Firestore (`chats/{chatId}/typing/{userId}`)
100. [ ] Update typing status on TextInput change (debounced)
101. [ ] Clear typing status after 3 seconds of inactivity
102. [ ] Listen for other users' typing status
103. [ ] Display "User is typing..." indicator in chat
104. [ ] Handle multiple users typing in groups

### Message Delivery Status (DM)
105. [ ] Update message status to "delivered" when recipient receives
106. [ ] Display checkmark indicators (single ✓ = sent, double ✓✓ = delivered)
107. [ ] Listen for message status updates in real-time
108. [ ] Update SQLite when status changes

### Read Receipts (DM)
109. [ ] Track last read message ID per user
110. [ ] Create `readReceipts` subcollection in Firestore
111. [ ] Update read receipt when user views chat
112. [ ] Update read receipt when new message received while viewing
113. [ ] Mark message as "read" when recipient reads it
114. [ ] Display triple ✓✓✓ or blue checkmarks for read messages
115. [ ] Update sender's UI when message is read

### Online/Offline Presence
116. [ ] Update user presence to "online" on app open
117. [ ] Update presence to "offline" on app close/background
118. [ ] Listen for presence changes for chat participants
119. [ ] Display online/offline indicator in chat header
120. [ ] Display "last seen" timestamp when offline
121. [ ] Handle "away" status after 5 minutes of inactivity

### Deployment Checkpoint #3
122. [ ] Deploy read receipts and presence to Expo Go
123. [ ] Test typing indicators between devices
124. [ ] Test read receipts update correctly
125. [ ] Test presence indicators (online/offline/last seen)
126. [ ] Verify message status updates work

---

## Phase 4: MVP - Group Chat (Hours 17-20)

### Create Group Chat
127. [ ] Build "Create Group" screen with participant selection
128. [ ] Allow selecting 2+ users for group
129. [ ] Add group name and optional group photo
130. [ ] Create group chat in Firestore with type "group"
131. [ ] Add all participants to `participants` array
132. [ ] Set creator as admin in `adminIds` array
133. [ ] Navigate to new group chat

### Group Messaging
134. [ ] Update message UI to show sender info in groups
135. [ ] Display sender avatar and name for each message
136. [ ] Update message send logic to handle group recipients
137. [ ] Ensure all participants receive messages
138. [ ] Show participant list in group chat header

### Group Read Receipts
139. [ ] Track read receipts for each group member
140. [ ] Implement "Seen by X" counter
141. [ ] Show "Seen by all" when all members have read
142. [ ] Add message details screen showing who's read (optional)
143. [ ] Optimize for large groups (show count, not names)

### Group Info & Management
144. [ ] Build Group Info screen (participant list, group name, etc.)
145. [ ] Allow admins to add new participants
146. [ ] Allow admins to remove participants
147. [ ] Allow admins to change group name/photo
148. [ ] Allow participants to leave group
149. [ ] Handle group updates (new member joined, etc.) with system messages

### Deployment Checkpoint #4 (MVP Complete)
150. [ ] Deploy group chat functionality to Expo Go
151. [ ] Test group chat with 3+ participants
152. [ ] Test group read receipts work correctly
153. [ ] Test adding/removing group members
154. [ ] Run through all MVP testing scenarios
155. [ ] Fix any critical bugs found

---

## Phase 5: MVP - Push Notifications (Hours 21-24)

### Push Notification Setup
156. [ ] Install expo-notifications: `npx expo install expo-notifications expo-device expo-constants`
157. [ ] Configure notification channels for Android
158. [ ] Request notification permissions on app start
159. [ ] Register for Expo push tokens
160. [ ] Store device tokens in Firestore user document
161. [ ] Handle token refresh and updates

### Cloud Functions for Notifications
162. [ ] Create Cloud Function: `sendMessageNotification`
163. [ ] Trigger on new message created in Firestore
164. [ ] Fetch recipient device tokens
165. [ ] Get sender information for notification
166. [ ] Send notification via Expo Push API
167. [ ] Handle notification errors and invalid tokens
168. [ ] Test function locally with Firebase emulator

### Notification Handling in App
169. [ ] Configure notification handler (foreground behavior)
170. [ ] Listen for foreground notifications
171. [ ] Show in-app notification banner for foreground messages
172. [ ] Handle notification tap to open specific chat
173. [ ] Extract chatId from notification data
174. [ ] Navigate to correct chat on notification tap
175. [ ] Clear notification badge when chat opened

### Testing & Refinement
176. [ ] Test foreground notifications on physical device
177. [ ] Test background notifications on physical device
178. [ ] Test closed app notifications on physical device
179. [ ] Verify tapping notification opens correct chat
180. [ ] Test notification sounds and vibration
181. [ ] Handle edge cases (chat deleted, user blocked, etc.)

### Deployment Checkpoint #5 (MVP FINAL)
182. [ ] Deploy complete MVP to Expo Go
183. [ ] Verify all MVP requirements met
184. [ ] Complete all 7 testing scenarios
185. [ ] Fix any remaining bugs
186. [ ] Record demo video showing MVP features
187. [ ] Submit MVP checkpoint

---

## Phase 6: Post-MVP Enhancements (Days 2-4)

### Media Sharing - Images
188. [ ] Install image picker: `npx expo install expo-image-picker`
189. [ ] Add camera/gallery button to message input
190. [ ] Request camera and media library permissions
191. [ ] Implement image picker functionality
192. [ ] Upload images to Firebase Storage
193. [ ] Generate thumbnail for large images
194. [ ] Update message schema to include mediaUrl
195. [ ] Display images in message bubbles
196. [ ] Add image preview/zoom functionality
197. [ ] Cache images locally for offline viewing

### Message Reply Feature
198. [ ] Add long-press menu on messages (reply, copy, delete)
199. [ ] Implement reply UI showing quoted message
200. [ ] Update message schema with `replyToId` field
201. [ ] Send reply with reference to original message
202. [ ] Display replied-to message in bubble
203. [ ] Scroll to original message on reply tap

### Advanced Chat Features
204. [ ] Add "Clear Chat History" functionality
205. [ ] Implement message deletion (for everyone / for me)
206. [ ] Add message edit capability (mark as edited)
207. [ ] Implement message search within chat
208. [ ] Add "starred/pinned" messages feature
209. [ ] Show message reactions (emoji reactions)

### Enhanced Notifications
210. [ ] Add notification preferences screen
211. [ ] Allow muting chats (disable notifications)
212. [ ] Add "Do Not Disturb" schedule
213. [ ] Customize notification sounds per chat
214. [ ] Group notifications by chat
215. [ ] Add quick reply from notification (iOS/Android)

### UI/UX Polish
216. [ ] Add loading skeletons for chat list
217. [ ] Improve message animations (fade in, slide)
218. [ ] Add swipe gestures (reply, delete)
219. [ ] Implement dark mode support
220. [ ] Add haptic feedback for interactions
221. [ ] Optimize image loading and caching
222. [ ] Improve typing indicator design
223. [ ] Add empty states with helpful CTAs

### Performance Optimization
224. [ ] Implement message pagination (load 20 at a time)
225. [ ] Add lazy loading for older messages
226. [ ] Optimize Firestore queries with indexes
227. [ ] Implement message deduplication
228. [ ] Add query cursors for efficient pagination
229. [ ] Cache user profiles to reduce Firestore reads
230. [ ] Implement background message sync
231. [ ] Optimize image compression before upload

### Testing & Bug Fixes
232. [ ] Test with poor network conditions (3G, throttled)
233. [ ] Test rapid-fire messages (20+ quickly)
234. [ ] Test with multiple chats open simultaneously
235. [ ] Test edge cases (empty messages, very long messages)
236. [ ] Fix memory leaks (unsubscribe listeners)
237. [ ] Test app lifecycle (background, foreground, killed)
238. [ ] Profile performance with React DevTools

---

## Phase 7: AI Features Implementation (Days 5-6)

**Note**: Tasks depend on chosen persona. Below are examples.

### AI Infrastructure
239. [ ] Choose persona (Remote Team / International / Parent / Creator)
240. [ ] Set up OpenAI or Anthropic API key in Cloud Functions
241. [ ] Install AI SDK: `npm install ai` (Vercel AI SDK)
242. [ ] Create Cloud Function: `callAI` (generic LLM endpoint)
243. [ ] Implement rate limiting for AI calls
244. [ ] Add cost tracking and logging
245. [ ] Set up response caching strategy

### RAG Pipeline for Conversation Context
246. [ ] Create Cloud Function: `getConversationContext`
247. [ ] Fetch relevant messages from conversation history
248. [ ] Format messages for LLM context
249. [ ] Implement token counting to stay within limits
250. [ ] Add semantic search over messages (vector embeddings - optional)
251. [ ] Cache conversation summaries for efficiency

### AI Feature 1: [Based on Persona]
252. [ ] Design UI for feature (button, modal, dedicated screen)
253. [ ] Create Cloud Function endpoint
254. [ ] Build prompt template with instructions
255. [ ] Pass conversation context via RAG
256. [ ] Display loading state while processing
257. [ ] Show results in user-friendly format
258. [ ] Handle errors gracefully
259. [ ] Add retry mechanism
260. [ ] Test with various conversation types
261. [ ] Cache results to reduce API calls

### AI Feature 2-5: [Repeat for each required feature]
262. [ ] Design UI
263. [ ] Create Cloud Function
264. [ ] Build prompt
265. [ ] Implement feature logic
266. [ ] Test and refine

### Advanced AI Feature (Choose One)
267. [ ] Implement multi-step agent OR proactive assistant
268. [ ] Set up agent framework (Swarm, LangChain, AI SDK)
269. [ ] Define agent tools/functions
270. [ ] Implement agent loop and state management
271. [ ] Test agent with complex scenarios
272. [ ] Add safety guardrails and limits

### AI Integration Polish
273. [ ] Add AI settings screen (enable/disable features)
274. [ ] Implement feedback mechanism (thumbs up/down)
275. [ ] Add cost monitoring and usage limits
276. [ ] Create AI onboarding tutorial
277. [ ] Optimize prompts based on testing
278. [ ] Add AI response streaming (if applicable)

---

## Phase 8: Final Polish & Submission (Day 7)

### Production Readiness
279. [ ] Update Firestore security rules for production
280. [ ] Implement proper error boundaries
281. [ ] Add analytics tracking (Firebase Analytics)
282. [ ] Set up error reporting (Sentry or Firebase Crashlytics)
283. [ ] Add app version check and update prompts
284. [ ] Implement proper loading states everywhere
285. [ ] Remove all console.logs and debug code
286. [ ] Update environment variables for production

### Deployment
287. [ ] Create production build: `eas build --profile production --platform all`
288. [ ] Test production build on physical devices
289. [ ] Deploy Cloud Functions to production
290. [ ] Verify all Firebase services are in production mode
291. [ ] Create Expo Go link or deploy to TestFlight/internal testing
292. [ ] Test complete app end-to-end on production

### Documentation
293. [ ] Write comprehensive README.md with:
  294. [ ] Project description
  295. [ ] Tech stack details
  296. [ ] Prerequisites
  297. [ ] Installation instructions
  298. [ ] Firebase setup steps
  299. [ ] Environment variables needed
  300. [ ] How to run locally
  301. [ ] How to deploy
  302. [ ] Known issues and troubleshooting
303. [ ] Create 1-page Persona Brainlift document
304. [ ] Document AI features and use cases
305. [ ] Add screenshots to README
306. [ ] Create architecture diagram (optional but impressive)

### Demo Video (5-7 minutes)
307. [ ] Script out demo flow
308. [ ] Record real-time messaging between two devices
309. [ ] Show group chat with 3+ participants
310. [ ] Demonstrate offline scenario (airplane mode test)
311. [ ] Show app lifecycle handling
312. [ ] Demo all 5 required AI features
313. [ ] Demo advanced AI capability
314. [ ] Add captions/annotations for clarity
315. [ ] Edit and export video
316. [ ] Upload to YouTube/Loom

### Social Media Post
317. [ ] Write 2-3 sentence description
318. [ ] Create thumbnail or screenshot
319. [ ] Include key features and persona
320. [ ] Tag @GauntletAI
321. [ ] Post on X/Twitter or LinkedIn

### Final Submission
322. [ ] Push all code to GitHub
323. [ ] Create GitHub release/tag for submission
324. [ ] Verify README has all setup instructions
325. [ ] Test setup instructions on fresh machine (if possible)
326. [ ] Submit all deliverables:
  327. [ ] GitHub repository link
  328. [ ] Demo video link
  329. [ ] Deployed app link (Expo Go/TestFlight/APK)
  330. [ ] Persona Brainlift PDF
  331. [ ] Social media post link
332. [ ] Submit before Sunday 10:59 PM CT

---

## Continuous Tasks (Throughout Development)

333. [ ] Commit after each completed task with descriptive message
334. [ ] Test on both iOS and Android after each feature
335. [ ] Deploy to Expo Go regularly (at least daily)
336. [ ] Keep dependencies updated
337. [ ] Review and update Firestore security rules as needed
338. [ ] Monitor Firebase usage and costs
339. [ ] Document any blockers or issues
340. [ ] Take breaks to avoid burnout!

---

## Emergency Debugging Checklist

If something breaks:
341. [ ] Check Firebase console for errors
342. [ ] Check Cloud Functions logs
343. [ ] Check Expo logs: `npx expo start`
344. [ ] Check device logs (Xcode/Android Studio)
345. [ ] Verify Firebase config is correct
346. [ ] Check network requests in Firebase console
347. [ ] Test on fresh device install
348. [ ] Clear SQLite database and re-sync
349. [ ] Check Firestore security rules aren't blocking
350. [ ] Verify all environment variables are set

