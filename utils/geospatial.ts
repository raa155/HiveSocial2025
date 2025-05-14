/**
 * Utility functions for geospatial calculations and marker positioning
 */

import { Platform } from 'react-native';
import { GeoPoint } from '@firebase/firestore';

/**
 * Calculate distance between two points in meters using the Haversine formula
 */
export const getDistanceFromLatLonInMeters = (lat1: number, lon1: number, lat2: number, lon2: number): number => {
  const R = 6371; // Radius of the earth in km
  const dLat = deg2rad(lat2 - lat1);
  const dLon = deg2rad(lon2 - lon1);
  const a = 
    Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(deg2rad(lat1)) * Math.cos(deg2rad(lat2)) * 
    Math.sin(dLon/2) * Math.sin(dLon/2); 
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a)); 
  const d = R * c * 1000; // Distance in meters
  return d;
};

/**
 * Convert degrees to radians
 */
export const deg2rad = (deg: number): number => {
  return deg * (Math.PI/180);
};

/**
 * Create a GeoHash for Firebase GeoPoint (simplified implementation)
 */
export const createGeoHash = (latitude: number, longitude: number): string => {
  // This is a simplified version, in production you would use a library like geofire
  const lat = latitude.toFixed(6);
  const lng = longitude.toFixed(6);
  return `${lat}_${lng}`;
};

/**
 * Offset overlapping markers to make them all visible
 * Improved implementation that better handles multiple overlapping markers
 */
export const offsetOverlappingMarkers = (markers: any[]): any[] => {
  const MIN_DISTANCE = 0.00025; // Increased minimum distance in degrees lat/lng
  const result = [...markers];
  
  // Enhanced algorithm:
  // 1. Use a more precise method to detect overlapping
  // 2. Use a spiral pattern with increasing distance for more markers
  // 3. Consider marker size in the offset calculation
  
  // Group markers by location (with some tolerance)
  const locationGroups: {[key: string]: any[]} = {};
  
  markers.forEach(marker => {
    // Create a key by rounding the coordinates with higher precision
    const key = `${marker.latitude.toFixed(6)}_${marker.longitude.toFixed(6)}`;
    
    if (!locationGroups[key]) {
      locationGroups[key] = [];
    }
    
    locationGroups[key].push(marker);
  });
  
  // For each group with more than one marker, apply more sophisticated offsets
  Object.values(locationGroups).forEach(group => {
    if (group.length <= 1) return;
    
    // Sort by tier precedence (soulmate first, casual last)
    group.sort((a, b) => {
      const tierRanking: { [key: string]: number } = {
        'soulmate': 5,
        'bestFriend': 4,
        'friend': 3,
        'buddy': 2,
        'casual': 1
      };
      
      return tierRanking[b.tier] - tierRanking[a.tier];
    });
    
    // Keep the first marker at its original position
    const baseMarker = group[0];
    
    // For large groups, use a spiral pattern instead of a circle
    const useSpiral = group.length > 8;
    
    // Add a small identifier to show original coordinate group
    group.forEach((marker) => {
      marker.originalCoordinateGroup = key;
    });
    
    // Calculate scale based on marker's tier - larger markers need more space
    const getScaleForTier = (tier: string): number => {
      const tierScales: { [key: string]: number } = {
        'soulmate': 1.5,
        'bestFriend': 1.4,
        'friend': 1.3,
        'buddy': 1.2,
        'casual': 1.0
      };
      
      return tierScales[tier] || 1.0;
    };
    
    if (useSpiral) {
      // Apply spiral pattern for many markers
      const spiralAngleDelta = 2 * Math.PI / 6;  // How much to rotate per spiral
      let currentRadius = MIN_DISTANCE;
      let currentAngle = 0;
      
      for (let i = 1; i < group.length; i++) {
        const marker = group[i];
        const scale = getScaleForTier(marker.tier);
        
        // Calculate position on spiral
        const offsetLat = currentRadius * Math.sin(currentAngle) * scale;
        const offsetLng = currentRadius * Math.cos(currentAngle) * scale;
        
        // Apply offset
        marker.latitude = baseMarker.latitude + offsetLat;
        marker.longitude = baseMarker.longitude + offsetLng;
        
        // Increment angle and occasionally radius for spiral effect
        currentAngle += spiralAngleDelta;
        if (i % 6 === 0) {
          currentRadius += MIN_DISTANCE / 2;
        }
      }
    } else {
      // For smaller groups, use a circle with scaled distances
      for (let i = 1; i < group.length; i++) {
        const marker = group[i];
        const scale = getScaleForTier(marker.tier);
        
        // Calculate angle for this marker's position in the circle
        const angle = (i - 1) * (2 * Math.PI / (group.length - 1));
        
        // Apply scaled radius based on tier
        const radius = MIN_DISTANCE * scale;
        
        // Calculate offset
        const offsetLat = radius * Math.sin(angle);
        const offsetLng = radius * Math.cos(angle);
        
        // Apply offset
        marker.latitude = baseMarker.latitude + offsetLat;
        marker.longitude = baseMarker.longitude + offsetLng;
      }
    }
  });
  
  return result;
};

/**
 * Convert a region delta to a radius in meters
 */
export const deltaToRadiusInMeters = (latitude: number, latitudeDelta: number): number => {
  // Approximate conversion from delta to radius in meters
  // This is a simplified formula, not exact but good enough for visualization
  const EARTH_RADIUS = 6371000; // Earth radius in meters
  const latRadians = latitude * (Math.PI / 180);
  
  // Calculate the meters per degree at this latitude
  const metersPerDegree = EARTH_RADIUS * Math.cos(latRadians) * (Math.PI / 180);
  
  // Convert latitudeDelta to meters
  return latitudeDelta * metersPerDegree / 2;
};

/**
 * Convert a radius in meters to a region delta
 */
export const radiusToLatitudeDelta = (latitude: number, radiusInMeters: number): number => {
  // Approximate conversion from radius in meters to delta
  // This is a simplified formula, not exact but good enough for visualization
  const EARTH_RADIUS = 6371000; // Earth radius in meters
  const latRadians = latitude * (Math.PI / 180);
  
  // Calculate the degrees per meter at this latitude
  const degreesPerMeter = (180 / Math.PI) / (EARTH_RADIUS * Math.cos(latRadians));
  
  // Convert radius to latitudeDelta
  return radiusInMeters * degreesPerMeter * 2;
};

/**
 * Check if a device is using iOS
 */
export const isIOS = (): boolean => {
  return Platform.OS === 'ios';
};

export default {
  getDistanceFromLatLonInMeters,
  deg2rad,
  createGeoHash,
  offsetOverlappingMarkers,
  deltaToRadiusInMeters,
  radiusToLatitudeDelta,
  isIOS
};
