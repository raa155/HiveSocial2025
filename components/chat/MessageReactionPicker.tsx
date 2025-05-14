import React, { useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  TouchableWithoutFeedback,
  Animated,
  Dimensions,
  Platform,
} from 'react-native';
import { BlurView } from 'expo-blur';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

// Available reactions
export const REACTIONS = [
  { id: 'like', emoji: '👍', label: 'Like' },
  { id: 'love', emoji: '❤️', label: 'Love' },
  { id: 'laugh', emoji: '😂', label: 'Laugh' },
  { id: 'wow', emoji: '😮', label: 'Wow' },
  { id: 'sad', emoji: '😢', label: 'Sad' },
  { id: 'angry', emoji: '😠', label: 'Angry' },
];

// Reaction object type
export interface Reaction {
  id: string;
  emoji: string;
  label: string;
  count?: number;
  users?: string[]; // Array of user IDs who reacted
}

interface MessageReactionPickerProps {
  visible: boolean;
  messageId: string;
  position: { x: number; y: number };
  onClose: () => void;
  onReactionSelected: (messageId: string, reaction: Reaction) => void;
  existingReactions?: Reaction[]; // Reactions that already exist on the message
  currentUserReaction?: string | null; // The ID of the current user's reaction, if any
}

const MessageReactionPicker: React.FC<MessageReactionPickerProps> = ({
  visible,
  messageId,
  position,
  onClose,
  onReactionSelected,
  existingReactions = [],
  currentUserReaction = null,
}) => {
  // Animation values
  const scaleAnim = useRef(new Animated.Value(0.5)).current;
  const opacityAnim = useRef(new Animated.Value(0)).current;

  // Start animation when component mounts
  useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.spring(scaleAnim, {
          toValue: 1,
          friction: 7,
          tension: 40,
          useNativeDriver: true,
        }),
        Animated.timing(opacityAnim, {
          toValue: 1,
          duration: 200,
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      // Reset animations
      scaleAnim.setValue(0.5);
      opacityAnim.setValue(0);
    }
  }, [visible]);

  // Calculate the modal position
  const getModalPosition = () => {
    // Ensure the reaction picker stays within screen bounds
    let x = position.x;
    let y = position.y;

    // Width of the reaction picker container
    const reactionPickerWidth = 300;
    const reactionPickerHeight = 54;

    // Adjust x position if it would go off the right edge
    if (x + reactionPickerWidth > SCREEN_WIDTH) {
      x = SCREEN_WIDTH - reactionPickerWidth - 20;
    }

    // Adjust x position if it would go off the left edge
    if (x < 20) {
      x = 20;
    }

    return {
      left: x,
      top: y - reactionPickerHeight - 10, // Position above the message
    };
  };

  // Handle reaction selection
  const handleReactionSelect = (reaction: Reaction) => {
    onReactionSelected(messageId, reaction);
    onClose();
  };

  // Determine if the user has already selected this reaction
  const isReactionSelected = (reactionId: string) => {
    return currentUserReaction === reactionId;
  };

  if (!visible) return null;

  return (
    <Modal transparent animationType="none" visible={visible} onRequestClose={onClose}>
      <TouchableWithoutFeedback onPress={onClose}>
        <View style={styles.modalOverlay}>
          <Animated.View
            style={[
              styles.pickerContainer,
              getModalPosition(),
              {
                transform: [{ scale: scaleAnim }],
                opacity: opacityAnim,
              },
            ]}
          >
            <BlurView intensity={Platform.OS === 'ios' ? 30 : 80} style={styles.blurContainer}>
              <View style={styles.reactionsContainer}>
                {REACTIONS.map((reaction) => {
                  const isSelected = isReactionSelected(reaction.id);
                  return (
                    <TouchableOpacity
                      key={reaction.id}
                      style={[styles.reactionButton, isSelected && styles.reactionButtonSelected]}
                      onPress={() => handleReactionSelect(reaction)}
                      activeOpacity={0.7}
                    >
                      <Text style={styles.reactionEmoji}>{reaction.emoji}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </BlurView>
          </Animated.View>
        </View>
      </TouchableWithoutFeedback>
    </Modal>
  );
};

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  pickerContainer: {
    position: 'absolute',
    borderRadius: 28,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  blurContainer: {
    borderRadius: 28,
    overflow: 'hidden',
  },
  reactionsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: 'rgba(255, 255, 255, 0.6)',
    paddingHorizontal: 8,
    paddingVertical: 6,
  },
  reactionButton: {
    width: 42,
    height: 42,
    borderRadius: 21,
    justifyContent: 'center',
    alignItems: 'center',
    marginHorizontal: 2,
  },
  reactionButtonSelected: {
    backgroundColor: 'rgba(108, 92, 231, 0.2)',
    transform: [{ scale: 1.1 }],
  },
  reactionEmoji: {
    fontSize: 24,
  },
});

export default MessageReactionPicker;
export type { Reaction };
