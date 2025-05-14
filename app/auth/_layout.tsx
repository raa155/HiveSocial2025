import React, { useEffect } from 'react';
import { Stack, useRouter } from 'expo-router';
import { useAuth } from '@/contexts/AuthContext';
import LoadingScreen from '@/components/screens/LoadingScreen';

export default function AuthLayout() {
  const { user, loading } = useAuth();
  const router = useRouter();
  
  // Log for debugging
  console.log('Auth layout rendered, user:', user ? 'Authenticated' : 'Not authenticated', 'loading:', loading);
  
  // Redirect authenticated users away from auth screens
  useEffect(() => {
    if (!loading && user) {
      console.log('Auth layout detected authenticated user, redirecting to home...');
      router.replace('/');
    }
  }, [user, loading, router]);
  
  // If we're still loading and no determination has been made, show loading screen
  if (loading) {
    return <LoadingScreen message="Checking authentication..." />;
  }
  
  // If the user is authenticated, we're in the process of redirecting
  // Don't render anything to avoid flicker
  if (user) {
    return <LoadingScreen message="Redirecting to app..." />;
  }
  
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        animation: 'slide_from_right',
      }}
    />
  );
}


