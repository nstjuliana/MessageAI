# Firebase Setup Guide

## ✅ Completed Steps

- [x] Created Firebase project in console
- [x] Installed Firebase SDK
- [x] Created `src/config/firebase.ts`
- [x] Created folder structure
- [x] Installed dependencies (AsyncStorage, SQLite, NetInfo, Constants)
- [x] Updated `.gitignore` to protect sensitive files

---

## 📋 Next Steps - YOU NEED TO DO THESE

### Step 1: Create .env File

1. Copy `env.example` to `.env`:
   ```bash
   copy env.example .env
   ```

2. Open `.env` and fill in your Firebase configuration values from the Firebase Console.

Go to Firebase Console → Project Settings → Your Apps → Web App → Config

Replace the placeholder values with your actual Firebase config:

```env
EXPO_PUBLIC_FIREBASE_API_KEY=AIza...your-actual-key
EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN=your-project.firebaseapp.com
EXPO_PUBLIC_FIREBASE_PROJECT_ID=your-project-id
EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET=your-project.appspot.com
EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=123456789
EXPO_PUBLIC_FIREBASE_APP_ID=1:123456789:web:abc123
```

**IMPORTANT**: The `.env` file is already in `.gitignore` so your credentials won't be committed to git.

---

### Step 2: Enable Firebase Services (If Not Done Yet)

#### Authentication
1. Firebase Console → Authentication → Get Started
2. Sign-in method tab → Email/Password → Enable → Save

#### Firestore Database
1. Firebase Console → Firestore Database → Create Database
2. Start in **test mode**
3. Choose location (us-central or closest to you)
4. Go to Rules tab and update with the security rules from the task list

#### Firebase Storage
1. Firebase Console → Storage → Get Started
2. Start in **test mode**
3. Use same location as Firestore

---

### Step 3: Download Platform-Specific Config Files (For Native Builds)

#### For iOS
1. Firebase Console → Project Settings → iOS app
2. Bundle ID: `com.yourname.messageai` (choose your own)
3. Download `GoogleService-Info.plist`
4. Save it to project root (it's gitignored)

#### For Android
1. Firebase Console → Project Settings → Android app
2. Package name: `com.yourname.messageai` (same as iOS)
3. Download `google-services.json`
4. Save it to project root (it's gitignored)

**Note**: These are needed for native builds later. Not required for Expo Go testing.

---

## 🧪 Test Firebase Connection

After setting up your `.env` file, let's verify Firebase is connected:

### Quick Test Script

Create a test file at `src/test-firebase.ts`:

```typescript
import { auth, db, storage } from './config/firebase';

export async function testFirebaseConnection() {
  console.log('Testing Firebase connection...');
  
  // Test Auth
  console.log('Auth initialized:', !!auth);
  
  // Test Firestore
  console.log('Firestore initialized:', !!db);
  
  // Test Storage
  console.log('Storage initialized:', !!storage);
  
  console.log('Firebase connection test complete!');
}
```

Then in `App.tsx` or `app/_layout.tsx`, import and call it:

```typescript
import { testFirebaseConnection } from './src/test-firebase';

useEffect(() => {
  testFirebaseConnection();
}, []);
```

Run the app: `npx expo start`

You should see the console logs confirming Firebase is initialized.

---

## 📱 Run the App

```bash
npx expo start
```

Then:
- Press `i` for iOS Simulator
- Press `a` for Android Emulator
- Scan QR code with Expo Go app on physical device

---

## ⚠️ Common Issues

### "Firebase config is undefined"
- Make sure `.env` file exists in project root
- Verify environment variables start with `EXPO_PUBLIC_`
- Restart Expo dev server after changing `.env`

### "No Firebase App '[DEFAULT]' has been created"
- Check that `firebase.ts` is being imported before any Firebase usage
- Verify `.env` values are correct (no quotes, no extra spaces)

### AsyncStorage peer dependency warning
- This warning is safe to ignore - AsyncStorage 2.2.0 is compatible with Firebase

---

## 🎯 What's Next

Once you verify Firebase is connected:
1. Set up TypeScript paths in `tsconfig.json` for clean imports
2. Update `app.json` with proper app metadata
3. Set up EAS for deployment
4. Build authentication screens

See `projectdesign/task-list.md` for the complete build order.

