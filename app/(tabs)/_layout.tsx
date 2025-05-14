import React, { useEffect } from 'react';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import { Link, Tabs, usePathname, useRouter } from 'expo-router';
import { Pressable, Platform, StyleSheet, View } from 'react-native';
import { useAuth } from '@/contexts/AuthContext';
import LoadingScreen from '@/components/screens/LoadingScreen';
import FloatingTabBar from '@/components/navigation/FloatingTabBar';

import Colors from '@/constants/Colors';
import { useColorScheme } from '@/components/useColorScheme';
import { useClientOnlyValue } from '@/components/useClientOnlyValue';

export const unstable_settings = {
  // Set the initial route name
  initialRouteName: 'index',
};

export default function TabLayout() {
  const colorScheme = useColorScheme();
  const path = usePathname();
  const { user, loading } = useAuth();
  const router = useRouter();
  
  useEffect(() => {
    console.log('TabLayout rendered. Current path:', path);
    console.log('Platform:', Platform.OS);
    console.log('TabLayout auth state:', { user: user ? 'Authenticated' : 'Not authenticated', loading });
    
    if (!loading && !user) {
      console.log('TabLayout: No authenticated user, redirecting to login...');
      router.replace('/');
    }
  }, [path, user, loading]);

  // If still loading, show loading screen
  if (loading) {
    return <LoadingScreen message="Loading HiveSocial..." />;
  }
  
  // If no user and not loading, we're in process of redirecting to login
  if (!user) {
    return <LoadingScreen message="Redirecting to login..." />;
  }
  
  return (
    <View style={styles.container}>
      <Tabs
        screenOptions={{
          tabBarActiveTintColor: Colors[colorScheme ?? 'light'].tint,
          headerShown: useClientOnlyValue(false, true),
          tabBarStyle: { 
            display: 'none' // Hide the default tab bar since we're using the floating tab bar
          },
          headerStyle: {
            backgroundColor: Colors[colorScheme ?? 'light'].background,
            elevation: 0,
            shadowOpacity: 0,
            borderBottomWidth: 0,
          },
          headerTitleStyle: {
            fontWeight: '600',
            fontSize: 18,
          },
          headerTitleAlign: 'center',
          headerShadowVisible: false,
        }}
        tabBar={props => <FloatingTabBar {...props} />}
      >
        {/* The tab to hide - not visible in tab bar */}
        <Tabs.Screen
          name="index"
          options={{
            href: null,
          }}
          listeners={{
            tabPress: e => {
              console.log('Tabs index pressed');
            },
          }}
        />
        
        <Tabs.Screen
          name="map/index"
          options={{
            title: 'Map',
            tabBarIcon: ({ color, size, focused }) => (
              <FontAwesome name="map" size={size} color={color} />
            ),
          }}
          listeners={{
            tabPress: e => {
              console.log('Map tab pressed');
            },
            focus: () => {
              console.log('Map tab focused');
            },
          }}
        />
        
        <Tabs.Screen
          name="connections/index"
          options={{
            title: 'Connections',
            tabBarIcon: ({ color, size, focused }) => (
              <FontAwesome name="users" size={size} color={color} />
            ),
          }}
          listeners={{
            tabPress: e => {
              console.log('Connections tab pressed');
            },
          }}
        />
        
        <Tabs.Screen
          name="chat/index"
          options={{
            title: 'Chat',
            tabBarIcon: ({ color, size, focused }) => (
              <FontAwesome name="comments" size={size} color={color} />
            ),
          }}
          listeners={{
            tabPress: e => {
              console.log('Chat tab pressed');
            },
          }}
        />
        
        <Tabs.Screen
          name="profile/index"
          options={{
            title: 'Profile',
            tabBarIcon: ({ color, size, focused }) => (
              <FontAwesome name="user" size={size} color={color} />
            ),
            headerRight: () => (
              <Link href="/settings" asChild>
                <Pressable style={styles.headerButton}>
                  {({ pressed }) => (
                    <FontAwesome
                      name="cog"
                      size={22}
                      color={Colors[colorScheme ?? 'light'].text}
                      style={{ opacity: pressed ? 0.5 : 1 }}
                    />
                  )}
                </Pressable>
              </Link>
            ),
          }}
          listeners={{
            tabPress: e => {
              console.log('Profile tab pressed');
            },
          }}
        />
      </Tabs>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    margin: 0,
    padding: 0,
  },
  headerButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 8,
    borderRadius: 20,
  },
});
