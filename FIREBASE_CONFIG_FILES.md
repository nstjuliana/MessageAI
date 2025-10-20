# Firebase Configuration Files Setup

Your `app.json` is now configured to use Firebase config files. You need to download these from Firebase Console.

---

## 📱 Required Files

- **Android**: `google-services.json` (place in project root)
- **iOS**: `GoogleService-Info.plist` (place in project root)

Both files are already in `.gitignore` so they won't be committed to git.

---

## 📥 How to Download

### For Android (google-services.json)

1. Go to **Firebase Console** → Your Project
2. Click the **gear icon** ⚙️ → **Project settings**
3. Scroll to **"Your apps"** section
4. If you don't have an Android app yet:
   - Click the **Android icon** 
   - Package name: `com.noah.messageai` (matches your app.json)
   - App nickname: "MessageAI Android"
   - Click **Register app**
5. Download **`google-services.json`**
6. Save it to your project root: `MessageAI/google-services.json`

### For iOS (GoogleService-Info.plist)

1. Go to **Firebase Console** → Your Project
2. Click the **gear icon** ⚙️ → **Project settings**
3. Scroll to **"Your apps"** section
4. If you don't have an iOS app yet:
   - Click the **iOS icon** 
   - Bundle ID: `com.noah.messageai` (matches your app.json)
   - App nickname: "MessageAI iOS"
   - Click **Register app**
5. Download **`GoogleService-Info.plist`**
6. Save it to your project root: `MessageAI/GoogleService-Info.plist`

---

## 📂 Expected File Structure

```
MessageAI/
├── google-services.json          ← Android config (root level)
├── GoogleService-Info.plist      ← iOS config (root level)
├── app.json                      ← References both files
├── .env                          ← Your Firebase web config
├── src/
│   └── config/
│       └── firebase.ts           ← Uses .env variables
└── ...
```

---

## ⚠️ Important Notes

### For Expo Go Testing (Development)
**You DON'T need these files yet!** 

Expo Go uses the web Firebase SDK (configured in `.env`), not the native Firebase SDKs. These config files are only needed when you build native apps.

### When You DO Need These Files

You'll need them when you:
- Build with EAS: `eas build`
- Create development builds
- Deploy to TestFlight or Play Store
- Use native Firebase features (FCM push notifications in production)

---

## 🧪 Current Setup Status

✅ **Working now:**
- Firebase web SDK (via `.env`)
- Expo Go testing
- Development on simulators/emulators

⏳ **Will work after downloading config files:**
- Native builds with EAS
- Production push notifications
- TestFlight/Play Store deployment

---

## 🚀 Next Steps

### Option 1: Skip for Now (Recommended for MVP)
Continue developing with Expo Go. Download these files later when you're ready to build native apps (Day 3-4).

### Option 2: Download Now (If You Want Native Builds)
1. Download both files from Firebase Console
2. Place them in project root
3. Run `npx expo prebuild` to generate native folders
4. Build with `eas build --profile development --platform ios`

---

## Testing Without Config Files

You can develop and test the entire MVP using just the `.env` file:

```bash
npx expo start
```

Then:
- Press `i` for iOS Simulator
- Press `a` for Android Emulator  
- Scan QR code for Expo Go on physical device

Firebase will work perfectly for development!

---

## 🔍 Troubleshooting

**"Error: GoogleService-Info.plist not found"**
- This only happens with native builds (EAS)
- For Expo Go, you don't need this file
- If building natively, download the file from Firebase Console

**"Different package name in google-services.json"**
- Make sure package name in Firebase matches `app.json`
- Android: `com.noah.messageai`
- Re-download the config file if package names don't match

**"File exists but still getting errors"**
- Make sure files are in project root (same folder as `app.json`)
- Check file names are exact: `google-services.json` and `GoogleService-Info.plist`
- Restart Expo dev server after adding files

