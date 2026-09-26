import { router, useLocalSearchParams } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Shell } from '../../components/shell';
import { Body, Button, colors, Heading, Icon } from '../../components/ui';
import { Cover } from '../../components/creation-card';
import { useStudio } from '../../context/studio';

export default function Item() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { creations, saved, toggleSave } = useStudio();
  const item = creations.find(creation => creation.id === id);
  return <Shell><View style={s.page}>
    <Pressable accessibilityRole="link" onPress={() => router.replace('/marketplace')} style={s.back}><Icon name="back" size={18} /><Text style={s.backText}>Marketplace</Text></Pressable>
    {item ? <>
      <Cover item={item} tall />
      <View style={s.details}><Heading style={{ fontSize: 24, lineHeight: 30 }}>{item.title.replace('\n', ' ')}</Heading><Body style={{ marginTop: 10 }}>{item.subtitle}</Body></View>
      <View style={s.price}><Text style={s.priceText}>{item.price}</Text><Body>Digital creation</Body></View>
      <Button title={saved.includes(item.id) ? 'Saved' : 'Save item'} icon={saved.includes(item.id) ? 'check' : 'heart'} onPress={() => toggleSave(item.id)} />
      <Body style={s.note}>Preview only. Purchases are not available.</Body>
    </> : <><Heading>Item not found</Heading><Body>This creation is no longer available.</Body></>}
  </View></Shell>;
}
const s = StyleSheet.create({
  page: { width: '100%', maxWidth: 500, alignSelf: 'center', paddingTop: 12 },
  back: { flexDirection: 'row', gap: 10, minHeight: 60, alignItems: 'center' },
  backText: { fontSize: 13, color: colors.muted },
  details: { marginTop: 28 },
  price: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 24 },
  priceText: { fontSize: 20, color: colors.ink },
  note: { fontSize: 11, textAlign: 'center', marginTop: 18 },
});
