import { Redirect } from 'expo-router';

// This file redirects from the root tab screen to the map screen
export default function Index() {
  // Use Redirect component instead of router.replace for cleaner navigation
  return <Redirect href="/map" />;
}
