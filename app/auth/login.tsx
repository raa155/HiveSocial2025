import React, { useState, useEffect } from 'react';
import { StyleSheet, View, Text, TextInput, TouchableOpacity, KeyboardAvoidingView, Platform, ScrollView, Alert, ActivityIndicator } from 'react-native';
import { Stack, router } from 'expo-router';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import { createUserWithEmailAndPassword, signInWithEmailAndPassword } from '@firebase/auth';
import { doc, setDoc, serverTimestamp } from '@firebase/firestore';
import { auth, db } from '../../config/firebase';
import { useAuth } from '@/contexts/AuthContext';
import LoadingScreen from '@/components/screens/LoadingScreen';

export default function LoginScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLogin, setIsLogin] = useState(true);
  const [loading, setLoading] = useState(false);
  const { user, loading: authLoading } = useAuth();
  
  // Check if user is already authenticated and redirect if needed
  useEffect(() => {
    if (user) {
      console.log('Login screen: User already authenticated, redirecting to home...');
      router.replace('/');
    }
  }, [user]);
  
  // Show loading screen while checking auth state
  if (authLoading) {
    return <LoadingScreen message="Checking authentication..." />;
  }
  
  // If the user is authenticated, we're in the process of redirecting
  // Don't render anything to avoid flicker
  if (user) {
    return <LoadingScreen message="Redirecting to app..." />;
  }

  const handleAuth = async () => {
    // Validation
    if (!email || !password) {
      Alert.alert('Error', 'Please enter both email and password');
      return;
    }
    
    if (password.length < 6) {
      Alert.alert('Error', 'Password should be at least 6 characters');
      return;
    }
    
    // Set loading state
    setLoading(true);
    
    try {
      // Handle either sign in or sign up
      if (isLogin) {
        // Sign in
        await signInWithEmailAndPassword(auth, email, password);
        console.log('User signed in successfully');
      } else {
        // Sign up
        const userCredential = await createUserWithEmailAndPassword(auth, email, password);
        const user = userCredential.user;
        
        // Create user document in Firestore
        await setDoc(doc(db, 'users', user.uid), {
          email: user.email,
          uid: user.uid,
          createdAt: serverTimestamp(),
          name: '',
          bio: '',
          interests: [],
          location: {
            visible: true
          },
          photoURL: ''
        });
        
        console.log('User account created successfully');
      }
      
      // Authentication successful, use router navigation
      console.log('User signed in successfully, navigating to tabs...');
      
      setLoading(false); // Make sure to turn off loading state

      // Use expo-router to navigate
      console.log('Executing navigation to /(tabs)');
      try {
        router.replace('/');
      } catch (e) {
        console.error('Navigation error:', e);
      }
    } catch (error) {
      // Handle specific error cases
      let errorMessage = 'An error occurred. Please try again.';
      
      switch(error.code) {
        case 'auth/invalid-email':
          errorMessage = 'The email address is not valid.';
          break;
        case 'auth/user-disabled':
          errorMessage = 'This user account has been disabled.';
          break;
        case 'auth/user-not-found':
          errorMessage = 'No user found with this email address.';
          break;
        case 'auth/wrong-password':
          errorMessage = 'Incorrect password.';
          break;
        case 'auth/email-already-in-use':
          errorMessage = 'This email is already registered.';
          break;
        case 'auth/weak-password':
          errorMessage = 'The password is too weak.';
          break;
        case 'auth/network-request-failed':
          errorMessage = 'Network error. Please check your connection.';
          break;
        default:
          console.error('Firebase auth error:', error);
      }
      
      Alert.alert('Authentication Error', errorMessage);
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView 
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : null}
      keyboardVerticalOffset={60}
    >
      <Stack.Screen options={{ title: '', headerShown: false }} />
      
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.headerContainer}>
          <FontAwesome name="connectdevelop" size={80} color="#007bff" />
          <Text style={styles.appName}>HiveSocial</Text>
          <Text style={styles.tagline}>Connect with nearby people who share your interests</Text>
        </View>
        
        <View style={styles.formContainer}>
          <Text style={styles.formTitle}>{isLogin ? 'Log In' : 'Sign Up'}</Text>
          
          <View style={styles.inputContainer}>
            <FontAwesome name="envelope" size={20} color="#999" style={styles.inputIcon} />
            <TextInput
              style={styles.input}
              placeholder="Email"
              value={email}
              onChangeText={setEmail}
              autoCapitalize="none"
              keyboardType="email-address"
              editable={!loading}
            />
          </View>
          
          <View style={styles.inputContainer}>
            <FontAwesome name="lock" size={20} color="#999" style={styles.inputIcon} />
            <TextInput
              style={styles.input}
              placeholder="Password"
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              editable={!loading}
            />
          </View>
          
          {isLogin && (
            <TouchableOpacity 
              style={styles.forgotPasswordContainer}
              disabled={loading}
              onPress={() => {
                if (email) {
                  // You can implement password reset functionality here
                  Alert.alert('Reset Password', 'Password reset functionality will be implemented here.');
                } else {
                  Alert.alert('Email Required', 'Please enter your email address first.');
                }
              }}
            >
              <Text style={styles.forgotPasswordText}>Forgot Password?</Text>
            </TouchableOpacity>
          )}
          
          <TouchableOpacity 
            style={[styles.authButton, loading && styles.authButtonDisabled]}
            onPress={handleAuth}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator size="small" color="#ffffff" />
            ) : (
              <Text style={styles.authButtonText}>{isLogin ? 'Log In' : 'Sign Up'}</Text>
            )}
          </TouchableOpacity>
          
          <View style={styles.switchContainer}>
            <Text style={styles.switchText}>
              {isLogin ? "Don't have an account? " : "Already have an account? "}
            </Text>
            <TouchableOpacity onPress={() => setIsLogin(!isLogin)} disabled={loading}>
              <Text style={[styles.switchActionText, loading && styles.textDisabled]}>
                {isLogin ? 'Sign Up' : 'Log In'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: 20,
  },
  headerContainer: {
    alignItems: 'center',
    marginBottom: 40,
  },
  appName: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#333',
    marginTop: 16,
  },
  tagline: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    marginTop: 8,
  },
  formContainer: {
    width: '100%',
  },
  formTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 24,
    color: '#333',
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    marginBottom: 16,
    paddingHorizontal: 12,
  },
  inputIcon: {
    marginRight: 12,
  },
  input: {
    flex: 1,
    height: 50,
    fontSize: 16,
  },
  forgotPasswordContainer: {
    alignItems: 'flex-end',
    marginBottom: 24,
  },
  forgotPasswordText: {
    color: '#007bff',
    fontSize: 14,
  },
  authButton: {
    backgroundColor: '#007bff',
    borderRadius: 8,
    height: 50,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  authButtonDisabled: {
    backgroundColor: '#99caff',
  },
  authButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  switchContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: 16,
  },
  switchText: {
    color: '#666',
    fontSize: 14,
  },
  switchActionText: {
    color: '#007bff',
    fontSize: 14,
    fontWeight: 'bold',
  },
  textDisabled: {
    color: '#99caff',
  },
});
