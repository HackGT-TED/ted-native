import { useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, useWindowDimensions, View } from 'react-native';
import { Shell } from '../components/shell';
import { Body, colors, Heading, Icon, Label, Ornament } from '../components/ui';
import { CreationCard } from '../components/creation-card';
import { useStudio } from '../context/studio';
export default function Marketplace() {
  const {
    creations,
    saved
  } = useStudio();
  const [category, setCategory] = useState('All wonders');
  const [query, setQuery] = useState('');
  const {
    width
  } = useWindowDimensions();
  const mobile = width < 700;
  const items = creations.filter(item => (category === 'All wonders' || (category === 'Saved' ? saved.includes(item.id) : item.category === category)) && `${item.title} ${item.author}`.toLowerCase().replace('\n', ' ').includes(query.toLowerCase()));
  return <Shell><View style={s.intro}><Label>THE TEDTIME MARKETPLACE</Label><Heading style={{
        fontSize: mobile ? 42 : 55,
        lineHeight: 59,
        textAlign: 'center',
        marginTop: 8
      }}>Find your little wonder.</Heading><Body style={{
        textAlign: 'center',
        marginTop: 8
      }}>Stories, journals, and keepsakes from imaginative souls.</Body><Ornament /></View><View style={s.search}><Icon name="search" color={colors.muted} /><TextInput accessibilityLabel="Search the marketplace" placeholder="A story, a maker, a little inspiration…" placeholderTextColor={colors.muted} value={query} onChangeText={setQuery} style={s.input} />{query ? <Pressable accessibilityRole="button" accessibilityLabel="Clear search" onPress={() => setQuery('')}><Icon name="close" size={19} /></Pressable> : null}</View><View style={s.filters}>{['All wonders', 'Stories', 'Journals', 'Prints', 'Saved'].map(value => <Pressable accessibilityRole="button" accessibilityState={{
        selected: value === category
      }} key={value} onPress={() => setCategory(value)} style={[s.chip, value === category && s.selected]}><Text style={[s.chipText, value === category && {
          color: colors.paper
        }]}>{value}</Text></Pressable>)}</View><Text style={s.count}>{items.length} little {items.length === 1 ? 'wonder' : 'wonders'} to discover</Text><View style={s.grid}>{items.map(item => <View key={item.id} style={{
        width: mobile ? '47%' : '31%'
      }}><CreationCard item={item} /></View>)}</View>{items.length === 0 && <View style={s.empty}><Icon name="leaf" size={40} color={colors.gold} /><Heading style={{
        textAlign: 'center',
        marginTop: 15
      }}>A quiet little corner.</Heading><Body style={{
        textAlign: 'center',
        marginTop: 10
      }}>{category === 'Saved' ? 'Tap the heart on a creation to keep it here.' : 'Try a different search or category to find your wonder.'}</Body></View>}</Shell>;
}
const s = StyleSheet.create({
  intro: {
    alignItems: 'center',
    paddingTop: 38
  },
  search: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: '#F0ECE1',
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 6,
    paddingHorizontal: 16,
    maxWidth: 600,
    width: '100%',
    alignSelf: 'center'
  },
  input: {
    flex: 1,
    height: 50,
    fontSize: 13,
    color: colors.ink
  },
  filters: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 8,
    marginVertical: 23
  },
  chip: {
    paddingHorizontal: 16,
    minHeight: 40,
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 25
  },
  selected: {
    backgroundColor: colors.green,
    borderColor: colors.green
  },
  chipText: {
    fontSize: 11,
    color: colors.muted
  },
  count: {
    fontSize: 11,
    color: colors.muted,
    marginBottom: 19
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    gap: 25
  },
  empty: {
    alignItems: 'center',
    paddingVertical: 45
  }
});
