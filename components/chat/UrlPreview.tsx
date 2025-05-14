import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Image,
  TouchableOpacity,
  Linking,
  ActivityIndicator,
} from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';

// URL regex pattern for extracting URLs from text
const URL_REGEX = /(https?:\/\/[^\s]+)/g;

interface UrlPreviewProps {
  url: string;
  isUserMessage?: boolean;
}

interface PreviewData {
  url: string;
  title?: string;
  description?: string;
  image?: string;
  siteName?: string;
  hostname?: string;
}

const UrlPreview: React.FC<UrlPreviewProps> = ({
  url,
  isUserMessage = false,
}) => {
  const [previewData, setPreviewData] = useState<PreviewData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Extract hostname from URL
  const getHostname = (urlString: string): string => {
    try {
      const { hostname } = new URL(urlString);
      return hostname.replace(/^www\./, '');
    } catch (error) {
      return '';
    }
  };
  
  // Fetch URL preview data
  useEffect(() => {
    const fetchPreviewData = async () => {
      try {
        setLoading(true);
        setError(null);
        
        // Create a simplified preview with just the URL and hostname
        // In a real implementation, you would use a service to fetch meta tags
        // or implement server-side link preview generation
        const hostname = getHostname(url);
        
        setPreviewData({
          url,
          hostname,
          title: `Content from ${hostname}`,
          description: 'Tap to open this link',
        });
        
        setLoading(false);
      } catch (error) {
        console.error('Error fetching URL preview:', error);
        setError('Could not load preview');
        setLoading(false);
      }
    };
    
    if (url) {
      fetchPreviewData();
    }
  }, [url]);
  
  // Open the URL
  const handlePress = async () => {
    try {
      if (await Linking.canOpenURL(url)) {
        await Linking.openURL(url);
      } else {
        console.error('Cannot open URL:', url);
      }
    } catch (error) {
      console.error('Error opening URL:', error);
    }
  };
  
  if (loading) {
    return (
      <View style={[
        styles.container,
        isUserMessage ? styles.userContainer : styles.otherContainer
      ]}>
        <ActivityIndicator
          size="small"
          color={isUserMessage ? '#fff' : '#6C5CE7'}
        />
      </View>
    );
  }
  
  if (error || !previewData) {
    return (
      <TouchableOpacity
        style={[
          styles.container,
          styles.errorContainer,
          isUserMessage ? styles.userContainer : styles.otherContainer
        ]}
        onPress={handlePress}
      >
        <Ionicons
          name="link"
          size={16}
          color={isUserMessage ? '#fff' : '#6C5CE7'}
          style={styles.linkIcon}
        />
        <Text style={[
          styles.urlText,
          isUserMessage ? styles.userText : styles.otherText
        ]}>
          {url}
        </Text>
      </TouchableOpacity>
    );
  }
  
  return (
    <TouchableOpacity
      style={[
        styles.container,
        isUserMessage ? styles.userContainer : styles.otherContainer
      ]}
      onPress={handlePress}
      activeOpacity={0.8}
    >
      <View style={styles.content}>
        {previewData.image && (
          <Image
            source={{ uri: previewData.image }}
            style={styles.image}
            resizeMode="cover"
          />
        )}
        
        <View style={styles.textContainer}>
          {previewData.title && (
            <Text
              style={[
                styles.title,
                isUserMessage ? styles.userText : styles.otherText
              ]}
              numberOfLines={2}
            >
              {previewData.title}
            </Text>
          )}
          
          {previewData.description && (
            <Text
              style={[
                styles.description,
                isUserMessage ? styles.userSubText : styles.otherSubText
              ]}
              numberOfLines={2}
            >
              {previewData.description}
            </Text>
          )}
          
          <View style={styles.urlRow}>
            <Ionicons
              name="link"
              size={12}
              color={isUserMessage ? 'rgba(255, 255, 255, 0.7)' : '#888'}
              style={styles.linkIcon}
            />
            <Text
              style={[
                styles.hostname,
                isUserMessage ? styles.userSubText : styles.otherSubText
              ]}
              numberOfLines={1}
            >
              {previewData.hostname}
            </Text>
          </View>
        </View>
      </View>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  container: {
    borderRadius: 12,
    overflow: 'hidden',
    marginVertical: 4,
    maxWidth: 300,
  },
  userContainer: {
    backgroundColor: 'rgba(108, 92, 231, 0.8)',
  },
  otherContainer: {
    backgroundColor: '#f0f0f0',
  },
  errorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 10,
  },
  content: {
    flexDirection: 'column',
  },
  image: {
    width: '100%',
    height: 150,
    backgroundColor: '#ddd',
  },
  textContainer: {
    padding: 10,
  },
  title: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 4,
  },
  description: {
    fontSize: 12,
    marginBottom: 6,
  },
  urlRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  linkIcon: {
    marginRight: 4,
  },
  hostname: {
    fontSize: 12,
  },
  urlText: {
    fontSize: 14,
    textDecorationLine: 'underline',
  },
  userText: {
    color: '#fff',
  },
  otherText: {
    color: '#333',
  },
  userSubText: {
    color: 'rgba(255, 255, 255, 0.7)',
  },
  otherSubText: {
    color: '#888',
  },
});

// Export a utility function to extract URLs from text
export const extractUrls = (text: string): string[] => {
  return text.match(URL_REGEX) || [];
};

export default UrlPreview;
