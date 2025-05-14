# HiveSocial Bottom Navigation

This document describes the bottom navigation components available in the HiveSocial app.

## Available Navigation Styles

The app now includes two modern bottom navigation styles that you can use:

1. **ModernTabBar** (Default) - A clean, modern tab bar with indicator and subtle animations
2. **FloatingTabBar** - A floating pill-shaped tab bar with more prominent animations

## How to Switch Between Navigation Styles

To use the ModernTabBar (default), your `_layout.tsx` should include:

```tsx
<Tabs
  screenOptions={{
    // options here
  }}
  tabBar={props => <ModernTabBar {...props} />}
>
  {/* Tab screens */}
</Tabs>
```

To use the FloatingTabBar, update your `_layout.tsx` to:

```tsx
<Tabs
  screenOptions={{
    // options here
    tabBarStyle: { 
      display: 'none' // Hide the default tab bar
    },
  }}
  tabBar={props => <FloatingTabBar {...props} />}
>
  {/* Tab screens */}
</Tabs>
```

## Implementation Details

### ModernTabBar

The ModernTabBar provides:
- Clean, minimalist design
- Animated indicator
- Gradient highlight for active tab
- Proper iOS/Android adaptations

### FloatingTabBar 

The FloatingTabBar provides:
- Floating appearance with rounded corners
- Larger icon for the active tab
- Gradient background for active tab
- Smooth animations between tab changes

## Design Principles

The navigation follows these design principles:

1. **Consistency**: Matches the visual styling of profile, chat, and connections screens
2. **Clarity**: Clear visual indication of the active tab
3. **Accessibility**: Proper contrast, touch targets, and visual feedback
4. **Modern Aesthetics**: Uses the app's color palette and rounded design language

## Primary Color Palette

The navigation uses the following color palette:
- Primary: #6C5CE7 (Purple)
- Primary Light: #a29bfe (Light Purple)
- Secondary: #FF6B6B (Red accent for notifications)

These colors align with the profile screen's color scheme.
