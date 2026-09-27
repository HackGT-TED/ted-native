import '../../global.css';
import { useCallback, useEffect, useState } from 'react';
import { Stack } from 'expo-router';
import { useFonts } from 'expo-font';
import { StatusBar } from 'expo-status-bar';
import * as SplashScreen from 'expo-splash-screen';
import { ActivityIndicator, Platform, View } from 'react-native';
import { StudioProvider } from '../context/studio';
import { colors } from '../components/ui';
import { LaunchSplash } from '../components/launch-splash';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

SplashScreen.preventAutoHideAsync().catch(() => {});

export default function RootLayout() {
  const [loaded, error] = useFonts({
    'Tedfont-Regular': require('../../assets/fonts/Tedfont-Regular.ttf'),
    Icons: require('../../assets/fonts/Icons.ttf'),
  });
  const [splash, setSplash] = useState(true);
  const finishSplash = useCallback(() => setSplash(false), []);
  useEffect(() => {
    if (!loaded && !error) return;
    if (Platform.OS === 'web') return;
    SplashScreen.hide();
  }, [loaded, error]);
  if (!loaded && !error) {
    return <View className="flex-1 items-center justify-center bg-paper"><ActivityIndicator color={colors.cocoa} /></View>;
  }
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <StudioProvider>
        <StatusBar style="dark" />
        <Stack screenOptions={{
          headerShown: false,
          animation: 'none',
          contentStyle: { backgroundColor: colors.paper },
        }}>
          <Stack.Screen name="auth" options={{
            presentation: 'transparentModal',
            animation: 'none',
            gestureEnabled: false,
            contentStyle: { backgroundColor: 'transparent' },
          }} />
        </Stack>
        {splash && <LaunchSplash onFinish={finishSplash} />}
      </StudioProvider>
    </GestureHandlerRootView>
  );
}
