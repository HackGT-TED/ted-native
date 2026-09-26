import { useState } from 'react';
import { router } from 'expo-router';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Body, Button, colors, fieldStyles, Heading, Icon } from '../components/ui';
import { useStudio } from '../context/studio';

export default function Auth() {
  const { name, signIn, signOut } = useStudio();
  const [register, setRegister] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [error, setError] = useState('');
  const close = () => router.canGoBack() ? router.back() : router.replace('/recorder');
  function submit() {
    if (register && !displayName.trim()) { setError('Enter your name.'); return; }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) { setError('Enter a valid email.'); return; }
    if (password.length < 8) { setError('Use at least 8 characters for your password.'); return; }
    signIn(displayName.trim() || email.trim().split('@')[0]);
    close();
  }
  return <SafeAreaView style={s.safe}><KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
    <ScrollView contentContainerStyle={s.scroll} keyboardShouldPersistTaps="handled"><View style={s.form}>
      <Pressable onPress={close} accessibilityRole="button" accessibilityLabel="Close" style={s.close}><Icon name="close" /></Pressable>
      <Heading>{name ? 'Account' : register ? 'Create an account' : 'Sign in'}</Heading>
      <Body style={{ marginTop: 8 }}>{name || 'Your TedTime account.'}</Body>
      {name ? <Button title="Sign out" secondary onPress={() => { signOut(); close(); }} style={{ marginTop: 32 }} /> : <>
        {register && <><Text style={fieldStyles.label}>Name</Text><TextInput accessibilityLabel="Name" value={displayName} onChangeText={setDisplayName} autoComplete="name" style={fieldStyles.input} /></>}
        <Text style={fieldStyles.label}>Email</Text><TextInput accessibilityLabel="Email" value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" autoComplete="email" style={fieldStyles.input} />
        <Text style={fieldStyles.label}>Password</Text><TextInput accessibilityLabel="Password" value={password} onChangeText={setPassword} secureTextEntry autoComplete={register ? 'new-password' : 'current-password'} onSubmitEditing={submit} style={fieldStyles.input} />
        {error ? <Text accessibilityRole="alert" style={fieldStyles.error}>{error}</Text> : null}
        <Button title={register ? 'Create account' : 'Sign in'} onPress={submit} style={{ marginTop: 28 }} />
        <Pressable accessibilityRole="button" onPress={() => { setRegister(!register); setError(''); }} style={s.switch}><Text style={s.switchText}>{register ? 'Already have an account? Sign in' : 'Create an account'}</Text></Pressable>
      </>}
      <Body style={s.note}>Demo account. Use sample details.</Body>
    </View></ScrollView>
  </KeyboardAvoidingView></SafeAreaView>;
}
const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.paper },
  scroll: { flexGrow: 1, padding: 24, justifyContent: 'center' },
  form: { maxWidth: 400, width: '100%', alignSelf: 'center', paddingBottom: 30 },
  close: { alignSelf: 'flex-end', width: 44, height: 44, alignItems: 'center', justifyContent: 'center', marginBottom: 28 },
  switch: { alignItems: 'center', minHeight: 54, justifyContent: 'center' },
  switchText: { fontSize: 13, color: colors.ink },
  note: { marginTop: 24, fontSize: 11, textAlign: 'center' },
});
