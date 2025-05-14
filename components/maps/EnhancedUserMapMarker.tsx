import React, { useState, useEffect, useRef } from 'react';
import { View, Image, Text, StyleSheet, ViewStyle, ActivityIndicator } from 'react-native';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import { Asset } from 'expo-asset';

// Define tier types for the marker
export type MarkerTier = 'soulmate' | 'bestFriend' | 'friend' | 'buddy' | 'casual';

// Define the props for the enhanced marker component
interface EnhancedUserMapMarkerProps {
  photoURL?: string;
  distance?: number;
  name?: string;
  tier?: MarkerTier;
  sharedInterestsCount?: number;
  online?: boolean;
  style?: ViewStyle;
}

/**
 * Enhanced map marker component for displaying users on the map with tier-based styling
 */
const EnhancedUserMapMarker: React.FC<EnhancedUserMapMarkerProps> = ({ 
  photoURL, 
  distance, 
  name, 
  tier = 'casual',
  sharedInterestsCount = 0,
  online = false,
  style 
}) => {
  const [imageLoaded, setImageLoaded] = useState(false);
  const [imageError, setImageError] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [tracksViewChanges, setTracksViewChanges] = useState(true);
  const [imageKey, setImageKey] = useState(Date.now().toString());
  const retryCount = useRef(0);
  const imageComponent = useRef(null);

  // Load image and handle errors with retry mechanism
  useEffect(() => {
    if (photoURL) {
      // Reset states when photoURL changes
      setIsLoading(true);
      setImageLoaded(false);
      setImageError(false);
      setTracksViewChanges(true);

      // Force refresh of image
      setImageKey(Date.now().toString());
      
      // Set up a timeout to stop tracking view changes after image loads
      const viewChangesTimeout = setTimeout(() => {
        if (tracksViewChanges) {
          console.log('Setting tracksViewChanges to false for:', name);
          setTracksViewChanges(false);
        }
      }, 2000);

      // Prefetch image to pre-cache
      if (photoURL) {
        console.log('Prefetching image for marker:', name);
        Image.prefetch(photoURL).catch(err => {
          console.log('Prefetch error:', err);
        });
      }
      
      return () => {
        clearTimeout(viewChangesTimeout);
      };
    }
  }, [photoURL]);

  // Add an automatic retry mechanism if the image fails to load
  useEffect(() => {
    if (photoURL && imageError && retryCount.current < 3) {
      const retryTimeout = setTimeout(() => {
        console.log(`Retry ${retryCount.current + 1} loading image for:`, name);
        retryCount.current += 1;
        setImageKey(Date.now().toString());
        setImageError(false);
        setIsLoading(true);
      }, 1000);
      
      return () => clearTimeout(retryTimeout);
    }
  }, [imageError, photoURL, name]);

  // Handle image load success
  const handleImageLoad = () => {
    console.log('Image loaded successfully for:', name);
    setImageLoaded(true);
    setImageError(false);
    setIsLoading(false);
    
    // After a short delay, set tracksViewChanges to false for performance
    setTimeout(() => {
      setTracksViewChanges(false);
    }, 100);
  };

  // Handle image load error
  const handleImageError = (error) => {
    console.error('Image load error for user:', name, error?.nativeEvent?.error || 'Unknown error');
    setImageError(true);
    setIsLoading(false);
  };

  // Determine the marker size based on tier
  const getMarkerSize = () => {
    const safeType = tier || 'casual';
    switch(safeType) {
      case 'soulmate': return { container: 60, image: 52 };
      case 'bestFriend': return { container: 52, image: 44 };
      case 'friend': return { container: 48, image: 40 };
      case 'buddy': return { container: 44, image: 36 };
      case 'casual':
      default: return { container: 40, image: 32 };
    }
  };

  // Determine the marker border color based on tier
  const getMarkerColor = () => {
    const safeType = tier || 'casual';
    switch(safeType) {
      case 'soulmate': return '#00B0FF'; // Light blue
      case 'bestFriend': return '#FFD700'; // Gold
      case 'friend': return '#C0C0C0'; // Silver
      case 'buddy': return '#CD7F32'; // Bronze
      case 'casual':
      default: return '#AAAAAA'; // Gray
    }
  };

  const markerSize = getMarkerSize();
  const markerColor = getMarkerColor();
  
  const containerRadius = markerSize.container / 2;
  const imageRadius = markerSize.image / 2;

  return (
    <View style={[styles.container, style]}>
      <View 
        style={[
          styles.imageContainer, 
          { 
            width: markerSize.container, 
            height: markerSize.container, 
            borderRadius: containerRadius,
            borderColor: markerColor,
            backgroundColor: '#fff',
            justifyContent: 'center',
            alignItems: 'center',
            overflow: 'hidden'
          }
        ]}
      >
        {photoURL ? (
          <>
            {/* Default icon shown while image is loading */}
            {(!imageLoaded || imageError) && (
              <View style={[
                styles.defaultImage, 
                { 
                  width: markerSize.image, 
                  height: markerSize.image, 
                  borderRadius: imageRadius,
                  backgroundColor: markerColor
                }
              ]}>
                <FontAwesome 
                  name="user" 
                  size={markerSize.image / 2.5} 
                  color="#fff" 
                />
              </View>
            )}
            
            {/* Main profile image */}
            <Image 
              key={imageKey}
              ref={imageComponent}
              source={{ 
                uri: photoURL,
                cache: 'force-cache'
              }}
              style={[
                styles.image, 
                { 
                  width: markerSize.image, 
                  height: markerSize.image, 
                  borderRadius: imageRadius,
                  opacity: imageLoaded ? 1 : 0  // Only show when loaded
                }
              ]}
              onLoad={handleImageLoad}
              onError={handleImageError}
              resizeMode="cover"
              fadeDuration={0}
            />
            
            {/* Loading indicator */}
            {isLoading && !imageLoaded && !imageError && (
              <ActivityIndicator 
                size="small" 
                color={markerColor} 
                style={styles.loadingIndicator}
              />
            )}
          </>
        ) : (
          <View style={[
            styles.defaultImage, 
            { 
              width: markerSize.image, 
              height: markerSize.image, 
              borderRadius: imageRadius,
              backgroundColor: markerColor
            }
          ]}>
            <FontAwesome 
              name="user" 
              size={markerSize.image / 2.5} 
              color="#fff" 
            />
          </View>
        )}
      </View>
      
      {/* Display the number of shared interests */}
      {sharedInterestsCount > 0 && (
        <View style={[styles.interestBadge, { backgroundColor: markerColor }]}>
          <Text style={styles.interestCount}>{sharedInterestsCount}</Text>
        </View>
      )}
      
      {/* Online status indicator */}
      {online && (
        <View style={styles.onlineIndicator} />
      )}
      
      {/* Display distance if available */}
      {distance && (
        <View style={[styles.distanceContainer, { backgroundColor: `${markerColor}CC` }]}>
          <Text style={styles.distanceText}>{distance}m</Text>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    width: 80,
    height: 70,
  },
  imageContainer: {
    borderWidth: 3,
    position: 'relative',
  },
  image: {
    backgroundColor: '#eee',
  },
  defaultImage: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  distanceContainer: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
    marginTop: 4,
  },
  distanceText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: 'bold',
  },
  interestBadge: {
    position: 'absolute',
    top: -5,
    right: 5,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#007bff',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#fff',
  },
  interestCount: {
    color: '#fff',
    fontSize: 10,
    fontWeight: 'bold',
  },
  onlineIndicator: {
    position: 'absolute',
    bottom: -5,
    right: 5,
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#4CAF50', // Green for online
    borderWidth: 1,
    borderColor: '#fff',
  },
  loadingIndicator: {
    position: 'absolute',
  }
});

export default EnhancedUserMapMarker;
