import React, { useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Switch,
  Dimensions,
  Animated,
  PanResponder,
  TextInput
} from 'react-native';
import FontAwesome from '@expo/vector-icons/FontAwesome';

const { width } = Dimensions.get('window');
const DRAWER_WIDTH = width * 0.8; // 80% of screen width
const DISMISS_THRESHOLD = 50; // How far to swipe to dismiss

// Predefined interest categories
const INTEREST_CATEGORIES = {
  "Activities": [
    "Hiking", "Cycling", "Running", "Swimming", "Yoga", "Dancing", 
    "Photography", "Painting", "Drawing", "Crafting"
  ],
  "Entertainment": [
    "Movies", "TV Shows", "Gaming", "Music", "Reading", "Theater", 
    "Concerts", "Festivals"
  ],
  "Lifestyle": [
    "Cooking", "Baking", "Travel", "Fashion", "Fitness", "Meditation", 
    "Mindfulness"
  ],
  "Social & Intellectual": [
    "Politics", "History", "Science", "Philosophy", "Technology",
    "Languages", "Volunteering", "Networking"
  ],
  "Sports": [
    "Football", "Basketball", "Baseball", "Soccer", "Tennis", "Golf", 
    "Volleyball", "Skiing", "Snowboarding", "Surfing"
  ],
  "Other": [] // Will contain any interests not in above categories
};

interface FilterDrawerProps {
  visible: boolean;
  onClose: () => void;
  filters: {
    // Interest filters
    selectedInterests: string[];
    minSharedInterests: number;
    // Visibility filters
    onlineOnly: boolean;
  };
  allInterests: string[];
  onInterestToggle: (interest: string) => void;
  onMinSharedInterestsChange: (value: number) => void;
  onOnlineOnlyToggle: (value: boolean) => void;
  drawerAnimation: Animated.Value;
}

