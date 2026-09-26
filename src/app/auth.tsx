import { useCallback, useEffect, useRef } from 'react';
import { router } from 'expo-router';
import { cssInterop } from 'nativewind';
import { ActivityIndicator, Animated, BackHandler, KeyboardAvoidingView, Platform, Pressable, ScrollView, Text, useAnimatedValue, useWindowDimensions, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Body, colors, Heading, Icon } from '../components/ui';
import Auth from '../components/Auth';
import Account from '../components/Account';
import { supabase } from '../lib/supabase';
import { useStudio } from '../context/studio';

const AnimatedKeyboardAvoidingView = Animated.createAnimatedComponent(KeyboardAvoidingView);
cssInterop(AnimatedKeyboardAvoidingView, { className: 'style' });

export default function AuthScreen() {
  const { session, authLoading, authError, name } = useStudio();
  const { height } = useWindowDimensions();
  const progress = useAnimatedValue(0);
  const closing = useRef(false);

  useEffect(() => {
    Animated.timing(progress, { toValue: 1, duration: 300, useNativeDriver: Platform.OS !== 'web' }).start();
    return () => progress.stopAnimation();
  }, [progress]);

  const close = useCallback(() => {
    if (closing.current) return;
    closing.current = true;
    Animated.timing(progress, { toValue: 0, duration: 220, useNativeDriver: Platform.OS !== 'web' }).start(({ finished }) => {
      if (finished) {
        if (router.canGoBack()) router.back();
        else router.replace('/recorder');
      }
    });
  }, [progress]);

  useEffect(() => {
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
      close();
      return true;
    });
    return () => subscription.remove();
  }, [close]);

  return <View className="flex-1 justify-end" accessibilityViewIsModal>
    <Pressable className="absolute inset-0 bg-[rgba(49,34,24,0.35)]" onPress={close} accessibilityRole="button" accessibilityLabel="Close account sheet" />
    <AnimatedKeyboardAvoidingView className="h-[65%] w-full overflow-hidden rounded-t-3xl bg-paper" style={{ transform: [{ translateY: progress.interpolate({ inputRange: [0, 1], outputRange: [height, 0] }) }] }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <SafeAreaView className="flex-1" edges={['bottom', 'left', 'right']}>
        <ScrollView contentContainerClassName="grow px-6 pb-4 pt-5" keyboardShouldPersistTaps="handled">
          <View className="w-full max-w-[400px] self-center">
            <View className="flex-row items-center gap-3">
              <Heading className="flex-1">{session ? 'Account' : 'Sign in'}</Heading>
              <Pressable onPress={close} accessibilityRole="button" accessibilityLabel="Close" className="h-11 w-11 items-center justify-center"><Icon name="close" /></Pressable>
            </View>
            {!supabase ? <Body className="mt-3 text-center !text-[11px]">Sign-in isn’t available yet. Please try again later.</Body>
              : authLoading ? <ActivityIndicator accessibilityLabel="Restoring your session" color={colors.cocoa} className="mt-3 text-center !text-[11px]" />
              : <>
                {authError ? <Text accessibilityRole="alert" className="my-3 text-[13px] leading-5 text-rust">{authError}</Text> : null}
                {session ? <Account key={session.user.id} userId={session.user.id} email={session.user.email} displayName={name} /> : <Auth />}
              </>}
          </View>
        </ScrollView>
      </SafeAreaView>
    </AnimatedKeyboardAvoidingView>
  </View>;
}
