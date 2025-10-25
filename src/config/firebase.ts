import Constants from 'expo-constants';
import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getDatabase } from 'firebase/database';
import { getFirestore } from 'firebase/firestore';
import { getFunctions } from 'firebase/functions';
import { getStorage } from 'firebase/storage';

// Get Firebase config from environment variables
// Supports both process.env (dev) and Constants.expoConfig.extra (production)
const getEnvVar = (key: string, extraKey: string) => {
  return process.env[key] || Constants.expoConfig?.extra?.[extraKey];
};

const firebaseConfig = {
  apiKey: getEnvVar('EXPO_PUBLIC_FIREBASE_API_KEY', 'firebaseApiKey'),
  authDomain: getEnvVar('EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN', 'firebaseAuthDomain'),
  projectId: getEnvVar('EXPO_PUBLIC_FIREBASE_PROJECT_ID', 'firebaseProjectId'),
  storageBucket: getEnvVar('EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET', 'firebaseStorageBucket'),
  messagingSenderId: getEnvVar('EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID', 'firebaseMessagingSenderId'),
  appId: getEnvVar('EXPO_PUBLIC_FIREBASE_APP_ID', 'firebaseAppId'),
  databaseURL: getEnvVar('EXPO_PUBLIC_FIREBASE_DATABASE_URL', 'firebaseDatabaseURL'),
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize Firebase Auth
// Note: Firebase JS SDK uses IndexedDB for persistence by default in web
// For React Native, AsyncStorage persistence is handled by @react-native-async-storage/async-storage
const auth = getAuth(app);

// Initialize Firestore
const db = getFirestore(app);

// Initialize Realtime Database (for presence and typing indicators)
// Note: Requires EXPO_PUBLIC_FIREBASE_DATABASE_URL to be set
let rtdb: any = null;
try {
  if (firebaseConfig.databaseURL) {
    rtdb = getDatabase(app);
  } else {
    console.warn('⚠️ Firebase Realtime Database URL not configured. Presence tracking disabled.');
  }
} catch (error) {
  console.error('Failed to initialize Realtime Database:', error);
}

// Initialize Storage
const storage = getStorage(app);

// Initialize Cloud Functions
const functions = getFunctions(app);

export { app, auth, db, functions, rtdb, storage };

