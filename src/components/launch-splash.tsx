import { useEffect } from 'react';
import { View } from 'react-native';
import Animated, { ReduceMotion, useAnimatedStyle, useSharedValue, withSpring, withTiming } from 'react-native-reanimated';
import { BearMark } from './bear-mark';

/** Short placeholder while a real launch animation is prepared. */
export function LaunchSplash({ onFinish }: { onFinish: () => void }) {
  const scale = useSharedValue(0.2);
  const lift = useSharedValue(72);
  const bearOpacity = useSharedValue(0);
  const veil = useSharedValue(1);

  useEffect(() => {
    const spring = { damping: 9, stiffness: 170, reduceMotion: ReduceMotion.System };
    scale.value = withSpring(1, spring);
    lift.value = withSpring(0, { damping: 12, stiffness: 150, reduceMotion: ReduceMotion.System });
    bearOpacity.value = withTiming(1, { duration: 180 });
    const fadeTimer = setTimeout(() => {
      veil.value = withTiming(0, { duration: 320 });
    }, 1100);
    const doneTimer = setTimeout(onFinish, 1480);
    return () => {
      clearTimeout(fadeTimer);
      clearTimeout(doneTimer);
    };
  }, [bearOpacity, lift, onFinish, scale, veil]);

  const bearStyle = useAnimatedStyle(() => ({
    opacity: bearOpacity.value,
    transform: [{ translateY: lift.value }, { scale: scale.value }],
  }));
  const veilStyle = useAnimatedStyle(() => ({ opacity: veil.value }));

  return (
    <Animated.View
      style={veilStyle}
      className="absolute inset-0 z-50 items-center justify-center bg-paper"
    >
      <Animated.View style={bearStyle}>
        <BearMark size={148} />
      </Animated.View>
      <View className="h-8" />
    </Animated.View>
  );
}
