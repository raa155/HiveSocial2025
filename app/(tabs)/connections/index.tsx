import React, { useState, useRef, useEffect } from 'react';
import { 
  StyleSheet, 
  View, 
  Text, 
  FlatList, 
  TouchableOpacity, 
  ActivityIndicator,
  Alert,
  Animated,
  Image,
  Dimensions,
  Platform,
  StatusBar
} from 'react-native';
import { router } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useAuth } from '@/contexts/AuthContext';
import { 
  collection, 
  query, 
  where, 
  getDocs, 
  updateDoc, 
  doc, 
  deleteDoc, 
  onSnapshot,
  addDoc,
  serverTimestamp
} from '@firebase/firestore';
import { db } from '@/config/firebase';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const CARD_PADDING = 16;

// Tier color mapping to match the map screen colors
const TIER_COLORS = {
  'soulmate': { primary: '#00B0FF', gradient: ['#00B0FF', '#64c8ff'] },     // Light blue
  'bestFriend': { primary: '#FFD700', gradient: ['#FFD700', '#ffe666'] },  // Gold
  'friend': { primary: '#C0C0C0', gradient: ['#C0C0C0', '#e6e6e6'] },      // Silver
  'buddy': { primary: '#CD7F32', gradient: ['#CD7F32', '#e2aa73'] },       // Bronze
  'casual': { primary: '#AAAAAA', gradient: ['#AAAAAA', '#d9d9d9'] }        // Gray
};

