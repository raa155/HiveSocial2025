import React, { useState, useEffect, useCallback, useRef } from 'react';
import { StyleSheet, View, Text, TextInput, TouchableOpacity, FlatList, KeyboardAvoidingView, Platform, Image, ActivityIndicator } from 'react-native';
import { Stack, useLocalSearchParams, router } from 'expo-router';
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
  getDoc, 
  addDoc,
  updateDoc,
  serverTimestamp,
  setDoc
} from '@firebase/firestore';
import { db } from '@/config/firebase';

export default function ChatRoomScreen() {
  const { user, userData } = useAuth();
  const { id: chatId, name } = useLocalSearchParams();
  const [loading, setLoading] = useState(true);
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [otherUser, setOtherUser] = useState(null);
  const [isTyping, setIsTyping] = useState(false);
  const [otherUserTyping, setOtherUserTyping] = useState(false);
  const typingTimeoutRef = useRef(null);

  // Load chat messages
  useEffect(() => {
    if (!user?.uid || !chatId) return;

    let unsubscribe = null;
    
    try {
      console.log(`Loading chat ${chatId}...`);
      
      // Get the chat room data
      const chatRoomRef = doc(db, 'chatRooms', chatId.toString());
      
      // Get a reference to the messages collection for this chat room
      const messagesRef = collection(db, 'chatRooms', chatId.toString(), 'messages');
      
      // Order messages by timestamp
      const messagesQuery = query(
        messagesRef,
        orderBy('createdAt', 'desc')
      );
      
      // Set up a listener for messages
      unsubscribe = onSnapshot(messagesQuery, (snapshot) => {
        const messageList = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data(),
          createdAt: doc.data().createdAt?.toDate() || new Date()
        }));
        
        // Mark messages as delivered when seen by recipient
        snapshot.docs.forEach(async (doc) => {
          const messageData = doc.data();
          
          // Check if this message is from the other user and needs delivery status update
          if (messageData.userId !== user.uid && 
              messageData.status && 
              !messageData.status.delivered) {
            
            await updateDoc(doc.ref, {
              'status.delivered': true
            });
          }
          
          // Check if this message is from the other user and needs read status update
          if (messageData.userId !== user.uid && 
              messageData.status && 
              !messageData.status.read) {
            
            await updateDoc(doc.ref, {
              'status.read': true,
              'status.readAt': serverTimestamp()
            });
          }
        });
        
        setMessages(messageList);
        setLoading(false);
      }, error => {
        console.error('Error fetching messages:', error);
        setLoading(false);
      });
      
      // Also get the chat room to find the other user
      getDoc(chatRoomRef).then(async (chatRoomDoc) => {
        if (!chatRoomDoc.exists()) {
          console.log(`Chat room ${chatId} does not exist`);
          return;
        }
        
        const chatRoomData = chatRoomDoc.data();
        
        // Find the other user ID (not current user)
        const otherUserId = chatRoomData.participants.find(id => id !== user.uid);
        
        if (!otherUserId) {
          console.log('Could not find other user in chat room');
          return;
        }
        
        // Get other user's data
        const otherUserDoc = await getDoc(doc(db, 'users', otherUserId));
        
        if (otherUserDoc.exists()) {
          setOtherUser({
            id: otherUserId,
            ...otherUserDoc.data()
          });
        }
      }).catch(error => {
        console.error('Error getting chat room data:', error);
      });
      
    } catch (error) {
      console.error('Error setting up chat listener:', error);
      setLoading(false);
    }
    
    // Return cleanup function
    return () => {
      if (unsubscribe) {
        console.log(`Cleaning up chat listener for ${chatId}`);
        unsubscribe();
      }
    };
  }, [user?.uid, chatId]);

  // Handle sending a new message
  const handleSendMessage = async () => {
    if (!user?.uid || !chatId || !newMessage.trim()) return;
    
    try {
      // Get a reference to the messages collection for this chat room
      const messagesRef = collection(db, 'chatRooms', chatId.toString(), 'messages');
      
      // Add the new message with delivery status
      const messageDoc = await addDoc(messagesRef, {
        text: newMessage.trim(),
        createdAt: serverTimestamp(),
        userId: user.uid,
        userName: userData?.name || 'You',
        system: false,
        status: {
          delivered: false,
          read: false,
          readAt: null
        }
      });
      
      // Update the chat room with the last message
      const chatRoomRef = doc(db, 'chatRooms', chatId.toString());
      await updateDoc(chatRoomRef, {
        lastMessage: {
          text: newMessage.trim(),
          userId: user.uid,
          userName: userData?.name || 'You',
          createdAt: serverTimestamp()
        },
        lastMessageText: newMessage.trim(),
        lastMessageTimestamp: serverTimestamp()
      });
      
      // Clear the input
      setNewMessage('');
    } catch (error) {
      console.error('Error sending message:', error);
      alert('Error sending message. Please try again.');
    }
  };

  const renderMessage = ({ item, index }) => {
    const isUser = item.userId === user?.uid;
    const isSystem = item.system;
    const showAvatar = !isUser && !isSystem && (!messages[index + 1] || messages[index + 1].userId !== item.userId);
    
    // Format the timestamp
    const timestamp = item.createdAt ? 
      item.createdAt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '';
    
    if (isSystem) {
      return (
        <View style={styles.systemMessageContainer}>
          <Text style={styles.systemMessageText}>{item.text}</Text>
        </View>
      );
    }
    
    return (
      <View style={[
        styles.messageRow,
        isUser ? styles.userMessageRow : styles.otherMessageRow
      ]}>
        {!isUser && showAvatar && (
          <View style={styles.avatarContainer}>
            {otherUser?.photoURL ? (
              <Image source={{ uri: otherUser.photoURL }} style={styles.avatar} />
            ) : (
              <View style={styles.defaultAvatar}>
                <Text style={styles.defaultAvatarText}>
                  {(otherUser?.name || 'U').charAt(0)}
                </Text>
              </View>
            )}
          </View>
        )}
        
        <View 
          style={[
            styles.messageContainer,
            isUser ? styles.userMessage : styles.otherMessage,
            !isUser && !showAvatar && styles.consecutiveMessage
          ]}
        >
          <Text style={[
            styles.messageText,
            isUser && { color: '#fff' }
          ]}>
            {item.text}
          </Text>
          <View style={[
            styles.messageFooter,
            isUser && { justifyContent: 'flex-end' }
          ]}>
            <Text style={[
              styles.timestampText,
              isUser && { color: 'rgba(255, 255, 255, 0.7)' }
            ]}>
              {timestamp}
            </Text>
            
            {/* Message status indicators (for user's messages only) */}
            {isUser && item.status && (
              <View style={styles.statusContainer}>
                {item.status.read ? (
                  <View style={styles.readStatusContainer}>
                    <FontAwesome name="check-circle" size={12} color="#4caf50" style={styles.statusIcon} />
                    {item.status.readAt && (
                      <Text style={styles.readAtText}>
                        {new Date(item.status.readAt.toDate()).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </Text>
                    )}
                  </View>
                ) : item.status.delivered ? (
                  <FontAwesome name="check" size={12} color="#2196f3" style={styles.statusIcon} />
                ) : (
                  <FontAwesome name="clock-o" size={12} color="#bdbdbd" style={styles.statusIcon} />
                )}
              </View>
            )}
          </View>
        </View>
      </View>
    );
  };

  // Handle typing indicator
  const handleTyping = (text) => {
    setNewMessage(text);
    
    // If the user is typing and we haven't set the typing indicator yet
    if (text.length > 0 && !isTyping && user?.uid && chatId) {
      setIsTyping(true);
      
      // Update typing status in Firebase
      const typingRef = doc(db, 'chatRooms', chatId.toString(), 'typing', user.uid);
      setDoc(typingRef, {
        isTyping: true,
        timestamp: serverTimestamp(),
        userId: user.uid,
        userName: userData?.name || 'You'
      });
    }
    
    // Clear previous timeout
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }
    
    // Set timeout to stop typing after 2 seconds of inactivity
    typingTimeoutRef.current = setTimeout(() => {
      if (isTyping && user?.uid && chatId) {
        setIsTyping(false);
        
        // Update typing status in Firebase
        const typingRef = doc(db, 'chatRooms', chatId.toString(), 'typing', user.uid);
        setDoc(typingRef, {
          isTyping: false,
          timestamp: serverTimestamp(),
          userId: user.uid,
          userName: userData?.name || 'You'
        });
      }
    }, 2000);
  };
  
  // Listen for other user typing status
  useEffect(() => {
    if (!user?.uid || !chatId || !otherUser) return;
    
    const typingRef = doc(db, 'chatRooms', chatId.toString(), 'typing', otherUser.id);
    
    const unsubscribe = onSnapshot(typingRef, (snapshot) => {
      if (snapshot.exists()) {
        const typingData = snapshot.data();
        setOtherUserTyping(typingData.isTyping);
      }
    });
    
    return () => unsubscribe();
  }, [user?.uid, chatId, otherUser]);

  // Handle going back to the chat list
  const handleGoBack = useCallback(() => {
    if (Platform.OS === 'ios') {
      // For iOS, use standard back
      router.back();
    } else {
      // For Android, explicitly navigate to ensure proper cleanup
      router.push('/(tabs)/chat');
    }
  }, []);

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : null}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
    >
      <Stack.Screen
        options={{
          title: name || 'Chat',
          headerLeft: () => (
            <TouchableOpacity onPress={handleGoBack} style={styles.headerButton}>
              <FontAwesome name="arrow-left" size={20} color="#007bff" />
            </TouchableOpacity>
          ),
        }}
      />
      
      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#007bff" />
          <Text style={styles.loadingText}>Loading messages...</Text>
        </View>
      ) : (
        <>
          <FlatList
            data={messages}
            renderItem={renderMessage}
            keyExtractor={(item) => item.id}
            inverted={true} // Display most recent messages at the bottom
            contentContainerStyle={styles.messagesList}
          />
          
          {otherUserTyping && (
            <View style={styles.typingIndicatorContainer}>
              <View style={styles.typingBubble}>
                <View style={styles.typingDot} />
                <View style={[styles.typingDot, styles.typingDotMiddle]} />
                <View style={styles.typingDot} />
              </View>
              <Text style={styles.typingText}>
                {otherUser?.name || 'User'} is typing...
              </Text>
            </View>
          )}
          
          <View style={styles.inputContainer}>
            <TextInput
              style={styles.input}
              value={newMessage}
              onChangeText={handleTyping}
              placeholder="Type a message..."
              multiline={true}
              maxHeight={100}
            />
            <TouchableOpacity
              style={[
                styles.sendButton,
                !newMessage.trim() && styles.sendButtonDisabled
              ]}
              onPress={handleSendMessage}
              disabled={!newMessage.trim()}
            >
              <FontAwesome name="send" size={20} color="#fff" />
            </TouchableOpacity>
          </View>
        </>
      )}
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f8f8',
  },
  headerButton: {
    padding: 10,
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
  messagesList: {
    padding: 16,
  },
  messageRow: {
    flexDirection: 'row',
    marginBottom: 12,
    alignItems: 'flex-end',
  },
  userMessageRow: {
    justifyContent: 'flex-end',
  },
  otherMessageRow: {
    justifyContent: 'flex-start',
  },
  avatarContainer: {
    width: 36,
    height: 36,
    borderRadius: 18,
    marginRight: 8,
    overflow: 'hidden',
  },
  avatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
  },
  defaultAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#ccc',
    justifyContent: 'center',
    alignItems: 'center',
  },
  defaultAvatarText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#fff',
  },
  messageContainer: {
    maxWidth: '75%',
    padding: 12,
    borderRadius: 16,
    position: 'relative',
  },
  userMessage: {
    backgroundColor: '#007bff',
    borderBottomRightRadius: 4,
  },
  otherMessage: {
    backgroundColor: '#f0f0f0',
    borderBottomLeftRadius: 4,
  },
  consecutiveMessage: {
    marginLeft: 44, // To align with the avatar
  },
  messageText: {
    fontSize: 16,
    color: '#333',
    marginBottom: 4,
  },
  messageFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 2,
  },
  timestampText: {
    fontSize: 10,
    color: 'rgba(0, 0, 0, 0.5)',
  },
  statusContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginLeft: 4,
  },
  statusIcon: {
    marginLeft: 4,
  },
  readStatusContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  readAtText: {
    fontSize: 9,
    color: 'rgba(255, 255, 255, 0.7)',
    marginLeft: 2,
  },
  systemMessageContainer: {
    alignItems: 'center',
    marginVertical: 12,
  },
  systemMessageText: {
    fontSize: 12,
    color: '#999',
    backgroundColor: 'rgba(0, 0, 0, 0.05)',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  typingIndicatorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 8,
    paddingLeft: 16,
  },
  typingBubble: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f0f0f0',
    borderRadius: 10,
    padding: 6,
    width: 40,
    justifyContent: 'center',
  },
  typingDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#999',
    marginHorizontal: 1,
    opacity: 0.6,
  },
  typingDotMiddle: {
    opacity: 0.8,
    transform: [{ translateY: -2 }],
  },
  typingText: {
    fontSize: 12,
    color: '#666',
    marginLeft: 8,
    fontStyle: 'italic',
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: '#eee',
  },
  input: {
    flex: 1,
    backgroundColor: '#f0f0f0',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 10,
    marginRight: 10,
    fontSize: 16,
    maxHeight: 120,
  },
  sendButton: {
    backgroundColor: '#007bff',
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
  },
  sendButtonDisabled: {
    backgroundColor: '#ccc',
  },
});
