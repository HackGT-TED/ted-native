import { useCallback, useEffect, useRef, useState } from 'react';
import { router, useIsFocused, useLocalSearchParams } from 'expo-router';
import { ActivityIndicator, Platform, Pressable, Text, View } from 'react-native';
import { Shell } from '../../components/shell';
import { Body, Button, colors, Heading, Icon, Label } from '../../components/ui';
import { HighlightedScript } from '../../components/read-along/highlighted-script';
import { useStudio } from '../../context/studio';
import { useReadAlong, type ReadAlongPhase, type ReadAlongTake } from '../../hooks/use-read-along';
import { useReadingLink } from '../../hooks/use-reading-link';
import { useWrittenStory } from '../../hooks/use-written-stories';
import { saveReadingLink, type ReadingLink } from '../../services/reading-links';
import { formatDuration, newProjectId } from '../../utils/recordings';
import type { ScriptWord } from '../../utils/read-along';

const status: Record<ReadAlongPhase, string> = {
  idle: 'Ready',
  connecting: 'Connecting… you can start reading',
  listening: 'Recording',
  stopping: 'Saving your take…',
  error: 'Stopped',
};

/** The first few words a take covered, as its clip title in the story timeline. */
function clipTitle(words: ScriptWord[], take: ReadAlongTake, fallback: string) {
  if (take.toWord < take.fromWord) return fallback.slice(0, 80);
  const last = Math.min(take.toWord, take.fromWord + 5);
  const excerpt = words.slice(take.fromWord, last + 1).map(word => word.text).join(' ').replace(/[\s,;:—–-]+$/, '');
  return `“${excerpt}${last < take.toWord ? '…' : ''}”`.slice(0, 80);
}

/** Read a written story aloud: a purple highlighter follows along, and each take becomes a clip. */
export default function ReadAlongScreen() {
  const { slug } = useLocalSearchParams<{ slug: string }>();
  const { story, loading, error, refresh } = useWrittenStory(slug);
  const back = () => router.canGoBack() ? router.back()
    : router.replace({ pathname: '/read/[slug]', params: { slug } });
  const text = story?.paragraphs.join('\n\n');
  if (story && text && Platform.OS !== 'web') {
    return <ReadAlong key={story.slug} storyId={story.slug} title={story.title} text={text} onBack={back} />;
  }
  return <Shell><View className="w-full max-w-[500px] self-center pt-3">
    <BackLink onPress={back} />
    {loading && !story ? <ActivityIndicator accessibilityLabel="Loading story" className="mt-[80px]" color={colors.cocoa} />
      : error ? <View className="mt-[60px] items-center gap-4">
        <Text accessibilityRole="alert" className="text-center text-[13px] text-rust">{error}</Text>
        <Button title="Retry" secondary onPress={() => { void refresh(); }} />
      </View>
      : <>
        <Heading className="!text-[32px] !leading-[40px]">{story ? 'Read along' : 'Story not found'}</Heading>
        <Body className="mt-2">{story
          ? 'Read along uses native microphone streaming. Open this story on iOS or Android.'
          : 'It may have been removed.'}</Body>
      </>}
  </View></Shell>;
}

function BackLink({ onPress, disabled = false }: { onPress: () => void; disabled?: boolean }) {
  return <Pressable accessibilityRole="link" accessibilityLabel="Back" accessibilityState={{ disabled }} disabled={disabled}
    onPress={onPress} className={`min-h-[52px] flex-row items-center gap-2.5 ${disabled ? 'opacity-40' : ''}`}>
    <Icon name="back" size={18} /><Text className="text-[13px] text-muted">Back</Text>
  </Pressable>;
}

