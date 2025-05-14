/**
 * Utility for managing user presence (online status) using Firebase
 */

import { useEffect, useRef } from 'react';
import { AppState, AppStateStatus, Platform } from 'react-native';
import { db, auth, database } from '@/config/firebase';
import { doc, setDoc, serverTimestamp, collection, onSnapshot } from '@firebase/firestore';
import { ref, set, onValue, onDisconnect as rtdbOnDisconnect } from '@firebase/database';
// NetInfo dependency is commented out since it wasn't successfully installed
// import NetInfo from '@react-native-community/netinfo';

/**
 * Custom hook to manage user online presence
 * This uses both Firestore and Realtime Database for reliable presence detection
 */
export function useUserPresence() {
  // Track if presence has been initialized
  const initialized = useRef(false);
  // Track app state
  const appState = useRef(AppState.currentState);
  // Track connectivity
  const isConnected = useRef(true);
  
  useEffect(() => {
    // Skip if already initialized
    if (initialized.current) return;
    
    const setupPresence = async () => {
      // Get current user
      const user = auth.currentUser;
      if (!user) {
        console.log('Cannot setup presence: No user is signed in');
        return;
      }
      
      // Initialize both databases
      const firestore = db;
      const rtdb = database;
      
      try {
        console.log('Setting up presence system for user:', user.uid);
        
        // 1. Setup Firestore presence
        const userPresenceRef = doc(firestore, 'presence', user.uid);
        
        // 2. Setup Realtime Database presence (more reliable for disconnect detection)
        const rtdbPresenceRef = ref(rtdb, `online/${user.uid}`);
        const connectedRef = ref(rtdb, '.info/connected');

        // Update Firestore with initial online status
        await setDoc(userPresenceRef, {
          online: true,
          lastSeen: serverTimestamp(),
          updatedAt: serverTimestamp()
        }, { merge: true });

        // Handle realtime database connection state
        onValue(connectedRef, async (snapshot) => {
          if (snapshot.val() === true) {
            console.log('Connected to Firebase Realtime Database');
            
            // User is online in RTDB
            await set(rtdbPresenceRef, {
              online: true,
              lastSeen: new Date().toISOString()
            });
            
            // Setup disconnect handling for RTDB
            rtdbOnDisconnect(rtdbPresenceRef).update({
              online: false,
              lastSeen: new Date().toISOString()
            });
            
            // Update Firestore status as well
            await setDoc(userPresenceRef, {
              online: true,
              lastSeen: serverTimestamp(),
              updatedAt: serverTimestamp()
            }, { merge: true });
          } else {
            console.log('Disconnected from Firebase Realtime Database');
          }
        });
        
        // Mark as initialized
        initialized.current = true;
      } catch (error) {
        console.error('Error setting up presence:', error);
      }
    };

    // Setup app state change listener
    const handleAppStateChange = async (nextAppState: AppStateStatus) => {
      // Get current user
      const user = auth.currentUser;
      if (!user) return;
      
      // Get references
      const firestore = db;
      const rtdb = database;
      const userPresenceRef = doc(firestore, 'presence', user.uid);
      const rtdbPresenceRef = ref(rtdb, `online/${user.uid}`);
      
      console.log('App state changed from', appState.current, 'to', nextAppState);
      
      // App going to background or inactive
      if (
        appState.current.match(/active/) && 
        (nextAppState === 'background' || nextAppState === 'inactive')
      ) {
        console.log('App is going to background, updating presence');
        
        // Update presence status
        try {
          await setDoc(userPresenceRef, {
            online: false,
            lastSeen: serverTimestamp(),
            updatedAt: serverTimestamp()
          }, { merge: true });
          
          await set(rtdbPresenceRef, {
            online: false,
            lastSeen: new Date().toISOString()
          });
        } catch (error) {
          console.error('Error updating presence on app background:', error);
        }
      } 
      // App coming to foreground
      else if (
        (appState.current === 'background' || appState.current === 'inactive') && 
        nextAppState === 'active'
      ) {
        console.log('App is coming to foreground, updating presence');
        
        // Update presence status
        try {
          await setDoc(userPresenceRef, {
            online: true,
            lastSeen: serverTimestamp(),
            updatedAt: serverTimestamp()
          }, { merge: true });
          
          await set(rtdbPresenceRef, {
            online: true,
            lastSeen: new Date().toISOString()
          });
          
          // Setup disconnect handler again
          rtdbOnDisconnect(rtdbPresenceRef).update({
            online: false,
            lastSeen: new Date().toISOString()
          });
        } catch (error) {
          console.error('Error updating presence on app foreground:', error);
        }
      }
      
      // Save current state
      appState.current = nextAppState;
    };
    
    // NetInfo dependency is commented out since it wasn't successfully installed
    /*
    // Setup connectivity change listener
    const handleConnectivityChange = async ({ isConnected: connected }) => {
      // Get current user
      const user = auth.currentUser;
      if (!user) return;
      
      // Skip if connection status hasn't changed
      if (connected === isConnected.current) return;
      console.log('Connectivity changed. Connected:', connected);
      
      // Save new state
      isConnected.current = connected;
      
      // Update presence status
      try {
        const firestore = db;
        const rtdb = database;
        const userPresenceRef = doc(firestore, 'presence', user.uid);
        const rtdbPresenceRef = ref(rtdb, `online/${user.uid}`);
        
        // If reconnected
        if (connected) {
          console.log('Device reconnected, updating presence');
          
          await setDoc(userPresenceRef, {
            online: true,
            lastSeen: serverTimestamp(),
            updatedAt: serverTimestamp()
          }, { merge: true });
          
          await set(rtdbPresenceRef, {
            online: true,
            lastSeen: new Date().toISOString()
          });
          
          // Setup disconnect handler again
          rtdbOnDisconnect(rtdbPresenceRef).update({
            online: false,
            lastSeen: new Date().toISOString()
          });
        } 
        // If disconnected
        else {
          console.log('Device disconnected, updating presence');
          
          await setDoc(userPresenceRef, {
            online: false,
            lastSeen: serverTimestamp(),
            updatedAt: serverTimestamp()
          }, { merge: true });
          
          await set(rtdbPresenceRef, {
            online: false,
            lastSeen: new Date().toISOString()
          });
        }
      } catch (error) {
        console.error('Error updating presence on connectivity change:', error);
      }
    };
    */
    
    // Only setup presence for authenticated users
    if (auth.currentUser) {
      setupPresence();
      
      // Subscribe to app state changes
      const appStateSubscription = AppState.addEventListener('change', handleAppStateChange);
      
      // NetInfo subscription is commented out since the package wasn't successfully installed
      // const netInfoSubscription = NetInfo.addEventListener(handleConnectivityChange);
      
      // Cleanup
      return () => {
        appStateSubscription.remove();
        // netInfoSubscription();
      };
    }
  }, []);
}
