import React, { useState, useEffect, useRef } from 'react';
import { StyleSheet, View, Text, ActivityIndicator, TouchableOpacity, Alert, Platform, Image, Modal } from 'react-native';
import MapView, { PROVIDER_GOOGLE, Marker, Circle, Callout } from 'react-native-maps';
import * as Location from 'expo-location';
import { 
  collection, 
  query, 
  where, 
  getDocs, 
  doc, 
  setDoc, 
  getDoc, 
  GeoPoint, 
  addDoc,
  serverTimestamp 
} from '@firebase/firestore';
import { db } from '@/config/firebase';
import { useAuth } from '@/contexts/AuthContext';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import EnhancedUserMapMarker, { MarkerTier } from '@/components/maps/EnhancedUserMapMarker';
import ProfileCard from '@/components/maps/ProfileCard';
import { router } from 'expo-router';

// Constants for location
const QUARTER_MILE_IN_METERS = 400; // 0.4 km
const LOCATION_TASK_NAME = 'background-location-task';

// Constants for tier system
const TIER_THRESHOLDS = {
  SOULMATE: 15, // 15+ shared interests
  BEST_FRIEND: 8, // 8-14 shared interests
  FRIEND: 5, // 5-7 shared interests
  BUDDY: 3, // 3-4 shared interests
  CASUAL: 1, // 1-2 shared interests
};

