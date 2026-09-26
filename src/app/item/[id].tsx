import { router, useLocalSearchParams } from 'expo-router';
import { Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { Shell } from '../../components/shell';
import { Body, Button, colors, Heading, Icon, Label, Ornament } from '../../components/ui';
import { Cover } from '../../components/creation-card';
import { useStudio } from '../../context/studio';
export default function Item() {
  const {
    id
  } = useLocalSearchParams<{
    id: string;
  }>();
  const {
    creations,
    saved,
    toggleSave
  } = useStudio();
  const {
    width
  } = useWindowDimensions();
  const item = creations.find(i => i.id === id);
  if (!item) return <Shell><View style={s.missing}><Heading>This wonder wandered off.</Heading><Button title="Back to marketplace" onPress={() => router.replace('/marketplace')} /></View></Shell>;
  const isSaved = saved.includes(item.id);
  return <Shell><Pressable accessibilityRole="link" onPress={() => router.navigate('/marketplace')} style={s.back}><Icon name="back" size={18} /><Text style={{
        color: colors.green,
        fontSize: 12
      }}>Back to the marketplace</Text></Pressable><View style={[s.columns, width < 700 && {
      flexDirection: 'column'
    }]}><View style={{
        flex: 1
      }}><Cover item={item} tall /></View><View style={{
        flex: 1,
        justifyContent: 'center'
      }}><Label>{item.category.toUpperCase()} · THE TEDTIME COLLECTION</Label><Heading style={s.title}>{item.title.replace('\n', ' ')}</Heading><Body>Thoughtfully made by {item.author}</Body><Ornament /><Heading style={{
          fontSize: 28
        }}>{item.subtitle}</Heading><Body style={{
          marginVertical: 20
        }}>A little invitation to slow down, look closer, and let your imagination wander. Made with care for curious minds and quiet moments.</Body><View style={s.priceRow}><Heading style={{
            fontSize: 32
          }}>{item.price}</Heading><Label>DIGITAL CREATION</Label></View><Button title={isSaved ? 'Saved to your little collection' : 'Save to your little collection'} icon={isSaved ? 'check' : 'heart'} onPress={() => toggleSave(item.id)} /><Body style={{
          fontSize: 10,
          textAlign: 'center',
          marginTop: 13
        }}>A preview of the TedTime collection. Purchases coming later.</Body></View></View></Shell>;
}
const s = StyleSheet.create({
  back: {
    flexDirection: 'row',
    gap: 10,
    alignItems: 'center',
    paddingVertical: 27,
    minHeight: 44
  },
  columns: {
    flexDirection: 'row',
    gap: 40,
    paddingBottom: 20
  },
  title: {
    fontSize: 49,
    lineHeight: 50,
    marginTop: 18,
    marginBottom: 12
  },
  priceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 20,
    paddingVertical: 15,
    borderTopWidth: 1,
    borderColor: colors.line
  },
  missing: {
    paddingVertical: 60,
    gap: 25
  }
});
