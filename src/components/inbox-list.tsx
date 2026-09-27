import { Image } from 'expo-image';
import { router } from 'expo-router';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';
import { useStudio } from '../context/studio';
import type { InboxStory } from '../hooks/use-inbox';
import { useStoryPlayer } from '../hooks/use-story-player';
import { formatPublished, tint } from './audio-story-tile';
import { colors, Icon } from './ui';

/** Stories sent to the user, each with a big "Play on bear" button. One plays at a time. */
export function InboxList({ items }: { items: InboxStory[] }) {
  const { inbox } = useStudio();
  const player = useStoryPlayer();
  return <View className="gap-3">
    {items.map(story => {
      const active = player.activeId === story.id;
      const busy = active && player.loading;
      const playing = active && player.playing;
      const sent = formatPublished(story.sentAt);
      const error = player.error?.id === story.id ? player.error.message : '';
      return <View key={story.shareId} className="rounded-[18px] border border-line bg-paper p-3">
        <View className="flex-row items-center gap-3">
          <Pressable accessibilityRole="link" accessibilityLabel={`Open ${story.title}, from ${story.senderName}`}
            onPress={() => { inbox.markListened(story.shareId); router.push({ pathname: '/story/[id]', params: { id: story.id } }); }}
            className="flex-1 flex-row items-center gap-3 active:opacity-70">
            <View className="h-16 w-16 overflow-hidden rounded-xl">
              {story.coverUrl
                ? <Image source={{ uri: story.coverUrl }} contentFit="cover" style={{ width: 64, height: 64 }} accessibilityIgnoresInvertColors />
                : <View className="flex-1 items-center justify-center" style={{ backgroundColor: tint(story.id) }}>
                  <Icon name="mic" size={24} color={colors.cocoa} />
                </View>}
            </View>
            <View className="flex-1 gap-1">
              <View className="flex-row items-center gap-2">
                {!story.listenedAt ? <View accessibilityLabel="New" className="h-2 w-2 rounded-full bg-rust" /> : null}
                <Text numberOfLines={1} className="flex-1 text-[15px] font-medium text-ink">{story.title}</Text>
              </View>
              <Text numberOfLines={1} className="text-[12px] text-muted">From {story.senderName}{sent ? ` · ${sent}` : ''}</Text>
            </View>
          </Pressable>
        </View>
        <Pressable accessibilityRole="button" accessibilityLabel={`${playing ? 'Pause' : 'Play on bear:'} ${story.title}`}
          accessibilityState={{ busy }}
          onPress={() => { inbox.markListened(story.shareId); void player.toggle(story); }}
          className={`mt-3 min-h-11 flex-row items-center justify-center gap-2 rounded-[10px] active:opacity-80 ${active ? 'bg-cocoa' : 'bg-cream'}`}>
          {busy ? <ActivityIndicator color={colors.paper} />
            : <Icon name={playing ? 'pause' : 'bear'} size={20} color={active ? colors.paper : colors.cocoa} />}
          <Text className={`text-[13px] font-medium ${active ? 'text-paper' : 'text-cocoa'}`}>
            {playing ? 'Pause' : active && !busy ? 'Resume on bear' : 'Play on bear'}
          </Text>
        </Pressable>
        {error ? <Text accessibilityRole="alert" className="mt-2 text-[12px] text-rust">{error}</Text> : null}
      </View>;
    })}
  </View>;
}
