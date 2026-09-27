import { ReactNode, useEffect } from 'react';
import { Pressable, ScrollView, Text, useWindowDimensions, View } from 'react-native';
import { router, usePathname } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, Icon } from './ui';
import { useStudio } from '../context/studio';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';

const links = [
  { path: '/create' as const, title: 'Create', icon: 'create' as const },
  { path: '/explore' as const, title: 'Explore', icon: 'search' as const },
  { path: '/library' as const, title: 'Library', icon: 'book' as const },
  { path: '/bear' as const, title: 'My Bear', icon: 'heart' as const },
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
    const selected = pathname === link.path;
    return <Pressable key={link.path} accessibilityRole="tab" accessibilityState={{ selected }} onPress={() => router.replace(link.path)} className={`min-h-11 items-center justify-center gap-[5px] ${mobile ? "flex-1" : ""}`}>
      {mobile && <Icon name={link.icon} size={22} color={selected ? colors.ink : colors.muted} />}
      <Text className={`${selected ? "font-semibold text-ink" : "text-muted"} ${mobile ? "text-[11px]" : "text-[13px]"}`}>{link.title}</Text>
    </Pressable>;
  });
  const content = <View className={`w-full max-w-[1000px] self-center ${scroll ? "" : "flex-1"} ${mobile ? "px-6" : "px-12"}`}>{children}</View>;
  return <SafeAreaView className="flex-1 bg-paper" edges={['top', 'bottom']}>
    <Animated.View className="flex-1" style={chromeStyle} pointerEvents={immersive ? 'none' : 'auto'} accessibilityElementsHidden={immersive} importantForAccessibility={immersive ? 'no-hide-descendants' : 'auto'}>
    <Animated.View style={quietStyle} pointerEvents={quiet ? 'none' : 'auto'} accessibilityElementsHidden={quiet} importantForAccessibility={quiet ? 'no-hide-descendants' : 'auto'} className={`h-[72px] flex-row items-center justify-between border-b border-line ${mobile ? "px-6" : "px-12"}`}>
      <Pressable accessibilityRole="link" accessibilityLabel="TedTime home" onPress={() => router.replace('/')} className="min-h-11 flex-row items-center gap-[9px]">
        <View accessible={false} pointerEvents="none" className="h-[25px] w-[26px]">
          <View className="absolute left-px top-px h-[9px] w-[9px] rounded-[5px] bg-cocoa" /><View className="absolute right-px top-px h-[9px] w-[9px] rounded-[5px] bg-cocoa" />
          <View className="absolute left-px top-[5px] h-5 w-6 rounded-[10px] bg-cocoa">
            <View className="absolute left-1.5 top-[7px] h-[3px] w-[3px] rounded-[2px] bg-paper" /><View className="absolute right-1.5 top-[7px] h-[3px] w-[3px] rounded-[2px] bg-paper" />
            <View className="absolute left-2.5 top-3 h-[3px] w-1 rounded-[2px] bg-paper" />
          </View>
        </View>
        <Text className="text-[23px] font-bold tracking-[-1.1px] text-ink">tedtime<Text className="text-honey">.</Text></Text>
      </Pressable>
      {!mobile && <View className="flex-row gap-6">{navigation}</View>}
      <Pressable accessibilityRole="button" accessibilityLabel={name ? 'Account' : 'Sign in'} onPress={() => router.push('/auth')} className="min-h-11 min-w-11 flex-row items-center justify-center gap-2">
        <Icon name="person" size={21} />{!mobile && <Text className="text-[13px] text-ink">{name ? 'Account' : 'Sign in'}</Text>}
      </Pressable>
    </Animated.View>
    {scroll ? <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled" contentContainerClassName="grow pb-9">{content}</ScrollView> : content}
    {mobile && <Animated.View style={quietStyle} pointerEvents={quiet ? 'none' : 'auto'} accessibilityElementsHidden={quiet} importantForAccessibility={quiet ? 'no-hide-descendants' : 'auto'} className="flex-row border-t border-line pb-[7px] pt-2.5">{navigation}</Animated.View>}
    </Animated.View>
    {recordingOverlay && <Animated.View className="absolute inset-0 items-center justify-center" style={overlayStyle}
      pointerEvents={immersive ? 'auto' : 'none'} accessibilityElementsHidden={!immersive} importantForAccessibility={immersive ? 'auto' : 'no-hide-descendants'}>
      {recordingOverlay}
    </Animated.View>}
  </SafeAreaView>;
}
