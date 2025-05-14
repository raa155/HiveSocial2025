import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
import { onAuthStateChanged } from '@firebase/auth';
import { doc, getDoc } from '@firebase/firestore';
import { auth, db } from '../config/firebase';
import { useProtectedRoute } from './useProtectedRoute';
import { useRouter, useSegments, usePathname } from 'expo-router';
import { Platform } from 'react-native';

// Define types
type User = {
  uid: string;
  email: string;
  name?: string;
  bio?: string;
  interests?: string[];
  photoURL?: string;
  profileImages?: string[]; // Array of image URLs for profile grid
  location?: {
    visible: boolean;
  };
} | null;

type AuthContextType = {
  user: User;
  userData: any;
  loading: boolean;
  refreshUserData: () => Promise<void>;
  signOut: () => Promise<void>;
};

// Create the context
const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Create a provider component
export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User>(null);
  const [userData, setUserData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();
  const pathname = usePathname();
  const segments = useSegments();
  const authCheckComplete = useRef(false);
  const isNavigating = useRef(false);

  // Debug logging
  useEffect(() => {
    console.log('Auth state changed:', { 
      user: user ? 'Authenticated' : 'Not authenticated', 
      loading, 
      pathname, 
      segments,
      platform: Platform.OS
    });
    
    // When auth check is complete and user is authenticated,
    // log additional info to help with debugging
    if (!loading && user) {
      console.log('User authenticated:', {
        uid: user.uid,
        hasUserData: !!userData,
        pathname,
      });
    }
  }, [user, loading, pathname, segments, userData]);

  // Function to fetch user data from Firestore
  const fetchUserData = async (uid: string) => {
    try {
      const userDocRef = doc(db, 'users', uid);
      const userDoc = await getDoc(userDocRef);
      if (userDoc.exists()) {
        setUserData(userDoc.data());
      } else {
        console.log('No user data found in Firestore');
      }
    } catch (error) {
      console.error('Error fetching user data:', error);
    }
  };

  // Function to refresh user data
  const refreshUserData = async () => {
    if (user?.uid) {
      await fetchUserData(user.uid);
    }
  };

  // Sign out function
  const signOut = async () => {
    try {
      console.log('Signing out user...');
      await auth.signOut();
      console.log('User signed out');
      
      // Reset state
      setUser(null);
      setUserData(null);
      
      // Clear AsyncStorage cache if needed
      // This might be needed in some cases if there are persistence issues
      // await AsyncStorage.clear();
      
      // Navigate to login
      router.replace('/auth/login');
    } catch (error) {
      console.error('Error signing out:', error);
    }
  };

  // Handle direct navigation to fixed routes based on auth state
  const navigateToInitialScreen = () => {
    // Skip if already navigating
    if (isNavigating.current) return;
    isNavigating.current = true;
    
    // Navigate to the appropriate screen based on auth state
    try {
      console.log('Navigating to initial screen based on auth state:', user ? 'Authenticated' : 'Not authenticated');
      if (user) {
        // User is authenticated, navigate to tabs index which will redirect to map
        router.replace('/');
      } else {
        // User is not authenticated, navigate to login
        router.replace('/auth/login');
      }
    } catch (e) {
      console.error('Navigation error:', e);
    } finally {
      // Reset navigation flag after a delay
      setTimeout(() => {
        isNavigating.current = false;
      }, 500);
    }
  };

  // When Firebase auth state changes, set user and navigate
  useEffect(() => {
    let unsubscribe: () => void;
    let initialAuthCheckComplete = false;
    
    const setupAuthListener = async () => {
      console.log('Setting up Firebase auth state listener...');
      
      try {
        // Make sure we're loading while checking auth
        setLoading(true);
        
        // Set up the auth state change listener
        unsubscribe = onAuthStateChanged(auth, async (authUser) => {
          console.log('Firebase auth state changed:', authUser ? 'Logged in' : 'Logged out');
          
          if (authUser) {
            // User is signed in
            setUser({
              uid: authUser.uid,
              email: authUser.email || '',
            });
            
            // Fetch additional user data from Firestore
            await fetchUserData(authUser.uid);
            
            // Let any navigation happen naturally from the root component
            // after we set loading to false
          } else {
            // User is signed out
            setUser(null);
            setUserData(null);
          }
          
          initialAuthCheckComplete = true;
          
          // After we've determined the auth state, turn off loading
          setLoading(false);
          authCheckComplete.current = true;
        });
      } catch (error) {
        console.error('Error setting up auth listener:', error);
        setLoading(false);
        authCheckComplete.current = true;
      }
    };
    
    setupAuthListener();

    // Cleanup subscription
    return () => {
      if (unsubscribe) unsubscribe();
    };
  }, []);

  // Handle navigation when pathname is not-found or index
  useEffect(() => {
    if (loading) return;
    if (!authCheckComplete.current) return;
    
    // Check if we're on the not-found screen
    if (segments && segments.length > 0 && segments[0] === '+not-found') {
      console.log('On not-found screen, navigating to initial screen');
      navigateToInitialScreen();
      return;
    }
    
    // Check if we're on the root index with no segments
    if ((!segments || segments.length === 0) && pathname === '/') {
      console.log('On root path, navigating to initial screen');
      navigateToInitialScreen();
      return;
    }
  }, [loading, pathname, segments, user]);

  // Use the protected route hook
  useProtectedRoute(user);

  return (
    <AuthContext.Provider value={{ user, userData, loading, refreshUserData, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

// Create a hook to use the auth context
export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
