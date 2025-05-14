import React, { useState } from 'react';
import { StyleSheet, View, Text, Image, ScrollView, TouchableOpacity, Switch, Alert, ActivityIndicator, Modal, Dimensions } from 'react-native';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import { useAuth } from '@/contexts/AuthContext';
import { signOut } from '@firebase/auth';
import { doc, updateDoc } from '@firebase/firestore';
import { auth, db } from '@/config/firebase';
import { router } from 'expo-router';

export default function ProfileScreen() {
  const { userData, user, refreshUserData } = useAuth();
  const [locationVisible, setLocationVisible] = useState(userData?.location?.visible || false);
  const [loading, setLoading] = useState(false);
  const [selectedImageIndex, setSelectedImageIndex] = useState<number | null>(null);
  const [showImageModal, setShowImageModal] = useState(false);
  
  // Handle image tap
  const handleImageTap = (index: number) => {
    setSelectedImageIndex(index);
    setShowImageModal(true);
  };

  // Close image modal
  const closeImageModal = () => {
    setShowImageModal(false);
    setSelectedImageIndex(null);
  };
  
  // Handle logout
  const handleLogout = async () => {
    try {
      // Use the signOut function from AuthContext instead of directly calling Firebase
      await auth.signOut();
      console.log('User signed out via profile screen');
      // Navigation will be handled by the AuthContext listener
    } catch (error) {
      console.error('Error signing out:', error);
      Alert.alert('Error', 'Failed to sign out. Please try again.');
    }
  };
  
  // Handle location visibility toggle
  const handleLocationToggle = async (value) => {
    if (!user?.uid) return;
    
    setLoading(true);
    try {
      const userRef = doc(db, 'users', user.uid);
      await updateDoc(userRef, {
        'location.visible': value
      });
      
      await refreshUserData();
      setLocationVisible(value);
    } catch (error) {
      console.error('Error updating location visibility:', error);
      Alert.alert('Error', 'Failed to update setting. Please try again.');
    } finally {
      setLoading(false);
    }
  };
  
  if (!userData) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#007bff" />
      </View>
    );
  }
  
  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <View style={styles.profileImageContainer}>
          {userData.photoURL ? (
            <Image source={{ uri: userData.photoURL }} style={styles.profileImage} />
          ) : (
            <FontAwesome name="user-circle" size={100} color="#ccc" />
          )}
        </View>
        <Text style={styles.name}>{userData.name || 'Anonymous User'}</Text>
      </View>
      
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>About Me</Text>
        <Text style={styles.bio}>
          {userData.bio || 'No bio yet. Tap Edit Profile to add a bio.'}
        </Text>
      </View>
      
      {/* Profile Images Grid */}
      {userData.profileImages && userData.profileImages.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Photos</Text>
          <View style={styles.profileImagesGrid}>
            {userData.profileImages.map((imageUrl, index) => (
              <TouchableOpacity 
                key={index} 
                style={styles.gridImageContainer}
                onPress={() => handleImageTap(index)}
                activeOpacity={0.9}
              >
                <Image 
                  source={{ uri: imageUrl }} 
                  style={styles.gridImage}
                  resizeMode="cover"
                />
              </TouchableOpacity>
            ))}
          </View>
        </View>
      )}
      
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Interests</Text>
        {userData.interests && userData.interests.length > 0 ? (
          <View style={styles.interestsContainer}>
            {userData.interests.map((interest, index) => (
              <View key={index} style={styles.interestTag}>
                <Text style={styles.interestText}>{interest}</Text>
              </View>
            ))}
          </View>
        ) : (
          <Text style={styles.emptyText}>No interests added yet. Tap Edit Profile to add interests.</Text>
        )}
      </View>
      
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Settings</Text>
        <View style={styles.settingItem}>
          <Text style={styles.settingLabel}>Location Visibility</Text>
          <Switch
            value={locationVisible}
            onValueChange={handleLocationToggle}
            trackColor={{ false: '#767577', true: '#81b0ff' }}
            thumbColor={locationVisible ? '#f5dd4b' : '#f4f3f4'}
            disabled={loading}
          />
        </View>
        <Text style={styles.settingDescription}>
          {locationVisible 
            ? 'Your location is visible to other users'
            : 'Your location is hidden from other users'}
        </Text>
      </View>
      
      <TouchableOpacity 
        style={styles.editButton}
        onPress={() => router.push('/edit-profile')}
      >
        <Text style={styles.editButtonText}>Edit Profile</Text>
      </TouchableOpacity>
      
      <TouchableOpacity 
        style={styles.logoutButton}
        onPress={handleLogout}
      >
        <Text style={styles.logoutButtonText}>Log Out</Text>
      </TouchableOpacity>
      
      {/* Image Modal */}
      <Modal
        visible={showImageModal}
        transparent={true}
        animationType="fade"
        onRequestClose={closeImageModal}
      >
        <View style={styles.modalContainer}>
          <TouchableOpacity 
            style={styles.modalCloseButton}
            onPress={closeImageModal}
          >
            <FontAwesome name="close" size={24} color="#fff" />
          </TouchableOpacity>
          
          {selectedImageIndex !== null && userData?.profileImages?.[selectedImageIndex] && (
            <Image
              source={{ uri: userData.profileImages[selectedImageIndex] }}
              style={styles.fullScreenImage}
              resizeMode="contain"
            />
          )}
        </View>
      </Modal>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f8f8',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  header: {
    alignItems: 'center',
    padding: 20,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  profileImageContainer: {
    marginBottom: 12,
  },
  profileImage: {
    width: 100,
    height: 100,
    borderRadius: 50,
  },
  name: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
  },
  section: {
    padding: 20,
    backgroundColor: '#fff',
    marginTop: 12,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 12,
    color: '#333',
  },
  bio: {
    fontSize: 16,
    color: '#666',
    lineHeight: 24,
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
  },
  gridImage: {
    width: '100%',
    height: '100%',
    borderRadius: 8,
  },
  modalContainer: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.9)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalCloseButton: {
    position: 'absolute',
    top: 40,
    right: 20,
    zIndex: 2,
    padding: 10,
  },
  fullScreenImage: {
    width: '100%',
    height: '80%',
  },
  interestsContainer: {
    display: 'flex', 
    flexDirection: 'row',
  },
  interestTag: {
    backgroundColor: '#e1f5fe',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    marginRight: 8,
    marginBottom: 8,
  },
  interestText: {
    fontSize: 14,
    color: '#0288d1',
  },
  settingItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  settingLabel: {
    fontSize: 16,
    color: '#333',
  },
  settingDescription: {
    fontSize: 14,
    color: '#999',
    marginTop: 4,
  },
  editButton: {
    backgroundColor: '#007bff',
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
    margin: 20,
  },
  editButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  logoutButton: {
    backgroundColor: '#f8f8f8',
    borderWidth: 1,
    borderColor: '#ddd',
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
    marginHorizontal: 20,
    marginBottom: 40,
  },
  logoutButtonText: {
    color: '#ff3b30',
    fontSize: 16,
    fontWeight: 'bold',
  },
  emptyText: {
    fontSize: 14,
    color: '#999',
    fontStyle: 'italic',
  },
});
