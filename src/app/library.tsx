import { router } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';
import { Shell } from '../components/shell';
import { CreationCard } from '../components/creation-card';
import { Body, Button, colors, Heading, Icon } from '../components/ui';
import { useStudio } from '../context/studio';

export default function Library() {
  const { creations, saved } = useStudio();
  const items = creations.filter(item => saved.includes(item.id));

  return <Shell><View style={s.page}>
    <Heading>Library</Heading>
    <Body style={s.intro}>A little space for the creations you love.</Body>
    {items.length ? <View style={s.collection}>
      <Text style={s.count}>{items.length} saved {items.length === 1 ? 'creation' : 'creations'}</Text>
      {items.map(item => <CreationCard key={item.id} item={item} origin="library" />)}
    </View> : <View style={s.empty}>
      <View style={s.emptyIcon}><Icon name="book" size={28} color={colors.cocoa} /></View>
      <Text style={s.emptyTitle}>Keep something close.</Text>
      <Body style={s.emptyCopy}>Save a creation from Explore and find it here when you want to return.</Body>
      <Button title="Explore the community" secondary onPress={() => router.replace('/explore')} style={s.explore} />
    </View>}
  </View></Shell>;
}

const s = StyleSheet.create({
  page: { maxWidth: 700, width: '100%', alignSelf: 'center', paddingTop: 36 },
  intro: { marginTop: 8 },
  collection: { marginTop: 28 },
  count: { fontSize: 12, color: colors.muted, marginBottom: 4 },
  empty: { alignItems: 'center', paddingVertical: 56 },
  emptyIcon: { width: 64, height: 64, borderRadius: 20, backgroundColor: colors.cream, alignItems: 'center', justifyContent: 'center' },
  emptyTitle: { fontSize: 18, fontWeight: '500', color: colors.ink, marginTop: 22 },
  emptyCopy: { maxWidth: 300, textAlign: 'center', marginTop: 10 },
  explore: { marginTop: 24 },
});
