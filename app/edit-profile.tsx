import React, { useState, useEffect } from 'react';
import { 
  StyleSheet, 
  View, 
  Text, 
  TextInput, 
  TouchableOpacity, 
  ScrollView, 
  Alert, 
  ActivityIndicator, 
  FlatList, 
  Image, 
  Platform, 
  Dimensions,
  Animated,
} from 'react-native';
import { Stack, router } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import * as ImagePicker from 'expo-image-picker';
import { doc, updateDoc } from '@firebase/firestore';
import { ref, uploadBytes, getDownloadURL, deleteObject } from '@firebase/storage';
import { db, storage } from '@/config/firebase';
import { useAuth } from '@/contexts/AuthContext';
import { StatusBar } from 'expo-status-bar';

// Sample interests list - in a real app, this could be fetched from Firestore
const INTERESTS = [
  'Hiking', 'Reading', 'Gaming', 'Cooking', 'Photography', 
  'Art', 'Music', 'Movies', 'Sports', 'Travel', 
  'Technology', 'Fashion', 'Fitness', 'Dancing', 'Writing',
  'Gardening', 'Pets', 'Yoga', 'Meditation', 'Programming',
  'Coffee', 'Wine', 'Food', 'Cycling', 'Running'
];

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const CARD_PADDING = 20;

