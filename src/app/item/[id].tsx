import { router, useLocalSearchParams } from 'expo-router';
import { Pressable, Text, View } from 'react-native';
import { Shell } from '../../components/shell';
import { Body, Button, Heading, Icon } from '../../components/ui';
import { Cover } from '../../components/creation-card';
import { useStudio } from '../../context/studio';

export default function Item() {
  const { id, from } = useLocalSearchParams<{ id: string; from?: string }>();
  const { creations, saved, toggleSave } = useStudio();
  const item = creations.find(creation => creation.id === id);
  return <Shell><View className="w-full max-w-[500px] self-center pt-3">
    <Pressable accessibilityRole="link" onPress={() => router.replace(from === 'library' ? '/library' : '/explore')} className="min-h-[60px] flex-row items-center gap-2.5"><Icon name="back" size={18} /><Text className="text-[13px] text-muted">{from === 'library' ? 'Library' : 'Explore'}</Text></Pressable>
    {item ? <>
      <Cover item={item} tall />
      <View className="mt-7"><Heading className="!text-[32px] !leading-[40px]">{item.title.replace('\n', ' ')}</Heading><Body className="mt-2.5">{item.subtitle}</Body></View>
      <Body className="py-6 !text-[12px]">Shared by {item.author}</Body>
      <Button title={saved.includes(item.id) ? 'Remove from library' : 'Save to library'} icon={saved.includes(item.id) ? 'check' : 'heart'} secondary={saved.includes(item.id)} onPress={() => toggleSave(item.id)} />
      <Body className="mt-[18px] text-center !text-[11px]">{saved.includes(item.id) ? 'You can find this creation in your Library.' : 'Keep this creation in your Library to revisit.'}</Body>
    </> : <><Heading>Item not found</Heading><Body>This creation is no longer available.</Body></>}
  </View></Shell>;
}
