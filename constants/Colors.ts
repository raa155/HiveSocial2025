// Primary purple palette matching the profile style
const primaryColor = '#6C5CE7';
const primaryLightColor = '#a29bfe';
const secondaryColor = '#FF6B6B';

export default {
  light: {
    text: '#333',
    background: '#fff',
    tint: primaryColor,
    tabIconDefault: '#BDBDBD',
    tabIconSelected: primaryColor,
    tabBarBackground: '#FFFFFF',
    tabBarBorder: '#F0F0F0',
    cardBackground: '#FFF',
    cardShadow: 'rgba(0, 0, 0, 0.05)',
  },
  dark: {
    text: '#F5F5F5',
    background: '#121212',
    tint: primaryLightColor,
    tabIconDefault: '#757575',
    tabIconSelected: primaryLightColor,
    tabBarBackground: '#1E1E1E',
    tabBarBorder: '#2C2C2C',
    cardBackground: '#232323',
    cardShadow: 'rgba(0, 0, 0, 0.2)',
  },
  primary: primaryColor,
  primaryLight: primaryLightColor,
  secondary: secondaryColor,
};
