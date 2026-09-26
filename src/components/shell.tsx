import { ReactNode } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
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
    return <Pressable key={link.path} accessibilityRole="tab" accessibilityState={{ selected }} onPress={() => router.replace(link.path)} style={[s.navItem, mobile && s.mobileItem]}>
      {mobile && <Icon name={link.icon} size={22} color={selected ? colors.ink : colors.muted} />}
      <Text style={[s.navText, selected && s.selected, mobile && { fontSize: 11 }]}>{link.title}</Text>
    </Pressable>;
  });
  const content = <View style={[s.content, !scroll && { flex: 1 }, mobile && { paddingHorizontal: 24 }]}>{children}</View>;
  return <SafeAreaView style={s.safe} edges={['top', 'bottom']}>
    <View style={[s.header, mobile && { paddingHorizontal: 24 }]}>
      <Pressable accessibilityRole="link" accessibilityLabel="TedTime recorder" onPress={() => router.replace('/recorder')} style={s.brand}>
        <View accessible={false} pointerEvents="none" style={s.bear}>
          <View style={[s.ear, { left: 1 }]} /><View style={[s.ear, { right: 1 }]} />
          <View style={s.bearFace}>
            <View style={[s.eye, { left: 6 }]} /><View style={[s.eye, { right: 6 }]} />
            <View style={s.nose} />
          </View>
        </View>
        <Text style={s.brandText}>tedtime<Text style={{ color: colors.honey }}>.</Text></Text>
      </Pressable>
      {!mobile && <View style={s.nav}>{navigation}</View>}
      <Pressable accessibilityRole="button" accessibilityLabel={name ? 'Account' : 'Sign in'} onPress={() => router.push('/auth')} style={s.account}>
        <Icon name="person" size={21} />{!mobile && <Text style={s.accountText}>{name ? 'Account' : 'Sign in'}</Text>}
      </Pressable>
    </View>
    {scroll ? <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled" contentContainerStyle={s.scroll}>{content}</ScrollView> : content}
    {mobile && <View style={s.bottom}>{navigation}</View>}
  </SafeAreaView>;
}
const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.paper },
  header: { height: 72, paddingHorizontal: 48, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderBottomWidth: 1, borderColor: colors.line },
  brand: { minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: 9 },
  bear: { width: 26, height: 25 },
  ear: { position: 'absolute', top: 1, width: 9, height: 9, borderRadius: 5, backgroundColor: colors.cocoa },
  bearFace: { position: 'absolute', top: 5, left: 1, width: 24, height: 20, borderRadius: 10, backgroundColor: colors.cocoa },
  eye: { position: 'absolute', top: 7, width: 3, height: 3, borderRadius: 2, backgroundColor: colors.paper },
  nose: { position: 'absolute', top: 12, left: 10, width: 4, height: 3, borderRadius: 2, backgroundColor: colors.paper },
  brandText: { fontSize: 23, fontWeight: '700', letterSpacing: -1.1, color: colors.ink },
  nav: { flexDirection: 'row', gap: 24 },
  navItem: { minHeight: 44, alignItems: 'center', justifyContent: 'center', gap: 5 },
  mobileItem: { flex: 1 },
  navText: { fontSize: 13, color: colors.muted },
  selected: { color: colors.ink, fontWeight: '600' },
  account: { flexDirection: 'row', gap: 8, alignItems: 'center', justifyContent: 'center', minWidth: 44, minHeight: 44 },
  accountText: { fontSize: 13, color: colors.ink },
  content: { width: '100%', maxWidth: 1000, alignSelf: 'center', paddingHorizontal: 48 },
  scroll: { flexGrow: 1, paddingBottom: 36 },
  bottom: { flexDirection: 'row', paddingTop: 10, paddingBottom: 7, borderTopWidth: 1, borderColor: colors.line },
});
