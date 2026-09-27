import '../../global.css';
import { Stack } from 'expo-router';
import { useFonts } from 'expo-font';
import { StatusBar } from 'expo-status-bar';
import { ActivityIndicator, View } from 'react-native';
import { StudioProvider } from '../context/studio';
import { StoryBearProvider } from '../context/story-bear';
import { colors } from '../components/ui';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
export default function RootLayout() {
  const [loaded, error] = useFonts({
    'Tedfont-Regular': require('../../assets/fonts/Tedfont-Regular.ttf'),
    Icons: require('../../assets/fonts/Icons.ttf')
  });
  if (!loaded && !error) return <View className="flex-1 items-center justify-center bg-paper"><ActivityIndicator color={colors.cocoa} /></View>;
  return <GestureHandlerRootView><StudioProvider><StoryBearProvider><StatusBar style="dark" /><Stack screenOptions={{
      headerShown: false,
      animation: 'none',
      contentStyle: {
        backgroundColor: colors.paper
      }
    }}><Stack.Screen name="auth" options={{
        presentation: 'transparentModal',
        animation: 'none',
        gestureEnabled: false,
        contentStyle: { backgroundColor: 'transparent' }
      }} /></Stack></StoryBearProvider></StudioProvider></GestureHandlerRootView>;
}
