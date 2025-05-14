import { Stack, useRouter } from 'expo-router';
import { StyleSheet, TouchableOpacity, Platform } from 'react-native';
import { Text, View } from '@/components/Themed';
import * as Linking from 'expo-linking';

// Simple not found screen with platform-specific navigation
export default function NotFoundScreen() {
  const router = useRouter();
  
  console.log('Not found screen rendered, Platform:', Platform.OS);
  
  const handleNavigation = () => {
    console.log('Navigation button pressed on not-found screen');
    
    // Use router instead of window.location
    setTimeout(() => {
      try {
        console.log('Attempting to navigate to home...');
        router.replace('/');
      } catch (error) {
        console.error('Navigation error:', error);
        
        // Fallback navigation using deep linking
        try {
          console.log('Attempting fallback with deep linking...');
          const url = Linking.createURL('/');
          Linking.openURL(url);
        } catch (e) {
          console.error('Deep linking error:', e);
        }
      }
    }, 100);
  };

  return (
    <>
      <Stack.Screen options={{ title: 'Oops!' }} />
      <View style={styles.container}>
        <Text style={styles.title}>This screen doesn't exist.</Text>
        <Text style={styles.subtitle}>Please tap the button below to return to the app.</Text>

        <TouchableOpacity 
          style={styles.button}
          onPress={handleNavigation}
        >
          <Text style={styles.buttonText}>
            Go to Home Screen
          </Text>
        </TouchableOpacity>
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 10,
  },
  subtitle: {
    fontSize: 16,
    color: '#666',
    marginBottom: 30,
    textAlign: 'center',
  },
  button: {
    marginTop: 15,
    paddingVertical: 12,
    paddingHorizontal: 20,
    backgroundColor: '#007bff',
    borderRadius: 8,
  },
  buttonText: {
    fontSize: 16,
    color: '#ffffff',
    fontWeight: 'bold',
  },
});

