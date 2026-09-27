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

if (Platform.OS === 'web' && typeof document !== 'undefined') {
  const originalError = console.error.bind(console);
  console.error = (...args: unknown[]) => {
    // JSX indentation becomes a text child on web. It is not a failed screen.
    if (typeof args[0] === 'string' && args[0].includes('Unexpected text node')) return;
    originalError(...args);
  };
  if (!document.getElementById('tedtime-hide-scrollbars')) {
    const style = document.createElement('style');
    style.id = 'tedtime-hide-scrollbars';
    style.textContent = '*{scrollbar-width:none !important} *::-webkit-scrollbar{width:0 !important;height:0 !important;display:none !important}';
    document.head.appendChild(style);
  }
}

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
