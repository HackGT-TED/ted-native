import { useState } from 'react';
import { Image } from 'expo-image';
import { router, useLocalSearchParams } from 'expo-router';
import { ActivityIndicator, Pressable, Text, useWindowDimensions, View } from 'react-native';
import { Shell } from '../../components/shell';
import { Body, Button, colors, Heading, Icon } from '../../components/ui';
import { formatPublished, tint } from '../../components/audio-story-tile';
import { useStudio } from '../../context/studio';
import { useMarketplaceStory } from '../../hooks/use-marketplace-stories';
import { useStoryPlayer } from '../../hooks/use-story-player';

const SKIP_MS = 10_000;

function clock(ms: number) {
  const seconds = Math.max(0, Math.floor(ms / 1000));
  return `${Math.floor(seconds / 60)}:${(seconds % 60).toString().padStart(2, '0')}`;
}

function goBack() {
  if (router.canGoBack()) router.back();
  else router.replace('/explore');
}

/** Album-style player for one story: artwork, details, scrubber, and transport controls. */
export default function StoryPlayer() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { session, authLoading, savedStories, inbox } = useStudio();
  const { story, loading, error, refresh } = useMarketplaceStory(id, authLoading);
  const player = useStoryPlayer();
  const [barWidth, setBarWidth] = useState(0);
  const [saveError, setSaveError] = useState('');
  const art = Math.min(useWindowDimensions().width - 48, 340);

  const header = <View className="min-h-[60px] flex-row items-center justify-between">
    <Pressable accessibilityRole="button" accessibilityLabel="Back" onPress={goBack}
      className="min-h-11 flex-row items-center gap-2.5 pr-4">
      <Icon name="back" size={18} /><Text className="text-[13px] text-muted">Back</Text>
    </Pressable>
    <Text className="text-[11px] font-medium uppercase tracking-[1.4px] text-muted">Audio story</Text>
    <View className="w-[72px]" />
  </View>;

  if (loading || error || !story) {
    return <Shell><View className="w-full max-w-[500px] self-center pt-3">
      {header}
      {loading ? <ActivityIndicator accessibilityLabel="Loading story" className="mt-[80px]" color={colors.cocoa} />
        : error ? <View className="mt-[60px] items-center gap-4">
          <Text accessibilityRole="alert" className="text-center text-[13px] text-rust">{error}</Text>
          <Button title="Retry" secondary onPress={() => { void refresh(); }} />
        </View>
        : <View className="mt-[60px] items-center gap-2">
          <Heading className="text-center">Story not found</Heading>
          <Body className="text-center">It may have been removed from the marketplace.</Body>
        </View>}
    </View></Shell>;
  }

  const active = player.activeId === story.id;
  const busy = player.loading && (active || !player.activeId);
  const playing = active && player.playing;
  const duration = active && player.durationMs > 0 ? player.durationMs : story.durationMs ?? 0;
  const position = active ? Math.min(player.positionMs, duration || player.positionMs) : 0;
  const progress = duration > 0 ? Math.min(1, position / duration) : 0;
  const own = story.authorId === session?.user.id;
  // Set when someone sent this story to the viewer.
  const sent = inbox.items.find(item => item.id === story.id);
  const saved = savedStories.ids.has(story.id);
  const saving = savedStories.pending.includes(story.id);
  const published = formatPublished(story.publishedAt);
  const playError = player.error?.id === story.id ? player.error.message : '';

  return <Shell><View className="w-full max-w-[500px] self-center pb-10 pt-3">
    {header}

    <View className="mt-2 items-center">
      <View className="overflow-hidden rounded-2xl bg-cream"
        style={{ width: art, height: art, shadowColor: colors.ink, shadowOpacity: 0.18, shadowRadius: 18, shadowOffset: { width: 0, height: 10 }, elevation: 8 }}>
        {story.coverUrl
          ? <Image source={{ uri: story.coverUrl }} contentFit="cover" transition={200}
            style={{ width: art, height: art }} accessibilityIgnoresInvertColors />
          : <View className="flex-1 items-center justify-center" style={{ backgroundColor: tint(story.id) }}>
            <Icon name="mic" size={art / 4} color={colors.cocoa} />
          </View>}
      </View>
    </View>

    <View className="mt-8 flex-row items-start gap-3">
      <View className="flex-1 gap-1">
        <Heading className="!text-[28px] !leading-[34px]">{story.title}</Heading>
        {sent ? <Text className="text-[13px] font-medium text-cocoa">Sent by {sent.senderName}</Text> : null}
        {published ? <Text className="text-[12px] text-muted">Published {published}</Text> : null}
      </View>
      {own ? <View className="mt-1 rounded-full bg-cream px-3 py-1.5">
        <Text className="text-[11px] font-medium text-cocoa">Your story</Text>
      </View> : <Pressable accessibilityRole="button"
        accessibilityLabel={saved ? 'Remove from library' : 'Save to library'}
        accessibilityState={{ selected: saved, busy: saving }} disabled={saving}
        onPress={() => {
          if (!session) { router.push('/auth'); return; }
          setSaveError('');
          savedStories.toggle(story).catch((cause: unknown) => {
            setSaveError(cause instanceof Error ? cause.message : 'Could not update your library. Please retry.');
          });
        }}
        className="h-11 w-11 items-center justify-center">
        <Icon name={saved ? 'check' : 'heart'} size={26} color={saved ? colors.rust : colors.muted} />
      </Pressable>}
    </View>
    {saveError ? <Text accessibilityRole="alert" className="mt-1 text-[12px] text-rust">{saveError}</Text> : null}

    <View className="mt-6">
      <Pressable
        accessibilityRole="adjustable"
        accessibilityLabel="Playback position"
        accessibilityValue={{ text: `${clock(position)} of ${clock(duration)}` }}
        accessibilityActions={[{ name: 'increment' }, { name: 'decrement' }]}
        onAccessibilityAction={event => { void player.skip(event.nativeEvent.actionName === 'increment' ? SKIP_MS : -SKIP_MS); }}
        disabled={!active || duration <= 0}
        onLayout={event => setBarWidth(event.nativeEvent.layout.width)}
        onPress={event => {
          if (barWidth > 0 && duration > 0) void player.seekTo((event.nativeEvent.locationX / barWidth) * duration);
        }}
        className="h-7 justify-center"
      >
        <View className="h-1.5 overflow-hidden rounded-full bg-line">
          <View className="h-full rounded-full bg-cocoa" style={{ width: `${progress * 100}%` }} />
        </View>
        <View pointerEvents="none" className="absolute h-3.5 w-3.5 rounded-full bg-cocoa"
          style={{ left: Math.max(0, progress * barWidth - 7) }} />
      </Pressable>
      <View className="flex-row justify-between">
        <Text className="text-[11px] text-muted" style={{ fontVariant: ['tabular-nums'] }}>{clock(position)}</Text>
        <Text className="text-[11px] text-muted" style={{ fontVariant: ['tabular-nums'] }}>
          {duration > 0 ? `-${clock(duration - position)}` : '--:--'}
        </Text>
      </View>
    </View>

    <View className="mt-4 flex-row items-center justify-center gap-10">
      <Pressable accessibilityRole="button" accessibilityLabel="Back 10 seconds" disabled={!active}
        onPress={() => { void player.skip(-SKIP_MS); }}
        className={`h-14 w-14 items-center justify-center ${active ? '' : 'opacity-40'}`}>
        <Icon name="replay10" size={34} color={colors.ink} />
      </Pressable>
      <Pressable accessibilityRole="button" accessibilityLabel={playing ? 'Pause' : 'Play'}
        accessibilityState={{ busy }} onPress={() => {
          if (sent && !sent.listenedAt) inbox.markListened(sent.shareId);
          void player.toggle(story);
        }}
        className="h-20 w-20 items-center justify-center rounded-full bg-cocoa active:opacity-80">
        {busy ? <ActivityIndicator color={colors.paper} />
          : <Icon name={playing ? 'pause' : 'play'} size={44} color={colors.paper} />}
      </Pressable>
      <Pressable accessibilityRole="button" accessibilityLabel="Forward 10 seconds" disabled={!active}
        onPress={() => { void player.skip(SKIP_MS); }}
        className={`h-14 w-14 items-center justify-center ${active ? '' : 'opacity-40'}`}>
        <Icon name="forward10" size={34} color={colors.ink} />
      </Pressable>
    </View>
    {playError ? <Text accessibilityRole="alert" className="mt-3 text-center text-[12px] text-rust">{playError}</Text> : null}

    {story.description ? <View className="mt-8 rounded-2xl bg-cream p-5">
      <Text className="mb-2 text-[11px] font-medium uppercase tracking-[1.4px] text-muted">About this story</Text>
      <Text className="text-[14px] leading-[21px] text-ink">{story.description}</Text>
    </View> : null}
  </View></Shell>;
}
