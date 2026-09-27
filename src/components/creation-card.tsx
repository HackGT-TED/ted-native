import { router } from 'expo-router';
import { Pressable, Text, View } from 'react-native';
import { Creation, useStudio } from '../context/studio';
import { colors, Icon } from './ui';

export function Cover({ item, tall = false }: { item: Creation; tall?: boolean }) {
  return <View className={`justify-end rounded-xl bg-cream p-7 ${tall ? "min-h-[280px]" : "min-h-[230px]"}`}>
    <View className="mb-[30px] h-[5px] w-9 rounded-[3px]" style={{ backgroundColor: item.color }} />
    <Text className="mb-3 text-[12px] text-muted">{item.category}</Text>
    <Text className="text-[27px] font-medium leading-[34px] tracking-[-0.7px] text-ink">{item.title.replace('\n', ' ')}</Text>
    <Text className="mt-4 text-[12px] text-muted">{item.author}</Text>
  </View>;
}
export function CreationCard({ item, origin = 'explore' }: { item: Creation; origin?: 'explore' | 'library' }) {
  const { saved, toggleSave } = useStudio();
  const selected = saved.includes(item.id);
  return <View className="flex-row items-center gap-3 border-b border-line py-[18px]">
    <Pressable accessibilityRole="link" accessibilityLabel={`View ${item.title.replace('\n', ' ')}`} onPress={() => router.push({ pathname: '/item/[id]', params: { id: item.id, from: origin } })} className="flex-1 flex-row items-center gap-4">
      <View className="h-[62px] w-[52px] items-center justify-center rounded-[5px]" style={{ backgroundColor: item.color }}><Icon name={item.category === 'Journals' ? 'create' : 'book'} size={24} /></View>
      <View className="flex-1 gap-[7px]"><Text className="text-[15px] font-medium leading-[21px] text-ink">{item.title.replace('\n', ' ')}</Text><Text className="text-[11px] leading-[17px] text-muted">{item.category} · {item.author}</Text></View>
    </Pressable>
    <Pressable accessibilityRole="button" accessibilityLabel={`${selected ? 'Remove from library:' : 'Save to library:'} ${item.title.replace('\n', ' ')}`} accessibilityState={{ selected }} onPress={() => toggleSave(item.id)} className="min-h-11 w-10 items-center justify-center"><Icon name={selected ? 'check' : 'heart'} size={20} color={selected ? colors.ink : colors.muted} /></Pressable>
  </View>;
}
/** Tile matching AudioStoryTile, for the Explore grid. */
export function CreationTile({ item }: { item: Creation }) {
  const { saved, toggleSave } = useStudio();
  const selected = saved.includes(item.id);
  const title = item.title.replace('\n', ' ');
  return <View className="w-[48%] overflow-hidden rounded-xl border border-line bg-paper">
    <Pressable accessibilityRole="link" accessibilityLabel={`Open ${title}. ${item.subtitle}`} onPress={() => router.push({ pathname: '/item/[id]', params: { id: item.id, from: 'explore' } })} className="active:opacity-80">
      <View className="h-[132px] w-full items-center justify-center" style={{ backgroundColor: item.color }}>
        <Icon name={item.category === 'Journals' ? 'create' : 'book'} size={34} color={colors.cocoa} />
      </View>
      <View className="gap-1.5 p-3">
        <Text numberOfLines={2} className="text-[15px] font-medium leading-[20px] text-ink">{title}</Text>
        {item.subtitle ? <Text numberOfLines={3} className="text-[12px] leading-[17px] text-muted">{item.subtitle}</Text> : null}
        <Text className="text-[11px] text-muted">{item.author}</Text>
      </View>
    </Pressable>
    <Pressable accessibilityRole="button" accessibilityLabel={`${selected ? 'Remove from library:' : 'Save to library:'} ${title}`} accessibilityState={{ selected }} onPress={() => toggleSave(item.id)} className="absolute right-1.5 top-1.5 h-11 w-11 items-center justify-center">
      <View className="h-8 w-8 items-center justify-center rounded-full bg-paper/90">
        <Icon name={selected ? 'check' : 'heart'} size={18} color={selected ? colors.rust : colors.muted} />
      </View>
    </Pressable>
  </View>;
}
