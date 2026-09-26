import { Stack } from 'expo-router';
import { useFonts } from 'expo-font';
import { StatusBar } from 'expo-status-bar';
import { ActivityIndicator, View } from 'react-native';
import { BleProvider } from '../context/ble';
import { StudioProvider } from '../context/studio';
import { colors } from '../components/ui';
export default function RootLayout() {
  const [loaded, error] = useFonts({
    Cormorant: require('../../assets/fonts/CormorantGaramond.ttf'),
    Icons: require('../../assets/fonts/Icons.ttf')
  });
  if (!loaded && !error) return <View style={{
    flex: 1,
    backgroundColor: colors.paper,
    alignItems: 'center',
    justifyContent: 'center'
  }}><ActivityIndicator color={colors.green} /></View>;
  return <StudioProvider><BleProvider><StatusBar style="dark" /><Stack screenOptions={{
      headerShown: false,
      animation: 'none',
      contentStyle: {
        backgroundColor: colors.paper
      }
    }}><Stack.Screen name="auth" options={{
        presentation: 'modal'
      }} /></Stack></BleProvider></StudioProvider>;
}
