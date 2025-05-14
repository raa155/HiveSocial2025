import FontAwesome from '@expo/vector-icons/FontAwesome';
import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { useFonts } from 'expo-font';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect } from 'react';
import { ActivityIndicator, View, Platform } from 'react-native';
import 'react-native-reanimated';
import { auth } from '@/config/firebase';

import { useColorScheme } from '@/components/useColorScheme';
import { AuthProvider, useAuth } from '@/contexts/AuthContext';

export {
  // Catch any errors thrown by the Layout component.
  ErrorBoundary,
} from 'expo-router';

export const unstable_settings = {
  // Ensure that reloading on `/modal` keeps a back button present.
  initialRouteName: '(tabs)',
};

// Prevent the splash screen from auto-hiding before asset loading is complete.
SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const [loaded, error] = useFonts({
    SpaceMono: require('../assets/fonts/SpaceMono-Regular.ttf'),
    ...FontAwesome.font,
  });

  // Expo Router uses Error Boundaries to catch errors in the navigation tree.
  useEffect(() => {
    if (error) throw error;
  }, [error]);

  useEffect(() => {
    if (loaded) {
      SplashScreen.hideAsync();
    }
  }, [loaded]);

  // Check if user is logged in at app startup
  useEffect(() => {
    const checkCurrentUser = async () => {
      const currentUser = auth.currentUser;
      console.log('App startup - Firebase currentUser:', currentUser ? 
        `User logged in: ${currentUser.uid}` : 
        'No user logged in');
    };
    
    checkCurrentUser();
  }, []);

  if (!loaded) {
    console.log('Fonts not loaded yet, returning null');
    return null;
  }

  console.log('Platform:', Platform.OS);
  console.log('RootLayout rendered with fonts loaded');

  return (
    <AuthProvider>
      <RootLayoutNav />
    </AuthProvider>
  );
}

function RootLayoutNav() {
  const colorScheme = useColorScheme();
  const { user, userData, loading } = useAuth();
  
  // Debug logging
  useEffect(() => {
    console.log('Root layout rendered, auth state:', { 
      loading, 
      user: user ? 'Authenticated' : 'Not authenticated',
      platform: Platform.OS
    });
  }, [user, loading]);
  
  console.log('RootLayoutNav rendering with Stack navigator');
  
  return (
    <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
      {/* Use Stack for all routes for proper navigation */}
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen 
          name="index" 
          options={{ headerShown: false }}
        />
        <Stack.Screen 
          name="(tabs)" 
          options={{ headerShown: false }}
          listeners={{
            focus: () => {
              console.log('(tabs) route focused');
            },
          }}
        />
        <Stack.Screen 
          name="chat/[id]" 
          options={{ 
            headerShown: true,
            // Ensure proper cleanup between screens
            animation: 'slide_from_right',
            fullScreenGestureEnabled: true
          }} 
        />
        <Stack.Screen name="modal" options={{ presentation: 'modal', headerShown: true, title: 'Modal' }} />
        <Stack.Screen name="settings" options={{ presentation: 'modal', headerShown: true, title: 'Settings' }} />
        <Stack.Screen 
          name="auth" 
          options={{ headerShown: false }}
          listeners={{
            focus: () => {
              console.log('auth route focused');
            },
          }}
        />
        <Stack.Screen name="complete-profile" options={{ headerShown: true }} />
        <Stack.Screen name="edit-profile" options={{ headerShown: true, title: 'Edit Profile' }} />
        <Stack.Screen name="+not-found" options={{ headerShown: false, title: 'Not Found' }} />
      </Stack>
    </ThemeProvider>
  );
}
