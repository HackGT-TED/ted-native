import { Stack } from 'expo-router';
import { useFonts } from 'expo-font';
import { StatusBar } from 'expo-status-bar';
import { ActivityIndicator, View } from 'react-native';
import { StudioProvider } from '../context/studio';
import { colors } from '../components/ui';
export default function RootLayout() {
  const [loaded, error] = useFonts({
    Icons: require('../../assets/fonts/Icons.ttf')
  });
  if (!loaded && !error) return <View style={{
    flex: 1,
    backgroundColor: colors.paper,
    alignItems: 'center',
    justifyContent: 'center'
  }}><ActivityIndicator color={colors.cocoa} /></View>;
  return <StudioProvider><StatusBar style="dark" /><Stack screenOptions={{
      headerShown: false,
      animation: 'none',
      contentStyle: {
        backgroundColor: colors.paper
      }
    }}><Stack.Screen name="auth" options={{
        presentation: 'transparentModal',
        animation: 'slide_from_bottom',
        gestureEnabled: false,
        contentStyle: { backgroundColor: 'transparent' }
      }} /></Stack></StudioProvider>;
}
