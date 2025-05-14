import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Animated,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { createAudioPlayer } from 'expo-audio';
import * as FileSystem from 'expo-file-system';
import Ionicons from '@expo/vector-icons/Ionicons';
import FontAwesome from '@expo/vector-icons/FontAwesome';

interface VoiceMessageProps {
  uri: string;
  duration: number; // in seconds
  isUserMessage?: boolean;
}

const VoiceMessage: React.FC<VoiceMessageProps> = ({
  uri,
  duration,
  isUserMessage = false,
}) => {
  // State
  const [audioPlayer, setAudioPlayer] = useState(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [playbackPosition, setPlaybackPosition] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [actualDuration, setActualDuration] = useState(duration > 0 ? duration : 1);
  const [localUri, setLocalUri] = useState<string | null>(null);
  
  // Timer ref for tracking playback position
  const playbackTimer = useRef<NodeJS.Timeout | null>(null);
  
  // Animation value for progress bar
  const progressAnim = useState(new Animated.Value(0))[0];
  const progressWidth = progressAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0%', '100%'],
  });

  // Debug log the duration prop and URI
  useEffect(() => {
    console.log('VoiceMessage received duration:', duration);
    console.log('VoiceMessage received URI:', uri);
    
    // Ensure duration is valid, use a default if not
    if (duration && duration > 0) {
      setActualDuration(duration);
    } else {
      console.warn('Invalid duration received:', duration);
      // Keep previous duration or use 1 second as default
      setActualDuration(prev => prev > 0 ? prev : 1);
    }
    
    // Handle the URI - we'll need to copy it to a local file for better compatibility
    if (uri) {
      prepareAudioFile(uri);
    }
  }, [uri, duration]);
  
  // Function to copy audio file to app's cache directory for better playback compatibility
  const prepareAudioFile = async (originalUri: string) => {
    try {
      setIsLoading(true);
      
      // Check if file exists at the given URI
      const fileInfo = await FileSystem.getInfoAsync(originalUri);
      console.log('File info:', fileInfo);
      
      if (fileInfo.exists) {
        // File exists at the original URI
        
        // Create a copy in the cache directory to ensure it remains accessible
        const fileName = originalUri.split('/').pop();
        const destinationUri = `${FileSystem.cacheDirectory}voice_message_${Date.now()}_${fileName}`;
        
        console.log('Copying file to:', destinationUri);
        await FileSystem.copyAsync({
          from: originalUri,
          to: destinationUri
        });
        
        // Set the local URI to the copied file
        setLocalUri(destinationUri);
        console.log('File copied successfully to:', destinationUri);
      } else {
        console.error('File does not exist at URI:', originalUri);
        Alert.alert('Error', 'Voice message file not found');
        setLocalUri(null);
      }
      
      setIsLoading(false);
    } catch (error) {
      console.error('Error preparing audio file:', error);
      setIsLoading(false);
      // Fallback to the original URI
      setLocalUri(originalUri);
    }
  };
  
  // Initialize audio player
  useEffect(() => {
    if (!localUri) {
      return;
    }
    
    console.log('VoiceMessage initializing player with URI:', localUri);
    
    const initPlayer = async () => {
      try {
        setIsLoading(true);
        
        // Release any existing player
        if (audioPlayer) {
          try {
            audioPlayer.release();
          } catch (e) {
            console.error("Error releasing previous player:", e);
          }
        }
        
        // Create a new player with the local URI
        const player = createAudioPlayer({ uri: localUri });
        setAudioPlayer(player);
        
        // Allow some time for the player to initialize
        setTimeout(() => {
          if (player && player.status && player.status.isLoaded) {
            // If available, update with actual duration from the audio file
            if (player.status.durationMillis > 0) {
              const durationFromFile = player.status.durationMillis / 1000;
              console.log('Duration from file:', durationFromFile);
              if (durationFromFile > 0) {
                setActualDuration(durationFromFile);
              }
            } else {
              console.log('No duration available from player, using provided duration:', duration);
            }
          } else {
            console.log('Player not fully loaded after initialization');
          }
          setIsLoading(false);
        }, 500);
      } catch (error) {
        console.error('Error initializing audio player:', error);
        setIsLoading(false);
      }
    };
    
    initPlayer();
    
    // Clean up on unmount or when URI changes
    return () => {
      if (playbackTimer.current) {
        clearInterval(playbackTimer.current);
      }
      
      if (audioPlayer) {
        try {
          audioPlayer.release();
        } catch (e) {
          console.error("Error releasing audio player during cleanup:", e);
        }
      }
    };
  }, [localUri]);
  
  // Play/pause the audio
  const togglePlayback = async () => {
    if (!audioPlayer) {
      console.error('Cannot toggle playback: No audio player initialized');
      
      // Try to reinitialize the player if it's not available
      if (localUri) {
        try {
          setIsLoading(true);
          const player = createAudioPlayer({ uri: localUri });
          setAudioPlayer(player);
          
          // Wait a moment for the player to initialize
          setTimeout(async () => {
            try {
              await player.play();
              setIsPlaying(true);
              
              // Set up a timer to track playback position
              setupPlaybackTimer(player);
              
              setIsLoading(false);
            } catch (e) {
              console.error("Error playing audio after reinitialization:", e);
              setIsLoading(false);
            }
          }, 300);
        } catch (error) {
          console.error('Error reinitializing audio player:', error);
          setIsLoading(false);
          Alert.alert('Error', 'Failed to play voice message');
        }
      }
      
      return;
    }
    
    try {
      setIsLoading(true);
      
      if (isPlaying) {
        // Pause playback
        await audioPlayer.pause();
        
        // Clear playback timer
        if (playbackTimer.current) {
          clearInterval(playbackTimer.current);
          playbackTimer.current = null;
        }
        
        setIsPlaying(false);
      } else {
        // Start or resume playback
        await audioPlayer.play();
        setIsPlaying(true);
        
        // Set up a timer to track playback position
        setupPlaybackTimer(audioPlayer);
      }
      
      setIsLoading(false);
    } catch (error) {
      console.error('Error toggling playback:', error);
      
      // Try to recover by reinitializing the player
      if (localUri) {
        try {
          const player = createAudioPlayer({ uri: localUri });
          setAudioPlayer(player);
          setTimeout(async () => {
            try {
              await player.play();
              setIsPlaying(true);
              setupPlaybackTimer(player);
            } catch (e) {
              console.error("Error during recovery attempt:", e);
              setIsPlaying(false);
            }
          }, 300);
        } catch (e) {
          console.error("Could not recover player:", e);
        }
      }
      
      setIsPlaying(false);
      setIsLoading(false);
    }
  };
  
  // Setup a timer to track playback position
  const setupPlaybackTimer = (player) => {
    if (playbackTimer.current) {
      clearInterval(playbackTimer.current);
    }
    
    playbackTimer.current = setInterval(() => {
      if (player && player.status && player.status.isLoaded) {
        const position = player.status.positionMillis / 1000;
        setPlaybackPosition(position);
        
        // Update progress bar animation
        // Use actualDuration for better accuracy
        const progress = player.status.positionMillis / (actualDuration * 1000);
        progressAnim.setValue(progress);
        
        // If we know the actual duration from the file, update our state
        if (player.status.durationMillis > 0) {
          const fileDuration = player.status.durationMillis / 1000;
          if (fileDuration > 0 && Math.abs(fileDuration - actualDuration) > 1) {
            setActualDuration(fileDuration);
          }
        }
        
        // Check if playback has finished
        if (player.status.didJustFinish) {
          setIsPlaying(false);
          setPlaybackPosition(0);
          progressAnim.setValue(0);
          clearInterval(playbackTimer.current);
          playbackTimer.current = null;
        }
      }
    }, 100);
  };
  
  // Format seconds to MM:SS format
  const formatDuration = (seconds: number): string => {
    if (!seconds || isNaN(seconds) || seconds < 0) {
      // Default to 0:00 for invalid values
      return '0:00';
    }
    const minutes = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${minutes}:${secs < 10 ? '0' + secs : secs}`;
  };
  
  return (
    <View style={[
      styles.container,
      isUserMessage ? styles.userContainer : styles.otherContainer
    ]}>
      {/* Play Button */}
      <TouchableOpacity
        style={[
          styles.playButton,
          isUserMessage ? styles.userPlayButton : styles.otherPlayButton
        ]}
        onPress={togglePlayback}
        disabled={isLoading || !localUri}
      >
        {isLoading ? (
          <ActivityIndicator
            size="small"
            color={isUserMessage ? '#fff' : '#6C5CE7'}
          />
        ) : (
          <FontAwesome
            name={isPlaying ? 'pause' : 'play'}
            size={16}
            color={isUserMessage ? '#fff' : '#6C5CE7'}
          />
        )}
      </TouchableOpacity>
      
      {/* Waveform and Duration */}
      <View style={styles.contentContainer}>
        <View style={styles.waveformContainer}>
          <Animated.View
            style={[
              styles.progressBar,
              isUserMessage ? styles.userProgressBar : styles.otherProgressBar,
              {
                width: progressWidth,
              },
            ]}
          />
          
          <View style={styles.waveform}>
            {Array.from({ length: 15 }).map((_, index) => (
              <View
                key={index}
                style={[
                  styles.waveformBar,
                  isUserMessage ? styles.userWaveformBar : styles.otherWaveformBar,
                  { height: 3 + Math.random() * 12 }, // Random height for static waveform design
                ]}
              />
            ))}
          </View>
        </View>
        
        <View style={styles.durationContainer}>
          <Ionicons
            name="mic"
            size={12}
            color={isUserMessage ? '#fff' : '#666'}
            style={styles.micIcon}
          />
          <Text style={[
            styles.durationText,
            isUserMessage ? styles.userDurationText : styles.otherDurationText
          ]}>
            {isPlaying 
              ? formatDuration(playbackPosition)
              : formatDuration(actualDuration)}
          </Text>
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 10,
    borderRadius: 16,
    maxWidth: 240,
  },
  userContainer: {
    backgroundColor: '#6C5CE7',
  },
  otherContainer: {
    backgroundColor: '#f0f0f0',
  },
  playButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
  },
  userPlayButton: {
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
  },
  otherPlayButton: {
    backgroundColor: 'rgba(108, 92, 231, 0.1)',
  },
  contentContainer: {
    flex: 1,
  },
  waveformContainer: {
    height: 24,
    justifyContent: 'center',
    marginBottom: 4,
    position: 'relative',
  },
  progressBar: {
    position: 'absolute',
    top: 0,
    left: 0,
    height: '100%',
    borderRadius: 2,
  },
  userProgressBar: {
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
  },
  otherProgressBar: {
    backgroundColor: 'rgba(108, 92, 231, 0.2)',
  },
  waveform: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    height: '100%',
  },
  waveformBar: {
    width: 3,
    borderRadius: 1.5,
    marginHorizontal: 1,
  },
  userWaveformBar: {
    backgroundColor: 'rgba(255, 255, 255, 0.7)',
  },
  otherWaveformBar: {
    backgroundColor: 'rgba(108, 92, 231, 0.5)',
  },
  durationContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  micIcon: {
    marginRight: 4,
  },
  durationText: {
    fontSize: 12,
  },
  userDurationText: {
    color: 'rgba(255, 255, 255, 0.8)',
  },
  otherDurationText: {
    color: '#666',
  },
});

export default VoiceMessage;
