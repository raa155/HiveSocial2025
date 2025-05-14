import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
} from 'react-native';
import { Reaction } from './MessageReactionPicker';

interface MessageReactionsProps {
  reactions: Reaction[];
  onPress?: (reactionId: string) => void;
  currentUserReaction?: string | null;
  isUserMessage?: boolean;
}

const MessageReactions: React.FC<MessageReactionsProps> = ({
  reactions,
  onPress,
  currentUserReaction = null,
  isUserMessage = false,
}) => {
  if (!reactions || reactions.length === 0) return null;

  // Group the reactions by type
  const groupedReactions = reactions.reduce<Record<string, Reaction>>(
    (acc, reaction) => {
      const { id, emoji } = reaction;
      
      if (!acc[id]) {
        acc[id] = {
          id,
          emoji,
          label: reaction.label,
          count: 0,
          users: [],
        };
      }
      
      // Increment the count and add the user ID
      acc[id].count = (acc[id].count || 0) + 1;
      if (reaction.users) {
        acc[id].users = [...(acc[id].users || []), ...reaction.users];
      }
      
      return acc;
    },
    {}
  );

  // Convert the grouped reactions back to an array
  const reactionList = Object.values(groupedReactions);

  return (
    <View style={[
      styles.container,
      isUserMessage ? styles.userContainer : styles.otherContainer
    ]}>
      {reactionList.map((reaction) => {
        const isSelected = currentUserReaction === reaction.id;
        
        return (
          <TouchableOpacity
            key={reaction.id}
            style={[
              styles.reactionBadge,
              isUserMessage ? styles.userReactionBadge : styles.otherReactionBadge,
              isSelected && (isUserMessage ? styles.userSelectedBadge : styles.otherSelectedBadge),
            ]}
            onPress={() => onPress && onPress(reaction.id)}
            activeOpacity={0.7}
          >
            <Text style={styles.reactionEmoji}>{reaction.emoji}</Text>
            {(reaction.count && reaction.count > 1) && (
              <Text style={[
                styles.reactionCount,
                isUserMessage ? styles.userReactionCount : styles.otherReactionCount,
                isSelected && (isUserMessage ? styles.userSelectedCount : styles.otherSelectedCount),
              ]}>
                {reaction.count}
              </Text>
            )}
          </TouchableOpacity>
        );
      })}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: 4,
  },
  userContainer: {
    justifyContent: 'flex-end',
  },
  otherContainer: {
    justifyContent: 'flex-start',
  },
  reactionBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 6,
    paddingVertical: 4,
    borderRadius: 12,
    marginRight: 4,
    marginBottom: 4,
  },
  userReactionBadge: {
    backgroundColor: 'rgba(108, 92, 231, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(108, 92, 231, 0.2)',
  },
  otherReactionBadge: {
    backgroundColor: 'rgba(0, 0, 0, 0.05)',
    borderWidth: 1,
    borderColor: 'rgba(0, 0, 0, 0.1)',
  },
  userSelectedBadge: {
    backgroundColor: 'rgba(108, 92, 231, 0.2)',
    borderColor: 'rgba(108, 92, 231, 0.4)',
  },
  otherSelectedBadge: {
    backgroundColor: 'rgba(0, 0, 0, 0.1)',
    borderColor: 'rgba(0, 0, 0, 0.2)',
  },
  reactionEmoji: {
    fontSize: 14,
  },
  reactionCount: {
    fontSize: 12,
    marginLeft: 2,
  },
  userReactionCount: {
    color: 'rgba(108, 92, 231, 0.8)',
  },
  otherReactionCount: {
    color: 'rgba(0, 0, 0, 0.5)',
  },
  userSelectedCount: {
    color: 'rgba(108, 92, 231, 1)',
  },
  otherSelectedCount: {
    color: 'rgba(0, 0, 0, 0.7)',
  },
});

export default MessageReactions;
