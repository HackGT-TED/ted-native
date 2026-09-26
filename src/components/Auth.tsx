import { useRef, useState } from 'react';
import { Pressable, Text, TextInput, View } from 'react-native';
import { supabase } from '../lib/supabase';
import { Body, Button, colors, fieldStyles } from './ui';
import { appStyles as s } from '../styles/styles';

export default function Auth() {
  const [register, setRegister] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const pending = useRef(false);

  async function submit() {
    if (!supabase || pending.current) return;
    setError('');
    setNotice('');
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) { setError('Enter a valid email.'); return; }
    if (!password || (register && password.length < 8)) { setError(register ? 'Use at least 8 characters for your password.' : 'Enter your password.'); return; }
    if (register && !displayName.trim()) { setError('Enter your name.'); return; }
    pending.current = true;
    setLoading(true);
    try {
      const credentials = { email: email.trim(), password };
      const { data, error: authError } = register
        ? await supabase.auth.signUp({ ...credentials, options: { data: { display_name: displayName.trim() } } })
        : await supabase.auth.signInWithPassword(credentials);
      if (authError) throw authError;
      setPassword('');
      if (register && !data.session) {
        setNotice('Check your email to confirm your account, then return here to sign in.');
        setRegister(false);
      }
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not connect. Please try again.');
    } finally {
      pending.current = false;
      setLoading(false);
    }
  }

  return <View>
    <Body>{register ? 'Create your TedTime account.' : 'Welcome back to TedTime.'}</Body>
    {register && <>
      <Text style={fieldStyles.label}>Name</Text>
      <TextInput accessibilityLabel="Name" value={displayName} onChangeText={setDisplayName} autoComplete="name" maxLength={80} editable={!loading} style={fieldStyles.input} />
    </>}
    <Text style={fieldStyles.label}>Email</Text>
    <TextInput accessibilityLabel="Email" value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" autoCorrect={false} autoComplete="email" editable={!loading} placeholder="you@example.com" placeholderTextColor={colors.muted} style={fieldStyles.input} />
    <Text style={fieldStyles.label}>Password</Text>
    <TextInput accessibilityLabel="Password" value={password} onChangeText={setPassword} secureTextEntry autoCapitalize="none" autoComplete={register ? 'new-password' : 'current-password'} editable={!loading} onSubmitEditing={() => { void submit(); }} style={fieldStyles.input} />
    {error ? <Text accessibilityRole="alert" style={fieldStyles.error}>{error}</Text> : null}
    {notice ? <Text accessibilityLiveRegion="polite" style={s.notice}>{notice}</Text> : null}
    <Button title={loading ? 'Please wait…' : register ? 'Create account' : 'Sign in'} disabled={loading || !supabase} onPress={() => { void submit(); }} style={s.action} />
    <Pressable accessibilityRole="button" disabled={loading} onPress={() => { setRegister(!register); setError(''); setNotice(''); }} style={s.switch}>
      <Text style={s.switchText}>{register ? 'Already have an account? Sign in' : 'Create an account'}</Text>
    </Pressable>
  </View>;
}