const FilterDrawer: React.FC<FilterDrawerProps> = ({
  visible,
  onClose,
  filters,
  allInterests,
  onInterestToggle,
  onMinSharedInterestsChange,
  onOnlineOnlyToggle,
  drawerAnimation
}) => {
  // Create pan responder for swipe to dismiss - HOOK 1
  const panResponder = useMemo(() => PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onMoveShouldSetPanResponder: (_, gestureState) => {
      // Only respond to horizontal gestures
      return Math.abs(gestureState.dx) > Math.abs(gestureState.dy) && gestureState.dx < 0;
    },
    onPanResponderMove: (_, gestureState) => {
      // Only allow swiping left (negative dx)
      if (gestureState.dx < 0) {
        drawerAnimation.setValue(gestureState.dx);
      }
    },
    onPanResponderRelease: (_, gestureState) => {
      if (gestureState.dx < -DISMISS_THRESHOLD) {
        // Swipe threshold met, close the drawer
        onClose();
      } else {
        // Reset to open position
        Animated.spring(drawerAnimation, {
          toValue: 0,
          useNativeDriver: true,
        }).start();
      }
    },
  }), [drawerAnimation, onClose]);

  // Sort interests into categories - HOOK 2
  const categorizedInterests = useMemo(() => {
    const result = {...INTEREST_CATEGORIES};
    
    // Initialize "Other" category
    result["Other"] = [];
    
    // Categorize each interest
    allInterests.forEach(interest => {
      let found = false;
      
      // Check each category
      for (const category in result) {
        if (category === "Other") continue; // Skip "Other" for now
        
        if (result[category].includes(interest)) {
          found = true;
          break;
        }
      }
      
      // If not found in any category, add to "Other"
      if (!found) {
        result["Other"].push(interest);
      }
    });
    
    return result;
  }, [allInterests]);

  // Don't render if not visible
  if (!visible) return null;

  return (
    <Animated.View 
      style={[
        styles.container,
        {
          transform: [{
            translateX: drawerAnimation.interpolate({
              inputRange: [-DRAWER_WIDTH, 0],
              outputRange: [-DRAWER_WIDTH, 0],
              extrapolate: 'clamp'
            })
          }]
        }
      ]}
      {...panResponder.panHandlers}
    >
      <View style={styles.header}>
        <Text style={styles.title}>Filters</Text>
        <TouchableOpacity onPress={onClose} style={styles.closeButton}>
          <FontAwesome name="times" size={24} color="#333" />
        </TouchableOpacity>
      </View>
      
      <ScrollView style={styles.scrollContent}>
        {/* Minimum Shared Interests Slider */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Minimum Shared Interests</Text>
          <Text style={styles.sliderValue}>{filters.minSharedInterests}</Text>
          
          <View style={styles.customSliderContainer}>
            <TouchableOpacity
              style={styles.sliderButton}
              onPress={() => {
                if (filters.minSharedInterests > 1) {
                  onMinSharedInterestsChange(filters.minSharedInterests - 1);
                }
              }}
            >
              <Text style={styles.sliderButtonText}>-</Text>
            </TouchableOpacity>
            
            <TextInput
              style={styles.sliderInput}
              value={filters.minSharedInterests.toString()}
              keyboardType="number-pad"
              onChangeText={(text) => {
                const value = parseInt(text);
                if (!isNaN(value) && value >= 1 && value <= 15) {
                  onMinSharedInterestsChange(value);
                }
              }}
            />
            
            <TouchableOpacity
              style={styles.sliderButton}
              onPress={() => {
                if (filters.minSharedInterests < 15) {
                  onMinSharedInterestsChange(filters.minSharedInterests + 1);
                }
              }}
            >
              <Text style={styles.sliderButtonText}>+</Text>
            </TouchableOpacity>
          </View>
          
          <View style={styles.sliderLabels}>
            <Text style={styles.sliderLabel}>1</Text>
            <Text style={styles.sliderLabel}>15</Text>
          </View>
        </View>
        
        {/* Online Only Toggle */}
        <View style={styles.section}>
          <View style={styles.switchRow}>
            <Text style={styles.switchLabel}>Show Online Users Only</Text>
            <Switch
              value={filters.onlineOnly}
              onValueChange={onOnlineOnlyToggle}
              trackColor={{ false: "#D3D3D3", true: "#4B7BEC" }}
              thumbColor="#ffffff"
            />
          </View>
        </View>
        
        {/* Interest Filters */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Filter by Interests</Text>
          <Text style={styles.sectionSubtitle}>
            Show users who have these interests
          </Text>
          
          {/* Categorized Interest List */}
          {Object.keys(categorizedInterests).map(category => {
            // Skip empty categories
            if (categorizedInterests[category].length === 0) return null;
            
            return (
              <View key={category} style={styles.categorySection}>
                <Text style={styles.categoryTitle}>{category}</Text>
                
                <View style={styles.interestsGrid}>
                  {categorizedInterests[category].map(interest => (
                    <TouchableOpacity 
                      key={interest}
                      style={[
                        styles.interestTag,
                        filters.selectedInterests.includes(interest) && styles.interestTagSelected
                      ]}
                      onPress={() => onInterestToggle(interest)}
                    >
                      <Text 
                        style={[
                          styles.interestText,
                          filters.selectedInterests.includes(interest) && styles.interestTextSelected
                        ]}
                      >
                        {interest}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            );
          })}
        </View>
        
        {/* Info section at bottom */}
        <View style={styles.infoSection}>
          <FontAwesome name="info-circle" size={16} color="#666" style={styles.infoIcon} />
          <Text style={styles.infoText}>
            Users will only appear if they match your filters AND you match their filters (bilateral filtering).
          </Text>
        </View>
        
        {/* Bottom padding for scrolling */}
        <View style={{ height: 30 }} />
      </ScrollView>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: DRAWER_WIDTH,
    height: '100%',
    backgroundColor: 'white',
    shadowColor: '#000',
    shadowOffset: { width: 2, height: 0 },
    shadowOpacity: 0.3,
    shadowRadius: 5,
    elevation: 10,
    zIndex: 1000,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
  },
  closeButton: {
    padding: 5,
  },
  scrollContent: {
    flex: 1,
  },
  section: {
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 10,
  },
  sectionSubtitle: {
    fontSize: 14,
    color: '#666',
    marginBottom: 15,
  },
  slider: {
    width: '100%',
    height: 40,
  },
  customSliderContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginVertical: 10,
    paddingHorizontal: 10,
  },
  sliderButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#4B7BEC',
    justifyContent: 'center',
    alignItems: 'center',
  },
  sliderButtonText: {
    color: 'white',
    fontSize: 24,
    fontWeight: 'bold',
  },
  sliderInput: {
    width: 60,
    height: 40,
    textAlign: 'center',
    fontSize: 18,
    fontWeight: 'bold',
    borderWidth: 1,
    borderColor: '#D3D3D3',
    borderRadius: 8,
  },
  sliderValue: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#4B7BEC',
    textAlign: 'center',
    marginBottom: 10,
  },
  sliderLabels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 10,
  },
  sliderLabel: {
    fontSize: 12,
    color: '#666',
  },
  switchRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  switchLabel: {
    fontSize: 16,
    color: '#333',
  },
  categorySection: {
    marginTop: 15,
  },
  categoryTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#555',
    marginBottom: 10,
  },
  interestsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginHorizontal: -5,
  },
  interestTag: {
    backgroundColor: '#f0f0f0',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    margin: 5,
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  interestTagSelected: {
    backgroundColor: '#4B7BEC',
    borderColor: '#3B6AD9',
  },
  interestText: {
    fontSize: 14,
    color: '#555',
  },
  interestTextSelected: {
    color: 'white',
    fontWeight: '500',
  },
  infoSection: {
    flexDirection: 'row',
    padding: 20,
    backgroundColor: '#f9f9f9',
    alignItems: 'flex-start',
  },
  infoIcon: {
    marginRight: 10,
    marginTop: 2,
  },
  infoText: {
    flex: 1,
    fontSize: 13,
    color: '#666',
    lineHeight: 18,
  },
});

export default FilterDrawer;
