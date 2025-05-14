import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { 
  StyleSheet, 
  View, 
  Text, 
  ActivityIndicator, 
  TouchableOpacity, 
  Alert, 
  Platform, 
  Image, 
  Animated,
  Dimensions,
  Switch
} from 'react-native';
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
  serverTimestamp,
  deleteDoc,
  onSnapshot 
} from '@firebase/firestore';
import { db } from '@/config/firebase';
import { useAuth } from '@/contexts/AuthContext';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import EnhancedUserMapMarker from '@/components/maps/EnhancedUserMapMarker';
import MarkerSpiderfier from '@/components/maps/MarkerSpiderfier';
import ProfileCard from '@/components/maps/ProfileCard';
import FilterDrawer from '@/components/maps/FilterDrawer';
import { router } from 'expo-router';
import { 
  getDistanceFromLatLonInMeters, 
  offsetOverlappingMarkers, 
  radiusToLatitudeDelta 
} from '@/utils/geospatial';
import { useUserPresence } from '@/utils/presence';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

// Constants for location
const QUARTER_MILE_IN_METERS = 400; // 0.4 km (quarter mile)
const LOCATION_TASK_NAME = 'background-location-task';

// Constants for tier system
const TIER_THRESHOLDS = {
  SOULMATE: 15, // 15+ shared interests
  BEST_FRIEND: 8, // 8-14 shared interests
  FRIEND: 5, // 5-7 shared interests
  BUDDY: 3, // 3-4 shared interests
  CASUAL: 1, // 1-2 shared interests
};

// Get screen dimensions
const { width, height } = Dimensions.get('window');

// Tabbed navigation menu height calculation
const TAB_BAR_HEIGHT = Platform.OS === 'ios' ? 83 : 70; // Height including safe area insets on iOS

