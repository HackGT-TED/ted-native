import { router, useLocalSearchParams } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Shell } from '../../components/shell';
import { Body, Button, colors, Heading, Icon } from '../../components/ui';
import { Cover } from '../../components/creation-card';
import { useStudio } from '../../context/studio';

export default function Item() {
  const { id, from } = useLocalSearchParams<{ id: string; from?: string }>();
  const { creations, saved, toggleSave } = useStudio();
  const item = creations.find(creation => creation.id === id);
  return <Shell><View style={s.page}>
    <Pressable accessibilityRole="link" onPress={() => router.replace(from === 'library' ? '/library' : '/explore')} style={s.back}><Icon name="back" size={18} /><Text style={s.backText}>{from === 'library' ? 'Library' : 'Explore'}</Text></Pressable>
    {item ? <>
      <Cover item={item} tall />
      <View style={s.details}><Heading style={{ fontSize: 24, lineHeight: 30 }}>{item.title.replace('\n', ' ')}</Heading><Body style={{ marginTop: 10 }}>{item.subtitle}</Body></View>
      <Body style={s.credit}>Shared by {item.author}</Body>
      <Button title={saved.includes(item.id) ? 'Remove from library' : 'Save to library'} icon={saved.includes(item.id) ? 'check' : 'heart'} secondary={saved.includes(item.id)} onPress={() => toggleSave(item.id)} />
      <Body style={s.note}>{saved.includes(item.id) ? 'You can find this creation in your Library.' : 'Keep this creation in your Library to revisit.'}</Body>
    </> : <><Heading>Item not found</Heading><Body>This creation is no longer available.</Body></>}
  </View></Shell>;
}
const s = StyleSheet.create({
  page: { width: '100%', maxWidth: 500, alignSelf: 'center', paddingTop: 12 },
  back: { flexDirection: 'row', gap: 10, minHeight: 60, alignItems: 'center' },
  backText: { fontSize: 13, color: colors.muted },
  details: { marginTop: 28 },
  credit: { paddingVertical: 24, fontSize: 12 },
  note: { fontSize: 11, textAlign: 'center', marginTop: 18 },
});
