import React, { useState, useEffect, useRef } from 'react';
import { 
  View, 
  Text, 
  Image, 
  StyleSheet, 
  TouchableOpacity, 
  ScrollView, 
  ActivityIndicator,
  Animated,
  PanResponder,
  Dimensions,
  Modal,
  StatusBar,
  SafeAreaView,
  Platform
} from 'react-native';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import { MarkerTier } from './EnhancedUserMapMarker';
import { collection, query, where, getDocs } from '@firebase/firestore';
import { db } from '@/config/firebase';
import { useAuth } from '@/contexts/AuthContext';

interface ProfileCardProps {
  uid: string;
  name: string;
  bio?: string;
  photoURL?: string;
  profileImages?: string[];
  interests: string[];
  sharedInterests: string[];
  tier: MarkerTier;
  distance?: number;
  onDismiss: () => void;
  onStartChat?: (uid: string) => void;
  onInvite?: (uid: string) => void;
  onAcceptInvite?: (uid: string) => void;
  onDeclineInvite?: (uid: string) => void;
}

const { height, width } = Dimensions.get('window');
const TAB_BAR_HEIGHT = 80; // Increased to account for potential safe area
const DISMISS_THRESHOLD = 100; // How far the user needs to drag down to dismiss

// Connection Status Types
type ConnectionStatus = 'none' | 'pending_sent' | 'pending_received' | 'connected';

