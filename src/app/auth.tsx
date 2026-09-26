import { useState } from 'react';
import { router } from 'expo-router';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Body, Button, colors, Heading, Icon, Label, Ornament, serif } from '../components/ui';
import { useStudio } from '../context/studio';
export default function Auth() {
  const {
    name,
    signIn,
    signOut
  } = useStudio();
  const [register, setRegister] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [error, setError] = useState('');
  const close = () => router.canGoBack() ? router.back() : router.replace('/');
  function submit() {
    if (register && !displayName.trim()) return setError('What should we call you?');
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) return setError('Please enter a valid email address.');
    if (password.length < 8) return setError('Use a password with at least 8 characters.');
    signIn(displayName.trim() || email.split('@')[0]);
    close();
  }
  return <SafeAreaView style={s.safe}><KeyboardAvoidingView style={{
      flex: 1
    }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}><ScrollView contentContainerStyle={s.scroll} keyboardShouldPersistTaps="handled"><View style={s.card}><Pressable onPress={close} accessibilityRole="button" accessibilityLabel="Close sign in" style={s.close}><Icon name="close" /></Pressable><Text style={s.mark}>❦</Text><Label style={{
            textAlign: 'center'
          }}>YOUR LITTLE CORNER OF TEDTIME</Label><Heading style={s.title}>{name ? `Hello, ${name}.` : register ? 'A new chapter awaits.' : 'Welcome back, wanderer.'}</Heading><Body style={{
            textAlign: 'center'
          }}>{name ? 'Your imagination is right at home here.' : 'A place for your ideas, your discoveries, and you.'}</Body><Ornament />{name ? <><Button title="Back to exploring" onPress={close} icon="arrow" /><Button title="Sign out" secondary onPress={() => {
              signOut();
              close();
            }} style={{
              marginTop: 12
            }} /></> : <>{register && <><Text style={s.label}>Your name</Text><TextInput accessibilityLabel="Your name" value={displayName} onChangeText={setDisplayName} placeholder="What shall we call you?" placeholderTextColor={colors.muted} style={s.input} autoComplete="name" /></>}<Text style={s.label}>Email address</Text><TextInput accessibilityLabel="Email address" value={email} onChangeText={setEmail} placeholder="you@somewhere.com" placeholderTextColor={colors.muted} style={s.input} keyboardType="email-address" autoCapitalize="none" autoComplete="email" /><Text style={s.label}>Password</Text><TextInput accessibilityLabel="Password" value={password} onChangeText={setPassword} placeholder="At least 8 characters" placeholderTextColor={colors.muted} style={s.input} secureTextEntry autoComplete={register ? 'new-password' : 'current-password'} onSubmitEditing={submit} />{error ? <Text accessibilityRole="alert" style={s.error}>{error}</Text> : null}<Button title={register ? 'Create your account' : 'Sign in'} onPress={submit} icon="arrow" style={{
              marginTop: 12
            }} /><Pressable accessibilityRole="button" onPress={() => {
              setRegister(!register);
              setError('');
            }} style={s.switch}><Text style={s.switchText}>{register ? 'Already part of the story? Sign in' : 'New to TedTime? Join the story'}</Text></Pressable></>}<Text style={s.demo}>A little preview of what’s to come.{'\n'}Demo sign-in only — use sample details. Nothing is sent or stored.</Text></View></ScrollView></KeyboardAvoidingView></SafeAreaView>;
}
const s = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: colors.paper
  },
  scroll: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: 24
  },
  card: {
    maxWidth: 420,
    width: '100%',
    alignSelf: 'center',
    paddingVertical: 30
  },
  close: {
    alignSelf: 'flex-end',
    padding: 12,
    marginBottom: 15
  },
  mark: {
    fontFamily: serif,
    fontSize: 49,
    textAlign: 'center',
    color: colors.gold,
    marginBottom: 18
  },
  title: {
    textAlign: 'center',
    fontSize: 43,
    lineHeight: 46,
    marginVertical: 15
  },
  label: {
    fontSize: 12,
    color: colors.ink,
    marginBottom: 8,
    marginTop: 15
  },
  input: {
    minHeight: 52,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 5,
    paddingHorizontal: 15,
    color: colors.ink,
    fontSize: 14,
    backgroundColor: '#FBF8F0'
  },
  error: {
    color: colors.rust,
    fontSize: 12,
    marginTop: 13
  },
  switch: {
    alignItems: 'center',
    paddingVertical: 23
  },
  switchText: {
    color: colors.green,
    fontSize: 12
  },
  demo: {
    textAlign: 'center',
    color: colors.muted,
    fontSize: 10,
    lineHeight: 17,
    marginTop: 20
  }
});
