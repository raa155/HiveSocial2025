// Import the functions you need from the SDKs
import { initializeApp, getApps, getApp } from '@firebase/app';
import { getAuth, initializeAuth, getReactNativePersistence } from '@firebase/auth';
import { getFirestore } from '@firebase/firestore';
import { getStorage } from '@firebase/storage';
import { getDatabase } from '@firebase/database';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyDNSpecRefaNuzu4Hu0HeJGlCdsmLYRZWg",
  authDomain: "hivesocial-75456.firebaseapp.com",
  projectId: "hivesocial-75456",
  storageBucket: "hivesocial-75456.firebasestorage.app",
  messagingSenderId: "224390534339",
  appId: "1:224390534339:web:8b5bab677e40965365fe76",
  measurementId: "G-TNSRWTTRQ8",
  databaseURL: "https://hivesocial-75456-default-rtdb.firebaseio.com"
};

// Initialize Firebase
let app;
let auth;
let db;
let storage;
let database;

// Check if app is already initialized
if (getApps().length === 0) {
  console.log('Initializing Firebase app and authentication...');
  app = initializeApp(firebaseConfig);
  
  // Initialize auth with AsyncStorage for persistence
  auth = initializeAuth(app, {
    persistence: getReactNativePersistence(AsyncStorage)
  });
  
  db = getFirestore(app);
  storage = getStorage(app);
  database = getDatabase(app);
  
  console.log('Firebase initialized with persistence');
} else {
  app = getApp();
  auth = getAuth(app);
  db = getFirestore(app);
  storage = getStorage(app);
  database = getDatabase(app);
  
  console.log('Using existing Firebase instance');
}

export { app, auth, db, storage, database };
