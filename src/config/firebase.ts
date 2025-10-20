import Constants from 'expo-constants';
import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
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
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize Firebase Auth
// Note: Firebase Auth in Expo web SDK uses browser-based persistence by default
const auth = getAuth(app);

// Initialize Firestore
const db = getFirestore(app);

// Initialize Storage
const storage = getStorage(app);

export { app, auth, db, storage };

