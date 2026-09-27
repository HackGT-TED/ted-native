import { Image } from 'expo-image';
import { router } from 'expo-router';
import { Pressable, Text, View } from 'react-native';
import { storyCovers } from '../content/story-covers';
import type { WrittenStorySummary } from '../hooks/use-written-stories';
import { colors, Icon } from './ui';

/** A written story tile in Explore's grid: cover, title, author, reading time. Opens the reader. */
export function WrittenStoryTile({ story }: { story: WrittenStorySummary }) {
  const cover = storyCovers[story.slug];
  return <View className="w-[48%] overflow-hidden rounded-xl border border-line bg-paper">
    <Pressable accessibilityRole="link"
      accessibilityLabel={`Read ${story.title} by ${story.author}, ${story.reading_minutes} minutes`}
      onPress={() => router.push({ pathname: '/read/[slug]', params: { slug: story.slug } })}
      className="active:opacity-80">
      {cover
        ? <Image source={cover} contentFit="cover" contentPosition="top" style={{ width: '100%', height: 160 }} accessibilityIgnoresInvertColors />
        : <View className="h-[160px] w-full items-center justify-center bg-cream"><Icon name="book" size={34} color={colors.cocoa} /></View>}
      <View className="gap-1.5 p-3">
        <Text numberOfLines={2} className="text-[15px] font-medium leading-[20px] text-ink">{story.title}</Text>
        <Text numberOfLines={1} className="text-[12px] text-muted">{story.author}</Text>
        <Text className="text-[11px] text-muted">{story.category} · {story.reading_minutes} min read</Text>
      </View>
    </Pressable>
  </View>;
}
