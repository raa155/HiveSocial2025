import React, { useState, useEffect, useRef } from 'react';
import { 
  StyleSheet, 
  View, 
  Text, 
  Image, 
  ScrollView, 
  TouchableOpacity, 
  ActivityIndicator, 
  Animated,
  Dimensions,
  Platform,
  Modal,
  SafeAreaView,
  Alert
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import { Stack, useLocalSearchParams, router } from 'expo-router';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useAuth } from '@/contexts/AuthContext';
import { doc, getDoc, collection, query, where, getDocs } from '@firebase/firestore';
import { db } from '@/config/firebase';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const CARD_PADDING = 20;

// Tier color mapping to match the map screen colors
const TIER_COLORS = {
  'soulmate': { primary: '#00B0FF', gradient: ['#00B0FF', '#64c8ff'] },     // Light blue
  'bestFriend': { primary: '#FFD700', gradient: ['#FFD700', '#ffe666'] },  // Gold
  'friend': { primary: '#C0C0C0', gradient: ['#C0C0C0', '#e6e6e6'] },      // Silver
  'buddy': { primary: '#CD7F32', gradient: ['#CD7F32', '#e2aa73'] },       // Bronze
  'casual': { primary: '#AAAAAA', gradient: ['#AAAAAA', '#d9d9d9'] }        // Gray
};