const ProfileCard: React.FC<ProfileCardProps> = ({
  uid,
  name = 'User',
  bio = '',
  photoURL,
  profileImages = [],
  interests = [],
  sharedInterests = [],
  tier = 'casual',
  distance,
  onDismiss,
  onStartChat,
  onInvite,
  onAcceptInvite,
  onDeclineInvite
}) => {
  const { user } = useAuth();
  
  // Make sure we have arrays even if undefined is passed
  const safeProfileImages = Array.isArray(profileImages) ? profileImages : [];
  const safeInterests = Array.isArray(interests) ? interests : [];
  const safeSharedInterests = Array.isArray(sharedInterests) ? sharedInterests : [];

  // State for image loading and errors
  const [imageLoaded, setImageLoaded] = useState(false);
  const [imageError, setImageError] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedImageIndex, setSelectedImageIndex] = useState<number | null>(null);
  const [showImageModal, setShowImageModal] = useState(false);
  
  // Connection status state
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>('none');
  const [connectionId, setConnectionId] = useState<string | null>(null);
  const [chatRoomId, setChatRoomId] = useState<string | null>(null);
  const [checkingConnection, setCheckingConnection] = useState(true);

  // Check connection status on component mount
  useEffect(() => {
    const checkConnectionStatus = async () => {
      if (!user?.uid || !uid) return;
      
      try {
        setCheckingConnection(true);
        
        // Check for connection requests in both directions
        const connectionRequestsRef = collection(db, 'connectionRequests');
        
        // Check for sent request
        const sentQuery = query(
          connectionRequestsRef,
          where('senderId', '==', user.uid),
          where('receiverId', '==', uid)
        );
        
        // Check for received request
        const receivedQuery = query(
          connectionRequestsRef,
          where('senderId', '==', uid),
          where('receiverId', '==', user.uid)
        );
        
        const [sentSnapshot, receivedSnapshot] = await Promise.all([
          getDocs(sentQuery),
          getDocs(receivedQuery)
        ]);
        
        if (!sentSnapshot.empty) {
          // We sent an invitation
          const request = sentSnapshot.docs[0];
          const requestData = request.data();
          
          if (requestData.status === 'accepted') {
            // Connection established
            setConnectionStatus('connected');
            setConnectionId(request.id);
            setChatRoomId(requestData.chatRoomId || null);
          } else {
            // Pending invitation we sent
            setConnectionStatus('pending_sent');
            setConnectionId(request.id);
          }
        } else if (!receivedSnapshot.empty) {
          // We received an invitation
          const request = receivedSnapshot.docs[0];
          const requestData = request.data();
          
          if (requestData.status === 'accepted') {
            // Connection established
            setConnectionStatus('connected');
            setConnectionId(request.id);
            setChatRoomId(requestData.chatRoomId || null);
          } else {
            // Pending invitation we received
            setConnectionStatus('pending_received');
            setConnectionId(request.id);
          }
        } else {
          // No connection or invitation
          setConnectionStatus('none');
        }
      } catch (error) {
        console.error('Error checking connection status:', error);
        setConnectionStatus('none');
      } finally {
        setCheckingConnection(false);
      }
    };
    
    checkConnectionStatus();
  }, [user?.uid, uid]);

  // Debug log
  useEffect(() => {
    console.log('ProfileCard mounted with props:', { 
      name, 
      hasPhoto: !!photoURL, 
      profileImages: safeProfileImages.length,
      interestsCount: safeInterests.length,
      sharedInterestsCount: safeSharedInterests.length,
      tier,
      distance,
      connectionStatus
    });
    
    console.log('Bio content:', bio);
    console.log('Profile images URLs:', safeProfileImages.slice(0, 1));
    console.log('Shared interests:', safeSharedInterests);
  }, [connectionStatus]);

  // Animation setup
  const slideAnim = useRef(new Animated.Value(height)).current;
  const opacityAnim = useRef(new Animated.Value(0)).current;

  // Pan responder for swipe to dismiss from the drag handle
  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: (_, gestureState) => {
        return gestureState.dy > 5;
      },
      onPanResponderMove: (_, gestureState) => {
        if (gestureState.dy > 0) {
          slideAnim.setValue(gestureState.dy);
        }
      },
      onPanResponderRelease: (_, gestureState) => {
        if (gestureState.dy > DISMISS_THRESHOLD) {
          dismiss();
        } else {
          Animated.spring(slideAnim, {
            toValue: 0,
            useNativeDriver: true,
          }).start();
        }
      },
    })
  ).current;

  // Animate card entry
  useEffect(() => {
    Animated.parallel([
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 300,
        useNativeDriver: true,
      }),
      Animated.timing(opacityAnim, {
        toValue: 1,
        duration: 300,
        useNativeDriver: true,
      })
    ]).start();
  }, []);

  // Dismiss animation
  const dismiss = () => {
    Animated.parallel([
      Animated.timing(slideAnim, {
        toValue: height,
        duration: 300,
        useNativeDriver: true,
      }),
      Animated.timing(opacityAnim, {
        toValue: 0,
        duration: 300,
        useNativeDriver: true,
      })
    ]).start(() => {
      onDismiss();
    });
  };

  // Close image modal
  const closeImageModal = () => {
    setShowImageModal(false);
    setSelectedImageIndex(null);
  };

  // Image gallery
  const handleImageTap = (index: number) => {
    console.log('Image tapped:', index);
    setSelectedImageIndex(index);
    setShowImageModal(true);
  };

  // Handle sending an invitation
  const handleSendInvite = () => {
    if (onInvite) {
      setIsLoading(true);
      onInvite(uid);
    }
  };
  
  // Handle accepting an invitation
  const handleAcceptInvite = () => {
    if (onAcceptInvite && connectionId) {
      setIsLoading(true);
      onAcceptInvite(connectionId);
    }
  };
  
  // Handle declining an invitation
  const handleDeclineInvite = () => {
    if (onDeclineInvite && connectionId) {
      setIsLoading(true);
      onDeclineInvite(connectionId);
    }
  };
  
  // Handle starting a chat
  const handleStartChat = () => {
    if (onStartChat) {
      onStartChat(uid);
    }
  };

  // Get tier display info
  const getTierInfo = () => {
    switch(tier) {
      case 'soulmate': return { name: 'Soulmate', color: '#00B0FF' };
      case 'bestFriend': return { name: 'Best Friend', color: '#FFD700' };
      case 'friend': return { name: 'Friend', color: '#C0C0C0' };
      case 'buddy': return { name: 'Buddy', color: '#CD7F32' };
      case 'casual':
      default: return { name: 'Casual', color: '#999999' };
    }
  };

  const tierInfo = getTierInfo();
  
  // Render action buttons based on connection status
  const renderActionButtons = () => {
    if (checkingConnection || isLoading) {
      return (
        <View style={styles.buttonContainer}>
          <View style={[styles.button, { backgroundColor: '#ccc' }]}>
            <ActivityIndicator size="small" color="#fff" />
          </View>
        </View>
      );
    }
    
    switch (connectionStatus) {
      case 'none':
        // No connection - show Connect button
        return (
          <View style={styles.buttonContainer}>
            {onInvite && (
              <TouchableOpacity 
                style={[styles.button, { backgroundColor: '#4B7BEC' }]}
                onPress={handleSendInvite}
              >
                <FontAwesome name="user-plus" size={18} color="#fff" />
                <Text style={styles.buttonText}>Connect</Text>
              </TouchableOpacity>
            )}
          </View>
        );
        
      case 'pending_sent':
        // We sent an invitation - show Pending button (disabled)
        return (
          <View style={styles.buttonContainer}>
            <View style={[styles.button, { backgroundColor: '#ccc' }]}>
              <FontAwesome name="clock-o" size={18} color="#fff" />
              <Text style={styles.buttonText}>Pending</Text>
            </View>
          </View>
        );
        
      case 'pending_received':
        // We received an invitation - show Accept/Decline buttons
        return (
          <View style={styles.buttonContainer}>
            <TouchableOpacity 
              style={[styles.button, styles.buttonHalf, { backgroundColor: '#4BB543' }]}
              onPress={handleAcceptInvite}
            >
              <FontAwesome name="check" size={18} color="#fff" />
              <Text style={styles.buttonText}>Accept</Text>
            </TouchableOpacity>
            
            <TouchableOpacity 
              style={[styles.button, styles.buttonHalf, { backgroundColor: '#FF3B30' }]}
              onPress={handleDeclineInvite}
            >
              <FontAwesome name="times" size={18} color="#fff" />
              <Text style={styles.buttonText}>Decline</Text>
            </TouchableOpacity>
          </View>
        );
        
      case 'connected':
        // Connected - show Message button
        return (
          <View style={styles.buttonContainer}>
            <TouchableOpacity 
              style={[styles.button, { backgroundColor: '#26DE81' }]}
              onPress={handleStartChat}
            >
              <FontAwesome name="comment" size={18} color="#fff" />
              <Text style={styles.buttonText}>Message</Text>
            </TouchableOpacity>
          </View>
        );
        
      default:
        return null;
    }
  };

  return (
    <Animated.View 
      style={[
        styles.overlay, 
        { opacity: opacityAnim }
      ]}
    >
      <TouchableOpacity 
        style={styles.dismissOverlay} 
        activeOpacity={1} 
        onPress={dismiss}
      >
        <Animated.View 
          style={[
            styles.container, 
            { transform: [{ translateY: slideAnim }] }
          ]}
        >
          {/* Drag Handle - only this has the pan responder */}
          <View {...panResponder.panHandlers} style={styles.dragHandle}>
            <View style={styles.dragIndicator} />
          </View>

          {/* Main Content Area */}
          <View style={{ flex: 1, flexDirection: 'column' }}>
            {/* Content in ScrollView */}
            <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollViewContent}>
              {/* Profile Header */}
              <View style={styles.header}>
                <View style={[styles.photoContainer, { borderColor: tierInfo.color }]}>
                  {photoURL ? (
                    <Image 
                      source={{ uri: photoURL }} 
                      style={styles.photo}
                      resizeMode="cover"
                    />
                  ) : (
                    <View style={[styles.defaultPhoto, { backgroundColor: tierInfo.color }]}>
                      <FontAwesome name="user" size={40} color="#fff" />
                    </View>
                  )}
                </View>
                
                <View style={styles.userInfo}>
                  <Text style={styles.nameText}>{name}</Text>
                  <View style={[styles.tierBadge, { backgroundColor: tierInfo.color }]}>
                    <Text style={styles.tierText}>{tierInfo.name}</Text>
                  </View>
                  {distance !== undefined && (
                    <Text style={styles.distanceText}>{distance}m away</Text>
                  )}
                </View>
              </View>

              {/* Bio Section */}
              {bio && (
                <View style={styles.section}>
                  <Text style={styles.sectionTitle}>Bio</Text>
                  <Text style={styles.bioText}>{bio}</Text>
                </View>
              )}

              {/* Photo Gallery */}
              {safeProfileImages.length > 0 && (
                <View style={styles.section}>
                  <Text style={styles.sectionTitle}>Photos</Text>
                  <View style={styles.photoGrid}>
                    {safeProfileImages.map((url, index) => (
                      <TouchableOpacity 
                        key={`image-${index}`} 
                        style={styles.gridItem}
                        onPress={() => handleImageTap(index)}
                      >
                        <Image 
                          source={{ uri: url }} 
                          style={styles.gridImage}
                          resizeMode="cover"
                        />
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>
              )}

              {/* Shared Interests */}
              {safeSharedInterests.length > 0 && (
                <View style={styles.section}>
                  <Text style={styles.sectionTitle}>
                    Shared Interests ({safeSharedInterests.length})
                  </Text>
                  <View style={styles.interestsContainer}>
                    {safeSharedInterests.map((interest, index) => (
                      <View 
                        key={`interest-${index}`} 
                        style={[
                          styles.interestTag, 
                          { backgroundColor: `${tierInfo.color}15` }
                        ]}
                      >
                        <Text style={[styles.interestText, { color: tierInfo.color }]}>
                          {interest}
                        </Text>
                      </View>
                    ))}
                  </View>
                </View>
              )}

              {/* Empty Interests Fallback */}
              {safeSharedInterests.length === 0 && (
                <View style={styles.section}>
                  <Text style={styles.sectionTitle}>Shared Interests (0)</Text>
                  <View style={styles.emptyInterests}>
                    <Text style={styles.emptyText}>No shared interests found</Text>
                  </View>
                </View>
              )}

              {/* Bottom Spacing */}
              <View style={{ height: 20 }} />
            </ScrollView>

            {/* Action Buttons - Fixed at bottom */}
            {renderActionButtons()}
          </View>
        </Animated.View>
      </TouchableOpacity>

      {/* Full Screen Image Modal */}
      <Modal
        visible={showImageModal}
        transparent={true}
        animationType="fade"
        onRequestClose={closeImageModal}
      >
        <View style={styles.modalContainer}>
          <TouchableOpacity 
            style={styles.closeButton}
            onPress={closeImageModal}
          >
            <FontAwesome name="close" size={24} color="#fff" />
          </TouchableOpacity>
          
          {selectedImageIndex !== null && safeProfileImages[selectedImageIndex] && (
            <Image
              source={{ uri: safeProfileImages[selectedImageIndex] }}
              style={styles.fullImage}
              resizeMode="contain"
            />
          )}
        </View>
      </Modal>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  overlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  dismissOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  container: {
    backgroundColor: 'white',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    height: height * 0.75, // 75% of screen height
    maxHeight: height - TAB_BAR_HEIGHT,
    flexDirection: 'column',
  },
  dragHandle: {
    height: 35,
    justifyContent: 'center',
    alignItems: 'center',
  },
  dragIndicator: {
    width: 40,
    height: 5,
    backgroundColor: '#D3D3D3',
    borderRadius: 2.5,
  },
  scrollView: {
    flex: 1,
  },
  scrollViewContent: {
    padding: 20,
  },
  header: {
    flexDirection: 'row',
    marginBottom: 20,
  },
  photoContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    borderWidth: 3,
    overflow: 'hidden',
  },
  photo: {
    width: '100%',
    height: '100%',
  },
  defaultPhoto: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  userInfo: {
    flex: 1,
    marginLeft: 15,
    justifyContent: 'center',
  },
  nameText: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 5,
  },
  tierBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    alignSelf: 'flex-start',
    marginBottom: 5,
  },
  tierText: {
    color: 'white',
    fontWeight: 'bold',
    fontSize: 12,
  },
  distanceText: {
    fontSize: 14,
    color: '#666',
  },
  section: {
    marginTop: 20,
  },
  sectionTitle: {
    fontSize: 17,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 10,
  },
  bioText: {
    fontSize: 15,
    color: '#444',
    lineHeight: 22,
  },
  photoGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginHorizontal: -5,
  },
  gridItem: {
    width: '33.33%',
    aspectRatio: 1,
    padding: 5,
  },
  gridImage: {
    width: '100%',
    height: '100%',
    borderRadius: 8,
    backgroundColor: '#f0f0f0',
  },
  interestsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginHorizontal: -4,
  },
  interestTag: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 16,
    margin: 4,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.1)',
  },
  interestText: {
    fontSize: 14,
    fontWeight: '500',
  },
  emptyInterests: {
    padding: 15,
    backgroundColor: '#f8f8f8',
    borderRadius: 8,
    alignItems: 'center',
  },
  emptyText: {
    color: '#999',
    fontStyle: 'italic',
  },
  buttonContainer: {
    flexDirection: 'row',
    padding: 15,
    borderTopWidth: 1,
    borderTopColor: '#eee',
    backgroundColor: 'white',
  },
  button: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: 8,
    marginHorizontal: 5,
  },
  buttonHalf: {
    flex: 0.5,
  },
  buttonText: {
    color: 'white',
    fontWeight: 'bold',
    fontSize: 15,
    marginLeft: 8,
  },
  modalContainer: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.9)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  closeButton: {
    position: 'absolute',
    top: 40,
    right: 20,
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 10,
  },
  fullImage: {
    width: '90%',
    height: '70%',
  },
});

export default ProfileCard;

export default ProfileCard;
