import React, { useState, useEffect } from 'react';
import { 
  View, 
  StyleSheet, 
  TouchableOpacity, 
  Text, 
  Dimensions,
  Platform
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BlurView } from 'expo-blur';
import Animated, { 
  useAnimatedStyle, 
  withSpring, 
  useSharedValue,
  withTiming,
  Easing
} from 'react-native-reanimated';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import Colors from '@/constants/Colors';
import { useColorScheme } from '@/components/useColorScheme';
import { LinearGradient } from 'expo-linear-gradient';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const TAB_BAR_HEIGHT = 70;
const ICON_SIZE = 24;
const ACTIVE_ICON_SIZE = 26;

type FloatingTabBarProps = {
  state: any;
  descriptors: any;
  navigation: any;
};

export default function FloatingTabBar({ state, descriptors, navigation }: FloatingTabBarProps) {
  const colorScheme = useColorScheme();
  const insets = useSafeAreaInsets();
  const [selectedTab, setSelectedTab] = useState(state.index);
  
  // Count visible routes (excluding any with href: null and the index route)
  const visibleRoutes = state.routes.filter(route => {
    const { options } = descriptors[route.key];
    return options.href !== null && route.name !== "index";
  });
  
  // Create scale animation values for each tab upfront
  const tabScales = state.routes.map((_, index) => 
    useSharedValue(state.index === index ? 1 : 0.85)
  );
  
  // Update selected tab when route changes
  useEffect(() => {
    setSelectedTab(state.index);
    
    // Update all tab animations
    state.routes.forEach((_, index) => {
      tabScales[index].value = withSpring(
        state.index === index ? 1 : 0.85,
        { damping: 15, stiffness: 120 }
      );
    });
  }, [state.index]);
  
  // Fade-in animation for the tab bar
  const opacity = useSharedValue(0);
  
  useEffect(() => {
    opacity.value = withTiming(1, {
      duration: 500,
      easing: Easing.out(Easing.ease),
    });
  }, []);
  
  const containerStyle = useAnimatedStyle(() => {
    return {
      opacity: opacity.value,
      transform: [
        { translateY: withTiming((1 - opacity.value) * 20, { duration: 500 }) }
      ],
    };
  });
  
  return (
    <Animated.View style={[styles.container, containerStyle]}>
      <View 
        style={[
          styles.floatingBar,
          {
            backgroundColor: 
              colorScheme === 'dark' 
                ? 'rgba(30, 30, 30, 0.95)' 
                : 'rgba(255, 255, 255, 0.97)',
            shadowColor: colorScheme === 'dark' ? '#000' : '#888',
            paddingBottom: insets.bottom > 0 ? insets.bottom - 10 : 16,
          }
        ]}
      >
        {Platform.OS === 'ios' && (
          <BlurView
            intensity={colorScheme === 'dark' ? 30 : 50}
            tint={colorScheme === 'dark' ? "dark" : "light"}
            style={StyleSheet.absoluteFill}
          />
        )}
        
        <View style={styles.tabContainer}>
          {state.routes.map((route, index) => {
            const { options } = descriptors[route.key];
            
            // Skip hidden tabs or the "index" tab
            if (options.href === null || route.name === "index") {
              return null;
            }
            
            const isFocused = state.index === index;
            
            // Get the pre-created animation value for this tab
            const animatedIconStyle = useAnimatedStyle(() => {
              return {
                transform: [{ scale: tabScales[index].value }],
              };
            });
            
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

            return (
              <TouchableOpacity
                key={route.key}
                accessibilityRole="button"
                accessibilityState={isFocused ? { selected: true } : {}}
                accessibilityLabel={options.tabBarAccessibilityLabel}
                testID={options.tabBarTestID}
                onPress={onPress}
                style={styles.tab}
                activeOpacity={0.7}
              >
                <Animated.View style={[
                  isFocused ? styles.activeIconContainer : styles.inactiveIconContainer,
                  animatedIconStyle
                ]}>
                  {isFocused ? (
                    <LinearGradient
                      colors={[Colors.primary, Colors.primaryLight]}
                      style={styles.activeIconBackground}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 1 }}
                    >
                      {options.tabBarIcon && options.tabBarIcon({ 
                        color: '#FFFFFF', 
                        focused: true,
                        size: ACTIVE_ICON_SIZE
                      })}
                    </LinearGradient>
                  ) : (
                    <>
                      {options.tabBarIcon && options.tabBarIcon({ 
                        color: Colors[colorScheme]?.tabIconDefault || '#888', 
                        focused: false,
                        size: ICON_SIZE
                      })}
                    </>
                  )}
                </Animated.View>
                
                <Text
                  style={[
                    styles.tabLabel,
                    {
                      color: isFocused 
                        ? Colors[colorScheme]?.tabIconSelected 
                        : Colors[colorScheme]?.tabIconDefault,
                      opacity: isFocused ? 1 : 0.7,
                    }
                  ]}
                  numberOfLines={1}
                >
                  {options.title}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    width: '100%',
    margin: 0,
    padding: 0,
  },
  floatingBar: {
    width: '100%',
    borderRadius: 0,
    paddingTop: 12,
    paddingHorizontal: 0,
    margin: 0,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 16,
    elevation: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(150, 150, 150, 0.2)',
  },
  tabContainer: {
    flexDirection: 'row',
    width: '100%',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 0,
    margin: 0,
  },
  tab: {
    alignItems: 'center',
    paddingVertical: 4,
    flex: 1,
    paddingHorizontal: 0,
    margin: 0,
  },
  activeIconContainer: {
    height: 45,
    width: 45,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 5,
  },
  inactiveIconContainer: {
    height: 45,
    width: 45,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 5,
  },
  activeIconBackground: {
    width: 45,
    height: 45,
    borderRadius: 22.5,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 5,
  },
  tabLabel: {
    fontSize: 11,
    fontWeight: '600',
    textAlign: 'center',
    width: '100%',
    paddingHorizontal: 2,
  },
});
