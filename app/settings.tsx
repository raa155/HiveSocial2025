import { StatusBar } from 'expo-status-bar';
import { Platform, StyleSheet, TouchableOpacity } from 'react-native';
import { Text, View } from '@/components/Themed';
import { router } from 'expo-router';
import FontAwesome from '@expo/vector-icons/FontAwesome';

export default function SettingsScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Settings</Text>
      
      <View style={styles.separator} lightColor="#eee" darkColor="rgba(255,255,255,0.1)" />
      
      <View style={styles.settingsContainer}>
        <TouchableOpacity style={styles.settingItem}>
          <FontAwesome name="bell" size={24} color="#666" style={styles.settingIcon} />
          <View style={styles.settingContent}>
            <Text style={styles.settingTitle}>Notifications</Text>
            <Text style={styles.settingDescription}>Manage your notification preferences</Text>
          </View>
          <FontAwesome name="chevron-right" size={16} color="#ccc" />
        </TouchableOpacity>
        
        <TouchableOpacity style={styles.settingItem}>
          <FontAwesome name="lock" size={24} color="#666" style={styles.settingIcon} />
          <View style={styles.settingContent}>
            <Text style={styles.settingTitle}>Privacy</Text>
            <Text style={styles.settingDescription}>Control your privacy settings</Text>
          </View>
          <FontAwesome name="chevron-right" size={16} color="#ccc" />
        </TouchableOpacity>
        
        <TouchableOpacity style={styles.settingItem}>
          <FontAwesome name="question-circle" size={24} color="#666" style={styles.settingIcon} />
          <View style={styles.settingContent}>
            <Text style={styles.settingTitle}>Help & Support</Text>
            <Text style={styles.settingDescription}>Get help with HiveSocial</Text>
          </View>
          <FontAwesome name="chevron-right" size={16} color="#ccc" />
        </TouchableOpacity>
        
        <TouchableOpacity style={styles.settingItem}>
          <FontAwesome name="info-circle" size={24} color="#666" style={styles.settingIcon} />
          <View style={styles.settingContent}>
            <Text style={styles.settingTitle}>About</Text>
            <Text style={styles.settingDescription}>App version and information</Text>
          </View>
          <FontAwesome name="chevron-right" size={16} color="#ccc" />
        </TouchableOpacity>
      </View>
      
      <TouchableOpacity style={styles.logoutButton}>
        <Text style={styles.logoutButtonText}>Log Out</Text>
      </TouchableOpacity>
      
      <TouchableOpacity style={styles.closeButton} onPress={() => router.back()}>
        <Text style={styles.closeButtonText}>Close</Text>
      </TouchableOpacity>
      
      {/* Use a light status bar on iOS to account for the black space above the modal */}
      <StatusBar style={Platform.OS === 'ios' ? 'light' : 'auto'} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 20,
  },
  separator: {
    marginVertical: 20,
    height: 1,
    width: '100%',
  },
  settingsContainer: {
    width: '100%',
  },
  settingItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  settingIcon: {
    marginRight: 16,
  },
  settingContent: {
    flex: 1,
  },
  settingTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  settingDescription: {
    fontSize: 14,
    color: '#666',
  },
  logoutButton: {
    backgroundColor: '#ff3b30',
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 40,
  },
  logoutButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  closeButton: {
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 16,
  },
  closeButtonText: {
    color: '#007aff',
    fontSize: 16,
  },
});
