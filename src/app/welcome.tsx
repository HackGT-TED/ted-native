import { router } from 'expo-router';
import { Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Button } from '../components/ui';

/** The only screen signed-out visitors see: a welcome and a way to sign in. */
export default function Welcome() {
  return <SafeAreaView className="flex-1 bg-paper" edges={['top', 'bottom']}>
    <View className="flex-1 items-center justify-center px-6">
      <Text accessibilityRole="header"
        className="text-center font-heading text-[42px] font-normal leading-[50px] tracking-[-1.2px] text-ink">
        Welcome to TedTime
      </Text>
      <Button title="Sign in" className="mt-8 w-full max-w-[320px]" onPress={() => router.push('/auth')} />
    </View>
  </SafeAreaView>;
}
