import { useState } from 'react';
import { router } from 'expo-router';
import { KeyboardAvoidingView, Platform, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { Shell } from '../components/shell';
import { Body, Button, colors, fieldStyles, Heading } from '../components/ui';
import { useStudio } from '../context/studio';

export default function Create() {
  const { name, session, authLoading, addCreation } = useStudio();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('Stories');
  const [error, setError] = useState('');
  const [created, setCreated] = useState('');
  function publish() {
    if (!title.trim() || !description.trim()) { setError('Add a title and description.'); return; }
    if (authLoading) return;
    if (!session) { router.push('/auth'); return; }
    const id = `creation-${Date.now()}`;
    addCreation({ id, title: title.trim(), subtitle: description.trim(), category, color: colors.cream, author: name });
    setError('');
    setCreated(id);
  }
  return <Shell><KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={s.page}>
    <Heading>{created ? 'Shared.' : 'Create'}</Heading>
    <Body style={{ marginTop: 8 }}>{created ? 'Your creation is now in Explore.' : 'Share a little of your world with the community.'}</Body>
    {created ? <View style={s.success}><Button title="View creation" onPress={() => router.push({ pathname: '/item/[id]', params: { id: created } })} /><Button title="Create another" secondary onPress={() => { setCreated(''); setTitle(''); setDescription(''); }} /></View> : <>
      <Text style={fieldStyles.label}>Category</Text>
      <View style={s.categories}>{['Stories', 'Journals', 'Art'].map(item => <Pressable key={item} accessibilityRole="button" accessibilityState={{ selected: category === item }} onPress={() => setCategory(item)} style={[s.category, category === item && { backgroundColor: colors.ink, borderColor: colors.ink }]}><Text style={{ fontSize: 13, color: category === item ? colors.paper : colors.muted }}>{item}</Text></Pressable>)}</View>
      <Text style={fieldStyles.label}>Title</Text><TextInput accessibilityLabel="Creation title" value={title} onChangeText={setTitle} maxLength={65} placeholder="Give it a name" placeholderTextColor={colors.muted} style={fieldStyles.input} />
      <Text style={fieldStyles.label}>Description</Text><TextInput accessibilityLabel="Creation description" value={description} onChangeText={setDescription} maxLength={160} multiline placeholder="A few words about your creation" placeholderTextColor={colors.muted} style={[fieldStyles.input, s.description]} />
      {error ? <Text accessibilityRole="alert" style={fieldStyles.error}>{error}</Text> : null}
      <Button title={authLoading ? 'Restoring session…' : session ? 'Share with community' : 'Sign in to share'} disabled={authLoading} onPress={publish} style={{ marginTop: 28 }} />
      <Body style={s.note}>Shared creations are available for this demo session.</Body>
    </>}
  </KeyboardAvoidingView></Shell>;
}
const s = StyleSheet.create({
  page: { width: '100%', maxWidth: 480, alignSelf: 'center', paddingTop: 36 },
  categories: { flexDirection: 'row', gap: 10 },
  category: { flex: 1, borderWidth: 1, borderColor: colors.line, borderRadius: 8, minHeight: 44, alignItems: 'center', justifyContent: 'center' },
  description: { minHeight: 130, paddingVertical: 16, textAlignVertical: 'top' },
  note: { fontSize: 11, textAlign: 'center', marginTop: 16 },
  success: { marginTop: 36, gap: 12 },
});
