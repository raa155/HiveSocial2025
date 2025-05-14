import React, { useState, useEffect } from 'react';
import { StyleSheet, View, Text, TextInput, TouchableOpacity, ScrollView, Alert, ActivityIndicator, FlatList, Image, Platform } from 'react-native';
import { Stack, router } from 'expo-router';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import * as ImagePicker from 'expo-image-picker';
import { doc, updateDoc } from '@firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from '@firebase/storage';
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

export default function CompleteProfileScreen() {
  const { user, refreshUserData } = useAuth();
  const [name, setName] = useState('');
  const [bio, setBio] = useState('');
  const [selectedInterests, setSelectedInterests] = useState<string[]>([]);
  const [customInterests, setCustomInterests] = useState<string[]>([]);
  const [customInterest, setCustomInterest] = useState('');
  const [profileImage, setProfileImage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);

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
      
      console.log('Image uploaded successfully. URL:', downloadURL);
      
    } catch (error) {
      console.error('Error uploading image:', error);
      Alert.alert('Upload Failed', 'Failed to upload image. Please try again.');
    } finally {
      setUploadingImage(false);
    }
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
          'location.visible': true, // Default to visible for new users
          lastUpdated: new Date()
        };
        
        // Only include photoURL if a profile image was uploaded
        if (profileImage) {
          updateData.photoURL = profileImage;
        }
        
        await updateDoc(userRef, updateData);
        
        await refreshUserData();
        router.replace('/(tabs)');
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
      <Stack.Screen options={{ title: 'Complete Your Profile', headerShown: true }} />
      
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <Text style={styles.intro}>
          Complete your profile to start connecting with people who share your interests.
        </Text>
        
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
          <Text style={styles.changePhotoText}>Tap to add a profile photo</Text>
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
          <Text style={styles.charCount}>{bio.length}/200</Text>
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
        
        <TouchableOpacity
          style={[styles.saveButton, loading && styles.saveButtonDisabled]}
          onPress={handleSaveProfile}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <Text style={styles.saveButtonText}>Save Profile</Text>
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
  intro: {
    fontSize: 16,
    color: '#666',
    marginBottom: 24,
    lineHeight: 22,
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
