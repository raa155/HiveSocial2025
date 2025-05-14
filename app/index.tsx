import React, { useEffect } from 'react';
import { router } from 'expo-router';
import { useAuth } from '@/contexts/AuthContext';
import LoadingScreen from '@/components/screens/LoadingScreen';

// This component renders when the root URL is accessed
export default function Root() {
  const { user, loading } = useAuth();
  
  useEffect(() => {
    // Log the current auth state
    console.log('Root index screen:', { 
      loading, 
      isAuthenticated: !!user,
      userId: user?.uid || 'none'
    });
    
    // Only navigate after auth state is determined
    if (!loading) {
      if (user) {
        console.log('Root index: User is authenticated, navigating to tabs...');
        router.replace('/(tabs)');
      } else {
        console.log('Root index: User is NOT authenticated, navigating to login...');
        router.replace('/auth/login');
      }
    }
  }, [user, loading]);
  
  // Show loading screen while checking auth state
  return <LoadingScreen message="Starting HiveSocial..." />;
}

