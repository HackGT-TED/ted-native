import { useState } from 'react';
import { router } from 'expo-router';
import { KeyboardAvoidingView, Platform, Pressable, StyleSheet, Text, TextInput, useWindowDimensions, View } from 'react-native';
import { Shell } from '../components/shell';
import { Body, Button, colors, Heading, Icon, Label, Ornament } from '../components/ui';
import { Cover } from '../components/creation-card';
import { Creation, useStudio } from '../context/studio';
export default function Create() {
  const {
    name,
    addCreation
  } = useStudio();
  const {
    width
  } = useWindowDimensions();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('Stories');
  const [color, setColor] = useState('#E2E6D8');
  const [error, setError] = useState('');
  const [created, setCreated] = useState('');
  const item: Creation = {
    id: '',
    title: title.trim() || 'Your next\nlittle wonder',
    subtitle: description.trim() || 'Every story starts somewhere',
    category,
    color,
    author: name || 'You',
    price: 'Free'
  };
  function publish() {
    if (!title.trim()) return setError('Give your little wonder a name first.');
    if (!description.trim()) return setError('Add a few words about your creation.');
    if (!name) {
      router.push('/auth');
      return;
    }
    const id = `creation-${Date.now()}`;
    addCreation({
      ...item,
      id
    });
    setCreated(id);
    setError('');
  }
  return <Shell><KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined}><View style={s.intro}><Label>THE CREATOR’S NOOK</Label><Heading style={{
          fontSize: 47,
          lineHeight: 51,
          textAlign: 'center',
          marginTop: 12
        }}>{created ? 'And so, a story begins.' : 'Make a little magic.'}</Heading><Body style={{
          textAlign: 'center',
          marginTop: 10
        }}>{created ? 'Your creation is now part of this demo marketplace.' : 'A small idea today. Someone’s favorite discovery tomorrow.'}</Body><Ornament /></View>{created ? <View style={s.success}><Icon name="check" size={39} color={colors.green} /><Heading style={{
          textAlign: 'center',
          marginVertical: 20
        }}>{title}</Heading><Button title="See your creation" icon="arrow" onPress={() => router.push({
          pathname: '/item/[id]',
          params: {
            id: created
          }
        })} /><Button title="Make something else" secondary style={{
          marginTop: 12
        }} onPress={() => {
          setCreated('');
          setTitle('');
          setDescription('');
        }} /></View> : <View style={[s.columns, width < 700 && {
        flexDirection: 'column-reverse'
      }]}><View style={s.form}><Label>01  ·  PLANT A LITTLE SEED</Label><Text style={s.label}>What would you like to make?</Text><View style={s.options}>{['Stories', 'Journals', 'Prints'].map(value => <Pressable accessibilityRole="button" accessibilityState={{
              selected: category === value
            }} key={value} onPress={() => setCategory(value)} style={[s.option, category === value && {
              backgroundColor: '#E4E8DB',
              borderColor: colors.green
            }]}><Text style={{
                color: colors.green,
                fontSize: 12
              }}>{value}</Text></Pressable>)}</View><Text style={s.label}>Give it a name</Text><TextInput accessibilityLabel="Creation title" value={title} onChangeText={setTitle} maxLength={65} placeholder="A title full of possibility…" placeholderTextColor={colors.muted} style={s.input} /><Text style={s.label}>Tell its little story</Text><TextInput accessibilityLabel="Creation description" value={description} onChangeText={setDescription} maxLength={160} placeholder="What makes your creation special?" placeholderTextColor={colors.muted} multiline style={[s.input, {
            minHeight: 110,
            paddingTop: 15,
            textAlignVertical: 'top'
          }]} /><Text style={s.label}>Choose a cover color</Text><View style={s.options}>{[{
              value: '#E2E6D8',
              name: 'Sage'
            }, {
              value: '#E9DDCC',
              name: 'Parchment'
            }, {
              value: '#EAD8CD',
              name: 'Rose'
            }, {
              value: '#DCE3E8',
              name: 'Sky'
            }].map(tone => <Pressable accessibilityRole="button" accessibilityLabel={tone.name} accessibilityState={{
              selected: color === tone.value
            }} onPress={() => setColor(tone.value)} key={tone.value} style={[s.swatch, {
              backgroundColor: tone.value,
              borderColor: color === tone.value ? colors.green : colors.line
            }]}>{color === tone.value && <Icon name="check" size={19} />}</Pressable>)}</View>{error ? <Text accessibilityRole="alert" style={s.error}>{error}</Text> : null}<Button title={name ? 'Share your little wonder' : 'Sign in to share your wonder'} onPress={publish} icon="arrow" style={{
            marginTop: 25
          }} /><Body style={{
            fontSize: 10,
            textAlign: 'center',
            marginTop: 12
          }}>Your demo creation stays here until the app reloads.</Body></View><View style={[s.preview, width < 700 && {
          width: '100%',
          maxWidth: 310,
          alignSelf: 'center'
        }]}><Label style={{
            textAlign: 'center',
            marginBottom: 17
          }}>A PEEK AT YOUR CREATION</Label><Cover item={item} tall /><Text style={s.previewNote}>A little imagination looks good on you.</Text></View></View>}</KeyboardAvoidingView></Shell>;
}
const s = StyleSheet.create({
  intro: {
    paddingTop: 38,
    alignItems: 'center'
  },
  columns: {
    flexDirection: 'row',
    gap: 48,
    maxWidth: 870,
    width: '100%',
    alignSelf: 'center'
  },
  form: {
    flex: 1
  },
  label: {
    fontSize: 12,
    color: colors.ink,
    marginTop: 24,
    marginBottom: 10
  },
  options: {
    flexDirection: 'row',
    gap: 10
  },
  option: {
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 5,
    paddingHorizontal: 19,
    minHeight: 43,
    justifyContent: 'center'
  },
  input: {
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 5,
    paddingHorizontal: 14,
    minHeight: 51,
    fontSize: 13,
    color: colors.ink,
    backgroundColor: '#FAF7F0'
  },
  swatch: {
    width: 43,
    height: 43,
    borderRadius: 25,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center'
  },
  preview: {
    width: '41%',
    paddingTop: 5
  },
  previewNote: {
    textAlign: 'center',
    color: colors.muted,
    fontSize: 10,
    marginTop: 15
  },
  error: {
    color: colors.rust,
    fontSize: 12,
    marginTop: 15
  },
  success: {
    alignItems: 'center',
    paddingVertical: 40
  }
});
