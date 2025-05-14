import React, { useState } from 'react';
import { View, Image, Text, StyleSheet } from 'react-native';
import FontAwesome from '@expo/vector-icons/FontAwesome';

/**
 * Custom marker component for maps that displays a user's profile photo
 */
const UserMapMarker = ({ photoURL, distance, name }) => {
  const [imageLoaded, setImageLoaded] = useState(false);
  const [imageError, setImageError] = useState(false);
  
  // Log props for debugging
  console.log('UserMapMarker props:', { 
    photoURL: photoURL ? 'exists' : 'missing', 
    photoURLLength: photoURL ? photoURL.length : 0,
    distance, 
    name 
  });

  // Handle image load error
  const handleImageError = (error) => {
    console.error('Image load error:', error.nativeEvent.error);
    setImageError(true);
  };

  // Handle image load success
  const handleImageLoad = () => {
    console.log('Image loaded successfully for:', name);
    setImageLoaded(true);
  };

  return (
    <View style={styles.container}>
      <View style={styles.imageContainer}>
        {photoURL && !imageError ? (
          <Image 
            source={{ uri: photoURL }} 
            style={styles.image}
            onLoad={handleImageLoad}
            onError={handleImageError}
          />
        ) : (
          <View style={styles.defaultImage}>
            <FontAwesome name="user" size={20} color="#fff" />
            {imageError && <Text style={styles.errorIndicator}>!</Text>}
          </View>
        )}
      </View>
      {distance && (
        <View style={styles.distanceContainer}>
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
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#fff',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#007bff',
    overflow: 'hidden',
  },
  image: {
    width: 40,
    height: 40,
    borderRadius: 20,
    resizeMode: 'cover',
  },
  defaultImage: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#007bff',
    justifyContent: 'center',
    alignItems: 'center',
  },
  distanceContainer: {
    backgroundColor: 'rgba(0, 123, 255, 0.8)',
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
  errorIndicator: {
    position: 'absolute',
    bottom: 2,
    right: 2,
    color: '#ff0000',
    fontSize: 10,
    fontWeight: 'bold',
  },
});

export default UserMapMarker;