function ReadAlong({ storyId, title, text, onBack }: { storyId: string; title: string; text: string; onBack: () => void }) {
  const { session, storyId: openId, openStory, timeline, draft, recorder } = useStudio();
  const userId = session?.user.id ?? null;
  // Every take of this written story goes into one story; its id is kept per written story.
  const reading = useReadingLink(userId, 'story', storyId);
  const [freshProject] = useState(newProjectId);
  const projectId = reading.link?.projectId ?? freshProject;
  const open = !reading.loading && openId === projectId;
  const focused = useIsFocused();

  // Open the story, as Create does, so its clips and name are the current ones and takes land in it.
  // Only while this screen is showing: other stack screens (another reading, Create) stay mounted
  // underneath and would otherwise keep switching the open story back and forth.
  useEffect(() => {
    if (focused && !reading.loading && openId !== projectId && recorder.phase === 'idle') openStory(projectId);
  }, [focused, openId, openStory, projectId, reading.loading, recorder.phase]);

  const wordsRef = useRef<ScriptWord[]>([]);
  const onRecorded = useCallback((take: ReadAlongTake) => {
    // The same pipeline as Create's clips: kept on the device, uploaded, and reorderable there.
    void timeline.addRecording({ uri: take.uri, title: clipTitle(wordsRef.current, take, title),
      duration: take.duration, recordedAt: take.recordedAt });
    if (!draft.name.trim()) draft.saveName(title);
    if (userId) {
      const link: ReadingLink = reading.link ?? { storyId, projectId, title, position: -1 };
      void saveReadingLink(userId, { ...link, position: take.toWord }).catch(() => {});
    }
  }, [draft, projectId, reading.link, storyId, timeline, title, userId]);

  const { words, phase, current, heard, error, pace, elapsed, start, stop, seek } = useReadAlong(text, { onRecorded });
  useEffect(() => { wordsRef.current = words; }, [words]);
  const active = phase === 'connecting' || phase === 'listening' || phase === 'stopping';
  const finished = !active && words.length > 0 && current === words.length - 1;

  // Pick up where the reader stopped last time.
  const restored = useRef(false);
  useEffect(() => {
    if (restored.current || reading.loading) return;
    restored.current = true;
    if (reading.link && reading.link.position >= 0) seek(Math.min(reading.link.position, words.length - 1));
  }, [reading.link, reading.loading, seek, words.length]);

  // Reading the last word ends the take; Deepgram flushes and the clip is saved.
  useEffect(() => {
    if (phase === 'listening' && words.length > 0 && current === words.length - 1) stop();
  }, [current, phase, stop, words.length]);

  const startOver = () => {
    seek(-1);
    if (userId && reading.link) void saveReadingLink(userId, { ...reading.link, position: -1 }).catch(() => {});
  };

  const clips = open ? timeline.segments : [];
  const failed = clips.filter(clip => clip.status === 'error' || clip.error);
  const blocked = !open || !timeline.ready || recorder.phase !== 'idle';

  return <Shell scroll={false}>
    <View className="w-full max-w-[700px] flex-1 self-center">
      <View className="flex-row items-center justify-between">
        <BackLink onPress={onBack} disabled={active} />
        <View className="flex-row items-center gap-2">
          <View className={`h-2 w-2 rounded-full ${phase === 'listening' ? 'bg-violet-500' : phase === 'error' ? 'bg-rust' : 'bg-line'}`} />
          <Text className="text-[12px] text-muted">{status[phase]}{active && phase !== 'stopping' ? ` · ${formatDuration(elapsed)}` : ''}</Text>
        </View>
      </View>
      <Label>READ ALONG</Label>
      <Text numberOfLines={2} className="mt-1 text-[20px] font-medium text-ink">{title}</Text>

      <View className="mt-3 flex-1">
        <HighlightedScript words={words} current={current} pace={pace} onSeek={active ? undefined : seek} />
      </View>

      <View className="gap-3 border-t border-line pt-3">
        {!!error && <Text accessibilityRole="alert" className="text-[13px] text-rust">{error}</Text>}
        <Text numberOfLines={2} className="min-h-[36px] text-[12px] leading-[18px] text-muted">
          {finished ? 'The end! Your reading is saved as clips in your story.'
            : heard ? `Heard: “${heard}”`
            : active ? 'Waiting for speech…'
            : current >= 0 ? 'Tap Start reading to pick up from the highlighted word, or tap any word.'
            : 'Tap Start reading, then read the story aloud. Each take is saved as a clip.'}
        </Text>
        <View className="flex-row gap-3">
          <Button className="flex-1" title={active ? 'Stop' : 'Start reading'} icon={active ? 'stop' : 'mic'}
            disabled={phase === 'stopping' || (!active && (blocked || finished))} onPress={active ? stop : start} />
          <Button secondary title="Start over" disabled={active || current < 0} onPress={startOver} />
        </View>
        <Pressable accessibilityRole="link" disabled={!clips.length || active}
          accessibilityLabel={clips.length ? `${clips.length} clips in your story. Open it in Create to listen and reorder.` : undefined}
          onPress={() => router.push('/create')}
          className={`min-h-11 flex-row items-center gap-3 rounded-[12px] bg-cream px-4 py-2.5 ${!clips.length ? 'opacity-60' : 'active:opacity-70'}`}>
          <Icon name="book" size={18} color={colors.cocoa} />
          <View className="flex-1">
            <Text className="text-[13px] font-medium text-ink">
              {clips.length ? `${clips.length} ${clips.length === 1 ? 'clip' : 'clips'} in your story` : 'Your takes will be saved as clips'}
            </Text>
            <Text className="text-[11px] text-muted">
              {failed.length ? `${failed.length} could not upload. Open the story to retry.`
                : timeline.syncPending ? 'Uploading to your account…'
                : clips.length ? 'Saved to your account · Open to listen and reorder' : 'They appear in Create, Home, and Library'}
            </Text>
          </View>
          {!!clips.length && <Icon name="arrow" size={16} color={colors.muted} />}
        </Pressable>
      </View>
    </View>
  </Shell>;
}
