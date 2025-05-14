import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  Image,
  FlatList,
  Dimensions,
  ActivityIndicator,
  Alert,
  Platform,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { useVideoPlayer } from 'expo-video';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import Ionicons from '@expo/vector-icons/Ionicons';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

// Types of media that can be selected
export type MediaType = 'photo' | 'video';

// Interface for media items
export interface MediaItem {
  uri: string;
  type: MediaType;
  width?: number;
  height?: number;
  duration?: number; // For videos, in milliseconds
  filename?: string;
  fileSize?: number;
  preview?: string; // Thumbnail for videos
}

interface MediaPickerProps {
  visible: boolean;
  onClose: () => void;
  onMediaSelected: (media: MediaItem[]) => void;
  maxSelections?: number; // Maximum number of media items that can be selected
}

const MediaPicker: React.FC<MediaPickerProps> = ({
  visible,
  onClose,
  onMediaSelected,
  maxSelections = 10, // Default to 10 max selections
}) => {
  const [selectedMedia, setSelectedMedia] = useState<MediaItem[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [processingVideos, setProcessingVideos] = useState<boolean>(false);
  
  // Refs for tracking permissions
  const cameraPermissionRequested = useRef<boolean>(false);
  const mediaLibraryPermissionRequested = useRef<boolean>(false);

  // Ask for permission to access the device's camera
  const requestCameraPermission = async () => {
    if (cameraPermissionRequested.current) return;
    cameraPermissionRequested.current = true;
    
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    
    if (status !== 'granted') {
      Alert.alert(
        'Camera Permission Required',
        'Please grant camera permissions to take photos and videos.',
        [{ text: 'OK' }]
      );
    }
    
    return status === 'granted';
  };

  // Ask for permission to access the device's media library
  const requestMediaLibraryPermission = async () => {
    if (mediaLibraryPermissionRequested.current) return;
    mediaLibraryPermissionRequested.current = true;
    
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    
    if (status !== 'granted') {
      Alert.alert(
        'Media Library Permission Required',
        'Please grant media library permissions to select photos and videos.',
        [{ text: 'OK' }]
      );
    }
    
    return status === 'granted';
  };

  // Generate a thumbnail for a video
  const generateThumbnail = async (videoUri: string): Promise<string | undefined> => {
    try {
      // Create a video player
      const player = useVideoPlayer({ uri: videoUri });
      
      // Wait for the player to be ready (maximum 3 seconds)
      let attempts = 0;
      while (!player.isReady && attempts < 15) {
        await new Promise(resolve => setTimeout(resolve, 200));
        attempts++;
      }
      
      if (player.isReady) {
        // Generate thumbnail at 0.5 seconds (usually good for a meaningful frame)
        const thumbnail = await player.generateThumbnailAsync(0.5);
        return thumbnail?.uri;
      }
      
      return undefined;
    } catch (error) {
      console.error('Error generating video thumbnail:', error);
      return undefined;
    }
  };

  // Take a photo using the device's camera
  const takePhoto = async () => {
    const hasPermission = await requestCameraPermission();
    if (!hasPermission) return;
    
    try {
      setLoading(true);
      
      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        aspect: [4, 3],
        quality: 0.8,
        allowsMultipleSelection: false,
      });
      
      if (!result.canceled && result.assets && result.assets.length > 0) {
        const asset = result.assets[0];
        
        const newMedia: MediaItem = {
          uri: asset.uri,
          type: 'photo',
          width: asset.width,
          height: asset.height,
          filename: asset.fileName || `photo-${new Date().getTime()}.jpg`,
          fileSize: asset.fileSize,
        };
        
        setSelectedMedia((prevMedia) => [...prevMedia, newMedia]);
      }
    } catch (error) {
      console.error('Error taking photo:', error);
      Alert.alert('Error', 'Failed to take photo. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // Take a video using the device's camera
  const takeVideo = async () => {
    const hasPermission = await requestCameraPermission();
    if (!hasPermission) return;
    
    try {
      setLoading(true);
      
      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ['videos'],
        allowsEditing: true,
        videoMaxDuration: 60, // 1 minute max
        quality: 0.8,
        allowsMultipleSelection: false,
      });
      
      if (!result.canceled && result.assets && result.assets.length > 0) {
        const asset = result.assets[0];
        
        setProcessingVideos(true);
        
        // Generate thumbnail for the video
        const thumbnailUri = await generateThumbnail(asset.uri);
        
        setProcessingVideos(false);
        
        const newMedia: MediaItem = {
          uri: asset.uri,
          type: 'video',
          width: asset.width,
          height: asset.height,
          duration: asset.duration ? asset.duration * 1000 : undefined, // Convert to milliseconds
          filename: asset.fileName || `video-${new Date().getTime()}.mp4`,
          fileSize: asset.fileSize,
          preview: thumbnailUri, // Add the thumbnail
        };
        
        setSelectedMedia((prevMedia) => [...prevMedia, newMedia]);
      }
    } catch (error) {
      console.error('Error taking video:', error);
      Alert.alert('Error', 'Failed to take video. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // Pick a photo from the device's media library
  const pickImage = async () => {
    const hasPermission = await requestMediaLibraryPermission();
    if (!hasPermission) return;
    
    try {
      setLoading(true);
      
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: false,
        quality: 0.8,
        allowsMultipleSelection: true,
        selectionLimit: maxSelections - selectedMedia.length,
      });
      
      if (!result.canceled && result.assets && result.assets.length > 0) {
        const newMedia: MediaItem[] = result.assets.map((asset) => ({
          uri: asset.uri,
          type: 'photo',
          width: asset.width,
          height: asset.height,
          filename: asset.fileName || `photo-${new Date().getTime()}.jpg`,
          fileSize: asset.fileSize,
        }));
        
        setSelectedMedia((prevMedia) => [...prevMedia, ...newMedia]);
      }
    } catch (error) {
      console.error('Error picking image:', error);
      Alert.alert('Error', 'Failed to pick image. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // Pick a video from the device's media library
  const pickVideo = async () => {
    const hasPermission = await requestMediaLibraryPermission();
    if (!hasPermission) return;
    
    try {
      setLoading(true);
      
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['videos'],
        allowsEditing: false,
        quality: 0.8,
        allowsMultipleSelection: true,
        selectionLimit: maxSelections - selectedMedia.length,
      });
      
      if (!result.canceled && result.assets && result.assets.length > 0) {
        setProcessingVideos(true);
        
        // Process videos one by one to generate thumbnails
        const processedMedia: MediaItem[] = [];
        
        for (const asset of result.assets) {
          // Generate thumbnail
          const thumbnailUri = await generateThumbnail(asset.uri);
          
          // Create media item
          const mediaItem: MediaItem = {
            uri: asset.uri,
            type: 'video',
            width: asset.width,
            height: asset.height,
            duration: asset.duration ? asset.duration * 1000 : undefined, // Convert to milliseconds
            filename: asset.fileName || `video-${new Date().getTime()}.mp4`,
            fileSize: asset.fileSize,
            preview: thumbnailUri,
          };
          
          processedMedia.push(mediaItem);
        }
        
        setProcessingVideos(false);
        setSelectedMedia((prevMedia) => [...prevMedia, ...processedMedia]);
      }
    } catch (error) {
      console.error('Error picking video:', error);
      Alert.alert('Error', 'Failed to pick video. Please try again.');
    } finally {
      setLoading(false);
      setProcessingVideos(false);
    }
  };

  // Remove a media item from the selected media
  const removeMedia = (index: number) => {
    setSelectedMedia((prevMedia) => {
      const newMedia = [...prevMedia];
      newMedia.splice(index, 1);
      return newMedia;
    });
  };

  // Handle submit - send selected media to the parent component
  const handleSubmit = () => {
    if (selectedMedia.length === 0) {
      Alert.alert('No Media Selected', 'Please select at least one photo or video to send.');
      return;
    }
    
    onMediaSelected(selectedMedia);
    resetAndClose();
  };

  // Reset state and close the modal
  const resetAndClose = () => {
    setSelectedMedia([]);
    onClose();
  };

  // Render a selected media item
  const renderMediaItem = ({ item, index }: { item: MediaItem; index: number }) => (
    <View style={styles.mediaItemContainer}>
      {item.type === 'video' && item.preview ? (
        // Use the preview for videos if available
        <Image
          source={{ uri: item.preview }}
          style={styles.mediaItemImage}
          resizeMode="cover"
        />
      ) : (
        // Otherwise just use the uri
        <Image
          source={{ uri: item.uri }}
          style={styles.mediaItemImage}
          resizeMode="cover"
        />
      )}
      
      {item.type === 'video' && (
        <View style={styles.videoIndicator}>
          <FontAwesome name="play-circle" size={24} color="#fff" />
          {item.duration && (
            <Text style={styles.videoDuration}>
              {formatDuration(item.duration)}
            </Text>
          )}
        </View>
      )}
      
      <TouchableOpacity
        style={styles.removeButton}
        onPress={() => removeMedia(index)}
      >
        <MaterialIcons name="close" size={16} color="#fff" />
      </TouchableOpacity>
    </View>
  );

  // Format the duration of a video (milliseconds to MM:SS)
  const formatDuration = (milliseconds: number): string => {
    const totalSeconds = Math.round(milliseconds / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes}:${seconds < 10 ? '0' + seconds : seconds}`;
  };

  return (
    <Modal
      visible={visible}
      transparent={true}
      animationType="slide"
      onRequestClose={resetAndClose}
      presentationStyle="overFullScreen"
      statusBarTranslucent={true}
    >
      <View style={styles.container}>
        <BlurView intensity={Platform.OS === 'ios' ? 50 : 100} style={styles.blurContainer}>
          <View style={styles.modalContent}>
            {/* Header */}
            <View style={styles.header}>
              <Text style={styles.title}>Send Media</Text>
              <TouchableOpacity onPress={resetAndClose} style={styles.closeButton}>
                <MaterialIcons name="close" size={24} color="#333" />
              </TouchableOpacity>
            </View>
            
            {/* Selected Media */}
            {selectedMedia.length > 0 ? (
              <View style={styles.selectedMediaContainer}>
                <Text style={styles.sectionTitle}>
                  Selected ({selectedMedia.length}/{maxSelections})
                </Text>
                <FlatList
                  data={selectedMedia}
                  renderItem={renderMediaItem}
                  keyExtractor={(_, index) => `media-${index}`}
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.selectedMediaList}
                />
              </View>
            ) : (
              <View style={styles.emptyState}>
                <MaterialIcons name="photo-library" size={40} color="#ccc" />
                <Text style={styles.emptyStateText}>No media selected</Text>
              </View>
            )}
            
            {/* Action Buttons */}
            <View style={styles.actionButtonsContainer}>
              <TouchableOpacity
                style={styles.actionButton}
                onPress={takePhoto}
                disabled={loading || processingVideos || selectedMedia.length >= maxSelections}
              >
                <View style={[
                  styles.actionButtonIcon,
                  (loading || processingVideos || selectedMedia.length >= maxSelections) && styles.disabledButton
                ]}>
                  <Ionicons name="camera-outline" size={28} color="#fff" />
                </View>
                <Text style={styles.actionButtonText}>Camera</Text>
              </TouchableOpacity>
              
              <TouchableOpacity
                style={styles.actionButton}
                onPress={takeVideo}
                disabled={loading || processingVideos || selectedMedia.length >= maxSelections}
              >
                <View style={[
                  styles.actionButtonIcon,
                  (loading || processingVideos || selectedMedia.length >= maxSelections) && styles.disabledButton
                ]}>
                  <Ionicons name="videocam-outline" size={28} color="#fff" />
                </View>
                <Text style={styles.actionButtonText}>Video</Text>
              </TouchableOpacity>
              
              <TouchableOpacity
                style={styles.actionButton}
                onPress={pickImage}
                disabled={loading || processingVideos || selectedMedia.length >= maxSelections}
              >
                <View style={[
                  styles.actionButtonIcon,
                  (loading || processingVideos || selectedMedia.length >= maxSelections) && styles.disabledButton
                ]}>
                  <Ionicons name="images-outline" size={28} color="#fff" />
                </View>
                <Text style={styles.actionButtonText}>Photos</Text>
              </TouchableOpacity>
              
              <TouchableOpacity
                style={styles.actionButton}
                onPress={pickVideo}
                disabled={loading || processingVideos || selectedMedia.length >= maxSelections}
              >
                <View style={[
                  styles.actionButtonIcon,
                  (loading || processingVideos || selectedMedia.length >= maxSelections) && styles.disabledButton
                ]}>
                  <Ionicons name="film-outline" size={28} color="#fff" />
                </View>
                <Text style={styles.actionButtonText}>Library</Text>
              </TouchableOpacity>
            </View>
            
            {/* Processing Indicator */}
            {processingVideos && (
              <View style={styles.processingContainer}>
                <ActivityIndicator size="small" color="#6C5CE7" style={styles.processingIndicator} />
                <Text style={styles.processingText}>Processing videos...</Text>
              </View>
            )}
            
            {/* Send Button */}
            <TouchableOpacity
              style={[
                styles.sendButton,
                (selectedMedia.length === 0 || loading || processingVideos) && styles.disabledSendButton
              ]}
              onPress={handleSubmit}
              disabled={selectedMedia.length === 0 || loading || processingVideos}
            >
              <LinearGradient
                colors={(selectedMedia.length === 0 || loading || processingVideos) ? ['#ccc', '#ccc'] : ['#6C5CE7', '#a29bfe']}
                style={styles.sendButtonGradient}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
              >
                {loading ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <>
                    <MaterialIcons name="send" size={20} color="#fff" style={styles.sendIcon} />
                    <Text style={styles.sendButtonText}>Send</Text>
                  </>
                )}
              </LinearGradient>
            </TouchableOpacity>
          </View>
        </BlurView>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  blurContainer: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingTop: 16,
    paddingBottom: 30,
    paddingHorizontal: 16,
    minHeight: '60%',
    maxHeight: '80%',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  title: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
  },
  closeButton: {
    padding: 4,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
  },
  selectedMediaContainer: {
    marginBottom: 20,
  },
  selectedMediaList: {
    paddingVertical: 8,
  },
  mediaItemContainer: {
    width: 100,
    height: 100,
    borderRadius: 12,
    marginRight: 8,
    overflow: 'hidden',
    position: 'relative',
  },
  mediaItemImage: {
    width: '100%',
    height: '100%',
  },
  removeButton: {
    position: 'absolute',
    top: 4,
    right: 4,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    borderRadius: 12,
    width: 24,
    height: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },
  videoIndicator: {
    position: 'absolute',
    bottom: 4,
    left: 4,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    borderRadius: 12,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  videoDuration: {
    color: '#fff',
    fontSize: 10,
    marginLeft: 4,
    fontWeight: '500',
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 30,
  },
  emptyStateText: {
    fontSize: 14,
    color: '#888',
    marginTop: 8,
  },
  actionButtonsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  actionButton: {
    alignItems: 'center',
    width: SCREEN_WIDTH / 4 - 16,
  },
  actionButtonIcon: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#6C5CE7',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  actionButtonText: {
    fontSize: 12,
    color: '#333',
  },
  disabledButton: {
    backgroundColor: '#ccc',
  },
  processingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  processingIndicator: {
    marginRight: 8,
  },
  processingText: {
    fontSize: 14,
    color: '#6C5CE7',
    fontWeight: '500',
  },
  sendButton: {
    height: 50,
    borderRadius: 25,
    overflow: 'hidden',
  },
  sendButtonGradient: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },
  sendButtonText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 16,
  },
  sendIcon: {
    marginRight: 8,
  },
  disabledSendButton: {
    opacity: 0.7,
  },
});

export default MediaPicker;
export type { MediaItem };