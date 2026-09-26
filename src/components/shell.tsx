import { ReactNode } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { router, usePathname } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, Icon, serif } from './ui';
import { useStudio } from '../context/studio';
const links = [{
  path: '/' as const,
  title: 'Home',
  icon: 'home' as const
}, {
  path: '/marketplace' as const,
  title: 'Marketplace',
  icon: 'shop' as const
}, {
  path: '/create' as const,
  title: 'Create',
  icon: 'create' as const
}];
export function Shell({
  children
}: {
  children: ReactNode;
}) {
  const {
    width
  } = useWindowDimensions();
  const mobile = width < 700;
  const pathname = usePathname();
  const {
    name
  } = useStudio();
  const navigation = links.map(link => <Pressable key={link.path} accessibilityRole="tab" accessibilityState={{
    selected: pathname === link.path
  }} accessibilityLabel={link.title} onPress={() => router.replace(link.path)} style={[s.navItem, mobile && s.mobileItem, pathname === link.path && !mobile && s.activeNav]}>{mobile && <Icon name={link.icon} color={pathname === link.path ? colors.green : colors.muted} size={23} />}<Text style={[s.navText, mobile && {
      fontSize: 10
    }, pathname === link.path && {
      color: colors.green,
      fontWeight: '700'
    }]}>{link.title}</Text>{!mobile && link.title === 'Create' && <Icon name="create" size={15} />}</Pressable>);
  return <SafeAreaView style={s.safe} edges={['top', 'bottom']}><View style={[s.header, mobile && {
      paddingHorizontal: 23,
      height: 71
    }]}><Pressable accessibilityRole="link" accessibilityLabel="TedTime home" onPress={() => router.navigate('/')} style={s.brand}><View style={s.brandMark}><Text style={s.brandLetter}>t</Text><View style={s.brandDot} /></View><Text style={s.brandName}>TedTime</Text></Pressable>{!mobile && <View style={s.nav}>{navigation}</View>}<Pressable accessibilityRole="button" onPress={() => router.push('/auth')} style={s.signIn}><Icon name="person" size={19} /><Text style={s.signInText}>{name ? name.split(' ')[0] : 'Sign in'}</Text>{!mobile && <Icon name="arrow" size={17} />}</Pressable></View><ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}><View style={[s.content, mobile && {
        paddingHorizontal: 23
      }]}>{children}<View style={s.footer}><Text style={s.footerText}>Made for the joy of making.</Text><Text style={s.footerMark}>❦</Text><Text style={s.footerText}>Take your time. It’s TedTime.</Text></View></View></ScrollView>{mobile && <View style={s.bottom}>{navigation}</View>}</SafeAreaView>;
}
const s = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: colors.paper
  },
  header: {
    height: 91,
    width: '100%',
    paddingHorizontal: 58,
    borderBottomWidth: 1,
    borderColor: colors.line,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 15
  },
  brand: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10
  },
  brandMark: {
    borderWidth: 1,
    borderColor: colors.green,
    width: 30,
    height: 35,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center'
  },
  brandLetter: {
    fontFamily: serif,
    color: colors.green,
    fontSize: 33,
    lineHeight: 35
  },
  brandDot: {
    width: 5,
    height: 5,
    backgroundColor: colors.gold,
    borderRadius: 4,
    position: 'absolute',
    right: -3,
    top: 2
  },
  brandName: {
    fontFamily: serif,
    fontSize: 31,
    fontWeight: '600',
    color: colors.ink,
    letterSpacing: -0.7
  },
  nav: {
    flexDirection: 'row',
    gap: 30,
    height: '100%'
  },
  navItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 3,
    justifyContent: 'center'
  },
  activeNav: {
    borderBottomWidth: 2,
    borderColor: colors.green
  },
  navText: {
    fontSize: 13,
    color: colors.muted
  },
  signIn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    minHeight: 44
  },
  signInText: {
    color: colors.ink,
    fontSize: 12,
    maxWidth: 95
  },
  scroll: {
    flexGrow: 1
  },
  content: {
    width: '100%',
    maxWidth: 1240,
    paddingHorizontal: 58,
    alignSelf: 'center',
    flex: 1
  },
  bottom: {
    flexDirection: 'row',
    borderTopWidth: 1,
    borderColor: colors.line,
    paddingTop: 9,
    paddingBottom: 8,
    backgroundColor: colors.paper
  },
  mobileItem: {
    flex: 1,
    flexDirection: 'column',
    gap: 4,
    minHeight: 45
  },
  footer: {
    borderTopWidth: 1,
    borderColor: colors.line,
    paddingVertical: 24,
    marginTop: 35,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 6
  },
  footerText: {
    fontSize: 9,
    color: colors.muted
  },
  footerMark: {
    color: colors.gold,
    fontSize: 22
  }
});
