import { useEffect } from 'react';
import { router, useLocalSearchParams } from 'expo-router';
import { Platform, Pressable, Text, View } from 'react-native';
import { Shell } from '../../components/shell';
import { Body, Button, Heading, Icon, Label } from '../../components/ui';
import { HighlightedScript } from '../../components/read-along/highlighted-script';
import { useStudio } from '../../context/studio';
import { useReadAlong, type ReadAlongPhase } from '../../hooks/use-read-along';

const status: Record<ReadAlongPhase, string> = {
  idle: 'Ready',
  connecting: 'Connecting… you can start reading',
  listening: 'Listening',
  stopping: 'Finishing…',
  error: 'Stopped',
};

/** Read a written story aloud while a purple highlighter follows along. */
export default function ReadStory() {
  const { id, from } = useLocalSearchParams<{ id: string; from?: string }>();
  const { creations } = useStudio();
  const item = creations.find(creation => creation.id === id);
  const back = () => router.replace({ pathname: '/item/[id]', params: { id, ...(from ? { from } : {}) } });
  if (!item?.text || Platform.OS === 'web') {
    return <Shell><View className="w-full max-w-[500px] self-center pt-3">
      <BackLink onPress={back} />
      <Heading className="!text-[32px] !leading-[40px]">{item?.text ? 'Read along' : 'Story not found'}</Heading>
      <Body className="mt-2">{item?.text
        ? 'Read along uses native microphone streaming. Open this story on iOS or Android.'
        : 'This story has no text to read along with.'}</Body>
    </View></Shell>;
  }
  return <ReadAlong title={item.title.replace('\n', ' ')} text={item.text} onBack={back} />;
}

function BackLink({ onPress, disabled = false }: { onPress: () => void; disabled?: boolean }) {
  return <Pressable accessibilityRole="link" accessibilityState={{ disabled }} disabled={disabled} onPress={onPress}
    className={`min-h-[52px] flex-row items-center gap-2.5 ${disabled ? 'opacity-40' : ''}`}>
    <Icon name="back" size={18} /><Text className="text-[13px] text-muted">Story</Text>
  </Pressable>;
}

function ReadAlong({ title, text, onBack }: { title: string; text: string; onBack: () => void }) {
  const { words, phase, current, heard, error, pace, start, stop, seek } = useReadAlong(text);
  const active = phase === 'connecting' || phase === 'listening' || phase === 'stopping';
  const finished = !active && words.length > 0 && current === words.length - 1;
  // Reading the last word ends the session; Deepgram flushes and the socket closes.
  useEffect(() => {
    if (phase === 'listening' && words.length > 0 && current === words.length - 1) stop();
  }, [current, phase, stop, words.length]);

  return <Shell scroll={false}>
    <View className="w-full max-w-[700px] flex-1 self-center">
      <View className="flex-row items-center justify-between">
        <BackLink onPress={onBack} disabled={active} />
        <View className="flex-row items-center gap-2">
          <View className={`h-2 w-2 rounded-full ${phase === 'listening' ? 'bg-violet-500' : phase === 'error' ? 'bg-rust' : 'bg-line'}`} />
          <Text className="text-[12px] text-muted">{status[phase]}</Text>
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
          {finished ? 'The end! Tap Start over to read it again.'
            : heard ? `Heard: “${heard}”`
            : active ? 'Waiting for speech…' : 'Tap Start reading, then read the story aloud. Tap a word to start from there.'}
        </Text>
        <View className="flex-row gap-3">
          <Button className="flex-1" title={active ? 'Stop' : 'Start reading'} icon={active ? 'stop' : 'mic'}
            disabled={phase === 'stopping' || finished} onPress={active ? stop : start} />
          <Button secondary title="Start over" disabled={active || current < 0} onPress={() => seek(-1)} />
        </View>
      </View>
    </View>
  </Shell>;
}
