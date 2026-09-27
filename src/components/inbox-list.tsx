import { Image } from 'expo-image';
import { router } from 'expo-router';
import { Pressable, Text, View } from 'react-native';
import { useStudio } from '../context/studio';
import type { InboxStory } from '../hooks/use-inbox';
import { formatPublished, tint } from './audio-story-tile';
import { colors, Icon } from './ui';

/** Opens a story someone sent you on its player page and clears its "new" dot. */
export function openSentStory(story: InboxStory, markListened: (shareId: string) => void) {
  markListened(story.shareId);
  router.push({ pathname: '/story/[id]', params: { id: story.id } });
}

/** Stories sent to the user. Tapping one opens the same player page as the community. */
export function InboxList({ items }: { items: InboxStory[] }) {
  const { inbox } = useStudio();
  return <View className="gap-3">
    {items.map(story => {
      const sent = formatPublished(story.sentAt);
      const isNew = !story.listenedAt;
      return <Pressable key={story.shareId} accessibilityRole="link"
        accessibilityLabel={`${isNew ? 'New: ' : ''}${story.title}, from ${story.senderName}`}
        onPress={() => openSentStory(story, inbox.markListened)}
        className="flex-row items-center gap-3 rounded-[18px] border border-line bg-paper p-3 active:opacity-70">
        <View className="h-16 w-16 overflow-hidden rounded-xl">
          {story.coverUrl
            ? <Image source={{ uri: story.coverUrl }} contentFit="cover" style={{ width: 64, height: 64 }} accessibilityIgnoresInvertColors />
            : <View className="flex-1 items-center justify-center" style={{ backgroundColor: tint(story.id) }}>
              <Icon name="mic" size={24} color={colors.cocoa} />
            </View>}
        </View>
        <View className="flex-1 gap-1">
          <View className="flex-row items-center gap-2">
            {isNew ? <View className="h-2 w-2 rounded-full bg-rust" /> : null}
            <Text numberOfLines={1} className={`flex-1 text-[15px] text-ink ${isNew ? 'font-semibold' : 'font-medium'}`}>{story.title}</Text>
          </View>
          <Text numberOfLines={1} className="text-[12px] text-muted">From {story.senderName}{sent ? ` · ${sent}` : ''}</Text>
        </View>
        <View className="h-10 w-10 items-center justify-center rounded-full bg-cream">
          <Icon name="play" size={22} color={colors.cocoa} />
        </View>
      </Pressable>;
    })}
  </View>;
}
