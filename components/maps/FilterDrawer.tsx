import React, { useMemo, useState, useEffect } from 'react';
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
  TextInput,
  Modal,
  Alert,
  FlatList
} from 'react-native';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';

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

// Gender Options
const GENDER_OPTIONS = ["Male", "Female", "Non-binary", "Any"];

// Activity Status Options
const ACTIVITY_OPTIONS = ["Recently active", "New users", "Any"];

// Looking For Options
const LOOKING_FOR_OPTIONS = ["Friendship", "Dating", "Activity partners", "Networking", "Any"];

const FILTER_PRESET_STORAGE_KEY = "hive_filter_presets";

interface FilterDrawerProps {
  visible: boolean;
  onClose: () => void;
  filters: {
    // Interest filters
    selectedInterests: string[];
    minSharedInterests: number;
    // Visibility filters
    onlineOnly: boolean;
    // Demographic filters
    ageRange: [number, number];
    selectedGender: string;
    // Activity filters
    activityStatus: string;
    // Looking for
    lookingFor: string;
  };
  allInterests: string[];
  onInterestToggle: (interest: string) => void;
  onMinSharedInterestsChange: (value: number) => void;
  onOnlineOnlyToggle: (value: boolean) => void;
  onAgeRangeChange: (value: [number, number]) => void;
  onGenderChange: (value: string) => void;
  onActivityStatusChange: (value: string) => void;
  onLookingForChange: (value: string) => void;
  onLoadPreset: (preset: any) => void;
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
  onAgeRangeChange,
  onGenderChange,
  onActivityStatusChange,
  onLookingForChange,
  onLoadPreset,
  drawerAnimation
}) => {
  // Local state for presets
  const [presets, setPresets] = useState<Array<{ name: string, filters: any }>>([]);
  const [showSavePresetModal, setShowSavePresetModal] = useState(false);
  const [presetName, setPresetName] = useState('');
  const [showPresetsModal, setShowPresetsModal] = useState(false);

  // Load presets on component mount
  useEffect(() => {
    loadPresets();
  }, []);

  // Load saved presets from AsyncStorage
  const loadPresets = async () => {
    try {
      const savedPresets = await AsyncStorage.getItem(FILTER_PRESET_STORAGE_KEY);
      if (savedPresets) {
        setPresets(JSON.parse(savedPresets));
      }
    } catch (error) {
      console.error('Error loading filter presets:', error);
    }
  };

  // Save a new preset
  const savePreset = async () => {
    if (!presetName.trim()) {
      Alert.alert('Error', 'Please enter a name for your preset');
      return;
    }

    try {
      // Check for duplicate names
      if (presets.some(p => p.name === presetName.trim())) {
        Alert.alert('Error', 'A preset with this name already exists');
        return;
      }

      const newPreset = {
        name: presetName.trim(),
        filters: { ...filters }
      };

      const updatedPresets = [...presets, newPreset];
      setPresets(updatedPresets);
      await AsyncStorage.setItem(FILTER_PRESET_STORAGE_KEY, JSON.stringify(updatedPresets));
      
      setPresetName('');
      setShowSavePresetModal(false);
      Alert.alert('Success', 'Filter preset saved successfully');
    } catch (error) {
      console.error('Error saving filter preset:', error);
      Alert.alert('Error', 'Failed to save preset');
    }
  };

  // Delete a preset
  const deletePreset = async (name: string) => {
    try {
      const updatedPresets = presets.filter(p => p.name !== name);
      setPresets(updatedPresets);
      await AsyncStorage.setItem(FILTER_PRESET_STORAGE_KEY, JSON.stringify(updatedPresets));
      Alert.alert('Success', 'Preset deleted successfully');
    } catch (error) {
      console.error('Error deleting preset:', error);
      Alert.alert('Error', 'Failed to delete preset');
    }
  };

  // Load a preset
  const handleLoadPreset = (preset: any) => {
    onLoadPreset(preset.filters);
    setShowPresetsModal(false);
  };

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

  // Helper function to render option buttons
  const renderOptionButtons = (options: string[], selectedOption: string, onSelect: (option: string) => void) => {
    return (
      <View style={styles.optionsContainer}>
        {options.map((option) => (
          <TouchableOpacity
            key={option}
            style={[
              styles.optionButton,
              selectedOption === option && styles.optionButtonSelected
            ]}
            onPress={() => onSelect(option)}
          >
            <Text
              style={[
                styles.optionText,
                selectedOption === option && styles.optionTextSelected
              ]}
            >
              {option}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
    );
  };

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
        <View style={styles.headerButtons}>
          <TouchableOpacity 
            onPress={() => setShowPresetsModal(true)} 
            style={styles.presetButton}
          >
            <FontAwesome name="list" size={20} color="#333" />
          </TouchableOpacity>
          <TouchableOpacity onPress={onClose} style={styles.closeButton}>
            <FontAwesome name="times" size={24} color="#333" />
          </TouchableOpacity>
        </View>
      </View>
      
      <ScrollView style={styles.scrollContent}>
        {/* Demographic Filters Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Demographics</Text>
          
          {/* Age Range Slider */}
          <Text style={styles.subsectionTitle}>Age Range: {filters.ageRange[0]} - {filters.ageRange[1]}</Text>
          
          {/* Minimum Age */}
          <View style={styles.ageSliderContainer}>
            <Text style={styles.ageLabel}>Min Age:</Text>
            <View style={styles.customSliderContainer}>
              <TouchableOpacity
                style={styles.sliderButton}
                onPress={() => {
                  if (filters.ageRange[0] > 18) {
                    onAgeRangeChange([filters.ageRange[0] - 1, filters.ageRange[1]]);
                  }
                }}
              >
                <Text style={styles.sliderButtonText}>-</Text>
              </TouchableOpacity>
              
              <TextInput
                style={styles.sliderInput}
                value={filters.ageRange[0].toString()}
                keyboardType="number-pad"
                onChangeText={(text) => {
                  const value = parseInt(text);
                  if (!isNaN(value) && value >= 18 && value <= filters.ageRange[1]) {
                    onAgeRangeChange([value, filters.ageRange[1]]);
                  }
                }}
              />
              
              <TouchableOpacity
                style={styles.sliderButton}
                onPress={() => {
                  if (filters.ageRange[0] < filters.ageRange[1]) {
                    onAgeRangeChange([filters.ageRange[0] + 1, filters.ageRange[1]]);
                  }
                }}
              >
                <Text style={styles.sliderButtonText}>+</Text>
              </TouchableOpacity>
            </View>
          </View>
          
          {/* Maximum Age */}
          <View style={styles.ageSliderContainer}>
            <Text style={styles.ageLabel}>Max Age:</Text>
            <View style={styles.customSliderContainer}>
              <TouchableOpacity
                style={styles.sliderButton}
                onPress={() => {
                  if (filters.ageRange[1] > filters.ageRange[0]) {
                    onAgeRangeChange([filters.ageRange[0], filters.ageRange[1] - 1]);
                  }
                }}
              >
                <Text style={styles.sliderButtonText}>-</Text>
              </TouchableOpacity>
              
              <TextInput
                style={styles.sliderInput}
                value={filters.ageRange[1].toString()}
                keyboardType="number-pad"
                onChangeText={(text) => {
                  const value = parseInt(text);
                  if (!isNaN(value) && value >= filters.ageRange[0] && value <= 100) {
                    onAgeRangeChange([filters.ageRange[0], value]);
                  }
                }}
              />
              
              <TouchableOpacity
                style={styles.sliderButton}
                onPress={() => {
                  if (filters.ageRange[1] < 100) {
                    onAgeRangeChange([filters.ageRange[0], filters.ageRange[1] + 1]);
                  }
                }}
              >
                <Text style={styles.sliderButtonText}>+</Text>
              </TouchableOpacity>
            </View>
          </View>
          
          {/* Gender Selection */}
          <Text style={styles.subsectionTitle}>Gender</Text>
          {renderOptionButtons(GENDER_OPTIONS, filters.selectedGender, onGenderChange)}
        </View>
        
        {/* Activity-based Filters */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Activity Status</Text>
          {renderOptionButtons(ACTIVITY_OPTIONS, filters.activityStatus, onActivityStatusChange)}
          
          {/* Online Only Toggle */}
          <View style={[styles.switchRow, { marginTop: 15 }]}>
            <Text style={styles.switchLabel}>Show Online Users Only</Text>
            <Switch
              value={filters.onlineOnly}
              onValueChange={onOnlineOnlyToggle}
              trackColor={{ false: "#D3D3D3", true: "#4B7BEC" }}
              thumbColor="#ffffff"
            />
          </View>
        </View>
        
        {/* Looking For Filters */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Looking For</Text>
          {renderOptionButtons(LOOKING_FOR_OPTIONS, filters.lookingFor, onLookingForChange)}
        </View>
        
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
        
        {/* Save Preset Button */}
        <View style={styles.section}>
          <TouchableOpacity 
            style={styles.savePresetButton}
            onPress={() => setShowSavePresetModal(true)}
          >
            <FontAwesome name="save" size={20} color="#fff" style={styles.saveIcon} />
            <Text style={styles.savePresetText}>Save Current Filters as Preset</Text>
          </TouchableOpacity>
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
      
      {/* Save Preset Modal */}
      <Modal
        transparent={true}
        visible={showSavePresetModal}
        animationType="fade"
        onRequestClose={() => setShowSavePresetModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Save Filter Preset</Text>
            <TextInput
              style={styles.presetNameInput}
              placeholder="Enter preset name"
              value={presetName}
              onChangeText={setPresetName}
              autoFocus
            />
            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={[styles.modalButton, styles.cancelButton]}
                onPress={() => {
                  setPresetName('');
                  setShowSavePresetModal(false);
                }}
              >
                <Text style={styles.modalButtonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalButton, styles.saveButton]}
                onPress={savePreset}
              >
                <Text style={styles.modalButtonText}>Save</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
      
      {/* Presets List Modal */}
      <Modal
        transparent={true}
        visible={showPresetsModal}
        animationType="fade"
        onRequestClose={() => setShowPresetsModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, styles.presetsModalContent]}>
            <Text style={styles.modalTitle}>Saved Filter Presets</Text>
            
            {presets.length === 0 ? (
              <Text style={styles.noPresetsText}>No saved presets yet</Text>
            ) : (
              <FlatList
                data={presets}
                keyExtractor={(item, index) => `preset-${index}`}
                renderItem={({ item }) => (
                  <View style={styles.presetItem}>
                    <TouchableOpacity
                      style={styles.presetItemButton}
                      onPress={() => handleLoadPreset(item)}
                    >
                      <Text style={styles.presetItemText}>{item.name}</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={styles.presetDeleteButton}
                      onPress={() => deletePreset(item.name)}
                    >
                      <FontAwesome name="trash" size={18} color="#ff6b6b" />
                    </TouchableOpacity>
                  </View>
                )}
                style={styles.presetsList}
              />
            )}
            
            <TouchableOpacity
              style={[styles.modalButton, styles.closePresetsButton]}
              onPress={() => setShowPresetsModal(false)}
            >
              <Text style={styles.modalButtonText}>Close</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
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
  headerButtons: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
  },
  closeButton: {
    padding: 5,
  },
  presetButton: {
    padding: 5,
    marginRight: 15,
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
    marginBottom: 15,
  },
  subsectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 10,
    marginTop: 5,
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
  ageSliderContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  ageLabel: {
    width: 70,
    fontSize: 14,
    color: '#333',
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
  optionsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginHorizontal: -5,
    marginTop: 5,
  },
  optionButton: {
    backgroundColor: '#f0f0f0',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    margin: 5,
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  optionButtonSelected: {
    backgroundColor: '#4B7BEC',
    borderColor: '#3B6AD9',
  },
  optionText: {
    fontSize: 14,
    color: '#555',
  },
  optionTextSelected: {
    color: 'white',
    fontWeight: '500',
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
  savePresetButton: {
    backgroundColor: '#4B7BEC',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 12,
    borderRadius: 8,
    marginTop: 10,
  },
  savePresetText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '500',
  },
  saveIcon: {
    marginRight: 8,
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
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    width: '85%',
    backgroundColor: 'white',
    borderRadius: 10,
    padding: 20,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  presetsModalContent: {
    width: '85%',
    maxHeight: '70%',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 15,
    color: '#333',
  },
  presetNameInput: {
    width: '100%',
    height: 50,
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    paddingHorizontal: 15,
    marginBottom: 20,
    fontSize: 16,
  },
  modalButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '100%',
  },
  modalButton: {
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 5,
    minWidth: 100,
    alignItems: 'center',
  },
  cancelButton: {
    backgroundColor: '#f1f1f1',
  },
  saveButton: {
    backgroundColor: '#4B7BEC',
  },
  closePresetsButton: {
    backgroundColor: '#4B7BEC',
    marginTop: 15,
  },
  modalButtonText: {
    fontSize: 16,
    fontWeight: '500',
    color: 'white',
  },
  presetsList: {
    width: '100%',
    maxHeight: 300,
  },
  presetItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 5,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
    width: '100%',
  },
  presetItemButton: {
    flex: 1,
  },
  presetItemText: {
    fontSize: 16,
    color: '#333',
  },
  presetDeleteButton: {
    padding: 8,
  },
  noPresetsText: {
    fontSize: 16,
    color: '#666',
    marginBottom: 15,
    fontStyle: 'italic',
    textAlign: 'center',
  },
});

export default FilterDrawer;
