import { useState } from 'react';
import { Platform, Text, TextInput, View } from 'react-native';
import { Shell } from '../components/shell';
import { Body, Button, colors, Label } from '../components/ui';
import { HighlightedScript } from '../components/read-along/highlighted-script';
import { useReadAlong, type ReadAlongPhase } from '../hooks/use-read-along';

// Temporary test screen for read-along tracking; the real reading UI will reuse the hook and script view.
const SAMPLE = `Once upon a time, in a cozy cottage at the edge of the Whispering Woods, there lived a little bear named Tedward. Every night, Tedward climbed onto the windowsill to count the stars. "One, two, three," he whispered, until his eyes grew heavy. But one night, a single star was missing. Tedward pulled on his red scarf, tiptoed past his sleeping mother, and set off into the dark forest to find it.`;

const status: Record<ReadAlongPhase, string> = {
  idle: 'Ready',
  connecting: 'Connecting… you can start reading',
  listening: 'Listening',
  stopping: 'Finishing…',
  error: 'Stopped',
};

export default function ReadAlong() {
  if (Platform.OS === 'web') {
    return <Shell><View className="pt-9"><Label>READ ALONG</Label>
      <Body className="mt-2">Read-along uses native microphone streaming. Open it on iOS or Android.</Body></View></Shell>;
  }
  return <ReadAlongTest />;
}

function ReadAlongTest() {
  const [script, setScript] = useState(SAMPLE);
  const [editing, setEditing] = useState(false);
  const { words, phase, current, heard, error, start, stop, seek } = useReadAlong(script);
  const active = phase === 'connecting' || phase === 'listening' || phase === 'stopping';

  return <Shell scroll={false}>
    <View className="flex-1 pt-6">
      <View className="flex-row items-center justify-between">
        <Label>READ ALONG · TEST</Label>
        <View className="flex-row items-center gap-2">
          <View className={`h-2 w-2 rounded-full ${phase === 'listening' ? 'bg-violet-500' : phase === 'error' ? 'bg-rust' : 'bg-line'}`} />
          <Text className="text-[12px] text-muted">{status[phase]}</Text>
        </View>
      </View>

      {editing
        ? <TextInput multiline value={script} onChangeText={setScript} autoFocus
            accessibilityLabel="Script" placeholder="Paste a story to read" placeholderTextColor={colors.muted}
            className="mt-4 flex-1 rounded-[10px] bg-cream p-4 text-[16px] leading-[24px] text-ink" textAlignVertical="top" />
        : <View className="mt-4 flex-1"><HighlightedScript words={words} current={current} onSeek={active ? undefined : seek} /></View>}

      <View className="gap-3 border-t border-line pt-3">
        {!!error && <Text accessibilityRole="alert" className="text-[13px] text-rust">{error}</Text>}
        <Text numberOfLines={2} className="min-h-[36px] text-[12px] leading-[18px] text-muted">
          {heard ? `Heard: “${heard}”` : active ? 'Waiting for speech…' : 'Tap a word to start from there.'}
        </Text>
        <View className="flex-row gap-3">
          <Button className="flex-1" title={active ? 'Stop' : 'Start reading'} icon={active ? 'stop' : 'mic'}
            disabled={phase === 'stopping' || editing || words.length === 0} onPress={active ? stop : start} />
          <Button secondary title={editing ? 'Done' : 'Edit'} disabled={active}
            onPress={() => { if (editing) seek(-1); setEditing(!editing); }} />
          <Button secondary title="Reset" disabled={active || editing} onPress={() => seek(-1)} />
        </View>
      </View>
    </View>
  </Shell>;
}
