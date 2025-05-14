import React, { useState, useEffect } from 'react';
import { StyleSheet, View, Text, TextInput, TouchableOpacity, ScrollView, Alert, ActivityIndicator, FlatList, Image, Platform, Dimensions } from 'react-native';
import { Stack, router } from 'expo-router';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import * as ImagePicker from 'expo-image-picker';
import { doc, updateDoc } from '@firebase/firestore';
import { ref, uploadBytes, getDownloadURL, deleteObject } from '@firebase/storage';
import { db, storage } from '@/config/firebase';
import { useAuth } from '@/contexts/AuthContext';

// Sample interests list - in a real app, this could be fetched from Firestore
const INTERESTS = [
  'Hiking', 'Reading', 'Gaming', 'Cooking', 'Photography', 
  'Art', 'Music', 'Movies', 'Sports', 'Travel', 
  'Technology', 'Fashion', 'Fitness', 'Dancing', 'Writing',
  'Gardening', 'Pets', 'Yoga', 'Meditation', 'Programming',
  'Coffee', 'Wine', 'Food', 'Cycling', 'Running'
];

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
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
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
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
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
    <View style={styles.container}>
      <Stack.Screen options={{ title: 'Edit Profile', headerShown: true }} />
      
      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Profile Image Section */}
        <View style={styles.profileImageSection}>
          <TouchableOpacity 
            style={styles.profileImageContainer}
            onPress={pickImage}
            disabled={uploadingImage || loading}
          >
            {profileImage ? (
              <Image source={{ uri: profileImage }} style={styles.profileImage} />
            ) : (
              <FontAwesome name="user-circle" size={100} color="#ccc" />
            )}
            
            {uploadingImage && (
              <View style={styles.uploadingOverlay}>
                <ActivityIndicator size="large" color="#fff" />
              </View>
            )}
            
            <View style={styles.editIconContainer}>
              <FontAwesome name="camera" size={16} color="#fff" />
            </View>
          </TouchableOpacity>
          <Text style={styles.changePhotoText}>Tap to change main profile photo</Text>
        </View>
        
        {/* Profile Images Grid Section */}
        <View style={styles.section}>
          <Text style={styles.label}>Photo Gallery</Text>
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
                  <FontAwesome name="times" size={16} color="#fff" />
                </TouchableOpacity>
              </View>
            ))}
            
            {/* Add image button (if less than 6 images) */}
            {profileImages.length < 6 && (
              <TouchableOpacity 
                style={styles.addImageButton}
                onPress={pickProfileImages}
                disabled={uploadingImage || loading}
              >
                {uploadingImage ? (
                  <ActivityIndicator size="small" color="#007bff" />
                ) : (
                  <>
                    <FontAwesome name="plus" size={24} color="#007bff" />
                    <Text style={styles.addImageText}>Add Photos</Text>
                  </>
                )}
              </TouchableOpacity>
            )}
          </View>
        </View>
        
        <View style={styles.section}>
          <Text style={styles.label}>Name</Text>
          <TextInput
            style={styles.input}
            placeholder="Your name"
            value={name}
            onChangeText={setName}
            maxLength={50}
            editable={!loading}
          />
        </View>
        
        <View style={styles.section}>
          <Text style={styles.label}>Bio</Text>
          <TextInput
            style={styles.bioInput}
            placeholder="Tell us about yourself..."
            value={bio}
            onChangeText={setBio}
            multiline
            maxLength={200}
            editable={!loading}
          />
          <Text style={styles.charCount}>{bio?.length || 0}/200</Text>
        </View>
        
        <View style={styles.section}>
          <Text style={styles.label}>Your Interests</Text>
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
                      <FontAwesome name="times" size={14} color="#fff" />
                    </TouchableOpacity>
                  </View>
                ))}
              </View>
            )}
          </View>
        </View>
        
        {/* Location Visibility Toggle */}
        <View style={styles.section}>
          <Text style={styles.label}>Location Settings</Text>
          <TouchableOpacity 
            style={styles.visibilityToggle}
            onPress={toggleLocationVisibility}
            disabled={loading}
          >
            <Text style={styles.visibilityText}>
              Show my location to other users
            </Text>
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
          <Text style={styles.visibilityDescription}>
            {locationVisible 
              ? 'Your location is visible to other users on the map.'
              : 'Your location is hidden from other users on the map.'}
          </Text>
        </View>
        
        <TouchableOpacity
          style={[styles.saveButton, loading && styles.saveButtonDisabled]}
          onPress={handleSaveProfile}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <Text style={styles.saveButtonText}>Save Changes</Text>
          )}
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f8f8',
  },
  scrollContent: {
    padding: 20,
    paddingBottom: 40,
  },
  profileImageSection: {
    alignItems: 'center',
    marginBottom: 24,
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
  },
  profileImage: {
    width: 120,
    height: 120,
    borderRadius: 60,
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
    backgroundColor: '#007bff',
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
    color: '#007bff',
  },
  profileImagesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'flex-start',
    marginHorizontal: -5,
  },
  gridImageContainer: {
    width: '33.33%',
    aspectRatio: 1,
    padding: 5,
    position: 'relative',
  },
  gridImage: {
    width: '100%',
    height: '100%',
    borderRadius: 8,
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
    width: '33.33%',
    aspectRatio: 1,
    padding: 5,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f0f8ff',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#cce5ff',
    borderStyle: 'dashed',
  },
  addImageText: {
    fontSize: 12,
    color: '#007bff',
    marginTop: 8,
  },
  section: {
    marginBottom: 24,
  },
  label: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 8,
  },
  subLabel: {
    fontSize: 14,
    color: '#666',
    marginBottom: 12,
  },
  input: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
  },
  bioInput: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    height: 120,
    textAlignVertical: 'top',
  },
  charCount: {
    fontSize: 12,
    color: '#999',
    textAlign: 'right',
    marginTop: 4,
  },
  interestsContainer: {
    marginHorizontal: -4,
  },
  interestTag: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 8,
    margin: 4,
  },
  interestTagSelected: {
    backgroundColor: '#007bff',
    borderColor: '#007bff',
  },
  interestText: {
    fontSize: 14,
    color: '#666',
  },
  interestTextSelected: {
    color: '#fff',
  },
  customInterestSection: {
    marginTop: 16,
  },
  customInterestInputContainer: {
    flexDirection: 'row',
    marginBottom: 12,
  },
  customInterestInput: {
    flex: 1,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    marginRight: 8,
  },
  addButton: {
    backgroundColor: '#007bff',
    borderRadius: 8,
    paddingHorizontal: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  addButtonDisabled: {
    backgroundColor: '#99caff',
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
    backgroundColor: '#e1f5fe',
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 6,
    marginRight: 8,
    marginBottom: 8,
  },
  customInterestText: {
    fontSize: 14,
    color: '#0288d1',
    marginRight: 8,
  },
  removeButton: {
    backgroundColor: '#0288d1',
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
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 12,
    marginBottom: 8,
  },
  visibilityText: {
    fontSize: 16,
    color: '#333',
  },
  toggleSwitch: {
    width: 50,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#ccc',
    padding: 2,
  },
  toggleSwitchActive: {
    backgroundColor: '#34c759',
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
  visibilityDescription: {
    fontSize: 14,
    color: '#666',
    marginBottom: 8,
  },
  saveButton: {
    backgroundColor: '#007bff',
    borderRadius: 8,
    padding: 16,
    alignItems: 'center',
    marginTop: 20,
  },
  saveButtonDisabled: {
    backgroundColor: '#99caff',
  },
  saveButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
});
