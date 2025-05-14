import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  StyleSheet, 
  View, 
  Text, 
  TextInput, 
  TouchableOpacity, 
  FlatList, 
  KeyboardAvoidingView, 
  Platform, 
  Image, 
  ActivityIndicator,
  Animated,
  Dimensions,
  SafeAreaView,
  Alert,
  Modal,
  TouchableWithoutFeedback
} from 'react-native';
import { Stack, useLocalSearchParams, router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import * as Clipboard from 'expo-clipboard';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import Ionicons from '@expo/vector-icons/Ionicons';
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
  setDoc,
  arrayUnion,
  arrayRemove
} from '@firebase/firestore';
import { db } from '@/config/firebase';
import { 
  MediaPicker, 
  MediaItem, 
  VoiceMessageRecorder, 
  VoiceMessage, 
  MessageReactionPicker, 
  Reaction, 
  MessageReactions, 
  MediaMessage, 
  UrlPreview, 
  extractUrls 
} from '@/components/chat';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const BUBBLE_MAX_WIDTH = SCREEN_WIDTH * 0.75;

// Message types
enum MessageType {
  TEXT = 'text',
  IMAGE = 'image',
  VIDEO = 'video',
  VOICE = 'voice',
  MEDIA = 'media', // Multiple media items
  SYSTEM = 'system'
}

// Message interface
interface Message {
  id: string;
  text?: string;
  createdAt: Date;
  userId: string;
  userName: string;
  system: boolean;
  type: MessageType;
  status?: {
    delivered: boolean;
    read: boolean;
    readAt: Date | null;
  };
  media?: MediaItem[];
  voiceUri?: string;
  voiceDuration?: number;
  reactions?: Reaction[];
  // For easier access in the component
  userReaction?: string | null;
}