export default function MapScreen() {
  const { user, userData } = useAuth();
  const [location, setLocation] = useState(null);
  const [nearbyUsers, setNearbyUsers] = useState([]);
  const [errorMsg, setErrorMsg] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedUser, setSelectedUser] = useState(null);
  const [showProfileCard, setShowProfileCard] = useState(false);
  const mapRef = useRef(null);

  console.log('MapScreen rendering, user:', user ? 'Authenticated' : 'Not authenticated');
  console.log('Platform:', Platform.OS);

  // Initial location setup
  useEffect(() => {
    console.log('MapScreen useEffect triggered');

    const setupLocation = async () => {
      console.log('Setting up location');
      let { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        console.log('Location permission denied');
        setErrorMsg('Permission to access location was denied');
        setLoading(false);
        return;
      }

      try {
        console.log('Getting current position');
        // Get current location
        let location = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.Balanced
        });
        console.log('Location obtained:', location ? 'Yes' : 'No');
        setLocation(location);
        
        // Save user location to Firebase
        if (user?.uid) {
          console.log('Saving location to Firebase');
          const userLocationRef = doc(db, 'locations', user.uid);
          await setDoc(userLocationRef, {
            uid: user.uid,
            location: new GeoPoint(
              location.coords.latitude,
              location.coords.longitude
            ),
            timestamp: new Date(),
            visible: userData?.location?.visible || false
          }, { merge: true });
          
          // Fetch nearby users
          console.log('Fetching nearby users');
          await fetchNearbyUsers(location.coords.latitude, location.coords.longitude);
        } else {
          console.log('No user UID available, skipping Firebase update');
        }
        
        setLoading(false);
      } catch (error) {
        console.error('Error getting location:', error);
        setErrorMsg('Error getting location');
        setLoading(false);
      }
    };

    setupLocation();
  }, [user?.uid, userData?.location?.visible]);
  
  // Calculate tier based on number of shared interests
  const calculateTier = (sharedInterestsCount) => {
    if (sharedInterestsCount >= TIER_THRESHOLDS.SOULMATE) return 'soulmate';
    if (sharedInterestsCount >= TIER_THRESHOLDS.BEST_FRIEND) return 'bestFriend';
    if (sharedInterestsCount >= TIER_THRESHOLDS.FRIEND) return 'friend';
    if (sharedInterestsCount >= TIER_THRESHOLDS.BUDDY) return 'buddy';
    if (sharedInterestsCount >= TIER_THRESHOLDS.CASUAL) return 'casual';
    return 'casual'; // Default tier
  };

  // Find shared interests between current user and another user
  const findSharedInterests = (userInterests, otherUserInterests) => {
    if (!userInterests || !otherUserInterests) return [];
    
    return userInterests.filter(interest => 
      otherUserInterests.includes(interest)
    );
  };

  // Function to fetch user profile data
  const fetchUserProfile = async (uid) => {
    try {
      console.log(`Fetching profile for user: ${uid}`);
      const userDocRef = doc(db, 'users', uid);
      const userDoc = await getDoc(userDocRef);
      if (userDoc.exists()) {
        const userData = userDoc.data();
        console.log(`Profile data for ${uid}:`, {
          name: userData.name || 'No name',
          hasPhoto: !!userData.photoURL,
          interestsCount: userData.interests?.length || 0
        });
        return userData;
      }
      console.log(`No profile found for user: ${uid}`);
      return null;
    } catch (error) {
      console.error(`Error fetching profile for user ${uid}:`, error);
      return null;
    }
  };

  // Handle marker press
  const handleMarkerPress = (user) => {
    console.log('Marker pressed, user data:', {
      uid: user.uid,
      name: user.name,
      hasProfileImages: !!user.profileImages && Array.isArray(user.profileImages),
      profileImagesCount: user.profileImages?.length || 0,
      hasInterests: !!user.interests && Array.isArray(user.interests),
      interestsCount: user.interests?.length || 0,
      hasSharedInterests: !!user.sharedInterests && Array.isArray(user.sharedInterests),
      sharedInterestsCount: user.sharedInterests?.length || 0,
    });
    
    setSelectedUser(user);
    setShowProfileCard(true);
  };

  // Handle profile card dismiss
  const handleDismissProfileCard = () => {
    setShowProfileCard(false);
    setTimeout(() => setSelectedUser(null), 300); // Delay clearing user to allow animation
  };

  // Handle starting a chat
  const handleStartChat = (uid) => {
    // First check if there's an existing chat room
    const selectedUser = nearbyUsers.find(u => u.uid === uid);
    if (!selectedUser) {
      Alert.alert('Error', 'User not found');
      return;
    }
    
    // Check if we have a connection with this user
    const checkConnection = async () => {
      try {
        const connectionRequestsRef = collection(db, 'connectionRequests');
        
        // Check both sent and received connections
        const sentQuery = query(
          connectionRequestsRef,
          where('senderId', '==', user.uid),
          where('receiverId', '==', uid),
          where('status', '==', 'accepted')
        );
        
        const receivedQuery = query(
          connectionRequestsRef,
          where('senderId', '==', uid),
          where('receiverId', '==', user.uid),
          where('status', '==', 'accepted')
        );
        
        const [sentResults, receivedResults] = await Promise.all([
          getDocs(sentQuery),
          getDocs(receivedQuery)
        ]);
        
        let chatRoomId = null;
        
        // Check if there's a chat room from either query
        if (!sentResults.empty) {
          const connectionData = sentResults.docs[0].data();
          chatRoomId = connectionData.chatRoomId;
        } else if (!receivedResults.empty) {
          const connectionData = receivedResults.docs[0].data();
          chatRoomId = connectionData.chatRoomId;
        }
        
        if (chatRoomId) {
          // Navigate to the chat screen
          router.push(`/chat/${chatRoomId}?name=${encodeURIComponent(selectedUser.name)}`);
        } else {
          Alert.alert('Error', 'No chat room found for this connection');
        }
      } catch (error) {
        console.error('Error checking connection:', error);
        Alert.alert('Error', 'Failed to find chat room');
      }
    };
    
    checkConnection();
    handleDismissProfileCard();
  };

  // Handle accepting an invitation
  const handleAcceptInvite = async (connectionId) => {
    try {
      if (!user?.uid) {
        Alert.alert('Error', 'You must be logged in to accept invitations');
        return;
      }
      
      console.log(`Accepting connection invitation ${connectionId}`);
      
      // Get the connection request reference
      const connectionRef = doc(db, 'connectionRequests', connectionId);
      const connectionDoc = await getDoc(connectionRef);
      
      if (!connectionDoc.exists()) {
        Alert.alert('Error', 'Connection request not found');
        return;
      }
      
      const connectionData = connectionDoc.data();
      
      // Update status to 'accepted'
      await setDoc(connectionRef, {
        ...connectionData,
        status: 'accepted',
        // Add participants array for easier querying
        participants: [connectionData.senderId, connectionData.receiverId],
        acceptedAt: serverTimestamp()
      }, { merge: true });
      
      // Create a chat room for these users with all necessary data
      const chatRoomRef = await addDoc(collection(db, 'chatRooms'), {
        participants: [connectionData.senderId, connectionData.receiverId],
        connectionId: connectionId,
        createdAt: serverTimestamp(),
        lastMessage: null,
        lastMessageText: '',
        lastMessageTimestamp: null
      });
      
      // Update the connection with the chat room ID
      await setDoc(connectionRef, {
        chatRoomId: chatRoomRef.id
      }, { merge: true });
      
      // Add a system message to the chat
      await addDoc(collection(db, 'chatRooms', chatRoomRef.id, 'messages'), {
        text: 'You are now connected! Say hello to your new connection.',
        createdAt: serverTimestamp(),
        system: true
      });
      
      Alert.alert('Success', 'Connection accepted!');
      handleDismissProfileCard();
      
    } catch (error) {
      console.error('Error accepting connection:', error);
      Alert.alert('Error', 'Failed to accept connection request');
    }
  };
  
  // Handle declining an invitation
  const handleDeclineInvite = async (connectionId) => {
    try {
      if (!user?.uid) {
        Alert.alert('Error', 'You must be logged in to decline invitations');
        return;
      }
      
      console.log(`Declining connection invitation ${connectionId}`);
      
      // Delete the connection request instead of just marking as declined
      // This matches the behavior in the connections tab
      const connectionRef = doc(db, 'connectionRequests', connectionId);
      await deleteDoc(connectionRef);
      
      Alert.alert('Success', 'Connection declined');
      handleDismissProfileCard();
      
    } catch (error) {
      console.error('Error declining connection:', error);
      Alert.alert('Error', 'Failed to decline connection request');
    }
  };

  // Handle sending an invitation
  const handleSendInvite = async (uid) => {
    // In a real app, send a connection invitation
    try {
      if (!user?.uid || uid === user.uid) {
        Alert.alert('Error', 'Cannot send invitation to yourself');
        return;
      }
      
      console.log(`Sending connection invitation to user ${uid}`);
      
      // Check if there's already a connection or pending request
      const connectionRequestsRef = collection(db, 'connectionRequests');
      
      // Check for existing requests in either direction
      const existingSentQuery = query(
        connectionRequestsRef,
        where('senderId', '==', user.uid),
        where('receiverId', '==', uid)
      );
      
      const existingReceivedQuery = query(
        connectionRequestsRef,
        where('senderId', '==', uid),
        where('receiverId', '==', user.uid)
      );
      
      const [sentResults, receivedResults] = await Promise.all([
        getDocs(existingSentQuery),
        getDocs(existingReceivedQuery)
      ]);
      
      if (!sentResults.empty) {
        // Already sent a request to this user
        Alert.alert('Connection Request', 'You have already sent a connection request to this user.');
        handleDismissProfileCard();
        return;
      }
      
      if (!receivedResults.empty) {
        // Already received a request from this user
        Alert.alert(
          'Connection Request',
          'This user has already sent you a connection request. Check your connections tab!',
          [{ text: 'OK', onPress: () => router.push('/connections') }]
        );
        handleDismissProfileCard();
        return;
      }
      
      // Find the selected user in nearbyUsers
      const selectedNearbyUser = nearbyUsers.find(u => u.uid === uid);
      if (!selectedNearbyUser) {
        Alert.alert('Error', 'User not found');
        return;
      }
      
      // Create a new connection request
      await addDoc(connectionRequestsRef, {
        senderId: user.uid,
        receiverId: uid,
        senderName: userData?.name || 'Anonymous User',
        status: 'pending',
        timestamp: serverTimestamp(),
        tier: selectedNearbyUser.tier,
        sharedInterests: selectedNearbyUser.sharedInterests || [],
        sharedInterestsCount: selectedNearbyUser.sharedInterestsCount || 0
      });
      
      Alert.alert('Success', 'Invitation sent! They will be notified of your request.');
      handleDismissProfileCard();
      
    } catch (error) {
      console.error('Error sending invitation:', error);
      Alert.alert('Error', 'Failed to send invitation. Please try again.');
    }
  };
  
  // Function to fetch nearby users
  const fetchNearbyUsers = async (latitude, longitude) => {
    if (!user?.uid) {
      console.log('Cannot fetch nearby users: No user UID');
      return;
    }
    
    try {
      // Don't set refreshing here to avoid clearing the existing markers while loading
      console.log('Fetching nearby users around', latitude, longitude);
      
      // Create a temporary array to collect new users
      const newUsers = [];
      
      // Get current user's profile to compare interests
      const currentUserProfile = await fetchUserProfile(user.uid);
      const currentUserInterests = currentUserProfile?.interests || [];
      
      console.log('Current user interests:', currentUserInterests);
      
      // In a production app, you would use Firebase Geoqueries or a cloud function
      // For simplicity, we'll fetch all visible locations and filter client-side
      const locationsRef = collection(db, 'locations');
      const q = query(locationsRef, where('visible', '==', true));
      const querySnapshot = await getDocs(q);
      
      const users = [];
      const profilePromises = [];
      
      console.log(`Found ${querySnapshot.size} total location entries`);
      
      querySnapshot.forEach((doc) => {
        const data = doc.data();
        // Don't include current user
        if (data.uid !== user.uid && data.location) {
          // Calculate distance
          const distance = getDistanceFromLatLonInMeters(
            latitude,
            longitude,
            data.location.latitude,
            data.location.longitude
          );
          
          // Only include users within quarter mile
          if (distance <= QUARTER_MILE_IN_METERS) {
            console.log(`User ${data.uid} is within range: ${Math.round(distance)}m`);
            
            const userObj = {
              uid: data.uid,
              latitude: data.location.latitude,
              longitude: data.location.longitude,
              distance: Math.round(distance),
              photoURL: null,
              name: null,
              bio: null,
              interests: [],
              sharedInterests: [],
              sharedInterestsCount: 0,
              tier: 'casual', // Default tier
            };
            
            users.push(userObj);
            
            // Fetch user profile data
            const profilePromise = fetchUserProfile(data.uid).then(profile => {
              if (profile) {
                console.log(`Setting profile data for user ${data.uid}`);
                
                // Log the photo URL for debugging
                if (profile.photoURL) {
                  console.log(`User ${data.uid} photo URL: ${profile.photoURL.substring(0, 50)}...`);
                  
                  // Ensure the photoURL is properly formed
                  let finalPhotoURL = profile.photoURL.trim();
                  
                  // Validate URL - add https:// if missing
                  if (!finalPhotoURL.startsWith('http')) {
                    finalPhotoURL = `https://${finalPhotoURL}`;
                  }
                  
                  // Add a cache-busting parameter to force reload on each run
                  const timestamp = new Date().getTime();
                  if (finalPhotoURL.includes('?')) {
                    finalPhotoURL += `&_cb=${timestamp}`;
                  } else {
                    finalPhotoURL += `?_cb=${timestamp}`;
                  }
                  
                  // Additional validation
                  try {
                    new URL(finalPhotoURL); // Test if it's a valid URL
                    
                    // Set the URL only after validation
                    userObj.photoURL = finalPhotoURL;
                    console.log(`Set User ${data.uid} photoURL: ${finalPhotoURL.substring(0, 30)}...`);
                    
                    // Pre-cache the image immediately
                    try {
                      console.log(`Pre-fetching image for ${data.uid}`);
                      Image.prefetch(finalPhotoURL)
                        .catch(prefetchError => {
                          console.error(`Prefetch error for ${data.uid}:`, prefetchError);
                        });
                    } catch (err) {
                      console.warn('Prefetch attempt failed:', err);
                    }
                  } catch (e) {
                    console.error(`Invalid URL for user ${data.uid}:`, e.message);
                    userObj.photoURL = null;
                  }
                } else {
                  console.log(`User ${data.uid} has no photo URL`);
                  userObj.photoURL = null;
                }
                
                userObj.name = profile.name || 'Anonymous User';
                userObj.bio = profile.bio || null;
                userObj.interests = profile.interests || [];
                
                // Load profile images if available
                if (profile.profileImages && Array.isArray(profile.profileImages)) {
                  userObj.profileImages = profile.profileImages;
                }
                
                // Calculate shared interests
                if (profile.interests && currentUserInterests.length > 0) {
                  userObj.sharedInterests = findSharedInterests(currentUserInterests, profile.interests);
                  userObj.sharedInterestsCount = userObj.sharedInterests.length;
                  // Using a safer type casting approach
                  const tierValue = calculateTier(userObj.sharedInterestsCount);
                  userObj.tier = tierValue;
                }
                
                console.log(`User ${data.uid} profile:`, {
                  name: userObj.name,
                  hasPhoto: !!userObj.photoURL,
                  photoURL: userObj.photoURL ? 'exists' : 'missing',
                  sharedInterests: userObj.sharedInterestsCount,
                  tier: userObj.tier
                });
              }
            });
            
            profilePromises.push(profilePromise);
          } else {
            console.log(`User ${data.uid} is out of range: ${Math.round(distance)}m`);
          }
        } else if (data.uid === user.uid) {
          console.log('Skipping current user location');
        } else {
          console.log('Skipping user with no location data');
        }
      });
      
      // Wait for all profile data to be fetched
      console.log(`Waiting for ${profilePromises.length} profile fetch operations to complete...`);
      await Promise.all(profilePromises);
      
      // Sort users by tier first (highest tier first) and then by distance (closest first)
      const tierRanking = {
        'soulmate': 5,
        'bestFriend': 4,
        'friend': 3,
        'buddy': 2,
        'casual': 1
      };
      
      users.sort((a, b) => {
        // Compare tiers first
        const tierDiff = tierRanking[b.tier] - tierRanking[a.tier];
        
        if (tierDiff !== 0) {
          return tierDiff; // Sort by tier if tiers are different
        }
        
        // If tiers are the same, sort by distance
        return a.distance - b.distance;
      });
      
      console.log('All profile data fetched and sorted. Nearby users with profiles:', users.map(u => ({
        uid: u.uid,
        name: u.name,
        tier: u.tier,
        sharedInterests: u.sharedInterestsCount
      })));
      
      // Pre-cache images for faster loading
      users.forEach(user => {
        if (user.photoURL) {
          // Preload images by creating a new Image object
          const prefetchImage = async () => {
            try {
              console.log(`Pre-caching image for user ${user.name}`);
              const imageAsset = Image.prefetch(user.photoURL);
            } catch (error) {
              console.error(`Failed to pre-cache image for ${user.name}:`, error);
            }
          };
          prefetchImage();
        }
      });
      
      // Now update the users state
      setNearbyUsers(users);
    } catch (error) {
      console.error('Error fetching nearby users:', error);
      Alert.alert('Error', 'Failed to fetch nearby users.');
    } finally {
      setRefreshing(false);
    }
  };
  
  // Helper function to calculate distance
  const getDistanceFromLatLonInMeters = (lat1, lon1, lat2, lon2) => {
    const R = 6371; // Radius of the earth in km
    const dLat = deg2rad(lat2 - lat1);
    const dLon = deg2rad(lon2 - lon1);
    const a = 
      Math.sin(dLat/2) * Math.sin(dLat/2) +
      Math.cos(deg2rad(lat1)) * Math.cos(deg2rad(lat2)) * 
      Math.sin(dLon/2) * Math.sin(dLon/2); 
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a)); 
    const d = R * c * 1000; // Distance in meters
    return d;
  };
  
  const deg2rad = (deg) => {
    return deg * (Math.PI/180);
  };
  
  // Refresh location and nearby users
  const handleRefresh = async () => {
    if (loading || refreshing) return;
    
    try {
      setRefreshing(true);
      console.log('Refreshing location');
      let location = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced
      });
      setLocation(location);
      
      // Save updated location to Firebase
      if (user?.uid) {
        console.log('Updating location in Firebase');
        const userLocationRef = doc(db, 'locations', user.uid);
        await setDoc(userLocationRef, {
          uid: user.uid,
          location: new GeoPoint(
            location.coords.latitude,
            location.coords.longitude
          ),
          timestamp: new Date(),
          visible: userData?.location?.visible || false
        }, { merge: true });
        
        // Fetch nearby users
        await fetchNearbyUsers(location.coords.latitude, location.coords.longitude);
      }
    } catch (error) {
      console.error('Error refreshing location:', error);
      Alert.alert('Error', 'Failed to refresh location.');
    } finally {
      setRefreshing(false);
    }
  };

  if (loading) {
    console.log('MapScreen showing loading state');
    return (
      <View style={styles.container}>
        <ActivityIndicator size="large" color="#0000ff" />
        <Text style={styles.paragraph}>Loading map...</Text>
      </View>
    );
  }

  if (errorMsg) {
    console.log('MapScreen showing error state:', errorMsg);
    return (
      <View style={styles.container}>
        <Text style={styles.paragraph}>{errorMsg}</Text>
      </View>
    );
  }

  console.log('MapScreen rendering map');
  return (
    <View style={styles.container}>
      {location ? (
        <>
          <MapView
            ref={mapRef}
            provider={PROVIDER_GOOGLE}
            style={styles.map}
            initialRegion={{
              latitude: location.coords.latitude,
              longitude: location.coords.longitude,
              latitudeDelta: 0.01,
              longitudeDelta: 0.01,
            }}
            showsUserLocation={true}
            showsMyLocationButton={true}
            cacheEnabled={Platform.OS === 'android'}
            loadingEnabled={true}
            loadingBackgroundColor="#F5F5F5"
            loadingIndicatorColor="#007bff"
          >
            {/* Quarter mile radius circle */}
            <Circle
              center={{
                latitude: location.coords.latitude,
                longitude: location.coords.longitude,
              }}
              radius={QUARTER_MILE_IN_METERS}
              fillColor="rgba(0, 123, 255, 0.1)"
              strokeColor="rgba(0, 123, 255, 0.5)"
              strokeWidth={1}
            />
            
            {/* Nearby users markers - Using direct approach for iOS */}
            {nearbyUsers.map((nearbyUser, index) => {
              if (nearbyUser.photoURL) {
                console.log(`Rendering marker for user ${nearbyUser.uid} - profile image available`);
              }
              
              // Use a stable key combining ID and coordinates to avoid remounts
              const markerKey = `marker-${nearbyUser.uid || index}-${nearbyUser.latitude.toFixed(6)}-${nearbyUser.longitude.toFixed(6)}`;
                
              return (
                <Marker
                  key={markerKey}
                  coordinate={{
                    latitude: nearbyUser.latitude,
                    longitude: nearbyUser.longitude,
                  }}
                  tracksViewChanges={true} // Set to true initially to ensure image loads
                  onPress={() => handleMarkerPress(nearbyUser)}
                >
                  <EnhancedUserMapMarker
                    photoURL={nearbyUser.photoURL}
                    distance={nearbyUser.distance}
                    name={nearbyUser.name}
                    tier={nearbyUser.tier}
                    sharedInterestsCount={nearbyUser.sharedInterestsCount}
                  />
                </Marker>
              );
            })}
          </MapView>
          
          {/* Refresh button */}
          <TouchableOpacity 
            style={styles.refreshButton}
            onPress={handleRefresh}
            disabled={refreshing}
          >
            {refreshing ? (
              <ActivityIndicator color="#fff" size="small" />
            ) : (
              <FontAwesome name="refresh" size={20} color="#fff" />
            )}
          </TouchableOpacity>
          
          {/* Information panel */}
          <View style={styles.infoPanel}>
            <Text style={styles.infoTitle}>Nearby Users</Text>
            <Text style={styles.infoText}>
              {nearbyUsers.length > 0 
                ? `${nearbyUsers.length} users nearby`
                : 'No users nearby at the moment'}
            </Text>
            
            {!userData?.location?.visible && (
              <Text style={styles.warningText}>
                Your location is currently hidden. Others can't see you on the map.
              </Text>
            )}
          </View>
          
          {/* Profile card modal */}
          {showProfileCard && selectedUser && (
            <ProfileCard
              uid={selectedUser.uid || ''}
              name={selectedUser.name || 'User'}
              bio={selectedUser.bio || ''}
              photoURL={selectedUser.photoURL || undefined}
              profileImages={selectedUser.profileImages || []}
              interests={selectedUser.interests || []}
              sharedInterests={selectedUser.sharedInterests || []}
              tier={selectedUser.tier || 'casual'}
              distance={selectedUser.distance || 0}
              onDismiss={handleDismissProfileCard}
              onStartChat={handleStartChat}
              onInvite={handleSendInvite}
              onAcceptInvite={handleAcceptInvite}
              onDeclineInvite={handleDeclineInvite}
            />
          )}
        </>
      ) : (
        <Text style={styles.paragraph}>Waiting for location...</Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  paragraph: {
    margin: 24,
    fontSize: 18,
    textAlign: 'center',
  },
  map: {
    width: '100%',
    height: '100%',
  },
  refreshButton: {
    position: 'absolute',
    top: 16,
    right: 16,
    backgroundColor: '#007bff',
    width: 50,
    height: 50,
    borderRadius: 25,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
  },
  infoPanel: {
    position: 'absolute',
    bottom: 16,
    left: 16,
    right: 16,
    backgroundColor: 'white',
    borderRadius: 8,
    padding: 16,
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
  },
  infoTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  infoText: {
    fontSize: 14,
    color: '#666',
  },
  warningText: {
    fontSize: 14,
    color: '#ff6347',
    marginTop: 8,
    fontStyle: 'italic',
  },
  profileCardContainer: {
    position: 'absolute',
    bottom: 16,
    left: 0,
    right: 0,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 2,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
