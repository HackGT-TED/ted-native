import { Image } from 'expo-image';
import { Pressable, Text, View } from 'react-native';
import type { MarketplaceStory } from '../hooks/use-marketplace-stories';
import { colors, Icon } from './ui';

const tints = ['#E4CDB0', '#EEDFCB', '#DBC4A6', '#E7CBBB', colors.cream];

/** A stable placeholder color per story, so the grid does not reshuffle on refresh. */
export function tint(id: string) {
  let hash = 0;
  for (const char of id) hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
  return tints[hash % tints.length];
}

export function formatPublished(value: string | null) {
  if (!value) return '';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? ''
    : date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

type Props = {
  story: MarketplaceStory;
  /** The viewer recorded this story: show "Yours" instead of a save button. */
  own: boolean;
  saved: boolean;
  saving: boolean;
  onOpen: () => void;
  onToggleSave: () => void;
};

export function AudioStoryTile({ story, own, saved, saving, onOpen, onToggleSave }: Props) {
  const published = formatPublished(story.publishedAt);
  return <View className="w-[48%] overflow-hidden rounded-xl border border-line bg-paper">
    <Pressable accessibilityRole="link"
      accessibilityLabel={`Open ${story.title}. ${story.description} ${published ? `Published ${published}.` : ''}`}
      onPress={onOpen} className="active:opacity-80">
      <View>
        {story.coverUrl
          ? <Image source={{ uri: story.coverUrl }} contentFit="cover" transition={150}
            style={{ width: '100%', height: 132 }} accessibilityIgnoresInvertColors />
          : <View className="h-[132px] w-full items-center justify-center" style={{ backgroundColor: tint(story.id) }}>
            <Icon name="mic" size={34} color={colors.cocoa} />
          </View>}
        <View pointerEvents="none" className="absolute bottom-2 left-2 h-9 w-9 items-center justify-center rounded-full bg-paper/90">
          <Icon name="play" size={20} color={colors.cocoa} />
        </View>
      </View>
      <View className="gap-1.5 p-3">
        <Text numberOfLines={2} className="text-[15px] font-medium leading-[20px] text-ink">{story.title}</Text>
        {story.description ? <Text numberOfLines={3} className="text-[12px] leading-[17px] text-muted">{story.description}</Text> : null}
        {published ? <Text className="text-[11px] text-muted">{published}</Text> : null}
      </View>
    </Pressable>
    {own ? <View pointerEvents="none" className="absolute right-2.5 top-2.5 rounded-full bg-paper/90 px-2.5 py-1">
      <Text className="text-[11px] font-medium text-cocoa">Yours</Text>
    </View> : <Pressable accessibilityRole="button"
      accessibilityLabel={`${saved ? 'Remove from library:' : 'Save to library:'} ${story.title}`}
      accessibilityState={{ selected: saved, busy: saving }} disabled={saving} onPress={onToggleSave}
      className="absolute right-1.5 top-1.5 h-11 w-11 items-center justify-center">
      <View className="h-8 w-8 items-center justify-center rounded-full bg-paper/90">
        <Icon name={saved ? 'check' : 'heart'} size={18} color={saved ? colors.rust : colors.muted} />
      </View>
    </Pressable>}
  </View>;
}
