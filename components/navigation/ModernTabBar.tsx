import React, { useEffect, useState } from 'react';
import { 
  View, 
  TouchableOpacity, 
  Text, 
  StyleSheet, 
  Dimensions, 
  Platform, 
  useWindowDimensions,
  LayoutAnimation,
  UIManager
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, { 
  useAnimatedStyle, 
  withSpring, 
  useSharedValue 
} from 'react-native-reanimated';
import { BlurView } from 'expo-blur';
import Colors from '@/constants/Colors';
import { useColorScheme } from '@/components/useColorScheme';
import { LinearGradient } from 'expo-linear-gradient';
import { usePathname } from 'expo-router';

// Enable layout animation for Android
if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

const { width: SCREEN_WIDTH } = Dimensions.get('window');

type TabBarProps = {
  state: any;
  descriptors: any;
  navigation: any;
};

const TabBarIndicator = ({ position, tabWidth }: { position: number, tabWidth: number }) => {
  const colorScheme = useColorScheme();
  const xPos = position * tabWidth;

  return (
    <Animated.View 
      style={[
        styles.indicator,
        {
          width: tabWidth * 0.5,
          left: xPos + tabWidth * 0.25, // Center the indicator within the tab
        }
      ]}
    >
      <LinearGradient
        colors={[Colors.primary, Colors.primaryLight]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        style={styles.indicatorGradient}
      />
    </Animated.View>
  );
};

export default function ModernTabBar({ state, descriptors, navigation }: TabBarProps) {
  const colorScheme = useColorScheme();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const [activeTabIndex, setActiveTabIndex] = useState(state.index);
  const pathname = usePathname();
  
  // Calculate tab width based on screen size and number of visible routes
  const visibleRoutes = state.routes.filter(route => {
    const { options } = descriptors[route.key];
    return options.href !== null;
  });
  
  const tabWidth = width / visibleRoutes.length;
  
  // Update active tab when the route changes
  useEffect(() => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setActiveTabIndex(state.index);
  }, [state.index, pathname]);
  
  return (
    <View style={[
      styles.container,
      {
        paddingBottom: insets.bottom > 0 ? insets.bottom : 12,
        backgroundColor: Colors[colorScheme]?.tabBarBackground,
        borderTopColor: Colors[colorScheme]?.tabBarBorder,
      }
    ]}>
      {Platform.OS === 'ios' && colorScheme === 'dark' ? (
        <BlurView
          intensity={30}
          tint="dark"
          style={StyleSheet.absoluteFill}
        />
      ) : null}
      
      <TabBarIndicator position={activeTabIndex - 1} tabWidth={tabWidth} />
      
      <View style={styles.tabs}>
        {state.routes.map((route, index) => {
          const { options } = descriptors[route.key];
          
          // Skip hidden tabs
          if (options.href === null) {
            return null;
          }
          
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
              accessibilityRole="button"
              accessibilityState={isFocused ? { selected: true } : {}}
              accessibilityLabel={options.tabBarAccessibilityLabel}
              testID={options.tabBarTestID}
              onPress={onPress}
              onLongPress={onLongPress}
              style={styles.tab}
              activeOpacity={0.8}
            >
              <View style={styles.tabContent}>
                {options.tabBarIcon && options.tabBarIcon({ 
                  color: isFocused 
                    ? Colors[colorScheme]?.tabIconSelected 
                    : Colors[colorScheme]?.tabIconDefault, 
                  size: 24,
                  focused: isFocused
                })}
                <Animated.Text 
                  style={[
                    styles.tabLabel,
                    { 
                      color: isFocused 
                        ? Colors[colorScheme]?.tabIconSelected 
                        : Colors[colorScheme]?.tabIconDefault,
                      opacity: isFocused ? 1 : 0.8,
                      transform: [{ scale: isFocused ? 1 : 0.9 }]
                    }
                  ]}
                  numberOfLines={1}
                >
                  {options.title}
                </Animated.Text>
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
    width: '100%',
    borderTopWidth: 1,
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    position: 'relative',
  },
  tabs: {
    flexDirection: 'row',
    paddingTop: 8,
  },
  tab: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabContent: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 4,
  },
  tabLabel: {
    fontSize: 11,
    fontWeight: '500',
    marginTop: 4,
    textAlign: 'center',
  },
  indicator: {
    height: 3,
    borderRadius: 1.5,
    position: 'absolute',
    top: -1.5,
    zIndex: 2,
    overflow: 'hidden',
  },
  indicatorGradient: {
    flex: 1,
    borderRadius: 1.5,
  },
});
