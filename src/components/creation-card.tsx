import { router } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Creation, useStudio } from '../context/studio';
import { colors, Icon } from './ui';

export function Cover({ item, tall = false }: { item: Creation; tall?: boolean }) {
  return <View style={[s.cover, tall && { minHeight: 280 }]}>
    <View style={[s.marker, { backgroundColor: item.color }]} />
    <Text style={s.coverCategory}>{item.category}</Text>
    <Text style={s.coverTitle}>{item.title.replace('\n', ' ')}</Text>
    <Text style={s.coverAuthor}>{item.author}</Text>
  </View>;
}
export function CreationCard({ item, origin = 'explore' }: { item: Creation; origin?: 'explore' | 'library' }) {
  const { saved, toggleSave } = useStudio();
  const selected = saved.includes(item.id);
  return <View style={s.row}>
    <Pressable accessibilityRole="link" accessibilityLabel={`View ${item.title.replace('\n', ' ')}`} onPress={() => router.push({ pathname: '/item/[id]', params: { id: item.id, from: origin } })} style={s.info}>
      <View style={[s.thumbnail, { backgroundColor: item.color }]}><Icon name={item.category === 'Journals' ? 'create' : 'book'} size={24} /></View>
      <View style={s.text}><Text style={s.title}>{item.title.replace('\n', ' ')}</Text><Text style={s.author}>{item.category} · {item.author}</Text></View>
    </Pressable>
    <Pressable accessibilityRole="button" accessibilityLabel={`${selected ? 'Remove from library:' : 'Save to library:'} ${item.title.replace('\n', ' ')}`} accessibilityState={{ selected }} onPress={() => toggleSave(item.id)} style={s.save}><Icon name={selected ? 'check' : 'heart'} size={20} color={selected ? colors.ink : colors.muted} /></Pressable>
  </View>;
}
const s = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, borderBottomWidth: 1, borderColor: colors.line, paddingVertical: 18 },
  info: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 16 },
  thumbnail: { width: 52, height: 62, borderRadius: 5, alignItems: 'center', justifyContent: 'center' },
  text: { flex: 1, gap: 7 },
  title: { fontSize: 15, fontWeight: '500', color: colors.ink, lineHeight: 21 },
  author: { fontSize: 11, lineHeight: 17, color: colors.muted },
  save: { width: 40, minHeight: 44, justifyContent: 'center', alignItems: 'center' },
  cover: { backgroundColor: colors.cream, borderRadius: 12, minHeight: 230, padding: 28, justifyContent: 'flex-end' },
  marker: { width: 36, height: 5, borderRadius: 3, marginBottom: 30 },
  coverCategory: { color: colors.muted, fontSize: 12, marginBottom: 12 },
  coverTitle: { fontSize: 27, fontWeight: '500', lineHeight: 34, letterSpacing: -0.7, color: colors.ink },
  coverAuthor: { fontSize: 12, color: colors.muted, marginTop: 16 },
});
