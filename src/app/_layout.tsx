import '../../global.css';
import { Stack } from 'expo-router';
import { useFonts } from 'expo-font';
import { StatusBar } from 'expo-status-bar';
import { ActivityIndicator, View } from 'react-native';
import { StudioProvider, useStudio } from '../context/studio';
import { colors } from '../components/ui';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

// Every screen that needs an account. Signed-out visitors only reach welcome and auth.
const appScreens = [
  'index', 'create', 'family', 'explore', 'library', 'account', 'marketplace', 'recorder', 'share', 'item/[id]', 'story/[id]', 'read/[slug]',
] as const;

function Loading() {
  return <View className="flex-1 items-center justify-center bg-paper"><ActivityIndicator color={colors.cocoa} /></View>;
}

function AppStack() {
  const { session, authLoading } = useStudio();
  // Wait for the saved session so signed-in users never see the welcome screen flash.
  if (authLoading) return <Loading />;
  const signedIn = Boolean(session);
  return <Stack screenOptions={{
    headerShown: false,
    animation: 'none',
    contentStyle: { backgroundColor: colors.paper },
  }}>
    <Stack.Protected guard={!signedIn}>
      <Stack.Screen name="welcome" />
    </Stack.Protected>
    <Stack.Protected guard={signedIn}>
      {appScreens.map(name => <Stack.Screen key={name} name={name} />)}
    </Stack.Protected>
    <Stack.Screen name="auth" options={{
      presentation: 'transparentModal',
      animation: 'none',
      gestureEnabled: false,
      contentStyle: { backgroundColor: 'transparent' },
    }} />
  </Stack>;
}

export default function RootLayout() {
  const [loaded, error] = useFonts({
    'Tedfont-Regular': require('../../assets/fonts/Tedfont-Regular.ttf'),
    Icons: require('../../assets/fonts/Icons.ttf')
  });
  if (!loaded && !error) return <Loading />;
  return <GestureHandlerRootView><StudioProvider><StatusBar style="dark" /><AppStack /></StudioProvider></GestureHandlerRootView>;
}
