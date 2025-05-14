// useProtectedRoute.tsx
import { useEffect, useRef } from 'react';
import { useSegments, useRouter } from 'expo-router';

/**
 * Hook to protect routes based on authentication state
 * @param user - The current user object
 * @returns void
 */
export function useProtectedRoute(user: any) {
  const segments = useSegments();
  const router = useRouter();
  const isNavigating = useRef(false);
  
  // Log current route info
  useEffect(() => {
    if (segments && segments.length > 0) {
      console.log('useProtectedRoute - Current route:', { 
        segments, 
        isAuth: user ? true : false,
        inAuthGroup: segments[0] === 'auth'
      });
    }
  }, [segments, user]);
  
  // Only run basic route protection logic
  useEffect(() => {
    // Skip if we're already navigating or if user state is not defined yet
    if (isNavigating.current || user === undefined || !segments || segments.length === 0) {
      return;
    }

    // Always ignore not-found screens
    if (segments[0] === '+not-found') {
      return;
    }

    // Get the current route group (first segment)
    const inAuthGroup = segments[0] === 'auth';

    // Handle authenticated users trying to access auth screens
    if (user && inAuthGroup) {
      console.log('User is authenticated but on auth screen, redirecting to home...');
      isNavigating.current = true;
      router.replace('/');
      
      // Reset navigation flag after delay
      setTimeout(() => {
        isNavigating.current = false;
      }, 500);
      return;
    }
    
    // Handle unauthenticated users trying to access protected routes
    if (!user && !inAuthGroup) {
      console.log('User is NOT authenticated but trying to access protected route, redirecting to login...');
      isNavigating.current = true;
      router.replace('/auth/login');
      
      // Reset navigation flag after delay
      setTimeout(() => {
        isNavigating.current = false;
      }, 500);
      return;
    }
  }, [user, segments, router]);
}