export default function UserProfileScreen() {
  const { user } = useAuth();
  const params = useLocalSearchParams();
  const { id, name, tier } = params;
  
  const [loading, setLoading] = useState(true);
  const [userData, setUserData] = useState(null);
  const [selectedImageIndex, setSelectedImageIndex] = useState(null);
  const [showImageModal, setShowImageModal] = useState(false);
  const [connection, setConnection] = useState(null);
  
  // Animation values
  const scrollY = useRef(new Animated.Value(0)).current;
  const headerOpacity = scrollY.interpolate({
    inputRange: [0, 100],
    outputRange: [0, 1],
    extrapolate: 'clamp',
  });
  
  // Load user data
  useEffect(() => {
    const fetchUserData = async () => {
      if (!id) {
        setLoading(false);
        return;
      }
      
      try {
        console.log('Fetching user profile for:', id);
        const userDocRef = doc(db, 'users', id.toString());
        const userDocSnapshot = await getDoc(userDocRef);
        
        if (userDocSnapshot.exists()) {
          const userData = userDocSnapshot.data();
          console.log('User data retrieved:', userData.name);
          setUserData(userData);
          
          // Also fetch connection data to get the chat room ID
          if (user?.uid) {
            try {
              // Check for connection between current user and this user
              const connectionQuery1 = query(
                collection(db, 'connectionRequests'),
                where('senderId', '==', user.uid),
                where('receiverId', '==', id.toString()),
                where('status', '==', 'accepted')
              );
              
              const connectionQuery2 = query(
                collection(db, 'connectionRequests'),
                where('senderId', '==', id.toString()),
                where('receiverId', '==', user.uid),
                where('status', '==', 'accepted')
              );
              
              const [snapshot1, snapshot2] = await Promise.all([
                getDocs(connectionQuery1),
                getDocs(connectionQuery2)
              ]);
              
              let connectionData = null;
              
              if (!snapshot1.empty) {
                connectionData = { id: snapshot1.docs[0].id, ...snapshot1.docs[0].data() };
              } else if (!snapshot2.empty) {
                connectionData = { id: snapshot2.docs[0].id, ...snapshot2.docs[0].data() };
              }
              
              if (connectionData) {
                console.log('Connection found with chat room ID:', connectionData.chatRoomId);
                setConnection(connectionData);
              }
            } catch (error) {
              console.error('Error fetching connection data:', error);
            }
          }
        } else {
          console.log('No user found with ID:', id);
          Alert.alert('Error', 'User not found');
        }
      } catch (error) {
        console.error('Error fetching user data:', error);
        Alert.alert('Error', 'Failed to load user profile');
      } finally {
        setLoading(false);
      }
    };
    
    fetchUserData();
  }, [id, user?.uid]);
  
  // Handle image tap for viewing
  const handleImageTap = (index) => {
    setSelectedImageIndex(index);
    setShowImageModal(true);
  };
  
  // Close image modal
  const closeImageModal = () => {
    setShowImageModal(false);
    setSelectedImageIndex(null);
  };
  
  // Get tier display info
  const getTierInfo = (tier) => {
    const tierKey = tier || 'casual';
    return {
      colors: TIER_COLORS[tierKey]?.gradient || TIER_COLORS.casual.gradient,
      name: getTierDisplayName(tierKey),
      color: TIER_COLORS[tierKey]?.primary || TIER_COLORS.casual.primary
    };
  };
  
  // Helper function to get display name for tier
  const getTierDisplayName = (tier) => {
    switch(tier) {
      case 'soulmate': return 'Soulmate';
      case 'bestFriend': return 'Best Friend';
      case 'friend': return 'Friend';
      case 'buddy': return 'Buddy';
      case 'casual': 
      default: return 'Casual';
    }
  };
  
  // Handle back button
  const handleGoBack = () => {
    router.back();
  };
  
  // Handle message button
  const handleMessage = () => {
    // Navigate to the chat screen if a chat room exists
    if (connection?.chatRoomId) {
      router.push(`/chat/${connection.chatRoomId}?name=${encodeURIComponent(userData?.name || 'User')}`);
    } else {
      // No chat room found - prompt user to connect first
      Alert.alert(
        'No Connection',
        'You need to connect with this user before you can message them.',
        [
          {
            text: 'Go Back',
            style: 'cancel'
          },
          {
            text: 'View Connections',
            onPress: () => router.push('/(tabs)/connections')
          }
        ]
      );
    }
  };
  
  const tierInfo = getTierInfo(tier);
  
  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#6C5CE7" />
        <Text style={styles.loadingText}>Loading profile...</Text>
      </View>
    );
  }
  
  if (!userData) {
    return (
      <View style={styles.errorContainer}>
        <MaterialIcons name="error-outline" size={60} color="#ff4757" />
        <Text style={styles.errorText}>User not found</Text>
        <TouchableOpacity 
          style={styles.backButton}
          onPress={handleGoBack}
        >
          <Text style={styles.backButtonText}>Go Back</Text>
        </TouchableOpacity>
      </View>
    );
  }
  
  return (
    <View style={styles.container}>
      <StatusBar style="dark" />
      
      <Stack.Screen
        options={{
          title: userData?.name || name || 'Profile',
          headerShown: true,
          headerBackTitle: 'Back',
          headerTintColor: '#6C5CE7',
          headerStyle: {
            backgroundColor: '#fff',
          },
          headerShadowVisible: false,
        }}
      />
      
      {/* Animated Header */}
      <Animated.View style={[styles.animatedHeader, { opacity: headerOpacity }]}>
        <Text style={styles.animatedHeaderText}>{userData?.name || name || 'Profile'}</Text>
      </Animated.View>
      
      <Animated.ScrollView 
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
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
            colors={tierInfo.colors}
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
          <Text style={styles.profileName}>{userData.name || 'User'}</Text>
          <View style={styles.tierBadge}>
            <Text style={styles.tierBadgeText}>{tierInfo.name}</Text>
          </View>
        </View>
        
        {/* About Me Card */}
        {userData.bio && (
          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <MaterialIcons name="person" size={20} color={tierInfo.color} />
              <Text style={styles.cardTitle}>About Me</Text>
            </View>
            <Text style={styles.bioText}>
              {userData.bio}
            </Text>
          </View>
        )}
        
        {/* Interests Card */}
        {userData.interests && userData.interests.length > 0 && (
          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <MaterialIcons name="favorite" size={20} color={tierInfo.color} />
              <Text style={styles.cardTitle}>Interests</Text>
            </View>
            
            <View style={styles.interestsContainer}>
              {userData.interests.map((interest, index) => (
                <View key={index} style={[styles.interestTag, { backgroundColor: `${tierInfo.color}15` }]}>
                  <Text style={[styles.interestText, { color: tierInfo.color }]}>{interest}</Text>
                </View>
              ))}
            </View>
          </View>
        )}
        
        {/* Profile Images Card */}
        {userData.profileImages && userData.profileImages.length > 0 && (
          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <MaterialIcons name="photo-library" size={20} color={tierInfo.color} />
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
        
        {/* Message Button */}
        <TouchableOpacity 
          style={styles.messageButton}
          onPress={handleMessage}
          activeOpacity={0.8}
        >
          <LinearGradient
            colors={['#6C5CE7', '#a29bfe']}
            style={styles.messageButtonGradient}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
          >
            <Ionicons name="chatbubble-outline" size={20} color="#fff" style={styles.messageButtonIcon} />
            <Text style={styles.messageButtonText}>Message</Text>
          </LinearGradient>
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
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#666',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f5f5f5',
    padding: 32,
  },
  errorText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    marginTop: 16,
    marginBottom: 24,
  },
  backButton: {
    backgroundColor: '#6C5CE7',
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 12,
  },
  backButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 40,
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
    marginBottom: 80,
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
    marginBottom: 8,
    textShadowColor: 'rgba(0, 0, 0, 0.3)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
  tierBadge: {
    backgroundColor: 'rgba(255, 255, 255, 0.25)',
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderRadius: 20,
    marginBottom: 60,
  },
  tierBadgeText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
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
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    margin: 4,
  },
  interestText: {
    fontSize: 14,
    fontWeight: '500',
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
  messageButton: {
    marginHorizontal: 16,
    marginTop: 8,
    marginBottom: 20,
    borderRadius: 12,
    overflow: 'hidden',
    shadowColor: '#6C5CE7',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 5,
  },
  messageButtonGradient: {
    flexDirection: 'row',
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  messageButtonIcon: {
    marginRight: 8,
  },
  messageButtonText: {
    color: '#fff',
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