export default function EditProfileScreen() {
  const { user, userData, refreshUserData } = useAuth();
  const [name, setName] = useState('');
  const [bio, setBio] = useState('');
  const [selectedInterests, setSelectedInterests] = useState<string[]>([]);
  const [customInterests, setCustomInterests] = useState<string[]>([]);
  const [customInterest, setCustomInterest] = useState('');
  const [profileImage, setProfileImage] = useState<string | null>(null);
  const [profileImages, setProfileImages] = useState<string[]>([]);
  const [locationVisible, setLocationVisible] = useState(false);
  const [loading, setLoading] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);
  
  // For subtle animations
  const fadeAnim = useState(new Animated.Value(0))[0];
  
  // Load user data when the component mounts
  useEffect(() => {
    if (userData) {
      setName(userData.name || '');
      setBio(userData.bio || '');
      
      // Set existing interests
      if (userData.interests && Array.isArray(userData.interests)) {
        // Split interests into predefined and custom
        const predefined = userData.interests.filter(interest => INTERESTS.includes(interest));
        const custom = userData.interests.filter(interest => !INTERESTS.includes(interest));
        
        setSelectedInterests(predefined);
        setCustomInterests(custom);
      }
      
      // Set main profile image
      if (userData.photoURL) {
        setProfileImage(userData.photoURL);
      }
      
      // Set additional profile images
      if (userData.profileImages && Array.isArray(userData.profileImages)) {
        setProfileImages(userData.profileImages);
      }
      
      // Set location visibility
      if (userData.location && typeof userData.location.visible === 'boolean') {
        setLocationVisible(userData.location.visible);
      }
      
      // Run the fade-in animation
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 600,
        useNativeDriver: true,
      }).start();
    }
  }, [userData]);

  // Request permission for media library access
  useEffect(() => {
    (async () => {
      if (Platform.OS !== 'web') {
        const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (status !== 'granted') {
          Alert.alert('Permission Needed', 'Sorry, we need camera roll permissions to upload a profile photo.');
        }
      }
    })();
  }, []);

  const toggleInterest = (interest: string) => {
    if (selectedInterests.includes(interest)) {
      setSelectedInterests(selectedInterests.filter(item => item !== interest));
    } else {
      setSelectedInterests([...selectedInterests, interest]);
    }
  };

  const addCustomInterest = () => {
    if (!customInterest.trim()) {
      return;
    }
    
    // Check if interest already exists
    if ([...selectedInterests, ...customInterests].includes(customInterest.trim())) {
      Alert.alert('Interest Exists', 'You have already added this interest.');
      return;
    }
    
    setCustomInterests([...customInterests, customInterest.trim()]);
    setCustomInterest('');
  };

  const removeCustomInterest = (interest: string) => {
    setCustomInterests(customInterests.filter(item => item !== interest));
  };

  const pickImage = async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.7,
      });
      
      if (!result.canceled && result.assets && result.assets.length > 0) {
        await uploadImage(result.assets[0].uri);
      }
    } catch (error) {
      console.error('Error picking image:', error);
      Alert.alert('Error', 'Failed to pick image. Please try again.');
    }
  };

  const pickProfileImages = async () => {
    try {
      // Check how many more images can be added (limit of 6 total)
      const remainingSlots = 6 - profileImages.length;
      
      if (remainingSlots <= 0) {
        Alert.alert(
          'Maximum Images Reached', 
          'You can only have up to 6 profile images. Remove some existing images to add more.',
          [{ text: 'OK' }]
        );
        return;
      }
      
      // For Android, we need to explicitly set selectionLimit to avoid the bug
      // where multiple images are selected when only one was picked
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsMultipleSelection: true,
        selectionLimit: remainingSlots,
        quality: 0.7,
        exif: false, // Don't need EXIF data to reduce memory usage
      });
      
      if (!result.canceled && result.assets && result.assets.length > 0) {
        setUploadingImage(true);
        
        try {
          // Upload each image and get their URLs
          const uploadPromises = result.assets.map(asset => uploadProfileImage(asset.uri));
          const uploadedImageUrls = await Promise.all(uploadPromises);
          
          // Filter out any null values (failed uploads)
          const validUrls = uploadedImageUrls.filter(url => url !== null);
          
          if (validUrls.length > 0) {
            // Add the new image URLs to the existing array
            setProfileImages([...profileImages, ...validUrls]);
          }
        } catch (error) {
          console.error('Error uploading profile images:', error);
          Alert.alert('Upload Failed', 'Failed to upload one or more images. Please try again.');
        } finally {
          setUploadingImage(false);
        }
      }
    } catch (error) {
      console.error('Error picking multiple images:', error);
      Alert.alert('Error', 'Failed to pick images. Please try again.');
    }
  };

  const uploadImage = async (uri: string) => {
    setUploadingImage(true);
    
    try {
      // Get file name from URI
      const fileName = uri.split('/').pop();
      const fileExtension = fileName?.split('.').pop() || 'jpg';
      
      // Create a unique file name to avoid overwriting
      const storageFileName = `profile_${user?.uid}_${Date.now()}.${fileExtension}`;
      
      // Create a reference to the storage location
      const storageRef = ref(storage, `profile_images/${storageFileName}`);
      
      // Fetch the image and convert it to a blob
      const response = await fetch(uri);
      const blob = await response.blob();
      
      // Upload the blob to Firebase Storage
      const snapshot = await uploadBytes(storageRef, blob);
      
      // Get the download URL
      const downloadURL = await getDownloadURL(snapshot.ref);
      
      // Update the profile image state
      setProfileImage(downloadURL);
      
      console.log('Main profile image uploaded successfully. URL:', downloadURL);
      
      return downloadURL;
    } catch (error) {
      console.error('Error uploading image:', error);
      Alert.alert('Upload Failed', 'Failed to upload image. Please try again.');
      return null;
    } finally {
      setUploadingImage(false);
    }
  };

  const uploadProfileImage = async (uri: string) => {
    try {
      // Get file name from URI
      const fileName = uri.split('/').pop();
      const fileExtension = fileName?.split('.').pop() || 'jpg';
      
      // Create a unique file name to avoid overwriting
      const storageFileName = `profile_grid_${user?.uid}_${Date.now()}_${Math.random().toString(36).substring(2, 8)}.${fileExtension}`;
      
      // Create a reference to the storage location - store in a dedicated subfolder for better organization
      const storageRef = ref(storage, `profile_images/${storageFileName}`);
      
      // Fetch the image and convert it to a blob
      const response = await fetch(uri);
      const blob = await response.blob();
      
      // Upload the blob to Firebase Storage
      const snapshot = await uploadBytes(storageRef, blob);
      
      // Get the download URL
      const downloadURL = await getDownloadURL(snapshot.ref);
      
      console.log('Grid profile image uploaded successfully. URL:', downloadURL);
      
      return downloadURL;
    } catch (error) {
      console.error('Error uploading grid image:', error);
      return null; // Return null on error to help with filtering out failed uploads
    }
  };

  const removeProfileImage = async (imageUrl: string, index: number) => {
    try {
      setLoading(true);
      
      // Parse the URL to get the storage path
      if (imageUrl) {
        try {
          // First, remove from the profile images array (UI update)
          const updatedImages = [...profileImages];
          updatedImages.splice(index, 1);
          setProfileImages(updatedImages);
          
          // Try to extract the reference path from Firebase Storage URL
          // Example URL: https://firebasestorage.googleapis.com/v0/b/bucket-name.appspot.com/o/profile_images%2Fprofile_grid_uid_timestamp.jpg?alt=media&token=...
          if (imageUrl.includes('firebasestorage.googleapis.com')) {
            // Extract the path segment
            const baseUrlPattern = 'https://firebasestorage.googleapis.com/v0/b/[^/]+/o/';
            const pathStart = imageUrl.search(new RegExp(baseUrlPattern)) + imageUrl.match(new RegExp(baseUrlPattern))[0].length;
            const pathEnd = imageUrl.indexOf('?', pathStart);
            
            if (pathStart >= 0 && pathEnd >= 0) {
              // Get the encoded path and decode it
              const encodedPath = imageUrl.substring(pathStart, pathEnd);
              const path = decodeURIComponent(encodedPath);
              
              // Create a reference to the file
              const imageRef = ref(storage, path);
              
              console.log('Attempting to delete file at path:', path);
              
              // Delete the file
              await deleteObject(imageRef)
                .then(() => {
                  console.log('Image deleted successfully from storage');
                })
                .catch((error) => {
                  // Continue with UI update even if storage deletion fails
                  console.error('Error deleting image from storage:', error);
                });
            }
          }
        } catch (storageError) {
          console.error('Error parsing URL or deleting from storage:', storageError);
          // Continue anyway to keep UI consistent
        }
      }
      
      console.log('Image removed from profile grid');
    } catch (error) {
      console.error('Error removing profile image:', error);
      Alert.alert('Error', 'Failed to remove image. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const toggleLocationVisibility = () => {
    setLocationVisible(!locationVisible);
  };

  const handleSaveProfile = async () => {
    // Validation
    if (!name.trim()) {
      Alert.alert('Missing Information', 'Please enter your name.');
      return;
    }

    if ([...selectedInterests, ...customInterests].length < 1) {
      Alert.alert('Missing Information', 'Please select at least one interest.');
      return;
    }

    setLoading(true);

    try {
      if (user?.uid) {
        const userRef = doc(db, 'users', user.uid);
        
        // Combine selected predefined interests and custom interests
        const combinedInterests = [...selectedInterests, ...customInterests];
        
        const updateData: any = {
          name: name.trim(),
          bio: bio.trim(),
          interests: combinedInterests,
          'location.visible': locationVisible,
          lastUpdated: new Date()
        };
        
        // Only update photoURL if it's changed
        if (profileImage) {
          updateData.photoURL = profileImage;
        }
        
        // Add profile images array if exists
        if (profileImages.length > 0) {
          updateData.profileImages = profileImages;
        }
        
        await updateDoc(userRef, updateData);
        
        await refreshUserData();
        
        Alert.alert('Success', 'Your profile has been updated!', [
          { text: 'OK', onPress: () => router.back() }
        ]);
      }
    } catch (error) {
      console.error('Error updating profile:', error);
      Alert.alert('Error', 'Failed to save profile. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const renderInterestItem = ({ item }: { item: string }) => (
    <TouchableOpacity
      style={[
        styles.interestTag,
        selectedInterests.includes(item) && styles.interestTagSelected
      ]}
      onPress={() => toggleInterest(item)}
      activeOpacity={0.7}
    >
      <Text 
        style={[
          styles.interestText,
          selectedInterests.includes(item) && styles.interestTextSelected
        ]}
      >
        {item}
      </Text>
    </TouchableOpacity>
  );

  return (
    <Animated.View style={[styles.container, { opacity: fadeAnim }]}>
      <StatusBar style="dark" />
      <Stack.Screen 
        options={{ 
          headerShown: true,
          headerStyle: {
            backgroundColor: '#fff',
          },
          headerTitleStyle: {
            fontWeight: '600',
            color: '#333',
          },
          headerShadowVisible: false,
          headerTitle: 'Edit Profile',
        }} 
      />
      
      <ScrollView 
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Profile Image Section */}
        <View style={styles.profileImageSection}>
          <TouchableOpacity 
            style={styles.profileImageContainer}
            onPress={pickImage}
            disabled={uploadingImage || loading}
            activeOpacity={0.9}
          >
            {profileImage ? (
              <Image source={{ uri: profileImage }} style={styles.profileImage} />
            ) : (
              <View style={styles.placeholderImage}>
                <FontAwesome name="user" size={50} color="#fff" />
              </View>
            )}
            
            {uploadingImage && (
              <View style={styles.uploadingOverlay}>
                <ActivityIndicator size="large" color="#fff" />
              </View>
            )}
            
            <View style={styles.editIconContainer}>
              <MaterialIcons name="camera-alt" size={20} color="#fff" />
            </View>
          </TouchableOpacity>
          <Text style={styles.changePhotoText}>Tap to change profile photo</Text>
        </View>
        
        {/* Card for Name and Bio */}
        <View style={styles.card}>
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Name</Text>
            <TextInput
              style={styles.input}
              placeholder="Your name"
              value={name}
              onChangeText={setName}
              maxLength={50}
              editable={!loading}
              placeholderTextColor="#aaa"
            />
          </View>
          
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Bio</Text>
            <TextInput
              style={styles.bioInput}
              placeholder="Tell us about yourself..."
              value={bio}
              onChangeText={setBio}
              multiline
              maxLength={200}
              editable={!loading}
              placeholderTextColor="#aaa"
            />
            <Text style={styles.charCount}>{bio?.length || 0}/200</Text>
          </View>
        </View>
        
        {/* Photo Gallery Card */}
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <MaterialIcons name="photo-library" size={20} color="#6C5CE7" />
            <Text style={styles.cardTitle}>Photo Gallery</Text>
          </View>
          <Text style={styles.subLabel}>
            Add up to 6 photos to your profile gallery ({profileImages.length}/6)
          </Text>
          
          <View style={styles.profileImagesGrid}>
            {/* Render existing images */}
            {profileImages.map((imageUrl, index) => (
              <View key={index} style={styles.gridImageContainer}>
                <Image source={{ uri: imageUrl }} style={styles.gridImage} />
                <TouchableOpacity 
                  style={styles.removeImageButton}
                  onPress={() => removeProfileImage(imageUrl, index)}
                  disabled={loading}
                >
                  <MaterialIcons name="close" size={16} color="#fff" />
                </TouchableOpacity>
              </View>
            ))}
            
            {/* Add image button (if less than 6 images) */}
            {profileImages.length < 6 && (
              <TouchableOpacity 
                style={styles.addImageButton}
                onPress={pickProfileImages}
                disabled={uploadingImage || loading}
                activeOpacity={0.7}
              >
                {uploadingImage ? (
                  <ActivityIndicator size="small" color="#6C5CE7" />
                ) : (
                  <>
                    <MaterialIcons name="add-photo-alternate" size={28} color="#6C5CE7" />
                    <Text style={styles.addImageText}>Add Photos</Text>
                  </>
                )}
              </TouchableOpacity>
            )}
          </View>
        </View>
        
        {/* Interests Card */}
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <MaterialIcons name="favorite" size={20} color="#6C5CE7" />
            <Text style={styles.cardTitle}>Your Interests</Text>
          </View>
          <Text style={styles.subLabel}>
            Select interests to connect with like-minded people ({selectedInterests.length + customInterests.length} selected)
          </Text>
          
          <FlatList
            data={INTERESTS}
            renderItem={renderInterestItem}
            keyExtractor={(item) => item}
            numColumns={3}
            scrollEnabled={false}
            contentContainerStyle={styles.interestsContainer}
          />
          
          {/* Custom Interest Input */}
          <View style={styles.customInterestSection}>
            <Text style={styles.subLabel}>Add your own interests</Text>
            <View style={styles.customInterestInputContainer}>
              <TextInput
                style={styles.customInterestInput}
                placeholder="Add a custom interest"
                value={customInterest}
                onChangeText={setCustomInterest}
                maxLength={20}
                editable={!loading}
                placeholderTextColor="#aaa"
              />
              <TouchableOpacity
                style={[styles.addButton, (!customInterest.trim() || loading) && styles.addButtonDisabled]}
                onPress={addCustomInterest}
                disabled={!customInterest.trim() || loading}
              >
                <Text style={styles.addButtonText}>Add</Text>
              </TouchableOpacity>
            </View>
            
            {/* Custom Interests List */}
            {customInterests.length > 0 && (
              <View style={styles.customInterestsList}>
                {customInterests.map((interest, index) => (
                  <View key={index} style={styles.customInterestItem}>
                    <Text style={styles.customInterestText}>{interest}</Text>
                    <TouchableOpacity
                      style={styles.removeButton}
                      onPress={() => removeCustomInterest(interest)}
                      disabled={loading}
                    >
                      <MaterialIcons name="close" size={12} color="#fff" />
                    </TouchableOpacity>
                  </View>
                ))}
              </View>
            )}
          </View>
        </View>
        
        {/* Location Settings Card */}
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <MaterialIcons name="location-on" size={20} color="#6C5CE7" />
            <Text style={styles.cardTitle}>Location Settings</Text>
          </View>
          
          <TouchableOpacity 
            style={styles.visibilityToggle}
            onPress={toggleLocationVisibility}
            disabled={loading}
            activeOpacity={0.8}
          >
            <View style={styles.toggleTextContainer}>
              <Text style={styles.visibilityText}>
                Show my location to other users
              </Text>
              <Text style={styles.visibilityDescription}>
                {locationVisible 
                  ? 'Your location is visible to other users'
                  : 'Your location is hidden from other users'}
              </Text>
            </View>
            
            <View style={[
              styles.toggleSwitch,
              locationVisible && styles.toggleSwitchActive
            ]}>
              <View style={[
                styles.toggleBall,
                locationVisible && styles.toggleBallActive
              ]} />
            </View>
          </TouchableOpacity>
        </View>
        
        {/* Save Button */}
        <TouchableOpacity
          style={[styles.saveButton, loading && styles.saveButtonDisabled]}
          onPress={handleSaveProfile}
          disabled={loading}
          activeOpacity={0.8}
        >
          <LinearGradient
            colors={loading ? ['#a29bfe', '#a29bfe'] : ['#6C5CE7', '#a29bfe']}
            style={styles.saveButtonGradient}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
          >
            {loading ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <Text style={styles.saveButtonText}>Save Changes</Text>
            )}
          </LinearGradient>
        </TouchableOpacity>
      </ScrollView>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingBottom: 40,
  },
  profileImageSection: {
    alignItems: 'center',
    marginTop: 16,
    marginBottom: 20,
  },
  profileImageContainer: {
    position: 'relative',
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: '#eee',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
    overflow: 'hidden',
    borderWidth: 5,
    borderColor: '#fff',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 5,
    elevation: 3,
  },
  profileImage: {
    width: 120,
    height: 120,
    borderRadius: 60,
  },
  placeholderImage: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: '#a29bfe',
    justifyContent: 'center',
    alignItems: 'center',
  },
  uploadingOverlay: {
    position: 'absolute',
    width: '100%',
    height: '100%',
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  editIconContainer: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    backgroundColor: '#6C5CE7',
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#fff',
  },
  changePhotoText: {
    fontSize: 14,
    color: '#6C5CE7',
    fontWeight: '500',
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 16,
    marginBottom: 16,
    padding: CARD_PADDING,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 3,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    marginLeft: 8,
  },
  inputGroup: {
    marginBottom: 16,
  },
  label: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
  },
  subLabel: {
    fontSize: 14,
    color: '#666',
    marginBottom: 12,
  },
  input: {
    backgroundColor: '#f9f9f9',
    borderWidth: 1,
    borderColor: '#e0e0e0',
    borderRadius: 12,
    padding: 14,
    fontSize: 16,
    color: '#333',
  },
  bioInput: {
    backgroundColor: '#f9f9f9',
    borderWidth: 1,
    borderColor: '#e0e0e0',
    borderRadius: 12,
    padding: 14,
    fontSize: 16,
    height: 120,
    textAlignVertical: 'top',
    color: '#333',
  },
  charCount: {
    fontSize: 12,
    color: '#999',
    textAlign: 'right',
    marginTop: 4,
  },
  profileImagesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginHorizontal: -6,
  },
  gridImageContainer: {
    width: (SCREEN_WIDTH - 32 - CARD_PADDING * 2 - 12) / 3,
    aspectRatio: 1,
    padding: 6,
    position: 'relative',
  },
  gridImage: {
    width: '100%',
    height: '100%',
    borderRadius: 12,
  },
  removeImageButton: {
    position: 'absolute',
    top: 10,
    right: 10,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    width: 24,
    height: 24,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 2,
  },
  addImageButton: {
    width: (SCREEN_WIDTH - 32 - CARD_PADDING * 2 - 12) / 3,
    aspectRatio: 1,
    padding: 6,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f3f0ff',
    borderRadius: 12,
    marginHorizontal: 6,
  },
  addImageText: {
    fontSize: 14,
    color: '#6C5CE7',
    fontWeight: '500',
    marginTop: 8,
  },
  interestsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginHorizontal: -4,
  },
  interestTag: {
    backgroundColor: '#f9f9f9',
    borderWidth: 1,
    borderColor: '#e0e0e0',
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 8,
    margin: 4,
  },
  interestTagSelected: {
    backgroundColor: '#6C5CE7',
    borderColor: '#6C5CE7',
  },
  interestText: {
    fontSize: 14,
    color: '#666',
    fontWeight: '500',
  },
  interestTextSelected: {
    color: '#fff',
  },
  customInterestSection: {
    marginTop: 20,
  },
  customInterestInputContainer: {
    flexDirection: 'row',
    marginBottom: 12,
  },
  customInterestInput: {
    flex: 1,
    backgroundColor: '#f9f9f9',
    borderWidth: 1,
    borderColor: '#e0e0e0',
    borderRadius: 12,
    padding: 14,
    fontSize: 16,
    marginRight: 10,
    color: '#333',
  },
  addButton: {
    backgroundColor: '#6C5CE7',
    borderRadius: 12,
    paddingHorizontal: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  addButtonDisabled: {
    backgroundColor: '#a29bfe',
  },
  addButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  customInterestsList: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: 8,
  },
  customInterestItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f3f0ff',
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 6,
    marginRight: 8,
    marginBottom: 8,
  },
  customInterestText: {
    fontSize: 14,
    color: '#6C5CE7',
    fontWeight: '500',
    marginRight: 8,
  },
  removeButton: {
    backgroundColor: '#6C5CE7',
    width: 20,
    height: 20,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  visibilityToggle: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#f9f9f9',
    borderWidth: 1,
    borderColor: '#e0e0e0',
    borderRadius: 12,
    padding: 16,
  },
  toggleTextContainer: {
    flex: 1,
  },
  visibilityText: {
    fontSize: 16,
    color: '#333',
    fontWeight: '500',
  },
  visibilityDescription: {
    fontSize: 14,
    color: '#777',
    marginTop: 4,
  },
  toggleSwitch: {
    width: 50,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#e0e0e0',
    padding: 2,
  },
  toggleSwitchActive: {
    backgroundColor: '#a29bfe',
  },
  toggleBall: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#fff',
  },
  toggleBallActive: {
    transform: [{ translateX: 22 }],
  },
  saveButton: {
    marginTop: 8,
    borderRadius: 12,
    overflow: 'hidden',
    marginBottom: 30,
    shadowColor: '#6C5CE7',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 5,
  },
  saveButtonDisabled: {
    opacity: 0.8,
  },
  saveButtonGradient: {
    paddingVertical: 16,
    alignItems: 'center',
  },
  saveButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
});
