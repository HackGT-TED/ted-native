import { LoadingSkeleton } from '../components/loading-skeleton';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { router } from 'expo-router';
import { cssInterop } from 'nativewind';
import { Animated, BackHandler, Keyboard, KeyboardAvoidingView, PanResponder, Platform, Pressable, ScrollView, Text, useAnimatedValue, useWindowDimensions, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Body, Heading, Icon } from '../components/ui';
import Auth from '../components/Auth';
import { supabase } from '../lib/supabase';
import { useStudio } from '../context/studio';

const AnimatedKeyboardAvoidingView = Animated.createAnimatedComponent(KeyboardAvoidingView);
cssInterop(AnimatedKeyboardAvoidingView, { className: 'style' });

export default function AuthScreen() {
  const { session, authLoading, authError } = useStudio();
  const [register, setRegister] = useState(false);
  const { height } = useWindowDimensions();
  const progress = useAnimatedValue(0);
  const dragY = useAnimatedValue(0);
  const closing = useRef(false);

  useEffect(() => {
    Animated.timing(progress, { toValue: 1, duration: 300, useNativeDriver: Platform.OS !== 'web' }).start();
    return () => {
      progress.stopAnimation();
      dragY.stopAnimation();
    };
  }, [progress, dragY]);

  const close = useCallback(() => {
    if (closing.current) return;
    closing.current = true;
    Keyboard.dismiss();
    dragY.stopAnimation();
    Animated.timing(progress, { toValue: 0, duration: 220, useNativeDriver: Platform.OS !== 'web' }).start(({ finished }) => {
      if (finished) {
        if (router.canGoBack()) router.back();
        else router.replace('/');
      }
    });
  }, [progress, dragY]);

  const panResponder = useMemo(() => {
    const resetDrag = () => {
      if (closing.current) return;
      Animated.spring(dragY, { toValue: 0, overshootClamping: true, useNativeDriver: Platform.OS !== 'web' }).start();
    };

    // PanResponder stores these callbacks; refs are only read when a gesture fires.
    // eslint-disable-next-line react-hooks/refs
    return PanResponder.create({
      onMoveShouldSetPanResponderCapture: (_, { dx, dy, numberActiveTouches }) =>
        !closing.current && numberActiveTouches === 1 && dy > 8 && dy > Math.abs(dx),
      onPanResponderGrant: () => dragY.stopAnimation(),
      onPanResponderMove: (_, { dy }) => {
        if (!closing.current) dragY.setValue(Math.max(0, dy));
      },
      onPanResponderRelease: (_, { dy, vy }) => {
        if (dy > 100 || (dy > 24 && vy > 0.7)) close();
        else resetDrag();
      },
      onPanResponderTerminate: resetDrag,
      onPanResponderTerminationRequest: () => false,
    });
  }, [close, dragY]);

  // This sheet only signs people in; once signed in, the app opens and Account is its own page.
  useEffect(() => {
    if (session) close();
  }, [session, close]);

  useEffect(() => {
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
      close();
      return true;
    });
    return () => subscription.remove();
  }, [close]);

  return <View className="flex-1 justify-end" accessibilityViewIsModal>
    <Pressable className="absolute inset-0 bg-[rgba(49,34,24,0.35)]" onPress={close} accessibilityRole="button" accessibilityLabel="Close account sheet" />
    <AnimatedKeyboardAvoidingView className="h-[65%] w-full overflow-hidden rounded-t-3xl bg-paper" style={{ transform: [{ translateY: Animated.add(progress.interpolate({ inputRange: [0, 1], outputRange: [height, 0] }), dragY) }] }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <SafeAreaView className="flex-1" edges={['bottom', 'left', 'right']}>
        <View {...panResponder.panHandlers} className="px-6 pb-2 pt-3" style={Platform.OS === 'web' ? { touchAction: 'none' } : undefined}>
          <View className="mb-2 h-1 w-10 self-center rounded-full bg-line" />
          <View className="w-full max-w-[400px] flex-row items-center gap-3 self-center">
            <Heading className="flex-1">{register ? 'Sign up' : 'Sign in'}</Heading>
            <Pressable onPress={close} accessibilityRole="button" accessibilityLabel="Close" className="h-11 w-11 items-center justify-center"><Icon name="close" /></Pressable>
          </View>
        </View>
        <ScrollView className="flex-1" contentContainerClassName="grow px-6 pb-4" keyboardShouldPersistTaps="handled">
          <View className="w-full max-w-[400px] self-center">
            {!supabase ? <Body className="mt-3 text-center !text-[11px]">Sign-in isn’t available yet. Please try again later.</Body>
              : authLoading ? <LoadingSkeleton variant="form" label="Restoring your session" className="mt-4" />
              : <>
                {authError ? <Text accessibilityRole="alert" className="my-3 text-[13px] leading-5 text-rust">{authError}</Text> : null}
                {session ? null : <Auth onRegisterChange={setRegister} />}
              </>}
          </View>
        </ScrollView>
      </SafeAreaView>
    </AnimatedKeyboardAvoidingView>
  </View>;
}
