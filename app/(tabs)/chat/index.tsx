import React, { useState, useEffect } from 'react';
import { StyleSheet, View, Text, FlatList, TouchableOpacity, ActivityIndicator, Image } from 'react-native';
import { router } from 'expo-router';
import FontAwesome from '@expo/vector-icons/FontAwesome';
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

export default function ChatScreen() {
  const { user, userData } = useAuth();
  const [loading, setLoading] = useState(true);
  const [chatRooms, setChatRooms] = useState([]);

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
    >
      <View style={styles.avatar}>
        {item.otherUserPhotoURL ? (
          <Image 
            source={{ uri: item.otherUserPhotoURL }} 
            style={styles.avatarImage} 
            resizeMode="cover" 
          />
        ) : (
          <FontAwesome name="user-circle" size={50} color="#ccc" />
        )}
      </View>
      <View style={styles.chatInfo}>
        <View style={styles.chatHeader}>
          <Text style={styles.name}>{item.otherUserName}</Text>
          {item.lastMessageTimestamp && (
            <Text style={styles.timestamp}>
              {formatTimestamp(item.lastMessageTimestamp)}
            </Text>
          )}
        </View>
        <View style={styles.chatFooter}>
          <View style={styles.lastMessageContainer}>
            <Text numberOfLines={1} style={styles.lastMessage}>
              {item.lastMessage}
            </Text>
            
            {/* Show status for last message if it's from the current user */}
            {item.lastMessageUserId === user?.uid && item.messageStatus && (
              <View style={styles.statusIconSmall}>
                {item.messageStatus.read ? (
                  <FontAwesome name="check-circle" size={10} color="#4caf50" />
                ) : item.messageStatus.delivered ? (
                  <FontAwesome name="check" size={10} color="#2196f3" />
                ) : (
                  <FontAwesome name="clock-o" size={10} color="#bdbdbd" />
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
        <ActivityIndicator size="large" color="#007bff" />
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
      <Text style={styles.title}>Messages</Text>
      {sortedChatRooms.length > 0 ? (
        <FlatList
          data={sortedChatRooms}
          renderItem={renderChatItem}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContainer}
        />
      ) : (
        <View style={styles.emptyContainer}>
          <FontAwesome name="comments-o" size={60} color="#ccc" />
          <Text style={styles.emptyText}>No messages yet</Text>
          <Text style={styles.emptySubtext}>
            Connect with people around you to start chatting!
          </Text>
          <TouchableOpacity 
            style={styles.exploreButton}
            onPress={() => router.push('/map')}
          >
            <Text style={styles.exploreButtonText}>Explore Map</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
    backgroundColor: '#f8f8f8',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
    color: '#666',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 16,
    color: '#333',
  },
  listContainer: {
    paddingBottom: 20,
  },
  chatItem: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    padding: 12,
    borderRadius: 8,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 1,
    },
    shadowOpacity: 0.2,
    shadowRadius: 1.41,
    elevation: 2,
  },
  avatar: {
    marginRight: 12,
    justifyContent: 'center',
    width: 50,
    height: 50,
    borderRadius: 25,
    overflow: 'hidden',
  },
  avatarImage: {
    width: 50,
    height: 50,
    borderRadius: 25,
  },
  chatInfo: {
    flex: 1,
    justifyContent: 'center',
  },
  chatHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  chatFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  name: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
  },
  timestamp: {
    fontSize: 12,
    color: '#999',
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
    marginRight: 4,
  },
  statusIconSmall: {
    marginLeft: 2,
  },
  unreadBadge: {
    backgroundColor: '#007bff',
    borderRadius: 10,
    width: 20,
    height: 20,
    justifyContent: 'center',
    alignItems: 'center',
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
    paddingBottom: 100,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#666',
    marginTop: 12,
  },
  emptySubtext: {
    fontSize: 14,
    color: '#999',
    textAlign: 'center',
    marginTop: 8,
    marginHorizontal: 40,
  },
  exploreButton: {
    marginTop: 20,
    backgroundColor: '#007bff',
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
  },
  exploreButtonText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 16,
  },
});
