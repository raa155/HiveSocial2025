import React, { useState, useEffect, useRef } from 'react';
import { Animated, View, TouchableOpacity, Text, StyleSheet, Platform } from 'react-native';
import { Marker } from 'react-native-maps';
import EnhancedUserMapMarker from './EnhancedUserMapMarker';

interface SpiderfiedMarkerProps {
  marker: any;
  index: number;
  totalMarkers: number;
  baseCoordinate: {
    latitude: number;
    longitude: number;
  };
  onPress: (marker: any) => void;
  onAnimationComplete?: () => void;
}

const SpiderfiedMarker: React.FC<SpiderfiedMarkerProps> = ({
  marker,
  index,
  totalMarkers,
  baseCoordinate,
  onPress,
  onAnimationComplete
}) => {
  const animation = useRef(new Animated.Value(0)).current;
  
  // Calculate the target position in the spiderfied pattern
  // Using a spiral pattern for many markers or a circle for fewer
  const calculateTargetPosition = () => {
    const MIN_OFFSET = 0.0004; // Base offset distance in degrees
    const useSpiral = totalMarkers > 8;
    
    if (useSpiral) {
      // Spiral pattern - markers get progressively further out
      const spiralAngleDelta = 2 * Math.PI / 6; // How much to rotate per spiral
      const angle = index * spiralAngleDelta;
      const radius = MIN_OFFSET * (1 + Math.floor(index / 6) * 0.5);
      
      return {
        latitude: baseCoordinate.latitude + radius * Math.sin(angle),
        longitude: baseCoordinate.longitude + radius * Math.cos(angle)
      };
    } else {
      // Circle pattern - evenly distribute markers in a circle
      const angle = index * (2 * Math.PI / totalMarkers);
      const radius = MIN_OFFSET;
      
      return {
        latitude: baseCoordinate.latitude + radius * Math.sin(angle),
        longitude: baseCoordinate.longitude + radius * Math.cos(angle)
      };
    }
  };
  
  const targetPosition = calculateTargetPosition();
  
  // Calculate the interpolated position
  const latitude = animation.interpolate({
    inputRange: [0, 1],
    outputRange: [baseCoordinate.latitude, targetPosition.latitude]
  });
  
  const longitude = animation.interpolate({
    inputRange: [0, 1],
    outputRange: [baseCoordinate.longitude, targetPosition.longitude]
  });
  
  // Animate to the spiderfied position
  useEffect(() => {
    // Stagger the animations slightly
    const delay = index * 40;
    
    Animated.timing(animation, {
      toValue: 1,
      duration: 300,
      delay,
      useNativeDriver: false // Native driver doesn't work with coordinates
    }).start(() => {
      if (index === totalMarkers - 1 && onAnimationComplete) {
        onAnimationComplete();
      }
    });
    
    return () => {
      // Animate back when component unmounts
      Animated.timing(animation, {
        toValue: 0,
        duration: 200,
        useNativeDriver: false
      }).start();
    };
  }, []);

  return (
    <Marker
      coordinate={{
        latitude,
        longitude
      }}
      tracksViewChanges={Platform.OS === 'ios'} // iOS needs this set to true
      onPress={() => onPress(marker)}
    >
      <EnhancedUserMapMarker
        photoURL={marker.photoURL}
        distance={marker.distance}
        name={marker.name}
        tier={marker.tier}
        sharedInterestsCount={marker.sharedInterestsCount}
        online={marker.online}
      />
    </Marker>
  );
};

interface MarkerSpiderfierProps {
  markers: any[];
  baseCoordinate: {
    latitude: number;
    longitude: number;
  };
  onMarkerPress: (marker: any) => void;
  onClose: () => void;
}

const MarkerSpiderfier: React.FC<MarkerSpiderfierProps> = ({
  markers,
  baseCoordinate,
  onMarkerPress,
  onClose
}) => {
  const [animationComplete, setAnimationComplete] = useState(false);
  
  // Handle animation completion
  const handleAnimationComplete = () => {
    setAnimationComplete(true);
  };

  return (
    <>
      {/* Line connecting to base coordinate */}
      {markers.map((marker, index) => (
        <SpiderfiedMarker
          key={`spider-${marker.uid}-${index}`}
          marker={marker}
          index={index}
          totalMarkers={markers.length}
          baseCoordinate={baseCoordinate}
          onPress={onMarkerPress}
          onAnimationComplete={handleAnimationComplete}
        />
      ))}
      
      {/* Close button */}
      {animationComplete && (
        <Marker
          coordinate={baseCoordinate}
          tracksViewChanges={Platform.OS === 'ios'}
          onPress={onClose}
        >
          <TouchableOpacity style={styles.closeButton} onPress={onClose}>
            <Text style={styles.closeText}>×</Text>
          </TouchableOpacity>
        </Marker>
      )}
    </>
  );
};

const styles = StyleSheet.create({
  closeButton: {
    backgroundColor: 'rgba(255, 0, 0, 0.8)',
    width: 28,
    height: 28,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: 'white',
  },
  closeText: {
    color: 'white',
    fontSize: 18,
    fontWeight: 'bold',
    textAlign: 'center',
    marginTop: -2,
  },
});

export default MarkerSpiderfier;
