import React from 'react';
import { View, StyleSheet } from 'react-native';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import Colors from '@/constants/Colors';
import { useColorScheme } from '@/components/useColorScheme';

type TabBarIconProps = {
  name: React.ComponentProps<typeof FontAwesome>['name'];
  color: string;
  size?: number;
  focused?: boolean;
};

export default function ModernTabBarIcon({ name, color, size = 24, focused = false }: TabBarIconProps) {
  const colorScheme = useColorScheme();
  
  return (
    <View style={styles.container}>
      <FontAwesome 
        name={name} 
        size={size} 
        color={color} 
        style={styles.icon} 
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  icon: {
    marginBottom: -2,
  },
});