export default function MapScreen() {
  const { user, userData } = useAuth();
  const [location, setLocation] = useState(null);
  const [nearbyUsers, setNearbyUsers] = useState([]);
  const [filteredUsers, setFilteredUsers] = useState([]);
  const [errorMsg, setErrorMsg] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedUser, setSelectedUser] = useState(null);
  const [showProfileCard, setShowProfileCard] = useState(false);
  
  // Filter drawer state
  const [showFilterDrawer, setShowFilterDrawer] = useState(false);
  const [filters, setFilters] = useState({
    selectedInterests: [],
    minSharedInterests: 1,
    onlineOnly: false
  });
  const [filtersActive, setFiltersActive] = useState(false);
  
  // Spiderfier state for handling overlapping markers
  const [spiderfiedMarkers, setSpiderfiedMarkers] = useState([]);
  const [spiderfierBaseCoordinate, setSpiderfierBaseCoordinate] = useState(null);
  const [showSpiderfier, setShowSpiderfier] = useState(false);
  
  // Location visibility state
  const [locationVisible, setLocationVisible] = useState(userData?.location?.visible || false);
  const [availableInterests, setAvailableInterests] = useState([]);
  
  // Animation refs
  const filterDrawerAnimation = useRef(new Animated.Value(0)).current;
  const controlsOpacity = useRef(new Animated.Value(1)).current;
  const controlsPosition = useRef(new Animated.Value(0)).current;
  
  // Map refs
  const mapRef = useRef(null);
  
  // Setup user presence
  useUserPresence();
  
  console.log('MapScreen rendering, user:', user ? 'Authenticated' : 'Not authenticated');
  console.log('Platform:', Platform.OS);

  // Setup initial load effect
  useEffect(() => {
    loadAvailableInterests();
  }, []);

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
        
        // Restore visibility setting from user data
        if (userData?.location?.visible !== undefined) {
          setLocationVisible(userData.location.visible);
        }
        
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
            lastSeen: serverTimestamp(),
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
  
  // Listen for real-time updates of online users
  useEffect(() => {
    if (!user?.uid || !location) return;
    
    console.log('Setting up presence listener');
    
    const presenceRef = collection(db, 'presence');
    const unsubscribe = onSnapshot(
      presenceRef,
      (snapshot) => {
        // Get current online users
        const onlineUsers = new Set();
        snapshot.forEach(doc => {
          const data = doc.data();
          if (data.online === true) {
            onlineUsers.add(doc.id);
          }
        });
        
        console.log(`Found ${onlineUsers.size} online users`);
        
        // Update our nearby users with online status
        setNearbyUsers(prevUsers => {
          const updatedUsers = prevUsers.map(user => ({
            ...user,
            online: onlineUsers.has(user.uid)
          }));
          
          // Apply filters to get filtered user list
          applyFilters(updatedUsers);
          
          return updatedUsers;
        });
      },
      (error) => {
        console.error('Error getting presence:', error);
      }
    );
    
    return () => unsubscribe();
  }, [location, user?.uid, filters]);
  
  // Monitor filter changes and apply them
  useEffect(() => {
    applyFilters(nearbyUsers);
    
    // Check if any filters are active
    const isActive = 
      filters.selectedInterests.length > 0 || 
      filters.minSharedInterests > 1 ||
      filters.onlineOnly;
    
    setFiltersActive(isActive);
  }, [filters, nearbyUsers]);
  
  // Animate controls when profile card visibility changes
  useEffect(() => {
    if (showProfileCard) {
      // Hide controls when profile card appears
      Animated.parallel([
        Animated.timing(controlsOpacity, {
          toValue: 0,
          duration: 200,
          useNativeDriver: true,
        }),
        Animated.timing(controlsPosition, {
          toValue: 50, // Move controls down/away
          duration: 250,
          useNativeDriver: true,
        })
      ]).start();
    } else {
      // Show controls when profile card disappears
      Animated.parallel([
        Animated.timing(controlsOpacity, {
          toValue: 1,
          duration: 250,
          useNativeDriver: true,
        }),
        Animated.timing(controlsPosition, {
          toValue: 0, // Return to original position
          duration: 200,
          useNativeDriver: true,
        })
      ]).start();
    }
  }, [showProfileCard]);
  
  // Load all available interests for filtering
  const loadAvailableInterests = async () => {
    try {
      // In a real app, this would be a Cloud Function or a dedicated interests collection
      // For now, we'll extract interests from all user profiles
      const usersRef = collection(db, 'users');
      const snapshot = await getDocs(usersRef);
      
      const allInterests = new Set();
      
      snapshot.forEach(doc => {
        const data = doc.data();
        if (data.interests && Array.isArray(data.interests)) {
          data.interests.forEach(interest => {
            allInterests.add(interest);
          });
        }
      });
      
      console.log(`Loaded ${allInterests.size} unique interests`);
      setAvailableInterests(Array.from(allInterests).sort());
    } catch (error) {
      console.error('Error loading interests:', error);
    }
  };
  
  // Apply filters to users
  const applyFilters = useCallback((users) => {
    if (!users || users.length === 0) {
      setFilteredUsers([]);
      return;
    }
    
    console.log('Applying filters:', {
      interestsCount: filters.selectedInterests.length,
      minShared: filters.minSharedInterests,
      onlineOnly: filters.onlineOnly
    });
    
    let filtered = [...users];
    
    // Filter by minimum shared interests
    if (filters.minSharedInterests > 1) {
      filtered = filtered.filter(user => user.sharedInterestsCount >= filters.minSharedInterests);
    }
    
    // Filter by specific interests
    if (filters.selectedInterests.length > 0) {
      filtered = filtered.filter(user => {
        if (!user.interests || !Array.isArray(user.interests)) return false;
        
        // Check if user has at least one of the selected interests
        return filters.selectedInterests.some(interest => 
          user.interests.includes(interest)
        );
      });
    }
    
    // Filter by online status
    if (filters.onlineOnly) {
      filtered = filtered.filter(user => user.online === true);
    }
    
    // Apply the offset algorithm to prevent overlapping markers
    const offsetUsers = offsetOverlappingMarkers(filtered);
    
    console.log(`Filtered from ${users.length} to ${filtered.length} users`);
    setFilteredUsers(offsetUsers);
  }, [filters]);
  
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

  // Handle marker press - now with support for detecting overlapping markers
  const handleMarkerPress = (user) => {
    console.log('Marker pressed, user data:', {
      uid: user.uid,
      name: user.name,
      position: `${user.latitude.toFixed(6)}, ${user.longitude.toFixed(6)}`,
      hasProfileImages: !!user.profileImages && Array.isArray(user.profileImages),
      profileImagesCount: user.profileImages?.length || 0,
      hasInterests: !!user.interests && Array.isArray(user.interests),
      interestsCount: user.interests?.length || 0,
      hasSharedInterests: !!user.sharedInterests && Array.isArray(user.sharedInterests),
      sharedInterestsCount: user.sharedInterests?.length || 0,
      online: user.online
    });
    
    // Check if this marker is part of a group of overlapping markers
    // We identify these by the originalCoordinateGroup property we set during offsetting
    if (user.originalCoordinateGroup && !showSpiderfier) {
      // Get all markers that share the same original coordinate group
      const markersInSameGroup = filteredUsers.filter(
        m => m.originalCoordinateGroup === user.originalCoordinateGroup
      );
      
      // If there are multiple markers in this group and they're not already spiderfied
      if (markersInSameGroup.length > 1) {
        // Set up the spiderfier
        setSpiderfiedMarkers(markersInSameGroup);
        setSpiderfierBaseCoordinate({
          latitude: parseFloat(user.originalCoordinateGroup.split('_')[0]),
          longitude: parseFloat(user.originalCoordinateGroup.split('_')[1])
        });
        setShowSpiderfier(true);
        return; // Don't show profile card yet
      }
    }
    
    // If not part of an overlapping group, or already spiderfied, show the profile card
    setSelectedUser(user);
    setShowProfileCard(true);
    
    // Close the spiderfier if it's open
    if (showSpiderfier) {
      closeSpiderfier();
    }
  };
  
  // Handle closing the spiderfier
  const handleCloseSpiderfier = () => {
    closeSpiderfier();
  };
  
  // Helper to close the spiderfier
  const closeSpiderfier = () => {
    setShowSpiderfier(false);
    setSpiderfiedMarkers([]);
    setSpiderfierBaseCoordinate(null);
  };

  // Handle profile card dismiss
  const handleDismissProfileCard = () => {
    setShowProfileCard(false);
    setTimeout(() => setSelectedUser(null), 300); // Delay clearing user to allow animation
    
    // Also close spiderfier if it's open
    if (showSpiderfier) {
      closeSpiderfier();
    }
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
      
      // Get presence data to determine who's online
      const presenceRef = collection(db, 'presence');
      const presenceSnapshot = await getDocs(presenceRef);
      const onlineUsers = new Set();
      
      presenceSnapshot.forEach(doc => {
        const data = doc.data();
        if (data.online === true) {
          onlineUsers.add(doc.id);
        }
      });
      
      console.log(`Found ${onlineUsers.size} online users`);
      
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
              online: onlineUsers.has(data.uid) // Check if user is online
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
      
      // Apply offset algorithm to prevent overlapping markers
      const offsetUsers = offsetOverlappingMarkers(users);
      
      // Update the state
      setNearbyUsers(offsetUsers);
      
      // Apply current filters
      applyFilters(offsetUsers);
    } catch (error) {
      console.error('Error fetching nearby users:', error);
      Alert.alert('Error', 'Failed to fetch nearby users.');
    } finally {
      setRefreshing(false);
    }
  };
  
  // Toggle location visibility
  const toggleLocationVisibility = async () => {
    try {
      if (!user?.uid) return;
      
      const newVisibility = !locationVisible;
      console.log(`Toggling location visibility to: ${newVisibility}`);
      
      // Update local state
      setLocationVisible(newVisibility);
      
      // Update in Firestore - user profile
      const userDocRef = doc(db, 'users', user.uid);
      await setDoc(userDocRef, {
        location: {
          visible: newVisibility
        }
      }, { merge: true });
      
      // Update in Firestore - locations collection
      const locationDocRef = doc(db, 'locations', user.uid);
      await setDoc(locationDocRef, {
        visible: newVisibility
      }, { merge: true });
      
      console.log('Location visibility updated in Firebase');
    } catch (error) {
      console.error('Error toggling location visibility:', error);
      // Revert local state on error
      setLocationVisible(!locationVisible);
      Alert.alert('Error', 'Failed to update location visibility.');
    }
  };
  
  // Open/close filter drawer
  const toggleFilterDrawer = () => {
    // Store current state for animation
    const isVisible = !showFilterDrawer;
    
    // Update state immediately
    setShowFilterDrawer(isVisible);
    
    // Animate drawer
    Animated.timing(filterDrawerAnimation, {
      toValue: isVisible ? 0 : -width,
      duration: 300,
      useNativeDriver: true,
    }).start();
  };
  // Handle filter changes
  const handleInterestToggle = (interest) => {
    setFilters(prev => {
      const updatedInterests = [...prev.selectedInterests];
      const index = updatedInterests.indexOf(interest);
      
      if (index === -1) {
        // Add the interest
        updatedInterests.push(interest);
      } else {
        // Remove the interest
        updatedInterests.splice(index, 1);
      }
      
      return {
        ...prev,
        selectedInterests: updatedInterests
      };
    });
  };
  
  // Handle minimum shared interests change
  const handleMinSharedInterestsChange = (value) => {
    setFilters(prev => ({
      ...prev,
      minSharedInterests: value
    }));
  };
  
  // Handle online only toggle
  const handleOnlineOnlyToggle = (value) => {
    setFilters(prev => ({
      ...prev,
      onlineOnly: value
    }));
  };
  
  // Function to get safe area insets
  const getSafeAreaInsets = () => {
    // On iOS, the status bar height is typically around 44pt
    // On Android, it varies, but we can use a default value
    const statusBarHeight = Platform.OS === 'ios' ? 44 : 24;
    
    // Use the TAB_BAR_HEIGHT constant for the bottom inset
    return {
      top: statusBarHeight,
      bottom: TAB_BAR_HEIGHT
    };
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
          visible: locationVisible,
          lastSeen: serverTimestamp()
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
            onPress={() => {
              // Close spiderfier when map is tapped
              if (showSpiderfier) {
                closeSpiderfier();
              }
            }}
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
            
            {/* Nearby users markers - Using filtered users */}
            {!showSpiderfier && filteredUsers.map((nearbyUser, index) => {
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
                    online={nearbyUser.online}
                  />
                </Marker>
              );
            })}
            
            {/* Spiderfier component for showing overlapping markers */}
            {showSpiderfier && spiderfiedMarkers.length > 0 && spiderfierBaseCoordinate && (
              <MarkerSpiderfier
                markers={spiderfiedMarkers}
                baseCoordinate={spiderfierBaseCoordinate}
                onMarkerPress={handleMarkerPress}
                onClose={handleCloseSpiderfier}
              />
            )}
          </MapView>
          
          {/* Filter Drawer */}
          <FilterDrawer
            visible={showFilterDrawer}
            onClose={toggleFilterDrawer}
            filters={filters}
            allInterests={availableInterests}
            onInterestToggle={handleInterestToggle}
            onMinSharedInterestsChange={handleMinSharedInterestsChange}
            onOnlineOnlyToggle={handleOnlineOnlyToggle}
            drawerAnimation={filterDrawerAnimation}
          />
          
          {/* Top control buttons - position changes when profile card is visible */}
          <Animated.View 
            style={[
              styles.topButtonsContainer, 
              { 
                top: getSafeAreaInsets().top + 10,
                right: 16,
                opacity: controlsOpacity,
                transform: [
                  { translateY: controlsPosition },
                  { scale: Animated.subtract(1, Animated.multiply(0.2, Animated.divide(controlsPosition, 50))) }
                ]
              }
            ]}
          >
            {/* Refresh button */}
            <TouchableOpacity 
              style={styles.topButton}
              onPress={handleRefresh}
              disabled={refreshing}
            >
              {refreshing ? (
                <ActivityIndicator color="#fff" size="small" />
              ) : (
                <FontAwesome name="refresh" size={20} color="#fff" />
              )}
            </TouchableOpacity>
            
            {/* Filter button */}
            <TouchableOpacity 
              style={[
                styles.topButton, 
                filtersActive && styles.topButtonActive
              ]}
              onPress={toggleFilterDrawer}
            >
              <FontAwesome name="filter" size={20} color="#fff" />
            </TouchableOpacity>
            
            {/* Visibility toggle switch */}
            <View style={styles.switchContainer}>
              <Switch
                value={locationVisible}
                onValueChange={toggleLocationVisibility}
                trackColor={{ false: "#F44336", true: "#4CAF50" }}
                thumbColor="#ffffff"
                ios_backgroundColor="#F44336"
              />
            </View>
          </Animated.View>
          
          {/* Information panel - hide when profile card is visible */}
          <Animated.View 
            style={[
              styles.infoPanel, 
              { 
                bottom: TAB_BAR_HEIGHT + 16,
                opacity: controlsOpacity,
                transform: [
                  { translateY: controlsPosition }
                ]
              }
            ]}
          >
            <Text style={styles.infoTitle}>Nearby Users</Text>
            <Text style={styles.infoText}>
              {filteredUsers.length > 0 
                ? `${filteredUsers.length} users nearby`
                : filtersActive
                  ? 'No users match your current filters'
                  : 'No users nearby at the moment'}
            </Text>
            
            {!locationVisible && (
              <Text style={styles.warningText}>
                Your location is currently hidden. Others can't see you on the map.
              </Text>
            )}
            
            {filtersActive && (
              <Text style={styles.filterText}>
                Filters active: {
                  [
                    filters.minSharedInterests > 1 ? `Min ${filters.minSharedInterests} shared interests` : '',
                    filters.selectedInterests.length > 0 ? `${filters.selectedInterests.length} interests selected` : '',
                    filters.onlineOnly ? 'Online only' : ''
                  ].filter(Boolean).join(', ')
                }
              </Text>
            )}
          </Animated.View>
          
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
              online={selectedUser.online || false}
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
  topButtonsContainer: {
    position: 'absolute',
    right: 16,
    zIndex: 10,
  },
  topButton: {
    backgroundColor: '#007bff',
    width: 50,
    height: 50,
    borderRadius: 25,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 10,
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
  },
  topButtonActive: {
    backgroundColor: '#ff6600', // Orange color for active filter
  },
  visibleButton: {
    backgroundColor: '#4CAF50', // Green for visible
  },
  hiddenButton: {
    backgroundColor: '#F44336', // Red for hidden
  },
  switchContainer: {
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    borderRadius: 20,
    padding: 5,
    marginTop: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
    elevation: 3,
  },
  infoPanel: {
    position: 'absolute',
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
  filterText: {
    fontSize: 14,
    color: '#ff6600',
    marginTop: 8,
    fontStyle: 'italic',
  },
  // Spiderfier styles
  spiderMarkerContainer: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  spiderLine: {
    backgroundColor: 'rgba(0, 123, 255, 0.6)',
    height: 2,
  },
  spiderCloseButton: {
    backgroundColor: 'rgba(255, 0, 0, 0.8)',
    width: 28,
    height: 28,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: 'white',
  },
  spiderCloseText: {
    color: 'white',
    fontSize: 18,
    fontWeight: 'bold',
    textAlign: 'center',
  },
});
