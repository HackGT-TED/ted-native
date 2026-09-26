import { ReactNode } from 'react';
import { Pressable, ScrollView, Text, useWindowDimensions, View } from 'react-native';
import { router, usePathname } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, Icon } from './ui';
import { useStudio } from '../context/studio';

const links = [
  { path: '/recorder' as const, title: 'Record', icon: 'mic' as const },
  { path: '/explore' as const, title: 'Explore', icon: 'search' as const },
  { path: '/library' as const, title: 'Library', icon: 'book' as const },
  { path: '/create' as const, title: 'Create', icon: 'create' as const },
];
export function Shell({ children, scroll = true }: { children: ReactNode; scroll?: boolean }) {
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
    <View className={`h-[72px] flex-row items-center justify-between border-b border-line ${mobile ? "px-6" : "px-12"}`}>
      <Pressable accessibilityRole="link" accessibilityLabel="TedTime recorder" onPress={() => router.replace('/recorder')} className="min-h-11 flex-row items-center gap-[9px]">
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
    </View>
    {scroll ? <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled" contentContainerClassName="grow pb-9">{content}</ScrollView> : content}
    {mobile && <View className="flex-row border-t border-line pb-[7px] pt-2.5">{navigation}</View>}
  </SafeAreaView>;
}
