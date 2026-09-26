import { useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { Shell } from '../components/shell';
import { Body, colors, Heading, Icon } from '../components/ui';
import { CreationCard } from '../components/creation-card';
import { useStudio } from '../context/studio';

export default function Marketplace() {
  const { creations, saved } = useStudio();
  const [category, setCategory] = useState('All');
  const [query, setQuery] = useState('');
  const items = creations.filter(item => (category === 'All' || (category === 'Saved' ? saved.includes(item.id) : item.category === category)) && `${item.title} ${item.author}`.replace('\n', ' ').toLowerCase().includes(query.trim().toLowerCase()));
  return <Shell><View style={s.page}>
    <Heading>Marketplace</Heading><Body style={{ marginTop: 8 }}>Independent stories, journals, and prints.</Body>
    <View style={s.search}><Icon name="search" size={20} color={colors.muted} /><TextInput accessibilityLabel="Search the marketplace" value={query} onChangeText={setQuery} placeholder="Search" placeholderTextColor={colors.muted} style={s.input} />{query ? <Pressable accessibilityRole="button" accessibilityLabel="Clear search" onPress={() => setQuery('')} style={s.clear}><Icon name="close" size={18} /></Pressable> : null}</View>
    <View style={s.filters}>{['All', 'Stories', 'Journals', 'Prints', 'Saved'].map(value => <Pressable accessibilityRole="button" accessibilityState={{ selected: category === value }} onPress={() => setCategory(value)} key={value} style={[s.filter, category === value && s.active]}><Text style={[s.filterText, category === value && { color: colors.ink }]}>{value}</Text></Pressable>)}</View>
    {items.map(item => <CreationCard key={item.id} item={item} />)}
    {!items.length && <Body style={s.empty}>{category === 'Saved' ? 'Saved items will appear here.' : 'No results. Try another search.'}</Body>}
  </View></Shell>;
}
const s = StyleSheet.create({
  page: { maxWidth: 700, width: '100%', alignSelf: 'center', paddingTop: 36 },
  search: { flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 28, backgroundColor: colors.cream, paddingHorizontal: 16, borderRadius: 10 },
  input: { flex: 1, minHeight: 50, fontSize: 14, color: colors.ink },
  clear: { minWidth: 36, minHeight: 44, justifyContent: 'center', alignItems: 'center' },
  filters: { flexDirection: 'row', flexWrap: 'wrap', gap: 22, marginTop: 20, borderBottomWidth: 1, borderColor: colors.line },
  filter: { minHeight: 44, justifyContent: 'center' },
  active: { borderBottomWidth: 2, borderColor: colors.ink },
  filterText: { fontSize: 12, color: colors.muted },
  empty: { textAlign: 'center', marginTop: 70 },
});
