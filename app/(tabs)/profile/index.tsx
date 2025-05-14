import React, { useState, useRef } from 'react';
import { 
  StyleSheet, 
  View, 
  Text, 
  Image, 
  ScrollView, 
  TouchableOpacity, 
  Switch, 
  Alert, 
  ActivityIndicator, 
  Modal, 
  Dimensions,
  Animated,
  Platform,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useAuth } from '@/contexts/AuthContext';
import { signOut } from '@firebase/auth';
import { doc, updateDoc } from '@firebase/firestore';
import { auth, db } from '@/config/firebase';
import { router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { BlurView } from 'expo-blur';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const CARD_PADDING = 20;

// Tabbed navigation menu height calculation
const TAB_BAR_HEIGHT = Platform.OS === 'ios' ? 83 : 70; // Height including safe area insets on iOS

export default function ProfileScreen() {
  const { userData, user, refreshUserData } = useAuth();
  const [locationVisible, setLocationVisible] = useState(userData?.location?.visible || false);
  const [loading, setLoading] = useState(false);
  const [selectedImageIndex, setSelectedImageIndex] = useState<number | null>(null);
  const [showImageModal, setShowImageModal] = useState(false);
  const insets = useSafeAreaInsets();
  
  // Animation values
  const scrollY = useRef(new Animated.Value(0)).current;
  const headerOpacity = scrollY.interpolate({
    inputRange: [0, 100],
    outputRange: [0, 1],
    extrapolate: 'clamp',
  });
  
  // Handle image tap
  const handleImageTap = (index: number) => {
    setSelectedImageIndex(index);
    setShowImageModal(true);
  };

  // Close image modal
  const closeImageModal = () => {
    setShowImageModal(false);
    setSelectedImageIndex(null);
  };
  
  // Handle logout
  const handleLogout = async () => {
    try {
      await auth.signOut();
      console.log('User signed out via profile screen');
    } catch (error) {
      console.error('Error signing out:', error);
      Alert.alert('Error', 'Failed to sign out. Please try again.');
    }
  };
  
  // Handle location visibility toggle
  const handleLocationToggle = async (value) => {
    if (!user?.uid) return;
    
    setLoading(true);
    try {
      const userRef = doc(db, 'users', user.uid);
      await updateDoc(userRef, {
        'location.visible': value
      });
      
      await refreshUserData();
      setLocationVisible(value);
    } catch (error) {
      console.error('Error updating location visibility:', error);
      Alert.alert('Error', 'Failed to update setting. Please try again.');
    } finally {
      setLoading(false);
    }
  };
  
  if (!userData) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#6C5CE7" />
      </View>
    );
  }
  
  return (
    <View style={styles.container}>
      <StatusBar style="dark" />
      
      {/* Animated Header */}
      <Animated.View style={[styles.animatedHeader, { opacity: headerOpacity }]}>
        <Text style={styles.animatedHeaderText}>{userData.name || 'Profile'}</Text>
      </Animated.View>
      
      <Animated.ScrollView 
        style={styles.scrollView}
        contentContainerStyle={[
          styles.scrollContent,
          // Add bottom padding to account for the tab bar
          { paddingBottom: TAB_BAR_HEIGHT + 20 }
        ]}
        showsVerticalScrollIndicator={false}
        onScroll={Animated.event(
          [{ nativeEvent: { contentOffset: { y: scrollY } } }],
          { useNativeDriver: true }
        )}
        scrollEventThrottle={16}
      >
        {/* Profile Header */}
        <View style={styles.profileHeader}>
          <LinearGradient
            colors={['#6C5CE7', '#a29bfe']}
            style={styles.headerGradient}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
          />
          <View style={styles.profileImageContainer}>
            {userData.photoURL ? (
              <Image source={{ uri: userData.photoURL }} style={styles.profileImage} />
            ) : (
              <View style={styles.placeholderImage}>
                <FontAwesome name="user" size={60} color="#fff" />
              </View>
            )}
          </View>
          <Text style={styles.profileName}>{userData.name || 'Anonymous User'}</Text>
        </View>
        
        {/* About Me Card */}
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <MaterialIcons name="person" size={20} color="#6C5CE7" />
            <Text style={styles.cardTitle}>About Me</Text>
          </View>
          <Text style={styles.bioText}>
            {userData.bio || 'No bio yet. Tap Edit Profile to add a bio.'}
          </Text>
        </View>
        
        {/* Interests Card */}
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <MaterialIcons name="favorite" size={20} color="#6C5CE7" />
            <Text style={styles.cardTitle}>Interests</Text>
          </View>
          
          {userData.interests && userData.interests.length > 0 ? (
            <View style={styles.interestsContainer}>
              {userData.interests.map((interest, index) => (
                <View key={index} style={styles.interestTag}>
                  <Text style={styles.interestText}>{interest}</Text>
                </View>
              ))}
            </View>
          ) : (
            <Text style={styles.emptyText}>No interests added yet. Tap Edit Profile to add interests.</Text>
          )}
        </View>
        
        {/* Profile Images Card */}
        {userData.profileImages && userData.profileImages.length > 0 && (
          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <MaterialIcons name="photo-library" size={20} color="#6C5CE7" />
              <Text style={styles.cardTitle}>Photos</Text>
            </View>
            <View style={styles.profileImagesGrid}>
              {userData.profileImages.map((imageUrl, index) => (
                <TouchableOpacity 
                  key={index} 
                  style={styles.gridImageContainer}
                  onPress={() => handleImageTap(index)}
                  activeOpacity={0.9}
                >
                  <Image 
                    source={{ uri: imageUrl }} 
                    style={styles.gridImage}
                    resizeMode="cover"
                  />
                  <LinearGradient
                    colors={['transparent', 'rgba(0,0,0,0.3)']}
                    style={styles.gridImageOverlay}
                  />
                </TouchableOpacity>
              ))}
            </View>
          </View>
        )}
        
        {/* Settings Card */}
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <MaterialIcons name="settings" size={20} color="#6C5CE7" />
            <Text style={styles.cardTitle}>Settings</Text>
          </View>
          <View style={styles.settingItem}>
            <View style={styles.settingLabelContainer}>
              <MaterialIcons name="location-on" size={20} color="#6C5CE7" />
              <Text style={styles.settingLabel}>Location Visibility</Text>
            </View>
            <Switch
              value={locationVisible}
              onValueChange={handleLocationToggle}
              trackColor={{ false: '#e0e0e0', true: '#a29bfe' }}
              thumbColor={locationVisible ? '#6C5CE7' : '#f4f3f4'}
              ios_backgroundColor="#e0e0e0"
              disabled={loading}
            />
          </View>
          <Text style={styles.settingDescription}>
            {locationVisible 
              ? 'Your location is visible to other users'
              : 'Your location is hidden from other users'}
          </Text>
        </View>
        
        {/* Action Buttons */}
        <TouchableOpacity 
          style={styles.editButton}
          onPress={() => router.push('/edit-profile')}
        >
          <LinearGradient
            colors={['#6C5CE7', '#a29bfe']}
            style={styles.buttonGradient}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
          >
            <Text style={styles.editButtonText}>Edit Profile</Text>
          </LinearGradient>
        </TouchableOpacity>
        
        <TouchableOpacity 
          style={styles.logoutButton}
          onPress={handleLogout}
        >
          <Text style={styles.logoutButtonText}>Log Out</Text>
        </TouchableOpacity>
      </Animated.ScrollView>
      
      {/* Image Modal */}
      <Modal
        visible={showImageModal}
        transparent={true}
        animationType="fade"
        onRequestClose={closeImageModal}
      >
        <View style={styles.modalContainer}>
          <BlurView intensity={100} style={styles.modalBlur} tint="dark">
            <TouchableOpacity 
              style={styles.modalCloseButton}
              onPress={closeImageModal}
            >
              <Ionicons name="close-circle" size={36} color="#fff" />
            </TouchableOpacity>
            
            {selectedImageIndex !== null && userData?.profileImages?.[selectedImageIndex] && (
              <Image
                source={{ uri: userData.profileImages[selectedImageIndex] }}
                style={styles.fullScreenImage}
                resizeMode="contain"
              />
            )}
          </BlurView>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f5f5f5',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 40, // This will be overridden by the inline style
  },
  animatedHeader: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: Platform.OS === 'ios' ? 90 : 60,
    backgroundColor: '#fff',
    zIndex: 1000,
    justifyContent: 'flex-end',
    alignItems: 'center',
    paddingBottom: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 5,
  },
  animatedHeaderText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
  },
  profileHeader: {
    height: 200,
    alignItems: 'center',
    justifyContent: 'flex-end',
    position: 'relative',
    marginBottom: 60,
  },
  headerGradient: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: '100%',
  },
  profileImageContainer: {
    position: 'absolute',
    bottom: -50,
    borderRadius: 80,
    borderWidth: 5,
    borderColor: '#fff',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 5,
    elevation: 5,
    backgroundColor: '#fff',
  },
  profileImage: {
    width: 100,
    height: 100,
    borderRadius: 50,
  },
  placeholderImage: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: '#a29bfe',
    justifyContent: 'center',
    alignItems: 'center',
  },
  profileName: {
    color: '#fff',
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 60,
    textShadowColor: 'rgba(0, 0, 0, 0.3)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 16,
    marginHorizontal: 16,
    marginBottom: 16,
    padding: CARD_PADDING,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 3,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 14,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    marginLeft: 8,
  },
  bioText: {
    fontSize: 16,
    color: '#555',
    lineHeight: 24,
  },
  interestsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginHorizontal: -4,
  },
  interestTag: {
    backgroundColor: '#f3f0ff',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    marginRight: 8,
    marginBottom: 8,
  },
  interestText: {
    fontSize: 14,
    color: '#6C5CE7',
    fontWeight: '500',
  },
  emptyText: {
    fontSize: 14,
    color: '#888',
    fontStyle: 'italic',
  },
  profileImagesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginHorizontal: -6,
  },
  gridImageContainer: {
    width: (SCREEN_WIDTH - 32 - CARD_PADDING * 2 - 12) / 3,
    aspectRatio: 1,
    padding: 6,
    position: 'relative',
  },
  gridImage: {
    width: '100%',
    height: '100%',
    borderRadius: 12,
  },
  gridImageOverlay: {
    position: 'absolute',
    bottom: 6,
    left: 6,
    right: 6,
    height: '50%',
    borderBottomLeftRadius: 12,
    borderBottomRightRadius: 12,
  },
  settingItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  settingLabelContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  settingLabel: {
    fontSize: 16,
    color: '#333',
    marginLeft: 8,
  },
  settingDescription: {
    fontSize: 14,
    color: '#888',
    marginTop: 4,
    marginLeft: 28,
  },
  editButton: {
    marginHorizontal: 16,
    marginTop: 8,
    borderRadius: 12,
    overflow: 'hidden',
    shadowColor: '#6C5CE7',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 5,
  },
  buttonGradient: {
    paddingVertical: 16,
    alignItems: 'center',
  },
  editButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  logoutButton: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    marginHorizontal: 16,
    marginTop: 12,
    marginBottom: 20,
  },
  logoutButtonText: {
    color: '#ff3b30',
    fontSize: 16,
    fontWeight: 'bold',
  },
  modalContainer: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  modalBlur: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalCloseButton: {
    position: 'absolute',
    top: 40,
    right: 20,
    zIndex: 2,
    backgroundColor: 'rgba(0,0,0,0.3)',
    borderRadius: 20,
  },
  fullScreenImage: {
    width: SCREEN_WIDTH - 40,
    height: SCREEN_WIDTH - 40,
    borderRadius: 12,
  },
});
