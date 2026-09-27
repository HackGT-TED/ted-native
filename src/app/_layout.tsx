import { LoadingSkeleton } from '../components/loading-skeleton';
import '../../global.css';
import { Stack } from 'expo-router';
import { useFonts } from 'expo-font';
import { StatusBar } from 'expo-status-bar';
import { View } from 'react-native';
import { StudioProvider, useStudio } from '../context/studio';
import { colors } from '../components/ui';
import { AppToast } from '../components/app-toast';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

// Every screen that needs an account. Signed-out visitors only reach welcome and auth.
const appScreens = [
  'index', 'create', 'family', 'explore', 'library', 'account', 'community', 'recorder', 'share', 'item/[id]', 'story/[id]',
] as const;

function Loading() {
  return <View className="flex-1 bg-paper px-6 pt-16"><LoadingSkeleton variant="screen" label="Loading TedTime" className="w-full max-w-[700px] self-center" /></View>;
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
    'Tedfont2-Regular': require('../../assets/fonts/Tedfont2-Regular.ttf'),
  });
  if (!loaded && !error) return <Loading />;
  return <GestureHandlerRootView><StudioProvider><StatusBar style="dark" /><AppStack /><AppToast /></StudioProvider></GestureHandlerRootView>;
}
