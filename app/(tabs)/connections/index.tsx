import React, { useState } from 'react';
import { 
  StyleSheet, 
  View, 
  Text, 
  FlatList, 
  TouchableOpacity, 
  ActivityIndicator,
  Alert 
} from 'react-native';
import { router } from 'expo-router';
import FontAwesome from '@expo/vector-icons/FontAwesome';
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
  Timestamp,
  addDoc,
  serverTimestamp
} from '@firebase/firestore';
import { db } from '@/config/firebase';
import { useEffect } from 'react';

export default function ConnectionsScreen() {
  const { user, userData } = useAuth();
  const [loading, setLoading] = useState(true);
  const [pendingConnections, setPendingConnections] = useState([]);
  const [connections, setConnections] = useState([]);

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
    
    try {
      setLoading(true);
      
      // Delete the connection request
      await deleteDoc(doc(db, 'connectionRequests', connectionId));
      
      console.log('Connection request declined');
      Alert.alert('Success', 'Connection request declined');
      
    } catch (error) {
      console.error('Error declining connection:', error);
      Alert.alert('Error', 'Failed to decline connection request');
    } finally {
      setLoading(false);
    }
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

  // Render a connection request
  const renderConnectionRequest = ({ item }) => (
    <View style={styles.connectionItem}>
      <View style={styles.connectionHeader}>
        <Text style={styles.name}>{item.senderName}</Text>
        <Text style={styles.timestamp}>
          {new Date(item.timestamp).toLocaleDateString()}
        </Text>
      </View>

      <View style={styles.tierContainer}>
        <Text style={styles.tier}>
          Tier: {getTierDisplayName(item.tier)}
        </Text>
      </View>

      {item.sharedInterests && item.sharedInterests.length > 0 && (
        <View style={styles.interestsContainer}>
          <Text style={styles.interestsLabel}>Shared Interests:</Text>
          <Text style={styles.interests}>{item.sharedInterests.join(', ')}</Text>
        </View>
      )}

      <View style={styles.actionButtons}>
        <TouchableOpacity
          style={[styles.actionButton, styles.acceptButton]}
          onPress={() => handleAcceptConnection(item)}
        >
          <Text style={styles.actionButtonText}>Accept</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.actionButton, styles.declineButton]}
          onPress={() => handleDeclineConnection(item.id)}
        >
          <Text style={styles.actionButtonText}>Decline</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  // Render an active connection
  const renderConnection = ({ item }) => (
    <TouchableOpacity 
      style={styles.connectionItem}
      onPress={() => handleViewChat(item)}
    >
      <View style={styles.connectionHeader}>
        <Text style={styles.name}>{item.otherUserName}</Text>
        <View style={styles.tierBadge}>
          <Text style={styles.tierBadgeText}>{getTierDisplayName(item.tier)}</Text>
        </View>
      </View>

      {item.sharedInterests && item.sharedInterests.length > 0 && (
        <View style={styles.interestsContainer}>
          <Text style={styles.interestsLabel}>Shared Interests:</Text>
          <Text style={styles.interests}>
            {item.sharedInterests.length > 3
              ? `${item.sharedInterests.slice(0, 3).join(', ')} +${item.sharedInterests.length - 3} more`
              : item.sharedInterests.join(', ')}
          </Text>
        </View>
      )}

      <View style={styles.chatButton}>
        <FontAwesome name="comments" size={14} color="#fff" />
        <Text style={styles.chatButtonText}>Chat</Text>
      </View>
    </TouchableOpacity>
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

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#007bff" />
        <Text style={styles.loadingText}>Loading connections...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Pending Connection Requests Section */}
      {pendingConnections.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Connection Requests</Text>
          <FlatList
            data={pendingConnections}
            renderItem={renderConnectionRequest}
            keyExtractor={(item) => item.id}
            contentContainerStyle={styles.listContainer}
            scrollEnabled={false}
          />
        </View>
      )}

      {/* Active Connections Section */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Your Connections</Text>
        {connections.length > 0 ? (
          <FlatList
            data={connections}
            renderItem={renderConnection}
            keyExtractor={(item) => item.id}
            contentContainerStyle={styles.listContainer}
          />
        ) : (
          <View style={styles.emptyContainer}>
            <FontAwesome name="users" size={60} color="#ccc" />
            <Text style={styles.emptyText}>
              You don't have any connections yet. Explore the map to find people nearby!
            </Text>
          </View>
        )}
      </View>
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
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    marginBottom: 16,
    color: '#333',
  },
  listContainer: {
    paddingBottom: 20,
  },
  connectionItem: {
    backgroundColor: '#fff',
    padding: 16,
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
  connectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  name: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    flex: 1,
  },
  timestamp: {
    fontSize: 12,
    color: '#999',
  },
  tierContainer: {
    marginBottom: 8,
  },
  tier: {
    fontSize: 14,
    color: '#666',
    fontStyle: 'italic',
  },
  tierBadge: {
    backgroundColor: '#007bff',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  tierBadgeText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: 'bold',
  },
  interestsContainer: {
    marginTop: 4,
    marginBottom: 12,
  },
  interestsLabel: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 4,
  },
  interests: {
    fontSize: 14,
    color: '#666',
  },
  actionButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 8,
  },
  actionButton: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 6,
    alignItems: 'center',
    marginHorizontal: 4,
  },
  acceptButton: {
    backgroundColor: '#28a745',
  },
  declineButton: {
    backgroundColor: '#dc3545',
  },
  actionButtonText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 14,
  },
  chatButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#007bff',
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 6,
    alignSelf: 'flex-end',
    marginTop: 8,
  },
  chatButtonText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 14,
    marginLeft: 8,
  },
  emptyContainer: {
    padding: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyText: {
    fontSize: 16,
    color: '#999',
    textAlign: 'center',
    marginTop: 16,
    lineHeight: 24,
  },
});