export default function ConnectionsScreen() {
  const { user, userData } = useAuth();
  const [loading, setLoading] = useState(true);
  const [pendingConnections, setPendingConnections] = useState([]);
  const [connections, setConnections] = useState([]);
  const [activeTab, setActiveTab] = useState('connections'); // 'connections' or 'requests'
  
  // Animation values
  const scrollY = useRef(new Animated.Value(0)).current;
  const headerOpacity = scrollY.interpolate({
    inputRange: [0, 60],
    outputRange: [0, 1],
    extrapolate: 'clamp',
  });
  
  // Tab slide animation
  const tabIndicatorPosition = useRef(new Animated.Value(0)).current;
  
  // Animate tab indicator when active tab changes
  useEffect(() => {
    Animated.spring(tabIndicatorPosition, {
      toValue: activeTab === 'connections' ? 0 : 1,
      useNativeDriver: false,
      friction: 8,
      tension: 100
    }).start();
  }, [activeTab]);

  // Load connection requests and current connections
  useEffect(() => {
    if (!user?.uid) return;

    // Create listeners for both pending connections and active connections
    console.log('Setting up connection listeners for user:', user.uid);
    
    // Get pending connection requests (status = 'pending')
    const pendingConnectionsQuery = query(
      collection(db, 'connectionRequests'),
      where('receiverId', '==', user.uid),
      where('status', '==', 'pending')
    );

    // Get active connections (status = 'accepted')
    const connectionsQuery = query(
      collection(db, 'connectionRequests'),
      where('status', '==', 'accepted'),
      where('participants', 'array-contains', user.uid)
    );

    // Set up listeners
    const unsubscribePending = onSnapshot(pendingConnectionsQuery, async (snapshot) => {
      console.log(`Received ${snapshot.docs.length} pending connection requests`);
      
      // Get user data for each sender
      const pendingRequestsWithData = await Promise.all(
        snapshot.docs.map(async (docSnapshot) => {
          const requestData = docSnapshot.data();
          // Get sender info
          const senderDoc = await getDocs(
            query(collection(db, 'users'), where('uid', '==', requestData.senderId))
          );
          
          let senderData = { name: 'Unknown User' };
          if (!senderDoc.empty) {
            senderData = senderDoc.docs[0].data();
          }
          
          return {
            id: docSnapshot.id,
            ...requestData,
            senderName: senderData.name,
            senderPhotoURL: senderData.photoURL,
            timestamp: requestData.timestamp?.toDate() || new Date(),
            tier: requestData.tier || 'casual',
            sharedInterests: requestData.sharedInterests || []
          };
        })
      );
      
      // Sort by timestamp, newest first
      pendingRequestsWithData.sort((a, b) => b.timestamp - a.timestamp);
      setPendingConnections(pendingRequestsWithData);
      setLoading(false);
    }, (error) => {
      console.error('Error getting pending connections:', error);
      Alert.alert('Error', 'Could not load connection requests');
      setLoading(false);
    });

    const unsubscribeConnections = onSnapshot(connectionsQuery, async (snapshot) => {
      console.log(`Received ${snapshot.docs.length} active connections`);
      
      // Get user data for each connection (the other user, not the current user)
      const connectionsWithData = await Promise.all(
        snapshot.docs.map(async (docSnapshot) => {
          const connectionData = docSnapshot.data();
          
          // Find the other user's ID (not the current user)
          const otherUserId = connectionData.senderId === user.uid 
            ? connectionData.receiverId 
            : connectionData.senderId;
          
          // Get other user's info
          const otherUserDoc = await getDocs(
            query(collection(db, 'users'), where('uid', '==', otherUserId))
          );
          
          let otherUserData = { name: 'Unknown User' };
          if (!otherUserDoc.empty) {
            otherUserData = otherUserDoc.docs[0].data();
          }
          
          return {
            id: docSnapshot.id,
            ...connectionData,
            otherUserId,
            otherUserName: otherUserData.name,
            otherUserPhotoURL: otherUserData.photoURL,
            timestamp: connectionData.timestamp?.toDate() || new Date(),
            tier: connectionData.tier || 'casual',
            sharedInterests: connectionData.sharedInterests || []
          };
        })
      );
      
      // Sort by tier and then by name
      connectionsWithData.sort((a, b) => {
        const tierRanking = {
          'soulmate': 5,
          'bestFriend': 4,
          'friend': 3,
          'buddy': 2,
          'casual': 1
        };
        
        // First sort by tier
        const tierDiff = tierRanking[b.tier] - tierRanking[a.tier];
        if (tierDiff !== 0) return tierDiff;
        
        // Then sort by name
        return a.otherUserName.localeCompare(b.otherUserName);
      });
      
      setConnections(connectionsWithData);
      setLoading(false);
    }, (error) => {
      console.error('Error getting connections:', error);
      Alert.alert('Error', 'Could not load connections');
      setLoading(false);
    });

    // Clean up listeners on unmount
    return () => {
      unsubscribePending();
      unsubscribeConnections();
    };
  }, [user?.uid]);

  // Handle accepting a connection request
  const handleAcceptConnection = async (connectionRequest) => {
    if (!user?.uid) return;
    
    try {
      setLoading(true);
      
      // Get the connection request reference
      const connectionRef = doc(db, 'connectionRequests', connectionRequest.id);
      
      // Update status to 'accepted'
      await updateDoc(connectionRef, {
        status: 'accepted',
        // Add participants array for easier querying
        participants: [connectionRequest.senderId, connectionRequest.receiverId],
        acceptedAt: serverTimestamp()
      });
      
      // Create a chat room for these users
      const chatRoomRef = await addDoc(collection(db, 'chatRooms'), {
        participants: [connectionRequest.senderId, connectionRequest.receiverId],
        connectionId: connectionRequest.id,
        createdAt: serverTimestamp(),
        lastMessage: null,
        lastMessageText: '',
        lastMessageTimestamp: null
      });
      
      // Update the connection with the chat room ID
      await updateDoc(connectionRef, {
        chatRoomId: chatRoomRef.id
      });
      
      // Add a system message to the chat
      await addDoc(collection(db, 'chatRooms', chatRoomRef.id, 'messages'), {
        text: 'You are now connected! Say hello to your new connection.',
        createdAt: serverTimestamp(),
        system: true
      });
      
      console.log('Connection accepted and chat room created:', chatRoomRef.id);
      
      // Alert after a slight delay to avoid UI glitches
      setTimeout(() => {
        Alert.alert('Success', 'Connection accepted!');
      }, 300);
      
    } catch (error) {
      console.error('Error accepting connection:', error);
      Alert.alert('Error', 'Failed to accept connection request');
    } finally {
      setLoading(false);
    }
  };

  // Handle declining a connection request
  const handleDeclineConnection = async (connectionId) => {
    if (!user?.uid) return;
    
    // Ask for confirmation before declining
    Alert.alert(
      'Decline Connection',
      'Are you sure you want to decline this connection request?',
      [
        {
          text: 'Cancel',
          style: 'cancel'
        },
        {
          text: 'Decline',
          style: 'destructive',
          onPress: async () => {
            try {
              setLoading(true);
              
              // Delete the connection request
              await deleteDoc(doc(db, 'connectionRequests', connectionId));
              
              console.log('Connection request declined');
              
              // Alert after a slight delay to avoid UI glitches
              setTimeout(() => {
                Alert.alert('Success', 'Connection request declined');
              }, 300);
              
            } catch (error) {
              console.error('Error declining connection:', error);
              Alert.alert('Error', 'Failed to decline connection request');
            } finally {
              setLoading(false);
            }
          }
        }
      ]
    );
  };

  // Handle viewing a chat with a connection
  const handleViewChat = (connection) => {
    // Navigate to the chat screen with the connection's chat room ID
    if (connection.chatRoomId) {
      router.push(`/chat/${connection.chatRoomId}?name=${encodeURIComponent(connection.otherUserName)}`);
    } else {
      Alert.alert('Error', 'Chat room not found for this connection');
    }
  };

  // Handle viewing a connection profile
  const handleViewProfile = (user) => {
    // Navigate to the user profile screen with the user's ID and other necessary data
    router.push({
      pathname: `/user-profile`,
      params: {
        id: user.otherUserId,
        name: user.otherUserName,
        tier: user.tier
      }
    });
  };

  // Render a connection request
  const renderConnectionRequest = ({ item }) => (
    <View style={styles.connectionCard}>
      <View style={styles.connectionHeader}>
        <View style={styles.userInfoContainer}>
          {item.senderPhotoURL ? (
            <Image source={{ uri: item.senderPhotoURL }} style={styles.avatar} />
          ) : (
            <View style={[
              styles.defaultAvatar,
              { backgroundColor: TIER_COLORS[item.tier]?.primary || TIER_COLORS.casual.primary }
            ]}>
              <Text style={styles.defaultAvatarText}>
                {(item.senderName || '?').charAt(0).toUpperCase()}
              </Text>
            </View>
          )}
          <View style={styles.nameContainer}>
            <Text style={styles.name}>{item.senderName}</Text>
            <View style={styles.timestampContainer}>
              <MaterialIcons name="schedule" size={12} color="#888" />
              <Text style={styles.timestamp}>
                {new Date(item.timestamp).toLocaleDateString(undefined, { 
                  month: 'short', 
                  day: 'numeric' 
                })}
              </Text>
            </View>
          </View>
        </View>
        <View style={styles.tierBadgeContainer}>
          <LinearGradient
            colors={TIER_COLORS[item.tier]?.gradient || TIER_COLORS.casual.gradient}
            style={styles.tierBadge}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
          >
            <Text style={styles.tierBadgeText}>{getTierDisplayName(item.tier)}</Text>
          </LinearGradient>
        </View>
      </View>

      {item.sharedInterests && item.sharedInterests.length > 0 && (
        <View style={styles.interestsContainer}>
          <Text style={styles.interestsLabel}>Shared Interests:</Text>
          <View style={styles.interestTagsContainer}>
            {item.sharedInterests.map((interest, index) => (
              <View key={index} style={styles.interestTag}>
                <Text style={styles.interestTagText}>{interest}</Text>
              </View>
            ))}
          </View>
        </View>
      )}

      <View style={styles.actionButtonsContainer}>
        <TouchableOpacity
          style={styles.declineButton}
          onPress={() => handleDeclineConnection(item.id)}
          activeOpacity={0.7}
        >
          <Text style={styles.declineButtonText}>Decline</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.acceptButton}
          onPress={() => handleAcceptConnection(item)}
          activeOpacity={0.7}
        >
          <LinearGradient
            colors={['#26de81', '#20bf6b']}
            style={styles.acceptButtonGradient}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
          >
            <Text style={styles.acceptButtonText}>Accept</Text>
          </LinearGradient>
        </TouchableOpacity>
      </View>
    </View>
  );

  // Render an active connection
  const renderConnection = ({ item }) => (
    <View style={styles.connectionCard}>
      <TouchableOpacity 
        style={styles.userInfoRow}
        onPress={() => handleViewProfile(item)}
        activeOpacity={0.7}
      >
        <View style={styles.userInfoContainer}>
          {item.otherUserPhotoURL ? (
            <Image source={{ uri: item.otherUserPhotoURL }} style={styles.avatar} />
          ) : (
            <View style={[
              styles.defaultAvatar, 
              { backgroundColor: TIER_COLORS[item.tier]?.primary || TIER_COLORS.casual.primary }
            ]}>
              <Text style={styles.defaultAvatarText}>
                {(item.otherUserName || '?').charAt(0).toUpperCase()}
              </Text>
            </View>
          )}
          <View style={styles.nameContainer}>
            <Text style={styles.name}>{item.otherUserName}</Text>
            <View style={styles.tierSmallTag}>
              <LinearGradient
                colors={TIER_COLORS[item.tier]?.gradient || TIER_COLORS.casual.gradient}
                style={styles.tierSmallBadge}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
              >
                <Text style={styles.tierSmallText}>{getTierDisplayName(item.tier)}</Text>
              </LinearGradient>
            </View>
          </View>
        </View>
        <MaterialIcons name="chevron-right" size={24} color="#ccc" style={styles.chevronIcon} />
      </TouchableOpacity>

      {item.sharedInterests && item.sharedInterests.length > 0 && (
        <View style={styles.interestsContainer}>
          <Text style={styles.interestsLabel}>Shared Interests:</Text>
          <View style={styles.interestTagsContainer}>
            {item.sharedInterests.slice(0, 3).map((interest, index) => (
              <View key={index} style={styles.interestTag}>
                <Text style={styles.interestTagText}>{interest}</Text>
              </View>
            ))}
            {item.sharedInterests.length > 3 && (
              <View style={styles.moreInterestsTag}>
                <Text style={styles.moreInterestsText}>+{item.sharedInterests.length - 3}</Text>
              </View>
            )}
          </View>
        </View>
      )}

      <TouchableOpacity
        style={styles.chatButton}
        onPress={() => handleViewChat(item)}
        activeOpacity={0.7}
      >
        <LinearGradient
          colors={['#6C5CE7', '#a29bfe']}
          style={styles.chatButtonGradient}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
        >
          <Ionicons name="chatbubble-outline" size={16} color="#fff" />
          <Text style={styles.chatButtonText}>Message</Text>
        </LinearGradient>
      </TouchableOpacity>
    </View>
  );

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

  // Render empty state
  const renderEmptyState = () => {
    const isConnections = activeTab === 'connections';
    
    return (
      <View style={styles.emptyContainer}>
        <LinearGradient
          colors={isConnections ? ['#6C5CE7', '#a29bfe'] : ['#ff9f43', '#f39c12']}
          style={styles.emptyIconContainer}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
        >
          <MaterialIcons 
            name={isConnections ? "people-outline" : "notifications-none"} 
            size={40} 
            color="#fff" 
          />
        </LinearGradient>
        
        <Text style={styles.emptyTitle}>
          {isConnections 
            ? 'No Connections Yet' 
            : 'No Pending Requests'}
        </Text>
        
        <Text style={styles.emptyText}>
          {isConnections 
            ? 'You don\'t have any connections yet. Explore the map to find people nearby!' 
            : 'You don\'t have any pending connection requests at the moment.'}
        </Text>
        
        {isConnections && (
          <TouchableOpacity 
            style={styles.exploreButton}
            onPress={() => router.push('/map')}
            activeOpacity={0.8}
          >
            <LinearGradient
              colors={['#6C5CE7', '#a29bfe']}
              style={styles.exploreButtonGradient}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
            >
              <MaterialIcons name="explore" size={18} color="#fff" style={{ marginRight: 8 }} />
              <Text style={styles.exploreButtonText}>Explore Map</Text>
            </LinearGradient>
          </TouchableOpacity>
        )}
      </View>
    );
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#6C5CE7" />
        <Text style={styles.loadingText}>Loading connections...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <StatusBar style="dark" />
      
      {/* Animated Header */}
      <Animated.View style={[styles.animatedHeader, { opacity: headerOpacity }]}>
        <Text style={styles.animatedHeaderText}>Connections</Text>
      </Animated.View>
      
      {/* Main Content */}
      <View style={styles.contentContainer}>
        {/* Tab Navigation */}
        <View style={styles.tabContainer}>
          <TouchableOpacity 
            style={[styles.tabButton, activeTab === 'connections' && styles.activeTabButton]}
            onPress={() => setActiveTab('connections')}
            activeOpacity={0.8}
          >
            <Text style={[
              styles.tabButtonText, 
              activeTab === 'connections' && styles.activeTabButtonText
            ]}>
              My Connections
            </Text>
          </TouchableOpacity>
          
          <TouchableOpacity 
            style={[styles.tabButton, activeTab === 'requests' && styles.activeTabButton]}
            onPress={() => setActiveTab('requests')}
            activeOpacity={0.8}
          >
            <Text style={[
              styles.tabButtonText, 
              activeTab === 'requests' && styles.activeTabButtonText
            ]}>
              Requests
            </Text>
            
            {pendingConnections.length > 0 && (
              <View style={styles.tabBadge}>
                <Text style={styles.tabBadgeText}>{pendingConnections.length}</Text>
              </View>
            )}
          </TouchableOpacity>
          
          <Animated.View 
            style={[
              styles.tabIndicator, 
              { 
                left: tabIndicatorPosition.interpolate({
                  inputRange: [0, 1],
                  outputRange: ['0%', '50%']
                }) 
              }
            ]} 
          />
        </View>
        
        {/* Content based on active tab */}
        {activeTab === 'connections' ? (
          connections.length > 0 ? (
            <Animated.FlatList
              data={connections}
              renderItem={renderConnection}
              keyExtractor={(item) => item.id}
              contentContainerStyle={styles.listContainer}
              showsVerticalScrollIndicator={false}
              onScroll={Animated.event(
                [{ nativeEvent: { contentOffset: { y: scrollY } } }],
                { useNativeDriver: true }
              )}
              scrollEventThrottle={16}
            />
          ) : (
            renderEmptyState()
          )
        ) : (
          pendingConnections.length > 0 ? (
            <Animated.FlatList
              data={pendingConnections}
              renderItem={renderConnectionRequest}
              keyExtractor={(item) => item.id}
              contentContainerStyle={styles.listContainer}
              showsVerticalScrollIndicator={false}
              onScroll={Animated.event(
                [{ nativeEvent: { contentOffset: { y: scrollY } } }],
                { useNativeDriver: true }
              )}
              scrollEventThrottle={16}
            />
          ) : (
            renderEmptyState()
          )
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
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
  contentContainer: {
    flex: 1,
    paddingTop: 16,
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
  tabContainer: {
    flexDirection: 'row',
    marginBottom: 16,
    paddingHorizontal: 16,
    position: 'relative',
  },
  tabButton: {
    flex: 1,
    height: 48,
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
  },
  activeTabButton: {
    borderBottomColor: '#6C5CE7',
  },
  tabButtonText: {
    fontSize: 15,
    fontWeight: '500',
    color: '#888',
  },
  activeTabButtonText: {
    fontWeight: '700',
    color: '#6C5CE7',
  },
  tabIndicator: {
    position: 'absolute',
    bottom: 0,
    width: '50%',
    height: 3,
    backgroundColor: '#6C5CE7',
    borderRadius: 3,
  },
  tabBadge: {
    position: 'absolute',
    right: -8,
    top: 8,
    backgroundColor: '#ff4757',
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 4,
  },
  tabBadgeText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: 'bold',
  },
  listContainer: {
    paddingHorizontal: 16,
    paddingBottom: 24,
  },
  connectionCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    marginBottom: 16,
    padding: CARD_PADDING,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 2,
  },
  connectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  userInfoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  userInfoContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  chevronIcon: {
    marginLeft: 8,
  },
  avatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
    marginRight: 12,
  },
  defaultAvatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: '#a29bfe',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  defaultAvatarText: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#fff',
  },
  nameContainer: {
    flex: 1,
  },
  name: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    marginBottom: 4,
  },
  timestampContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  timestamp: {
    fontSize: 12,
    color: '#888',
    marginLeft: 4,
  },
  tierBadgeContainer: {
    marginLeft: 8,
  },
  tierBadge: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 12,
  },
  tierBadgeText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#fff',
  },
  tierSmallTag: {
    alignSelf: 'flex-start',
  },
  tierSmallBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  tierSmallText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#fff',
  },
  interestsContainer: {
    marginTop: 8,
    marginBottom: 16,
  },
  interestsLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#555',
    marginBottom: 8,
  },
  interestTagsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  interestTag: {
    backgroundColor: '#f3f0ff',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
    marginRight: 8,
    marginBottom: 8,
  },
  interestTagText: {
    fontSize: 12,
    color: '#6C5CE7',
    fontWeight: '500',
  },
  moreInterestsTag: {
    backgroundColor: '#f0f0f0',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 12,
    marginBottom: 8,
  },
  moreInterestsText: {
    fontSize: 12,
    color: '#888',
    fontWeight: '500',
  },
  actionButtonsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 8,
  },
  declineButton: {
    flex: 1,
    height: 46,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 12,
    marginRight: 8,
  },
  declineButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#ff4757',
  },
  acceptButton: {
    flex: 1,
    height: 46,
    borderRadius: 12,
    overflow: 'hidden',
  },
  acceptButtonGradient: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  acceptButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#fff',
  },
  chatButton: {
    alignSelf: 'stretch',
    height: 46,
    borderRadius: 12,
    overflow: 'hidden',
  },
  chatButtonGradient: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },
  chatButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#fff',
    marginLeft: 8,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
    paddingBottom: 40,
  },
  emptyIconContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 8,
  },
  emptyText: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: 24,
  },
  exploreButton: {
    width: SCREEN_WIDTH * 0.6,
    height: 46,
    borderRadius: 23,
    overflow: 'hidden',
    shadowColor: '#6C5CE7',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
  },
  exploreButtonGradient: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },
  exploreButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});
