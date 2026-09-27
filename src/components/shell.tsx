import { ReactNode, useEffect } from 'react';
import { Platform, Pressable, ScrollView, Text, useWindowDimensions, View, type ViewStyle } from 'react-native';
import { router, usePathname } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, Icon } from './ui';
import { BearMark } from './bear-mark';
import { useStudio } from '../context/studio';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';

const links = [
  { path: '/' as const, title: 'Create', icon: 'create' as const, active: ['/', '/create'] },
  { path: '/explore' as const, title: 'Explore', icon: 'search' as const, active: ['/explore'] },
  { path: '/library' as const, title: 'Library', icon: 'book' as const, active: ['/library'] },
];
export function Shell({ children, scroll = true, immersive = false, quiet = false, recordingOverlay }: {
  children: ReactNode; scroll?: boolean; immersive?: boolean; quiet?: boolean; recordingOverlay?: ReactNode;
}) {
  const focus = useSharedValue(0);
  useEffect(() => { focus.value = withTiming(immersive ? 1 : 0, { duration: 320 }); }, [focus, immersive]);
  const chromeStyle = useAnimatedStyle(() => ({ opacity: 1 - focus.value }));
  const overlayStyle = useAnimatedStyle(() => ({ opacity: focus.value }));
  const quietFocus = useSharedValue(1);
  useEffect(() => { quietFocus.value = withTiming(quiet ? 0.15 : 1, { duration: 180 }); }, [quiet, quietFocus]);
  const quietStyle = useAnimatedStyle(() => ({ opacity: quietFocus.value }));
  const mobile = useWindowDimensions().width < 700;
  const pathname = usePathname();
  const { name } = useStudio();
  const navigation = links.map(link => {
    const selected = link.active.includes(pathname);
    return <Pressable key={link.path} accessibilityRole="tab" accessibilityState={{ selected }} onPress={() => router.replace(link.path)} className="min-h-11 flex-1 items-center justify-center gap-[5px]">
      <Icon name={link.icon} size={22} color={selected ? colors.ink : colors.muted} />
      <Text className={`${selected ? "font-semibold text-ink" : "text-muted"} text-[11px]`}>{link.title}</Text>
    </Pressable>;
  });
  const content = <View className={`w-full max-w-[1000px] self-center ${scroll ? "" : "min-h-0 flex-1"} ${mobile ? "px-6" : "px-12"}`}>{children}</View>;
  const webFrame = Platform.OS === 'web' ? { height: '100dvh', maxHeight: '100dvh', overflow: 'hidden' } as unknown as ViewStyle : undefined;
  return <SafeAreaView className="flex-1 bg-paper" edges={['top', 'bottom']} style={webFrame}>
    <Animated.View className="min-h-0 flex-1" style={[chromeStyle, { flex: 1, minHeight: 0, overflow: 'hidden', pointerEvents: immersive ? 'none' : 'auto' }]} accessibilityElementsHidden={immersive} importantForAccessibility={immersive ? 'no-hide-descendants' : 'auto'}>
    {scroll ? <ScrollView showsVerticalScrollIndicator={false} style={{ flex: 1, minHeight: 0 }} keyboardShouldPersistTaps="handled" contentContainerClassName="grow pb-9">{content}</ScrollView> : content}
    <Animated.View style={[quietStyle, { pointerEvents: quiet ? 'none' : 'auto' }]} accessibilityElementsHidden={quiet} importantForAccessibility={quiet ? 'no-hide-descendants' : 'auto'} className="flex-row border-t border-line pb-[7px] pt-2.5">
      {navigation}
      <Pressable accessibilityRole="button" accessibilityLabel={name ? 'Account settings' : 'Sign in'} onPress={() => router.push('/auth')} className="min-h-11 flex-1 items-center justify-center gap-[5px]">
        <BearMark size={24} />
        <Text className="text-[11px] text-muted">{name ? 'Account' : 'Sign in'}</Text>
      </Pressable>
    </Animated.View>
    </Animated.View>
    {recordingOverlay && <Animated.View className="absolute inset-0 items-center justify-center" style={[overlayStyle, { pointerEvents: immersive ? 'auto' : 'none' }]}
      accessibilityElementsHidden={!immersive} importantForAccessibility={immersive ? 'auto' : 'no-hide-descendants'}>
      {recordingOverlay}
    </Animated.View>}
  </SafeAreaView>;
}
