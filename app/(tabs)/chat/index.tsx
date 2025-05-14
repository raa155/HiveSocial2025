import React, { useState, useEffect, useRef } from 'react';
import { 
  StyleSheet, 
  View, 
  Text, 
  FlatList, 
  TouchableOpacity, 
  ActivityIndicator, 
  Image,
  Animated,
  StatusBar,
  Dimensions,
  Platform
} from 'react-native';
import { router } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { useAuth } from '@/contexts/AuthContext';
import { 
  collection, 
  query, 
  where, 
  getDocs, 
  orderBy, 
  onSnapshot, 
  doc, 
  getDoc 
} from '@firebase/firestore';
import { db } from '@/config/firebase';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

// Tabbed navigation menu height calculation
const TAB_BAR_HEIGHT = Platform.OS === 'ios' ? 83 : 70; // Height including safe area insets on iOS

export default function ChatScreen() {
  const { user, userData } = useAuth();
  const [loading, setLoading] = useState(true);
  const [chatRooms, setChatRooms] = useState([]);
  const scrollY = useRef(new Animated.Value(0)).current;
  
  // Animated header opacity for scroll effect
  const headerOpacity = scrollY.interpolate({
    inputRange: [0, 60],
    outputRange: [0, 1],
    extrapolate: 'clamp',
  });

  // Load chat rooms
  useEffect(() => {
    if (!user?.uid) return;
    
    let unsubscribers = [];

    const loadChatRooms = async () => {
      try {
        console.log('Loading chat rooms for user:', user.uid);
        
        // First get all connections that the user is part of
        const connectionsQuery = query(
          collection(db, 'connectionRequests'),
          where('status', '==', 'accepted'),
          where('participants', 'array-contains', user.uid)
        );
        
        // Get connection documents
        const connectionSnapshot = await getDocs(connectionsQuery);
        
        if (connectionSnapshot.empty) {
          console.log('No connections found');
          setChatRooms([]);
          setLoading(false);
          return;
        }

        // Get chat room IDs from the connections
        const chatRoomIds = connectionSnapshot.docs
          .filter(doc => doc.data().chatRoomId)
          .map(doc => ({
            id: doc.data().chatRoomId,
            connectionData: doc.data()
          }));
        
        if (chatRoomIds.length === 0) {
          console.log('No chat rooms found');
          setChatRooms([]);
          setLoading(false);
          return;
        }
        
        // Set up a listener for each chat room
        chatRoomIds.forEach(({ id, connectionData }) => {
          const chatRoomRef = doc(db, 'chatRooms', id);
          
          const unsubscribe = onSnapshot(chatRoomRef, async (chatRoomDoc) => {
            if (!chatRoomDoc.exists()) {
              console.log(`Chat room ${id} does not exist`);
              return;
            }
            
            const chatRoomData = chatRoomDoc.data();
            
            // Find the other user's ID (not the current user)
            const otherUserId = connectionData.senderId === user.uid 
              ? connectionData.receiverId 
              : connectionData.senderId;
            
            // Get other user's info
            const otherUserDoc = await getDoc(doc(db, 'users', otherUserId));
            
            let otherUserData = { name: 'Unknown User', photoURL: null };
            if (otherUserDoc.exists()) {
              otherUserData = otherUserDoc.data();
            }
            
            // Create a chat room object with the necessary data
            const chatRoom = {
              id: chatRoomDoc.id,
              otherUserId,
              otherUserName: otherUserData.name,
              otherUserPhotoURL: otherUserData.photoURL,
              lastMessage: chatRoomData.lastMessageText || 'No messages yet',
              lastMessageTimestamp: chatRoomData.lastMessageTimestamp?.toDate() || null,
              lastMessageUserId: chatRoomData.lastMessage?.userId || null,
              messageStatus: chatRoomData.lastMessage?.status || null,
              unread: 0, // TODO: Implement unread count
              tier: connectionData.tier || 'casual'
            };
            
            // Update the chat rooms state
            setChatRooms(prevRooms => {
              // Check if this room already exists in the state
              const existingIndex = prevRooms.findIndex(room => room.id === chatRoom.id);
              
              if (existingIndex >= 0) {
                // Update existing room
                const updatedRooms = [...prevRooms];
                updatedRooms[existingIndex] = chatRoom;
                return updatedRooms;
              } else {
                // Add new room
                return [...prevRooms, chatRoom];
              }
            });
            
            setLoading(false);
          }, error => {
            console.error(`Error listening to chat room ${id}:`, error);
          });
          
          unsubscribers.push(unsubscribe);
        });
      } catch (error) {
        console.error('Error loading chat rooms:', error);
        setLoading(false);
      }
    };

    loadChatRooms();
    
    // Return cleanup function that unsubscribes from all listeners
    return () => {
      console.log(`Cleaning up ${unsubscribers.length} chat room listeners`);
      unsubscribers.forEach(unsubscribe => {
        if (typeof unsubscribe === 'function') {
          unsubscribe();
        }
      });
    };
  }, [user?.uid]);

  const formatTimestamp = (timestamp) => {
    if (!timestamp) return '';
    
    const now = new Date();
    const messageDate = new Date(timestamp);
    
    // Check if the message is from today
    if (
      messageDate.getDate() === now.getDate() &&
      messageDate.getMonth() === now.getMonth() &&
      messageDate.getFullYear() === now.getFullYear()
    ) {
      // Format as time only for today's messages
      return messageDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    }
    
    // Check if the message is from this week
    const diff = now.getTime() - messageDate.getTime();
    const daysDiff = Math.floor(diff / (1000 * 60 * 60 * 24));
    
    if (daysDiff < 7) {
      // Format as day of week for this week's messages
      return messageDate.toLocaleDateString([], { weekday: 'short' });
    }
    
    // Format as date for older messages
    return messageDate.toLocaleDateString([], { month: 'short', day: 'numeric' });
  };

  const renderChatItem = ({ item }) => (
    <TouchableOpacity
      style={styles.chatItem}
      onPress={() => router.push(`/chat/${item.id}?name=${encodeURIComponent(item.otherUserName)}`)}
      activeOpacity={0.7}
    >
      <View style={styles.avatar}>
        {item.otherUserPhotoURL ? (
          <Image 
            source={{ uri: item.otherUserPhotoURL }} 
            style={styles.avatarImage} 
            resizeMode="cover" 
          />
        ) : (
          <View style={styles.defaultAvatar}>
            <Text style={styles.defaultAvatarText}>
              {(item.otherUserName || '?').charAt(0).toUpperCase()}
            </Text>
          </View>
        )}
        {/* Online status indicator would go here */}
      </View>
      <View style={styles.chatInfo}>
        <View style={styles.chatHeader}>
          <Text style={styles.name} numberOfLines={1}>
            {item.otherUserName}
          </Text>
          {item.lastMessageTimestamp && (
            <Text style={styles.timestamp}>
              {formatTimestamp(item.lastMessageTimestamp)}
            </Text>
          )}
        </View>
        <View style={styles.chatFooter}>
          <View style={styles.lastMessageContainer}>
            <Text numberOfLines={1} style={styles.lastMessage}>
              {/* Show "You: " prefix if last message was from current user */}
              {item.lastMessageUserId === user?.uid ? 'You: ' : ''}
              {item.lastMessage}
            </Text>
            
            {/* Show status for last message if it's from the current user */}
            {item.lastMessageUserId === user?.uid && item.messageStatus && (
              <View style={styles.statusIconContainer}>
                {item.messageStatus.read ? (
                  <MaterialIcons name="done-all" size={16} color="#6C5CE7" />
                ) : item.messageStatus.delivered ? (
                  <MaterialIcons name="done" size={16} color="#a29bfe" />
                ) : (
                  <MaterialIcons name="access-time" size={14} color="#bdbdbd" />
                )}
              </View>
            )}
          </View>
          
          {item.unread > 0 && (
            <View style={styles.unreadBadge}>
              <Text style={styles.unreadText}>{item.unread}</Text>
            </View>
          )}
        </View>
      </View>
    </TouchableOpacity>
  );

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#6C5CE7" />
        <Text style={styles.loadingText}>Loading chats...</Text>
      </View>
    );
  }

  // Sort chat rooms by last message timestamp, newest first
  const sortedChatRooms = [...chatRooms].sort((a, b) => {
    if (!a.lastMessageTimestamp && !b.lastMessageTimestamp) return 0;
    if (!a.lastMessageTimestamp) return 1;
    if (!b.lastMessageTimestamp) return -1;
    return b.lastMessageTimestamp - a.lastMessageTimestamp;
  });

  return (
    <View style={styles.container}>
      <StatusBar style="dark" />
      
      {/* Animated Header */}
      <Animated.View style={[styles.animatedHeader, { opacity: headerOpacity }]}>
        <Text style={styles.animatedHeaderText}>Messages</Text>
      </Animated.View>
      
      {/* Main Content */}
      <View style={styles.contentContainer}>
        {/* Header */}
        <View style={styles.headerContainer}>
          <Text style={styles.title}>Messages</Text>
          <TouchableOpacity style={styles.searchButton}>
            <MaterialIcons name="search" size={24} color="#6C5CE7" />
          </TouchableOpacity>
        </View>
        
        {sortedChatRooms.length > 0 ? (
          <Animated.FlatList
            data={sortedChatRooms}
            renderItem={renderChatItem}
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
          <View style={styles.emptyContainer}>
            <LinearGradient
              colors={['#6C5CE7', '#a29bfe']}
              style={styles.emptyIconBackground}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
            >
              <MaterialIcons name="chat-bubble-outline" size={40} color="#fff" />
            </LinearGradient>
            <Text style={styles.emptyText}>No messages yet</Text>
            <Text style={styles.emptySubtext}>
              Connect with people around you to start chatting!
            </Text>
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
                <Text style={styles.exploreButtonText}>Explore Map</Text>
              </LinearGradient>
            </TouchableOpacity>
          </View>
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
  headerContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingBottom: 16,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#333',
  },
  searchButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#f0f0f0',
    justifyContent: 'center',
    alignItems: 'center',
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
  listContainer: {
    paddingHorizontal: 16,
    paddingBottom: TAB_BAR_HEIGHT + 20,
  },
  chatItem: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    padding: 16,
    borderRadius: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 1,
    },
    shadowOpacity: 0.08,
    shadowRadius: 2,
    elevation: 2,
  },
  avatar: {
    position: 'relative',
    marginRight: 12,
    justifyContent: 'center',
    width: 56,
    height: 56,
    borderRadius: 28,
    overflow: 'hidden',
    backgroundColor: '#f3f0ff',
  },
  avatarImage: {
    width: 56,
    height: 56,
    borderRadius: 28,
  },
  defaultAvatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#a29bfe',
    justifyContent: 'center',
    alignItems: 'center',
  },
  defaultAvatarText: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#fff',
  },
  chatInfo: {
    flex: 1,
    justifyContent: 'center',
  },
  chatHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  chatFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  name: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    flex: 1,
    marginRight: 8,
  },
  timestamp: {
    fontSize: 12,
    color: '#888',
  },
  lastMessageContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginRight: 8,
  },
  lastMessage: {
    fontSize: 14,
    color: '#666',
    flex: 1,
  },
  statusIconContainer: {
    marginLeft: 4,
    width: 16,
    height: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  unreadBadge: {
    backgroundColor: '#6C5CE7',
    borderRadius: 12,
    minWidth: 24,
    height: 24,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 8,
  },
  unreadText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: 'bold',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
    paddingBottom: TAB_BAR_HEIGHT,
  },
  emptyIconBackground: {
    width: 80,
    height: 80,
    borderRadius: 40,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  emptyText: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
    marginTop: 8,
  },
  emptySubtext: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    marginTop: 8,
    lineHeight: 24,
  },
  exploreButton: {
    marginTop: 24,
    width: SCREEN_WIDTH * 0.6,
    height: 50,
    borderRadius: 25,
    overflow: 'hidden',
    shadowColor: '#6C5CE7',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
  },
  exploreButtonGradient: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  exploreButtonText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 16,
  },
});