export default function ChatRoomScreen() {
  const { user, userData } = useAuth();
  const { id: chatId, name } = useLocalSearchParams();
  const [loading, setLoading] = useState(true);
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [otherUser, setOtherUser] = useState(null);
  const [isTyping, setIsTyping] = useState(false);
  const [otherUserTyping, setOtherUserTyping] = useState(false);
  const [inputHeight, setInputHeight] = useState(50);
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  
  // Media picker state
  const [showMediaPicker, setShowMediaPicker] = useState(false);
  
  // Voice message state
  const [recordingVoice, setRecordingVoice] = useState(false);
  
  // Message reaction state
  const [showReactionPicker, setShowReactionPicker] = useState(false);
  const [selectedMessageForReaction, setSelectedMessageForReaction] = useState<string | null>(null);
  const [reactionPosition, setReactionPosition] = useState({ x: 0, y: 0 });
  
  // Input mode state (text, voice, etc.)
  const [inputMode, setInputMode] = useState<'text' | 'voice'>('text');
  
  // Context menu state
  const [showContextMenu, setShowContextMenu] = useState(false);
  const [selectedMessage, setSelectedMessage] = useState<Message | null>(null);
  const [contextMenuPosition, setContextMenuPosition] = useState({ x: 0, y: 0 });
  
  // Animation values
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const contentOffsetY = useRef(new Animated.Value(0)).current;
  
  // Reference to FlatList for scrolling
  const flatListRef = useRef<FlatList | null>(null);

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
        const messageList = snapshot.docs.map(doc => {
          const data = doc.data();
          
          // Check for user reaction
          let userReaction = null;
          if (data.reactions && Array.isArray(data.reactions)) {
            const userReactionObj = data.reactions.find(r => 
              r.users && r.users.includes(user.uid)
            );
            if (userReactionObj) {
              userReaction = userReactionObj.id;
            }
          }
          
          return {
            id: doc.id,
            ...data,
            type: data.type || MessageType.TEXT, // Default to text for older messages
            createdAt: data.createdAt?.toDate() || new Date(),
            userReaction,
          } as Message;
        });
        
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
        
        // Fade in animation
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 300,
          useNativeDriver: true,
        }).start();
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

  // Handle sending a new text message
  const handleSendTextMessage = async () => {
    if (!user?.uid || !chatId || !newMessage.trim()) return;
    
    try {
      // Get a reference to the messages collection for this chat room
      const messagesRef = collection(db, 'chatRooms', chatId.toString(), 'messages');
      
      // Extract URLs for preview
      const urls = extractUrls(newMessage.trim());
      
      // Add the new message with delivery status
      const messageDoc = await addDoc(messagesRef, {
        text: newMessage.trim(),
        createdAt: serverTimestamp(),
        userId: user.uid,
        userName: userData?.name || 'You',
        system: false,
        type: MessageType.TEXT,
        status: {
          delivered: false,
          read: false,
          readAt: null
        },
        urls: urls.length > 0 ? urls : null
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
      setInputHeight(50); // Reset input height
      
      // Scroll to bottom if needed
      if (flatListRef.current) {
        flatListRef.current.scrollToOffset({ animated: true, offset: 0 });
      }
    } catch (error) {
      console.error('Error sending message:', error);
      Alert.alert('Error', 'Error sending message. Please try again.');
    }
  };
  
  // Handle sending media messages
  const handleSendMediaMessage = async (mediaItems: MediaItem[]) => {
    if (!user?.uid || !chatId || mediaItems.length === 0) return;
    
    try {
      // Get a reference to the messages collection for this chat room
      const messagesRef = collection(db, 'chatRooms', chatId.toString(), 'messages');
      
      // Determine type based on media content
      const messageType = mediaItems.length === 1 
        ? (mediaItems[0].type === 'photo' ? MessageType.IMAGE : MessageType.VIDEO)
        : MessageType.MEDIA;
      
      // Add the new message
      const messageDoc = await addDoc(messagesRef, {
        createdAt: serverTimestamp(),
        userId: user.uid,
        userName: userData?.name || 'You',
        system: false,
        type: messageType,
        media: mediaItems,
        status: {
          delivered: false,
          read: false,
          readAt: null
        }
      });
      
      // Update the chat room with the last message info
      const chatRoomRef = doc(db, 'chatRooms', chatId.toString());
      
      // Create appropriate last message text based on media type
      let lastMessageText = '';
      if (messageType === MessageType.IMAGE) {
        lastMessageText = '📷 Photo';
      } else if (messageType === MessageType.VIDEO) {
        lastMessageText = '🎥 Video';
      } else {
        lastMessageText = `📷 ${mediaItems.length} Media items`;
      }
      
      await updateDoc(chatRoomRef, {
        lastMessage: {
          text: lastMessageText,
          userId: user.uid,
          userName: userData?.name || 'You',
          createdAt: serverTimestamp()
        },
        lastMessageText,
        lastMessageTimestamp: serverTimestamp()
      });
      
      // Scroll to bottom if needed
      if (flatListRef.current) {
        flatListRef.current.scrollToOffset({ animated: true, offset: 0 });
      }
    } catch (error) {
      console.error('Error sending media message:', error);
      Alert.alert('Error', 'Error sending media. Please try again.');
    }
  };
  
  // Handle sending a voice message
  const handleSendVoiceMessage = async (uri: string, duration: number) => {
    if (!user?.uid || !chatId || !uri) return;
    
    try {
      // Get a reference to the messages collection for this chat room
      const messagesRef = collection(db, 'chatRooms', chatId.toString(), 'messages');
      
      // Add the new message
      const messageDoc = await addDoc(messagesRef, {
        createdAt: serverTimestamp(),
        userId: user.uid,
        userName: userData?.name || 'You',
        system: false,
        type: MessageType.VOICE,
        voiceUri: uri,
        voiceDuration: duration,
        status: {
          delivered: false,
          read: false,
          readAt: null
        }
      });
      
      // Update the chat room with the last message info
      const chatRoomRef = doc(db, 'chatRooms', chatId.toString());
      await updateDoc(chatRoomRef, {
        lastMessage: {
          text: '🎤 Voice message',
          userId: user.uid,
          userName: userData?.name || 'You',
          createdAt: serverTimestamp()
        },
        lastMessageText: '🎤 Voice message',
        lastMessageTimestamp: serverTimestamp()
      });
      
      // Reset to text input mode
      setInputMode('text');
      
      // Scroll to bottom if needed
      if (flatListRef.current) {
        flatListRef.current.scrollToOffset({ animated: true, offset: 0 });
      }
    } catch (error) {
      console.error('Error sending voice message:', error);
      Alert.alert('Error', 'Error sending voice message. Please try again.');
    }
  };

  // Handle message reactions
  const handleReaction = async (messageId: string, reaction: Reaction) => {
    if (!user?.uid || !chatId) return;
    
    try {
      const messageRef = doc(db, 'chatRooms', chatId.toString(), 'messages', messageId);
      const messageDoc = await getDoc(messageRef);
      
      if (!messageDoc.exists()) {
        console.log(`Message ${messageId} does not exist`);
        return;
      }
      
      const messageData = messageDoc.data();
      const existingReactions = messageData.reactions || [];
      
      // Find if user already has a reaction on this message
      const existingUserReaction = existingReactions.find(r => 
        r.users && r.users.includes(user.uid)
      );
      
      if (existingUserReaction) {
        // If user is clicking the same reaction, remove it
        if (existingUserReaction.id === reaction.id) {
          // Remove user from this reaction's users array
          await updateDoc(messageRef, {
            reactions: existingReactions.map(r => {
              if (r.id === reaction.id) {
                return {
                  ...r,
                  users: arrayRemove(user.uid)
                };
              }
              return r;
            })
          });
        } else {
          // User is changing their reaction
          // Remove from old reaction
          await updateDoc(messageRef, {
            [`reactions.${existingReactions.findIndex(r => r.id === existingUserReaction.id)}.users`]: arrayRemove(user.uid)
          });
          
          // Add to new reaction
          const newReactionIndex = existingReactions.findIndex(r => r.id === reaction.id);
          if (newReactionIndex >= 0) {
            // Reaction type exists, add user to it
            await updateDoc(messageRef, {
              [`reactions.${newReactionIndex}.users`]: arrayUnion(user.uid)
            });
          } else {
            // Reaction type doesn't exist yet, create it
            await updateDoc(messageRef, {
              reactions: arrayUnion({
                id: reaction.id,
                emoji: reaction.emoji,
                label: reaction.label,
                users: [user.uid]
              })
            });
          }
        }
      } else {
        // User doesn't have a reaction yet, add one
        const existingReactionIndex = existingReactions.findIndex(r => r.id === reaction.id);
        
        if (existingReactionIndex >= 0) {
          // Reaction type exists, add user to it
          await updateDoc(messageRef, {
            [`reactions.${existingReactionIndex}.users`]: arrayUnion(user.uid)
          });
        } else {
          // Reaction type doesn't exist yet, create it
          await updateDoc(messageRef, {
            reactions: arrayUnion({
              id: reaction.id,
              emoji: reaction.emoji,
              label: reaction.label,
              users: [user.uid]
            })
          });
        }
      }
    } catch (error) {
      console.error('Error adding reaction:', error);
      Alert.alert('Error', 'Failed to add reaction. Please try again.');
    }
  };

  // Determine if we should show avatar and timestamp for this message
  const shouldShowAvatarAndTime = (currentMessage, previousMessage, nextMessage) => {
    // Always show for the first message in a group
    if (!nextMessage) return true;
    
    // If next message is from a different user, show avatar/time
    if (nextMessage.userId !== currentMessage.userId) return true;
    
    // If the time difference between messages is greater than 5 minutes, show
    const timeDiff = Math.abs(
      nextMessage.createdAt.getTime() - currentMessage.createdAt.getTime()
    );
    if (timeDiff > 5 * 60 * 1000) return true;
    
    return false;
  };

  // Handle long press on message to open the context menu
  const handleMessageLongPress = (message: Message, event: any) => {
    // Get the positions for the context menu
    const { pageX, pageY } = event.nativeEvent;
    
    setSelectedMessage(message);
    setContextMenuPosition({ x: pageX, y: pageY });
    setShowContextMenu(true);
  };
  
  // Handle copy message text
  const handleCopyText = async () => {
    if (!selectedMessage || !selectedMessage.text) return;
    
    try {
      await Clipboard.setStringAsync(selectedMessage.text);
      setShowContextMenu(false);
    } catch (error) {
      console.error('Error copying text:', error);
      Alert.alert('Error', 'Failed to copy text. Please try again.');
    }
  };
  
  // Handle adding a reaction to a message
  const handleAddReaction = () => {
    if (!selectedMessage) return;
    
    // Open reaction picker
    setSelectedMessageForReaction(selectedMessage.id);
    setReactionPosition(contextMenuPosition);
    setShowContextMenu(false);
    setShowReactionPicker(true);
  };

  const renderMessage = ({ item, index }) => {
    const isUser = item.userId === user?.uid;
    const isSystem = item.system;
    const previousMessage = messages[index + 1];
    const nextMessage = messages[index - 1];
    
    const showAvatarAndTime = !isUser && 
                              !isSystem && 
                              shouldShowAvatarAndTime(item, previousMessage, nextMessage);
    
    // Determine if this is the first message in a group (for styling)
    const isFirstInGroup = !previousMessage || previousMessage.userId !== item.userId;
    
    // Determine if this is the last message in a group (for styling)
    const isLastInGroup = !nextMessage || nextMessage.userId !== item.userId;
    
    // Format the timestamp
    const timestamp = item.createdAt ? 
      item.createdAt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '';
    
    // System message (like "User joined the conversation")
    if (isSystem) {
      return (
        <View style={styles.systemMessageContainer}>
          <Text style={styles.systemMessageText}>{item.text}</Text>
        </View>
      );
    }
    
    return (
      <TouchableWithoutFeedback 
        onLongPress={(event) => handleMessageLongPress(item, event)}
      >
        <View style={[
          styles.messageRow,
          isUser ? styles.userMessageRow : styles.otherMessageRow
        ]}>
          {/* Avatar (only show for other user's messages when needed) */}
          {!isUser && showAvatarAndTime ? (
            <View style={styles.avatarContainer}>
              {otherUser?.photoURL ? (
                <Image source={{ uri: otherUser.photoURL }} style={styles.avatar} />
              ) : (
                <View style={styles.defaultAvatar}>
                  <Text style={styles.defaultAvatarText}>
                    {(otherUser?.name || 'U').charAt(0).toUpperCase()}
                  </Text>
                </View>
              )}
            </View>
          ) : (
            // Empty space to align messages properly
            <View style={!isUser ? styles.avatarSpacer : null} />
          )}
          
          {/* Message bubble */}
          <View style={[
            styles.messageContainer,
            isUser ? styles.userMessage : styles.otherMessage,
            isFirstInGroup && (isUser ? styles.userFirstInGroup : styles.otherFirstInGroup),
            isLastInGroup && (isUser ? styles.userLastInGroup : styles.otherLastInGroup),
            !isFirstInGroup && !isLastInGroup && styles.messageInMiddle,
            !isUser && !showAvatarAndTime && styles.consecutiveMessage
          ]}>
            {/* Message content based on type */}
            {item.type === MessageType.TEXT && (
              <Text style={[
                styles.messageText,
                isUser && styles.userMessageText
              ]}>
                {item.text}
              </Text>
            )}
            
            {/* Display URL previews */}
            {item.type === MessageType.TEXT && item.urls && item.urls.length > 0 && (
              <UrlPreview url={item.urls[0]} isUserMessage={isUser} />
            )}
            
            {/* Display media content */}
            {(item.type === MessageType.IMAGE || 
              item.type === MessageType.VIDEO || 
              item.type === MessageType.MEDIA) && 
              item.media && (
                <MediaMessage 
                  media={item.media} 
                  isUserMessage={isUser} 
                />
            )}
            
            {/* Display voice message */}
            {item.type === MessageType.VOICE && item.voiceUri && (
              <VoiceMessage
                uri={item.voiceUri}
                duration={item.voiceDuration || 0}
                isUserMessage={isUser}
              />
            )}
            
            {/* Message reactions */}
            {item.reactions && item.reactions.length > 0 && (
              <MessageReactions
                reactions={item.reactions}
                onPress={(reactionId) => {
                  // Find the reaction object
                  const reactionObj = item.reactions.find(r => r.id === reactionId);
                  if (reactionObj) {
                    handleReaction(item.id, reactionObj);
                  }
                }}
                currentUserReaction={item.userReaction}
                isUserMessage={isUser}
              />
            )}
            
            {/* Time and delivery indicators (only show for last message in group) */}
            {isLastInGroup && (
              <View style={[
                styles.messageFooter,
                isUser ? styles.userMessageFooter : styles.otherMessageFooter
              ]}>
                <Text style={[
                  styles.timestampText,
                  isUser && styles.userTimestampText
                ]}>
                  {timestamp}
                </Text>
                
                {/* Delivery status (only for user's messages) */}
                {isUser && item.status && (
                  <View style={styles.statusContainer}>
                    {item.status.read ? (
                      <MaterialIcons name="done-all" size={14} color="#fff" />
                    ) : item.status.delivered ? (
                      <MaterialIcons name="done" size={14} color="rgba(255,255,255,0.8)" />
                    ) : (
                      <MaterialIcons name="access-time" size={12} color="rgba(255,255,255,0.5)" />
                    )}
                  </View>
                )}
              </View>
            )}
          </View>
        </View>
      </TouchableWithoutFeedback>
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
    // Fade out animation
    Animated.timing(fadeAnim, {
      toValue: 0,
      duration: 200,
      useNativeDriver: true,
    }).start(() => {
      if (Platform.OS === 'ios') {
        // For iOS, use standard back
        router.back();
      } else {
        // For Android, explicitly navigate to ensure proper cleanup
        router.push('/(tabs)/chat');
      }
    });
  }, []);
  
  // Calculate content container padding bottom based on input height
  const contentPaddingBottom = inputHeight + 16;

  // Header component for FlatList (actually appears at the bottom since list is inverted)
  const ListHeaderComponent = useCallback(() => (
    <View style={{ paddingVertical: 20 }}>
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
    </View>
  ), [otherUserTyping, otherUser]);
  
  // Render the context menu
  const renderContextMenu = () => {
    if (!showContextMenu || !selectedMessage) return null;
    
    return (
      <Modal
        transparent
        visible={showContextMenu}
        animationType="fade"
        onRequestClose={() => setShowContextMenu(false)}
      >
        <TouchableWithoutFeedback onPress={() => setShowContextMenu(false)}>
          <View style={styles.contextMenuOverlay}>
            <View 
              style={[
                styles.contextMenu,
                {
                  left: contextMenuPosition.x - 100, // Center the menu
                  top: contextMenuPosition.y - 60, // Position above the touch point
                }
              ]}
            >
              {selectedMessage.type === MessageType.TEXT && (
                <TouchableOpacity 
                  style={styles.contextMenuItem}
                  onPress={handleCopyText}
                >
                  <MaterialIcons name="content-copy" size={20} color="#333" />
                  <Text style={styles.contextMenuItemText}>Copy</Text>
                </TouchableOpacity>
              )}
              
              <TouchableOpacity 
                style={styles.contextMenuItem}
                onPress={handleAddReaction}
              >
                <MaterialIcons name="add-reaction" size={20} color="#333" />
                <Text style={styles.contextMenuItemText}>React</Text>
              </TouchableOpacity>
            </View>
          </View>
        </TouchableWithoutFeedback>
      </Modal>
    );
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar style="dark" />
      <Animated.View 
        style={[styles.container, { opacity: fadeAnim }]}
      >
        <Stack.Screen
          options={{
            headerShown: true,
            headerStyle: {
              backgroundColor: '#fff',
            },
            headerShadowVisible: false,
            headerTitle: () => (
              <View style={styles.headerTitleContainer}>
                {otherUser?.photoURL ? (
                  <Image 
                    source={{ uri: otherUser.photoURL }} 
                    style={styles.headerAvatar} 
                  />
                ) : (
                  <View style={styles.headerDefaultAvatar}>
                    <Text style={styles.headerDefaultAvatarText}>
                      {(name || '?').charAt(0).toUpperCase()}
                    </Text>
                  </View>
                )}
                <Text style={styles.headerTitle} numberOfLines={1}>
                  {name || 'Chat'}
                </Text>
              </View>
            ),
            headerLeft: () => (
              <TouchableOpacity onPress={handleGoBack} style={styles.headerButton}>
                <Ionicons name="arrow-back" size={24} color="#6C5CE7" />
              </TouchableOpacity>
            ),
            headerRight: () => (
              <TouchableOpacity style={styles.headerButton}>
                <Ionicons name="ellipsis-vertical" size={24} color="#6C5CE7" />
              </TouchableOpacity>
            ),
          }}
        />
        
        <KeyboardAvoidingView
          style={styles.keyboardAvoidingView}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
        >
          {loading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color="#6C5CE7" />
              <Text style={styles.loadingText}>Loading messages...</Text>
            </View>
          ) : (
            <View style={styles.chatContainer}>
              {/* Messages List */}
              <Animated.FlatList
                ref={flatListRef}
                data={messages}
                renderItem={renderMessage}
                keyExtractor={(item) => item.id}
                inverted={true} // Display most recent messages at the bottom
                contentContainerStyle={[
                  styles.messagesList,
                  { paddingBottom: contentPaddingBottom }
                ]}
                showsVerticalScrollIndicator={false}
                ListHeaderComponent={ListHeaderComponent}
                onScroll={Animated.event(
                  [{ nativeEvent: { contentOffset: { y: contentOffsetY } } }],
                  { useNativeDriver: true }
                )}
              />
              
              {/* Input Container */}
              {inputMode === 'text' ? (
                <View style={styles.inputContainer}>
                  <View style={styles.inputWrapper}>
                    <TouchableOpacity 
                      style={styles.attachButton}
                      onPress={() => setShowMediaPicker(true)}
                    >
                      <Ionicons name="add-circle-outline" size={24} color="#6C5CE7" />
                    </TouchableOpacity>
                    
                    <TextInput
                      style={[styles.input, { height: Math.max(40, inputHeight) }]}
                      value={newMessage}
                      onChangeText={handleTyping}
                      placeholder="Type a message..."
                      placeholderTextColor="#999"
                      multiline={true}
                      maxHeight={120}
                      onContentSizeChange={(e) => {
                        const height = e.nativeEvent.contentSize.height;
                        setInputHeight(Math.min(Math.max(40, height), 120));
                      }}
                    />
                    
                    <TouchableOpacity 
                      style={styles.emojiButton}
                      onPress={() => setInputMode('voice')}
                    >
                      <Ionicons name="mic-outline" size={24} color="#6C5CE7" />
                    </TouchableOpacity>
                  </View>
                  
                  <TouchableOpacity
                    style={[
                      styles.sendButton,
                      !newMessage.trim() && styles.sendButtonDisabled
                    ]}
                    onPress={handleSendTextMessage}
                    disabled={!newMessage.trim()}
                    activeOpacity={0.7}
                  >
                    <LinearGradient
                      colors={!newMessage.trim() ? ['#ccc', '#ccc'] : ['#6C5CE7', '#a29bfe']}
                      style={styles.sendButtonGradient}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 1 }}
                    >
                      <MaterialIcons name="send" size={20} color="#fff" />
                    </LinearGradient>
                  </TouchableOpacity>
                </View>
              ) : (
                <VoiceMessageRecorder
                  onSend={handleSendVoiceMessage}
                  onCancel={() => setInputMode('text')}
                />
              )}
            </View>
          )}
        </KeyboardAvoidingView>
        
        {/* Media Picker Modal */}
        {showMediaPicker && (
          <MediaPicker
            visible={showMediaPicker}
            onClose={() => setShowMediaPicker(false)}
            onMediaSelected={handleSendMediaMessage}
            maxSelections={10}
          />
        )}
        
        {/* Message Reaction Picker */}
        {showReactionPicker && selectedMessageForReaction && (
          <MessageReactionPicker
            visible={showReactionPicker}
            messageId={selectedMessageForReaction}
            position={reactionPosition}
            onClose={() => {
              setShowReactionPicker(false);
              setSelectedMessageForReaction(null);
            }}
            onReactionSelected={handleReaction}
            currentUserReaction={
              messages.find(m => m.id === selectedMessageForReaction)?.userReaction || null
            }
          />
        )}
        
        {/* Context Menu */}
        {renderContextMenu()}
      </Animated.View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#fff',
  },
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  keyboardAvoidingView: {
    flex: 1,
  },
  headerButton: {
    padding: 8,
  },
  headerTitleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    marginRight: 8,
  },
  headerDefaultAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#a29bfe',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 8,
  },
  headerDefaultAvatarText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#fff',
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: '600',
    color: '#333',
    maxWidth: SCREEN_WIDTH - 150, // Adjust based on header button widths
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#666',
  },
  chatContainer: {
    flex: 1,
    position: 'relative',
  },
  messagesList: {
    paddingHorizontal: 16,
    paddingTop: 10,
  },
  messageRow: {
    flexDirection: 'row',
    marginVertical: 2,
    alignItems: 'flex-end',
  },
  userMessageRow: {
    justifyContent: 'flex-end',
  },
  otherMessageRow: {
    justifyContent: 'flex-start',
  },
  avatarContainer: {
    width: 30,
    height: 30,
    borderRadius: 15,
    marginRight: 8,
    overflow: 'hidden',
  },
  avatarSpacer: {
    width: 38, // Avatar width + margin
  },
  avatar: {
    width: 30,
    height: 30,
    borderRadius: 15,
  },
  defaultAvatar: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: '#a29bfe',
    justifyContent: 'center',
    alignItems: 'center',
  },
  defaultAvatarText: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#fff',
  },
  messageContainer: {
    maxWidth: BUBBLE_MAX_WIDTH,
    padding: 12,
    borderRadius: 18,
    position: 'relative',
  },
  userMessage: {
    backgroundColor: '#6C5CE7',
  },
  otherMessage: {
    backgroundColor: '#f0f0f0',
  },
  userFirstInGroup: {
    borderTopRightRadius: 18,
  },
  userLastInGroup: {
    borderBottomRightRadius: 18,
  },
  otherFirstInGroup: {
    borderTopLeftRadius: 18,
  },
  otherLastInGroup: {
    borderBottomLeftRadius: 18,
  },
  messageInMiddle: {
    borderRadius: 18,
  },
  consecutiveMessage: {
    marginLeft: 38, // To align with the avatar
  },
  messageText: {
    fontSize: 16,
    color: '#333',
  },
  userMessageText: {
    color: '#fff',
  },
  messageFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
  },
  userMessageFooter: {
    justifyContent: 'flex-end',
  },
  otherMessageFooter: {
    justifyContent: 'flex-start',
  },
  timestampText: {
    fontSize: 11,
    color: 'rgba(0, 0, 0, 0.5)',
  },
  userTimestampText: {
    color: 'rgba(255, 255, 255, 0.7)',
  },
  statusContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginLeft: 4,
  },
  systemMessageContainer: {
    alignItems: 'center',
    marginVertical: 16,
  },
  systemMessageText: {
    fontSize: 13,
    color: '#888',
    backgroundColor: 'rgba(0, 0, 0, 0.05)',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  typingIndicatorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginLeft: 46, // Align with messages
    marginBottom: 8,
  },
  typingBubble: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f0f0f0',
    borderRadius: 12,
    padding: 8,
    width: 48,
    justifyContent: 'center',
  },
  typingDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#a29bfe',
    marginHorizontal: 2,
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
    padding: 8,
    paddingHorizontal: 16,
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
  },
  inputWrapper: {
    flex: 1,
    flexDirection: 'row',
    backgroundColor: '#f5f5f5',
    borderRadius: 24,
    paddingHorizontal: 8,
    marginRight: 8,
    alignItems: 'center',
  },
  attachButton: {
    padding: 8,
  },
  emojiButton: {
    padding: 8,
  },
  input: {
    flex: 1,
    fontSize: 16,
    paddingVertical: 8,
    color: '#333',
    maxHeight: 120,
  },
  sendButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
  },
  sendButtonGradient: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  sendButtonDisabled: {
    opacity: 0.7,
  },
  contextMenuOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
  },
  contextMenu: {
    position: 'absolute',
    width: 200,
    backgroundColor: '#fff',
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
    padding: 10,
  },
  contextMenuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
  },
  contextMenuItemText: {
    fontSize: 16,
    color: '#333',
    marginLeft: 12,
  },
});
