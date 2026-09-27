import { LoadingSkeleton } from '../loading-skeleton';
import { memo, useState } from 'react';
import { Pressable, Text, TextInput, View } from 'react-native';
import Animated, { FadeInDown, ReduceMotion } from 'react-native-reanimated';
import { colors, Icon } from '../ui';
import type { RecordingSegment } from '../../types/recording';
import { formatDuration, formatRecordingDay, formatRecordingTime } from '../../utils/recordings';

type Props = {
  recording: RecordingSegment;
  playing: boolean;
  disabled: boolean;
  loading: boolean;
  progress: number;
  playbackError?: string;
  onPlay: (recording: RecordingSegment) => void;
  onRetry: (id: string) => void;
  onRename: (id: string, title: string) => void;
  onDelete: (id: string) => void;
  drag: () => void;
  isDragging: boolean;
  position: number;
  total: number;
  onMoveEarlier: () => void;
  onMoveLater: () => void;
};

export const RecordingTimelineItem = memo(function RecordingTimelineItem({ recording, playing, disabled, loading, progress, playbackError, onPlay, onRetry, onRename, onDelete, drag, isDragging, position, total, onMoveEarlier, onMoveLater }: Props) {
  const [mode, setMode] = useState<'view' | 'rename' | 'delete' | 'move'>('view');
  const [name, setName] = useState('');
  const time = formatRecordingTime(recording.createdAt);
  const highlighted = playing || loading || isDragging;
  const save = () => {
    if (disabled || !name.trim()) return;
    onRename(recording.id, name.trim());
    setMode('view');
  };
  return <Animated.View entering={FadeInDown.duration(300).reduceMotion(ReduceMotion.System)}>
    <View className="pb-5">
    <View className={`rounded-[20px] border bg-cream px-4 py-4 ${isDragging ? 'border-cocoa' : 'border-line'}`}>
      {mode === 'rename' ? <View className="mb-3 gap-2">
        <Text className="text-[12px] text-muted">Segment name</Text>
        <TextInput accessibilityLabel="Segment name" value={name} onChangeText={setName}
          autoFocus maxLength={80} editable={!disabled} placeholder="Name this moment"
          placeholderTextColor={colors.muted} returnKeyType="done" onSubmitEditing={save}
          className="min-h-12 rounded-[10px] border border-line bg-paper px-3 text-[17px] font-semibold tracking-[-0.2px] text-ink" />
        <View className="flex-row justify-end gap-2">
          <Pressable accessibilityRole="button" onPress={() => setMode('view')} className="min-h-11 justify-center px-3">
            <Text className="text-[13px] text-muted">Cancel</Text>
          </Pressable>
          <Pressable accessibilityRole="button" accessibilityLabel="Save segment name" disabled={disabled || !name.trim()}
            accessibilityState={{ disabled: disabled || !name.trim() }} onPress={save}
            className={`min-h-11 justify-center rounded-lg bg-cocoa px-4 ${disabled || !name.trim() ? 'opacity-50' : ''}`}>
            <Text className="text-[13px] font-medium text-paper">Save name</Text>
          </Pressable>
        </View>
      </View> : <View className="mb-3">
        <View className="flex-row items-start gap-1">
          <Text className="flex-1 pt-2 text-[18px] font-semibold leading-6 text-ink">{recording.title}</Text>
          <Pressable accessibilityRole="button" accessibilityLabel={`Rename ${recording.title}`}
            disabled={disabled} onPress={() => { setName(recording.title); setMode('rename'); }}
            className="h-11 w-11 items-center justify-center rounded-full active:bg-paper">
            <Icon name="create" size={18} color={colors.muted} />
          </Pressable>
          <Pressable accessibilityRole="button" accessibilityLabel={`Delete ${recording.title}`}
            disabled={disabled} onPress={() => setMode('delete')}
            className="h-11 w-11 items-center justify-center rounded-full active:bg-paper">
            <Icon name="trash" size={18} color={colors.muted} />
          </Pressable>
        </View>
        <Text className="mt-1 text-[11px] text-muted" style={{ fontVariant: ['tabular-nums'] }}>
          {formatRecordingDay(recording.createdAt)} · {time} · {formatDuration(recording.durationMs)}
        </Text>
      </View>}
      {mode === 'move' && <View className="mb-3 flex-row flex-wrap justify-end gap-1">
        <Pressable accessibilityRole="button" disabled={disabled || position <= 1} onPress={onMoveEarlier}
          className={`min-h-11 justify-center px-3 ${position <= 1 ? 'opacity-40' : ''}`}>
          <Text className="text-[12px] font-medium text-cocoa">Move earlier</Text>
        </Pressable>
        <Pressable accessibilityRole="button" disabled={disabled || position >= total} onPress={onMoveLater}
          className={`min-h-11 justify-center px-3 ${position >= total ? 'opacity-40' : ''}`}>
          <Text className="text-[12px] font-medium text-cocoa">Move later</Text>
        </Pressable>
        <Pressable accessibilityRole="button" onPress={() => setMode('view')} className="min-h-11 justify-center px-3">
          <Text className="text-[12px] text-muted">Done</Text>
        </Pressable>
      </View>}
      {mode === 'delete' ? <View className="gap-3 rounded-[12px] bg-paper p-3">
        <Text className="text-[13px] leading-5 text-ink">Delete this segment from your story?</Text>
        <View className="flex-row justify-end gap-2">
          <Pressable accessibilityRole="button" accessibilityLabel="Keep segment" onPress={() => setMode('view')} className="min-h-11 justify-center px-3">
            <Text className="text-[13px] text-muted">Keep</Text>
          </Pressable>
          <Pressable accessibilityRole="button" accessibilityLabel="Confirm delete segment" disabled={disabled}
            onPress={() => onDelete(recording.id)} className="min-h-11 justify-center rounded-lg bg-rust px-4">
            <Text className="text-[13px] font-medium text-paper">Delete</Text>
          </Pressable>
        </View>
      </View> : <View className="flex-row items-center gap-3">
        <Pressable accessibilityRole="button" accessibilityLabel={`${playing ? 'Pause' : 'Play'} ${recording.title}`}
          disabled={disabled} accessibilityState={{ busy: loading, disabled }} onPress={() => onPlay(recording)}
          className="h-11 w-11 items-center justify-center rounded-full bg-paper active:opacity-50">
          {loading ? <LoadingSkeleton variant="inline" label="Loading audio" /> : <Icon name={playing ? 'pause' : 'play'} color={colors.cocoa} />}
        </Pressable>
        <View accessibilityRole="progressbar" accessibilityLabel="Playback progress"
          accessibilityValue={{ min: 0, max: 100, now: Math.round(progress * 100) }}
          className="h-1.5 flex-1 overflow-hidden rounded-full bg-line">
          <View className="h-full rounded-full bg-cocoa" style={{ width: `${progress * 100}%` }} />
        </View>
      </View>}
      {/* Footer: sync status on the left, the drag handle centered, retry and position on the right. */}
      <View className="mt-2 flex-row items-center">
        <View className="min-w-0 flex-1 flex-row items-center">
          <Text numberOfLines={1} accessibilityLiveRegion="polite" className="shrink text-[11px] text-muted">
            {recording.changeError ? 'Changes waiting to sync' : recording.pendingChange ? 'Saving changes…'
              : recording.status === 'uploading' ? 'Saving to your account…' : recording.status === 'error' ? 'Waiting to sync'
              : recording.status === 'local' ? 'On this device' : 'Saved'}
          </Text>
        </View>
        {mode !== 'rename' && mode !== 'delete' ? <Pressable
          accessibilityRole="adjustable" accessibilityLabel={`Reorder ${recording.title}`}
          accessibilityHint="Hold and drag to change position, or tap for move controls."
          accessibilityValue={{ min: 1, max: total, now: position, text: `${position} of ${total}` }}
          accessibilityActions={[{ name: 'decrement', label: 'Move earlier' }, { name: 'increment', label: 'Move later' }]}
          onAccessibilityAction={({ nativeEvent }) => {
            if (disabled) return;
            if (nativeEvent.actionName === 'decrement' && position > 1) onMoveEarlier();
            if (nativeEvent.actionName === 'increment' && position < total) onMoveLater();
          }}
          disabled={disabled || total < 2} delayLongPress={180}
          onLongPress={drag} onPress={() => setMode(mode === 'move' ? 'view' : 'move')}
          className={`h-11 w-11 items-center justify-center rounded-full active:bg-paper ${total < 2 ? 'opacity-40' : ''}`}>
          <Icon name="drag" size={24} color={colors.cocoa} />
        </Pressable> : <View className="w-11" />}
        <View className="flex-1 flex-row items-center justify-end gap-1">
          {(recording.status === 'error' || recording.error || recording.changeError) && <Pressable accessibilityRole="button" onPress={() => onRetry(recording.id)} className="min-h-11 justify-center px-2">
            <Text className="text-[12px] font-medium text-rust">Retry saving</Text>
          </Pressable>}
          <View accessible accessibilityRole="text"
            accessibilityLabel={`Chapter ${position} of ${total}${playing ? ', playing' : loading ? ', loading' : ''}`}
            className={`h-7 min-w-7 items-center justify-center rounded-full border px-1.5 ${highlighted ? 'border-cocoa bg-cocoa' : 'border-line bg-paper'}`}>
            <Text className={`text-[12px] font-semibold ${highlighted ? 'text-paper' : 'text-cocoa'}`}
              style={{ fontVariant: ['tabular-nums'] }}>{position}</Text>
          </View>
        </View>
      </View>
      {(recording.error || recording.changeError || playbackError) && <Text accessibilityRole="alert" className="mt-2 text-[12px] leading-[18px] text-rust">{playbackError || recording.changeError || recording.error}</Text>}
    </View>
    </View>
  </Animated.View>;
});
