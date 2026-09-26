import { router } from 'expo-router';
import { ActivityIndicator, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Body, colors, fieldStyles, Heading, Icon } from '../components/ui';
import Auth from '../components/Auth';
import Account from '../components/Account';
import { supabase } from '../lib/supabase';
import { useStudio } from '../context/studio';

export default function AuthScreen() {
  const { session, authLoading, authError, name } = useStudio();
  const close = () => router.canGoBack() ? router.back() : router.replace('/recorder');
  return <View style={s.overlay} accessibilityViewIsModal>
    <Pressable style={s.backdrop} onPress={close} accessibilityRole="button" accessibilityLabel="Close account sheet" />
    <KeyboardAvoidingView style={s.sheet} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <SafeAreaView style={s.safe} edges={['bottom', 'left', 'right']}>
        <ScrollView contentContainerStyle={s.scroll} keyboardShouldPersistTaps="handled">
          <View style={s.form}>
            <View style={s.header}>
              <Heading style={{ flex: 1 }}>{session ? 'Account' : 'Sign in'}</Heading>
              <Pressable onPress={close} accessibilityRole="button" accessibilityLabel="Close" style={s.close}><Icon name="close" /></Pressable>
            </View>
            {!supabase ? <Body style={s.note}>Sign-in isn’t available yet. Please try again later.</Body>
              : authLoading ? <ActivityIndicator accessibilityLabel="Restoring your session" color={colors.cocoa} style={s.note} />
              : <>
                {authError ? <Text accessibilityRole="alert" style={fieldStyles.error}>{authError}</Text> : null}
                {session ? <Account key={session.user.id} userId={session.user.id} email={session.user.email} displayName={name} /> : <Auth />}
              </>}
          </View>
        </ScrollView>
      </SafeAreaView>
    </KeyboardAvoidingView>
  </View>;
}
const s = StyleSheet.create({
  overlay: { flex: 1, justifyContent: 'flex-end' },
  backdrop: { ...StyleSheet.absoluteFill, backgroundColor: 'rgba(49, 34, 24, 0.35)' },
  // Only the top corners are rounded; the surface reaches every bottom edge.
  sheet: { height: '65%', width: '100%', backgroundColor: colors.paper, borderTopLeftRadius: 24, borderTopRightRadius: 24, overflow: 'hidden' },
  safe: { flex: 1 },
  scroll: { flexGrow: 1, paddingHorizontal: 24, paddingTop: 20, paddingBottom: 16 },
  form: { maxWidth: 400, width: '100%', alignSelf: 'center' },
  header: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  close: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  switch: { alignItems: 'center', minHeight: 54, justifyContent: 'center' },
  switchText: { fontSize: 13, color: colors.ink },
  note: { marginTop: 12, fontSize: 11, textAlign: 'center' },
});
