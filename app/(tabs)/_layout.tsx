import React, { useEffect } from 'react';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import { Link, Tabs, usePathname, useRouter } from 'expo-router';
import { Pressable, Platform } from 'react-native';
import { useAuth } from '@/contexts/AuthContext';
import LoadingScreen from '@/components/screens/LoadingScreen';

import Colors from '@/constants/Colors';
import { useColorScheme } from '@/components/useColorScheme';
import { useClientOnlyValue } from '@/components/useClientOnlyValue';

// You can explore the built-in icon families and icons on the web at https://icons.expo.fyi/
function TabBarIcon(props: {
  name: React.ComponentProps<typeof FontAwesome>['name'];
  color: string;
}) {
  return <FontAwesome size={28} style={{ marginBottom: -3 }} {...props} />;
}

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
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: Colors[colorScheme ?? 'light'].tint,
        // Disable the static render of the header on web
        // to prevent a hydration error in React Navigation v6.
        headerShown: useClientOnlyValue(false, true),
      }}
    >
      {/* The tab to hide */}
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
          tabBarIcon: ({ color }) => <TabBarIcon name="map" color={color} />,
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
          tabBarIcon: ({ color }) => <TabBarIcon name="users" color={color} />,
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
          tabBarIcon: ({ color }) => <TabBarIcon name="comments" color={color} />,
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
          tabBarIcon: ({ color }) => <TabBarIcon name="user" color={color} />,
          headerRight: () => (
            <Link href="/settings" asChild>
              <Pressable>
                {({ pressed }) => (
                  <FontAwesome
                    name="cog"
                    size={25}
                    color={Colors[colorScheme ?? 'light'].text}
                    style={{ marginRight: 15, opacity: pressed ? 0.5 : 1 }}
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
  );
}
