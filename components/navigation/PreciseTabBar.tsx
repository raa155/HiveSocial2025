import React from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  TouchableOpacity, 
  Dimensions, 
  Platform 
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import { LinearGradient } from 'expo-linear-gradient';
import Colors from '@/constants/Colors';
import { useColorScheme } from '@/components/useColorScheme';

const { width } = Dimensions.get('window');

/**
 * TabBar component that ensures precise alignment and equal width distribution
 */
export default function TabBar({ state, descriptors, navigation }) {
  const colorScheme = useColorScheme();
  const insets = useSafeAreaInsets();
  
  // Filter visible routes (exclude routes with href: null)
  const visibleRoutes = state.routes.filter(route => {
    const { options } = descriptors[route.key];
    return options.href !== null;
  });
  
  // Number of tabs to display
  const numTabs = visibleRoutes.length;
  
  // Calculate tab width (equal distribution)
  const tabWidth = width / numTabs;
  
  return (
    <View style={[
      styles.container, 
      { paddingBottom: insets.bottom > 0 ? insets.bottom : 8 }
    ]}>
      <View style={styles.tabBarContainer}>
        {state.routes.map((route, index) => {
          const { options } = descriptors[route.key];
          
          // Skip tabs with href: null
          if (options.href === null) {
            return null;
          }
          
          const label = options.tabBarLabel ?? options.title ?? route.name;
          const isFocused = state.index === index;
          
          const onPress = () => {
            const event = navigation.emit({
              type: 'tabPress',
              target: route.key,
              canPreventDefault: true,
            });

            if (!isFocused && !event.defaultPrevented) {
              navigation.navigate(route.name);
            }
          };

          const onLongPress = () => {
            navigation.emit({
              type: 'tabLongPress',
              target: route.key,
            });
          };

          return (
            <TouchableOpacity
              key={route.key}
              activeOpacity={0.7}
              accessibilityRole="button"
              accessibilityState={isFocused ? { selected: true } : {}}
              accessibilityLabel={options.tabBarAccessibilityLabel}
              testID={options.tabBarTestID}
              onPress={onPress}
              onLongPress={onLongPress}
              style={[styles.tab, { width: tabWidth }]}
            >
              <View style={styles.tabContent}>
                {isFocused ? (
                  <LinearGradient
                    colors={[Colors.primary, Colors.primaryLight]}
                    style={styles.activeIconContainer}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                  >
                    {options.tabBarIcon && options.tabBarIcon({
                      focused: true,
                      color: '#FFFFFF',
                      size: 24,
                    })}
                  </LinearGradient>
                ) : (
                  <View style={styles.inactiveIconContainer}>
                    {options.tabBarIcon && options.tabBarIcon({
                      focused: false,
                      color: Colors[colorScheme]?.tabIconDefault || '#888',
                      size: 22,
                    })}
                  </View>
                )}
                
                <Text
                  numberOfLines={1}
                  style={[
                    styles.label,
                    {
                      color: isFocused 
                        ? Colors[colorScheme]?.tabIconSelected 
                        : Colors[colorScheme]?.tabIconDefault,
                    }
                  ]}
                >
                  {label}
                </Text>
              </View>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'transparent',
    zIndex: 999,
  },
  tabBarContainer: {
    flexDirection: 'row',
    backgroundColor: Platform.OS === 'ios' 
      ? 'rgba(255, 255, 255, 0.95)'
      : 'rgba(255, 255, 255, 1)',
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(0, 0, 0, 0.1)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 5,
    height: 60,
  },
  tab: {
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabContent: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  activeIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 2,
  },
  inactiveIconContainer: {
    width: 48,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 2,
  },
  label: {
    fontSize: 10,
    fontWeight: '500',
    textAlign: 'center',
    marginTop: -8,
    width: '100%',
  },
});
