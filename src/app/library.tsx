import { router } from 'expo-router';
import { Text, View } from 'react-native';
import { Shell } from '../components/shell';
import { CreationCard } from '../components/creation-card';
import { Body, Button, colors, Heading, Icon } from '../components/ui';
import { useStudio } from '../context/studio';

export default function Library() {
  const { creations, saved } = useStudio();
  const items = creations.filter(item => saved.includes(item.id));

  return <Shell><View className="w-full max-w-[700px] self-center pt-9">
    <Heading>Library</Heading>
    <Body className="mt-2">A little space for the creations you love.</Body>
    {items.length ? <View className="mt-7">
      <Text className="mb-1 text-[12px] text-muted">{items.length} saved {items.length === 1 ? 'creation' : 'creations'}</Text>
      {items.map(item => <CreationCard key={item.id} item={item} origin="library" />)}
    </View> : <View className="items-center py-14">
      <View className="h-16 w-16 items-center justify-center rounded-[20px] bg-cream"><Icon name="book" size={28} color={colors.cocoa} /></View>
      <Text className="mt-[22px] text-[18px] font-medium text-ink">Keep something close.</Text>
      <Body className="mt-2.5 max-w-[300px] text-center">Save a creation from Explore and find it here when you want to return.</Body>
      <Button title="Explore the community" secondary onPress={() => router.replace('/explore')} className="mt-6" />
    </View>}
  </View></Shell>;
}
