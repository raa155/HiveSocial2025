import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Image,
  TouchableOpacity,
  StyleSheet,
  Dimensions,
  Modal,
  ActivityIndicator,
  Text,
  FlatList,
  PanResponder,
  Animated,
} from 'react-native';
import { useVideoPlayer, VideoView } from 'expo-video';
import { useEvent } from 'expo';
import Ionicons from '@expo/vector-icons/Ionicons';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { BlurView } from 'expo-blur';
import { MediaItem } from './MediaPicker';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const MAX_MEDIA_WIDTH = Math.min(280, SCREEN_WIDTH * 0.7);
const THUMBNAIL_SIZE = 100;

interface MediaMessageProps {
  media: MediaItem[];
  isUserMessage?: boolean;
}

const MediaMessage: React.FC<MediaMessageProps> = ({
  media,
  isUserMessage = false,
}) => {
  const [modalVisible, setModalVisible] = useState(false);
  const [selectedMediaIndex, setSelectedMediaIndex] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  
  // Animation values for swipe to dismiss
  const translateY = useRef(new Animated.Value(0)).current;
  const opacity = useRef(new Animated.Value(1)).current;
  
  // Pan responder for swipe to dismiss
  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: (_, gestureState) => {
        // Only respond to vertical gestures
        return Math.abs(gestureState.dy) > Math.abs(gestureState.dx * 3);
      },
      onPanResponderMove: (_, gestureState) => {
        // Only allow downward swipe
        if (gestureState.dy > 0) {
          translateY.setValue(gestureState.dy);
          // Calculate opacity based on distance dragged
          const newOpacity = Math.max(1 - gestureState.dy / 400, 0.25);
          opacity.setValue(newOpacity);
        }
      },
      onPanResponderRelease: (_, gestureState) => {
        // If swipe down distance is significant, dismiss modal
        if (gestureState.dy > 100) {
          Animated.parallel([
            Animated.timing(translateY, {
              toValue: 500,
              duration: 200,
              useNativeDriver: true,
            }),
            Animated.timing(opacity, {
              toValue: 0,
              duration: 200,
              useNativeDriver: true,
            }),
          ]).start(() => {
            setModalVisible(false);
            // Reset animation values after modal is closed
            translateY.setValue(0);
            opacity.setValue(1);
          });
        } else {
          // If not swiped far enough, snap back
          Animated.parallel([
            Animated.spring(translateY, {
              toValue: 0,
              useNativeDriver: true,
              friction: 8,
            }),
            Animated.spring(opacity, {
              toValue: 1,
              useNativeDriver: true,
              friction: 8,
            }),
          ]).start();
        }
      },
    })
  ).current;
  
  // Reset animation values when modal closes
  useEffect(() => {
    if (!modalVisible) {
      translateY.setValue(0);
      opacity.setValue(1);
    }
  }, [modalVisible]);

  // Format video duration
  const formatDuration = (milliseconds?: number): string => {
    if (!milliseconds) return '0:00';
    
    const seconds = Math.floor(milliseconds / 1000);
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    
    return `${minutes}:${remainingSeconds < 10 ? '0' : ''}${remainingSeconds}`;
  };

  // Open the media viewer modal
  const openMediaViewer = (index: number) => {
    setSelectedMediaIndex(index);
    setModalVisible(true);
  };

  // Render a thumbnail for a media item
  const renderThumbnail = ({ item, index }: { item: MediaItem; index: number }) => (
    <TouchableOpacity
      style={styles.thumbnailContainer}
      onPress={() => openMediaViewer(index)}
      activeOpacity={0.9}
    >
      {item.type === 'video' ? (
        // For videos, render a VideoView that can show the first frame
        <View style={styles.videoThumbnailContainer}>
          {item.preview ? (
            // If we have a preview, use that
            <Image
              source={{ uri: item.preview }}
              style={styles.thumbnail}
              resizeMode="cover"
            />
          ) : (
            // Otherwise use a VideoView as a thumbnail
            <VideoView
              player={useVideoPlayer({ 
                uri: item.uri,
                shouldPlay: false,
                shouldMute: true,
              })}
              style={styles.thumbnail}
              resizeMode="cover"
              useNativeControls={false}
            />
          )}
          <View style={styles.videoIndicator}>
            <Ionicons name="play-circle" size={24} color="#fff" />
            {item.duration && (
              <Text style={styles.videoDuration}>
                {formatDuration(item.duration)}
              </Text>
            )}
          </View>
        </View>
      ) : (
        // For images, just render the image
        <Image
          source={{ uri: item.uri }}
          style={styles.thumbnail}
          resizeMode="cover"
        />
      )}
    </TouchableOpacity>
  );

  // Render a grid of thumbnails for multiple media items
  const renderMediaGrid = () => {
    if (media.length === 1) {
      // For a single media item, render it directly
      const item = media[0];
      const aspectRatio = item.width && item.height ? item.width / item.height : 1;
      
      return (
        <TouchableOpacity
          style={[
            styles.singleMediaContainer,
            { width: MAX_MEDIA_WIDTH, height: MAX_MEDIA_WIDTH / aspectRatio },
          ]}
          onPress={() => openMediaViewer(0)}
          activeOpacity={0.9}
        >
          {item.type === 'video' ? (
            // For videos, render a VideoView that can show the first frame
            <View style={styles.singleMediaWrapper}>
              {item.preview ? (
                // If we have a preview, use that
                <Image
                  source={{ uri: item.preview }}
                  style={styles.singleMedia}
                  resizeMode="cover"
                />
              ) : (
                // Otherwise use a VideoView as a thumbnail
                <VideoView
                  player={useVideoPlayer({ 
                    uri: item.uri,
                    shouldPlay: false,
                    shouldMute: true,
                  })}
                  style={styles.singleMedia}
                  resizeMode="cover"
                  useNativeControls={false}
                />
              )}
              <View style={styles.videoOverlay}>
                <Ionicons name="play-circle" size={40} color="#fff" />
                {item.duration && (
                  <View style={styles.videoDurationContainer}>
                    <Text style={styles.videoOverlayDuration}>
                      {formatDuration(item.duration)}
                    </Text>
                  </View>
                )}
              </View>
            </View>
          ) : (
            // For images, just render the image
            <Image
              source={{ uri: item.uri }}
              style={styles.singleMedia}
              resizeMode="cover"
            />
          )}
        </TouchableOpacity>
      );
    } else {
      // For multiple media items, render a grid of thumbnails
      return (
        <View style={styles.mediaGrid}>
          <FlatList
            data={media}
            renderItem={renderThumbnail}
            keyExtractor={(_, index) => `media-${index}`}
            horizontal={false}
            numColumns={2}
            contentContainerStyle={styles.gridContentContainer}
          />
        </View>
      );
    }
  };

  // Render the media viewer modal
  const renderMediaViewerModal = () => {
    const selectedMedia = media[selectedMediaIndex];
    const isVideo = selectedMedia?.type === 'video';
    
    // Configure video player with additional options
    const videoPlayer = isVideo ? useVideoPlayer({
      uri: selectedMedia.uri,
      progressUpdateIntervalMillis: 250, // For smoother progress updates
      shouldMute: false, // Ensure audio is enabled
      shouldPlay: false, // Don't autoplay on load
    }) : null;
    
    // Use multiple events to track player state
    const { isPlaying } = isVideo ? useEvent(videoPlayer, 'playingChange', { isPlaying: false }) : { isPlaying: false };
    const { status } = isVideo ? useEvent(videoPlayer, 'statusChange', { status: videoPlayer?.status }) : { status: undefined };
    
    // Function to handle video loading events
    const handleVideoLoading = (loading: boolean) => {
      setIsLoading(loading);
    };

    // Function to toggle video play/pause
    const toggleVideoPlayback = () => {
      if (videoPlayer) {
        if (isPlaying) {
          videoPlayer.pause();
        } else {
          videoPlayer.play();
        }
      }
    };
    
    // Cleanup video resources when modal closes
    useEffect(() => {
      return () => {
        if (videoPlayer && isPlaying) {
          videoPlayer.pause();
        }
      };
    }, [videoPlayer, isPlaying, modalVisible]);
    
    return (
      <Modal
        visible={modalVisible}
        transparent={true}
        animationType="fade"
        onRequestClose={() => {
          if (videoPlayer && isPlaying) {
            videoPlayer.pause();
          }
          setModalVisible(false);
        }}
        presentationStyle="overFullScreen"
        statusBarTranslucent={true}
      >
        <TouchableOpacity 
          activeOpacity={1}
          style={styles.modalOverlay}
          onPress={() => {
            setModalVisible(false);
            if (videoPlayer && isPlaying) {
              videoPlayer.pause();
            }
          }}
        >
          <Animated.View 
            style={[
              styles.modalContainer,
              {
                transform: [{ translateY }],
                opacity
              }
            ]}
            {...panResponder.panHandlers}
          >
            <BlurView intensity={100} style={styles.modalBackground}>
              <TouchableOpacity 
                activeOpacity={1}
                style={styles.modalContent}
                onPress={(e) => {
                  // Stop propagation to prevent modal from closing when content is pressed
                  e.stopPropagation();
                }}
              >
                {/* Pull indicator */}
                <View style={styles.pullIndicator} />
                
                {/* Header */}
                <View style={styles.modalHeader}>
                  <TouchableOpacity
                    style={styles.closeButton}
                    onPress={() => {
                      setModalVisible(false);
                      if (videoPlayer && isPlaying) {
                        videoPlayer.pause();
                      }
                    }}
                  >
                    <MaterialIcons name="close" size={24} color="#fff" />
                  </TouchableOpacity>
                  
                  <Text style={styles.modalTitle}>
                    {selectedMediaIndex + 1} / {media.length}
                  </Text>
                  
                  <View style={{ width: 40 }} />
                </View>
                
                {/* Prominent dismiss button at top center */}
                <TouchableOpacity
                  style={styles.prominentCloseButton}
                  onPress={() => {
                    setModalVisible(false);
                    if (videoPlayer && isPlaying) {
                      videoPlayer.pause();
                    }
                  }}
                >
                  <View style={styles.prominentCloseIconContainer}>
                    <Ionicons name="close" size={28} color="#fff" />
                  </View>
                  <Text style={styles.closeText}>Close</Text>
                </TouchableOpacity>
                
                {/* Media Content */}
                <View style={styles.mediaViewerContainer}>
                  {isLoading && (
                    <ActivityIndicator
                      size="large"
                      color="#fff"
                      style={styles.loader}
                    />
                  )}
                  
                  {isVideo && videoPlayer ? (
                    <TouchableOpacity
                      style={styles.videoContainer}
                      onPress={toggleVideoPlayback}
                      activeOpacity={1}
                    >
                      <VideoView
                        player={videoPlayer}
                        style={styles.video}
                        onLoadStart={() => handleVideoLoading(true)}
                        onLoad={() => handleVideoLoading(false)}
                        resizeMode="contain"
                        useNativeControls={true} // Using native controls for better compatibility
                      />
                      
                      {/* Custom play button only shown initially and not during playback/loading */}
                      {!isPlaying && !isLoading && !videoPlayer?.isReady && (
                        <View style={styles.videoPlayOverlay}>
                          <TouchableOpacity
                            style={styles.playButton}
                            onPress={toggleVideoPlayback}
                          >
                            <Ionicons name="play" size={40} color="#fff" />
                          </TouchableOpacity>
                        </View>
                      )}
                    </TouchableOpacity>
                  ) : (
                    <Image
                      source={{ uri: selectedMedia.uri }}
                      style={styles.fullImage}
                      resizeMode="contain"
                      onLoadStart={() => setIsLoading(true)}
                      onLoad={() => setIsLoading(false)}
                    />
                  )}
                </View>
                
                {/* Footer / Pagination */}
                {media.length > 1 && (
                  <View style={styles.paginationContainer}>
                    <FlatList
                      data={media}
                      renderItem={({ item, index }) => (
                        <TouchableOpacity
                          style={[
                            styles.paginationItem,
                            index === selectedMediaIndex && styles.selectedPaginationItem,
                          ]}
                          onPress={() => {
                            setSelectedMediaIndex(index);
                            if (videoPlayer && isPlaying) {
                              videoPlayer.pause();
                            }
                          }}
                        >
                          {item.type === 'video' && item.preview ? (
                            <Image
                              source={{ uri: item.preview }}
                              style={styles.paginationImage}
                              resizeMode="cover"
                            />
                          ) : (
                            <Image
                              source={{ uri: item.uri }}
                              style={styles.paginationImage}
                              resizeMode="cover"
                            />
                          )}
                          {item.type === 'video' && (
                            <View style={styles.paginationVideoIndicator}>
                              <Ionicons name="play" size={12} color="#fff" />
                            </View>
                          )}
                        </TouchableOpacity>
                      )}
                      keyExtractor={(_, index) => `pagination-${index}`}
                      horizontal
                      showsHorizontalScrollIndicator={false}
                      contentContainerStyle={styles.paginationList}
                    />
                  </View>
                )}
              </TouchableOpacity>
            </BlurView>
          </Animated.View>
        </TouchableOpacity>
      </Modal>
    );
  };

  return (
    <View style={[
      styles.container,
      isUserMessage ? styles.userContainer : styles.otherContainer
    ]}>
      {renderMediaGrid()}
      {renderMediaViewerModal()}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginVertical: 2,
  },
  userContainer: {
    alignItems: 'flex-end',
  },
  otherContainer: {
    alignItems: 'flex-start',
  },
  singleMediaContainer: {
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: '#f0f0f0',
  },
  singleMediaWrapper: {
    width: '100%',
    height: '100%',
    position: 'relative',
  },
  singleMedia: {
    width: '100%',
    height: '100%',
  },
  videoOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  videoOverlayDuration: {
    position: 'absolute',
    bottom: 8,
    right: 8,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    color: '#fff',
    fontSize: 12,
    fontWeight: '500',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  videoDurationContainer: {
    position: 'absolute',
    bottom: 8,
    right: 8,
  },
  mediaGrid: {
    maxWidth: MAX_MEDIA_WIDTH,
    borderRadius: 12,
    overflow: 'hidden',
  },
  gridContentContainer: {
    padding: 2,
  },
  thumbnailContainer: {
    width: THUMBNAIL_SIZE,
    height: THUMBNAIL_SIZE,
    margin: 2,
    borderRadius: 8,
    overflow: 'hidden',
    backgroundColor: '#f0f0f0',
  },
  videoThumbnailContainer: {
    width: '100%',
    height: '100%',
    position: 'relative',
  },
  thumbnail: {
    width: '100%',
    height: '100%',
  },
  videoIndicator: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  videoDuration: {
    position: 'absolute',
    bottom: 4,
    right: 4,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    color: '#fff',
    fontSize: 10,
    fontWeight: '500',
    paddingHorizontal: 4,
    paddingVertical: 1,
    borderRadius: 4,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.9)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContainer: {
    flex: 1,
    width: '100%',
    height: '100%',
  },
  modalBackground: {
    flex: 1,
  },
  modalContent: {
    flex: 1,
    justifyContent: 'space-between',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
  },
  closeButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 10,
  },
  pullIndicator: {
    width: 36,
    height: 5,
    borderRadius: 2.5,
    backgroundColor: 'rgba(255, 255, 255, 0.5)',
    alignSelf: 'center',
    marginTop: 10,
  },
  modalTitle: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  prominentCloseButton: {
    position: 'absolute',
    top: 10,
    alignSelf: 'center',
    alignItems: 'center',
    zIndex: 20,
  },
  prominentCloseIconContainer: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 4,
  },
  closeText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
  mediaViewerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loader: {
    position: 'absolute',
    top: '50%',
    left: '50%',
    transform: [{ translateX: -20 }, { translateY: -20 }],
  },
  videoContainer: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  video: {
    width: '100%',
    height: '100%',
    backgroundColor: 'black', // Better default background for videos
  },
  videoPlayOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
  },
  playButton: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  fullImage: {
    width: '100%',
    height: '100%',
  },
  paginationContainer: {
    padding: 16,
  },
  paginationList: {
    paddingHorizontal: 8,
  },
  paginationItem: {
    width: 60,
    height: 60,
    borderRadius: 8,
    overflow: 'hidden',
    marginHorizontal: 4,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  selectedPaginationItem: {
    borderColor: '#6C5CE7',
  },
  paginationImage: {
    width: '100%',
    height: '100%',
  },
  paginationVideoIndicator: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
});

export default MediaMessage;