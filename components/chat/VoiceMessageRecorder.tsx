import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Animated,
  Easing,
  Platform,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { 
  useAudioRecorder, 
  RecordingPresets, 
  AudioModule
} from 'expo-audio';
import { createAudioPlayer } from 'expo-audio';
import Ionicons from '@expo/vector-icons/Ionicons';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import { LinearGradient } from 'expo-linear-gradient';

interface VoiceMessageRecorderProps {
  onSend: (uri: string, duration: number) => void;
  onCancel: () => void;
}

// Status of the recorder
type RecordingStatus = 'idle' | 'recording' | 'recorded' | 'playing';

const VoiceMessageRecorder: React.FC<VoiceMessageRecorderProps> = ({
  onSend,
  onCancel,
}) => {
  // Use the audio recorder hook
  const audioRecorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);
  
  // For the audio player, we'll use createAudioPlayer instead of the hook
  const [audioPlayer, setAudioPlayer] = useState(null);
  
  // Recording state
  const [recordingStatus, setRecordingStatus] = useState<RecordingStatus>('idle');
  const [recordingDuration, setRecordingDuration] = useState<number>(0);
  const [recordingUri, setRecordingUri] = useState<string | null>(null);
  const [playbackPosition, setPlaybackPosition] = useState<number>(0);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isRecording, setIsRecording] = useState<boolean>(false);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [sendEnabled, setSendEnabled] = useState<boolean>(false);

  // Animation values
  const recordButtonAnimation = useRef(new Animated.Value(1)).current;
  const waveAnimation = useRef(new Animated.Value(0)).current;
  const recordingTimer = useRef<NodeJS.Timeout | null>(null);
  const playbackTimer = useRef<NodeJS.Timeout | null>(null);
  
  // Store recording start time to calculate duration manually
  const recordingStartTime = useRef<number | null>(null);
  const recordingFinalDuration = useRef<number>(0);

  // Update UI based on state
  useEffect(() => {
    if (isRecording) {
      setRecordingStatus('recording');
      setSendEnabled(false);
    } else if (recordingUri && !isPlaying) {
      setRecordingStatus('recorded');
      setSendEnabled(true);
    } else if (isPlaying) {
      setRecordingStatus('playing');
      setSendEnabled(true);
    }
  }, [isRecording, recordingUri, isPlaying]);

  // Clean up resources when unmounting
  useEffect(() => {
    return () => {
      if (isRecording) {
        try {
          audioRecorder.stop();
        } catch (e) {
          console.error("Error stopping recording during cleanup:", e);
        }
      }
      
      if (audioPlayer) {
        try {
          audioPlayer.release();
        } catch (e) {
          console.error("Error releasing audio player during cleanup:", e);
        }
      }
      
      if (recordingTimer.current) {
        clearInterval(recordingTimer.current);
      }
      
      if (playbackTimer.current) {
        clearInterval(playbackTimer.current);
      }
    };
  }, [isRecording, audioPlayer]);

  // Debug log to track state changes
  useEffect(() => {
    console.log('Recording URI:', recordingUri);
    console.log('Duration:', recordingDuration);
    console.log('Final Duration:', recordingFinalDuration.current);
    console.log('Send enabled:', sendEnabled);
  }, [recordingUri, recordingDuration, sendEnabled]);

  // Request audio recording permissions
  const requestPermissions = async (): Promise<boolean> => {
    try {
      const status = await AudioModule.requestRecordingPermissionsAsync();
      return status.granted;
    } catch (error) {
      console.error('Error requesting recording permissions:', error);
      return false;
    }
  };

  // Start recording audio
  const startRecording = async () => {
    try {
      // Check if we have permission
      const hasPermission = await requestPermissions();
      if (!hasPermission) {
        Alert.alert(
          'Permission Required',
          'You need to grant microphone permission to record voice messages.',
          [{ text: 'OK' }]
        );
        return;
      }

      setIsLoading(true);

      // Reset states
      setRecordingDuration(0);
      setRecordingUri(null);
      setSendEnabled(false);
      recordingFinalDuration.current = 0;
      
      // Store the start time for manual duration calculation
      recordingStartTime.current = Date.now();
      
      // If there's a previous player, release it
      if (audioPlayer) {
        try {
          audioPlayer.release();
          setAudioPlayer(null);
        } catch (e) {
          console.error("Error releasing previous player:", e);
        }
      }

      // Prepare to record
      await audioRecorder.prepareToRecordAsync();
      
      // Start recording
      audioRecorder.record();
      
      // Update state
      setIsRecording(true);
      setRecordingStatus('recording');
      setIsLoading(false);

      // Start the duration timer - update UI every 100ms
      if (recordingTimer.current) {
        clearInterval(recordingTimer.current);
      }
      
      recordingTimer.current = setInterval(() => {
        if (recordingStartTime.current) {
          const elapsedSeconds = (Date.now() - recordingStartTime.current) / 1000;
          setRecordingDuration(Math.floor(elapsedSeconds));
        }
      }, 100);

      // Start the button and wave animations
      Animated.loop(
        Animated.sequence([
          Animated.timing(recordButtonAnimation, {
            toValue: 1.2,
            duration: 400,
            easing: Easing.out(Easing.ease),
            useNativeDriver: true,
          }),
          Animated.timing(recordButtonAnimation, {
            toValue: 1,
            duration: 400,
            easing: Easing.in(Easing.ease),
            useNativeDriver: true,
          }),
        ])
      ).start();

      Animated.loop(
        Animated.sequence([
          Animated.timing(waveAnimation, {
            toValue: 1,
            duration: 1000,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: true,
          }),
          Animated.timing(waveAnimation, {
            toValue: 0,
            duration: 1000,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: true,
          }),
        ])
      ).start();
    } catch (error) {
      console.error('Failed to start recording:', error);
      setIsLoading(false);
      Alert.alert('Error', 'Failed to start recording. Please try again.');
    }
  };

  // Stop recording and save the audio file
  const stopRecording = async () => {
    try {
      if (!isRecording) return;

      setIsLoading(true);

      // Stop the animations
      recordButtonAnimation.stopAnimation();
      waveAnimation.stopAnimation();

      // Calculate final duration manually
      if (recordingStartTime.current) {
        const elapsedMs = Date.now() - recordingStartTime.current;
        const elapsedSeconds = elapsedMs / 1000;
        recordingFinalDuration.current = Math.floor(elapsedSeconds);
        setRecordingDuration(recordingFinalDuration.current);
        console.log('Manually calculated duration:', recordingFinalDuration.current);
      }

      // Stop the duration timer
      if (recordingTimer.current) {
        clearInterval(recordingTimer.current);
        recordingTimer.current = null;
      }

      // Stop recording
      await audioRecorder.stop();
      
      // Get the URI
      const uri = audioRecorder.uri;
      
      // Update state with saved values
      setIsRecording(false);
      setRecordingStatus('recorded');
      
      if (uri) {
        setRecordingUri(uri);
        console.log('Recording saved at:', uri);
        // Explicitly enable send button
        setSendEnabled(true);
      } else {
        console.error('No URI returned from recorder');
        setSendEnabled(false);
      }
      
      setIsLoading(false);
    } catch (error) {
      console.error('Failed to stop recording:', error);
      setIsLoading(false);
      setIsRecording(false);
      setSendEnabled(false);
      Alert.alert('Error', 'Failed to stop recording. Please try again.');
    }
  };

  // Play the recorded audio
  const playRecording = async () => {
    try {
      if (!recordingUri) {
        console.error('Cannot play: No recording URI available');
        return;
      }

      setIsLoading(true);
      setPlaybackPosition(0);

      // Create a new audio player if we don't have one
      if (!audioPlayer) {
        console.log('Creating new player for:', recordingUri);
        const player = createAudioPlayer({ uri: recordingUri });
        setAudioPlayer(player);
        
        // Set up a timer to track playback position
        if (playbackTimer.current) {
          clearInterval(playbackTimer.current);
        }
        
        playbackTimer.current = setInterval(() => {
          if (player && player.status && player.status.isLoaded) {
            setPlaybackPosition(player.status.positionMillis / 1000);
            
            // Check if playback has finished
            if (player.status.didJustFinish) {
              setIsPlaying(false);
              setPlaybackPosition(0);
              clearInterval(playbackTimer.current);
              playbackTimer.current = null;
              setRecordingStatus('recorded');
            }
          }
        }, 100);
      }

      // Start playing
      if (audioPlayer) {
        await audioPlayer.play();
        setIsPlaying(true);
        setRecordingStatus('playing');
      }
      
      setIsLoading(false);
    } catch (error) {
      console.error('Failed to play recording:', error);
      setIsLoading(false);
      setRecordingStatus('recorded');
      Alert.alert('Error', 'Failed to play recording. Please try again.');
    }
  };

  // Stop playing the recorded audio
  const stopPlaying = async () => {
    try {
      if (!audioPlayer) return;

      setIsLoading(true);
      
      // Pause playback
      await audioPlayer.pause();
      
      // Clear the playback timer
      if (playbackTimer.current) {
        clearInterval(playbackTimer.current);
        playbackTimer.current = null;
      }
      
      setIsPlaying(false);
      setRecordingStatus('recorded');
      setPlaybackPosition(0);
      setIsLoading(false);
    } catch (error) {
      console.error('Failed to stop playing:', error);
      setIsLoading(false);
      setRecordingStatus('recorded');
    }
  };

  // Handle sending the voice message
  const handleSend = async () => {
    console.log('Send pressed. URI:', recordingUri, 'Duration:', recordingFinalDuration.current);
    
    if (!recordingUri) {
      console.error('Cannot send: No recording URI available');
      Alert.alert('Error', 'Recording is not available.');
      return;
    }
    
    // Using manually tracked duration instead of relying on the audio API
    if (recordingFinalDuration.current < 1) {
      console.error('Cannot send: Recording too short');
      Alert.alert('Error', 'Recording is too short.');
      return;
    }

    // Stop playing if currently playing
    if (isPlaying) {
      await stopPlaying();
    }

    // Use our manually tracked duration and URI for sending
    onSend(recordingUri, recordingFinalDuration.current);
  };

  // Handle canceling the voice message
  const handleCancel = async () => {
    // Stop recording or playing
    if (isRecording) {
      await stopRecording();
    } else if (isPlaying) {
      await stopPlaying();
    }

    onCancel();
  };

  // Format seconds to MM:SS format
  const formatDuration = (seconds: number): string => {
    const minutes = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${minutes}:${secs < 10 ? '0' + secs : secs}`;
  };

  // Render wave indicators
  const renderWaveIndicators = () => {
    const numIndicators = 5;
    const indicators = [];

    for (let i = 0; i < numIndicators; i++) {
      const delay = i * 0.1;
      const inputRange = [0, 0.5, 1];
      const scaleRange = [0.2, 1, 0.2]; // Instead of height range, use scale range

      const animatedScale = waveAnimation.interpolate({
        inputRange,
        outputRange: scaleRange,
        extrapolate: 'clamp',
      });

      indicators.push(
        <Animated.View
          key={i}
          style={[
            styles.waveIndicator,
            {
              transform: [{ scaleY: animatedScale }],
            },
          ]}
        />
      );
    }

    return indicators;
  };

  return (
    <View style={styles.container}>
      {recordingStatus === 'idle' ? (
        // Initial state - Hold to record button
        <View style={styles.recordButtonContainer}>
          <Text style={styles.recordingHint}>Hold to record voice message</Text>
          <TouchableOpacity
            style={styles.recordButton}
            onLongPress={startRecording}
            delayLongPress={200}
            activeOpacity={0.7}
          >
            <LinearGradient
              colors={['#6C5CE7', '#a29bfe']}
              style={styles.recordButtonGradient}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
            >
              <Ionicons name="mic" size={28} color="#fff" />
            </LinearGradient>
          </TouchableOpacity>
        </View>
      ) : recordingStatus === 'recording' ? (
        // Recording state - Release to stop button
        <View style={styles.recorderContainer}>
          <View style={styles.recordingInfo}>
            <View style={styles.waveContainer}>{renderWaveIndicators()}</View>
            <Text style={styles.recordingTimer}>{formatDuration(recordingDuration)}</Text>
          </View>

          <View style={styles.recordControlsContainer}>
            <TouchableOpacity style={styles.cancelButton} onPress={handleCancel}>
              <MaterialIcons name="cancel" size={24} color="#ff6b6b" />
            </TouchableOpacity>

            <Animated.View
              style={[
                styles.recordingButton,
                {
                  transform: [{ scale: recordButtonAnimation }],
                },
              ]}
            >
              <TouchableOpacity style={styles.stopButton} onPress={stopRecording}>
                <MaterialIcons name="stop" size={28} color="#fff" />
              </TouchableOpacity>
            </Animated.View>
          </View>
        </View>
      ) : (
        // Review state - Play/Send/Cancel buttons
        <View style={styles.reviewContainer}>
          <View style={styles.reviewInfo}>
            <TouchableOpacity
              style={styles.playButton}
              onPress={isPlaying ? stopPlaying : playRecording}
              disabled={isLoading}
            >
              {isLoading ? (
                <ActivityIndicator size="small" color="#6C5CE7" />
              ) : (
                <FontAwesome
                  name={isPlaying ? 'pause' : 'play'}
                  size={22}
                  color="#6C5CE7"
                />
              )}
            </TouchableOpacity>

            <View style={styles.durationContainer}>
              <Text style={styles.durationText}>
                {isPlaying
                  ? formatDuration(Math.floor(playbackPosition))
                  : formatDuration(recordingFinalDuration.current || recordingDuration)}
              </Text>
              <Text style={styles.totalDurationText}>
                {formatDuration(recordingFinalDuration.current || recordingDuration)}
              </Text>
            </View>
          </View>

          <View style={styles.reviewControls}>
            <TouchableOpacity
              style={styles.reviewCancelButton}
              onPress={handleCancel}
              disabled={isLoading}
            >
              <MaterialIcons name="delete" size={24} color="#ff6b6b" />
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.sendButton, !sendEnabled && styles.disabledSendButton]}
              onPress={handleSend}
              disabled={isLoading || !sendEnabled}
            >
              <LinearGradient
                colors={['#6C5CE7', '#a29bfe']}
                style={styles.sendButtonGradient}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
              >
                <MaterialIcons name="send" size={18} color="#fff" />
              </LinearGradient>
            </TouchableOpacity>
          </View>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#f5f5f5',
    borderRadius: 24,
    marginVertical: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  recordButtonContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
  },
  recordingHint: {
    color: '#666',
    fontSize: 14,
    marginBottom: 12,
  },
  recordButton: {
    width: 64,
    height: 64,
    borderRadius: 32,
    overflow: 'hidden',
  },
  recordButtonGradient: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  recorderContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  recordingInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  waveContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 30,
    marginRight: 12,
  },
  waveIndicator: {
    width: 3,
    height: 15, // Fixed height that will be scaled
    backgroundColor: '#6C5CE7',
    borderRadius: 1.5,
    marginHorizontal: 2,
  },
  recordingTimer: {
    color: '#333',
    fontSize: 16,
  },
  recordControlsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  cancelButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  recordingButton: {
    width: 54,
    height: 54,
    borderRadius: 27,
    overflow: 'hidden',
    backgroundColor: '#ff6b6b',
    justifyContent: 'center',
    alignItems: 'center',
  },
  stopButton: {
    flex: 1,
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  reviewContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  reviewInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  playButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#f0f0f0',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  durationContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  durationText: {
    color: '#333',
    fontSize: 16,
    fontWeight: '500',
  },
  totalDurationText: {
    color: '#888',
    fontSize: 14,
    marginLeft: 4,
  },
  reviewControls: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  reviewCancelButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  sendButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    overflow: 'hidden',
  },
  disabledSendButton: {
    opacity: 0.5,
  },
  sendButtonGradient: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
});

export default VoiceMessageRecorder;
