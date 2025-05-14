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
 * This is a simple implementation that offsets markers in a circular pattern
 */
export const offsetOverlappingMarkers = (markers: any[]): any[] => {
  const MIN_DISTANCE = 0.0001; // Minimum distance in degrees lat/lng
  const result = [...markers];
  
  // Simple algorithm for demonstration:
  // 1. Sort markers by priority (e.g. tier)
  // 2. For each marker, check if it's too close to any previous marker
  // 3. If too close, offset it in a spiral pattern
  
  // Group markers by location (with some tolerance)
  const locationGroups: {[key: string]: any[]} = {};
  
  markers.forEach(marker => {
    // Create a key by rounding the coordinates
    const key = `${marker.latitude.toFixed(5)}_${marker.longitude.toFixed(5)}`;
    
    if (!locationGroups[key]) {
      locationGroups[key] = [];
    }
    
    locationGroups[key].push(marker);
  });
  
  // For each group with more than one marker, apply offsets
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
    // Offset the rest in a circle around it
    const baseMarker = group[0];
    const radius = MIN_DISTANCE * 2;
    
    for (let i = 1; i < group.length; i++) {
      // Calculate angle for this marker's position in the circle
      const angle = (i - 1) * (2 * Math.PI / (group.length - 1));
      
      // Calculate offset
      const offsetLat = radius * Math.sin(angle);
      const offsetLng = radius * Math.cos(angle);
      
      // Apply offset
      group[i].latitude = baseMarker.latitude + offsetLat;
      group[i].longitude = baseMarker.longitude + offsetLng;
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
