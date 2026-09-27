import { useRef, useState } from 'react';
import { Platform, Text, View } from 'react-native';
import { formatDuration } from '../utils/recordings';

export function PlaybackSeekBar({ positionMs, durationMs, disabled, onSeek }: {
  positionMs: number; durationMs: number; disabled: boolean; onSeek: (position: number) => void;
}) {
  const width = useRef(0);
  const [preview, setPreview] = useState<number | null>(null);
  const position = Math.min(durationMs, Math.max(0, preview ?? positionMs));
  const progress = durationMs > 0 ? position / durationMs : 0;
  const at = (x: number) => Math.min(1, Math.max(0, x / Math.max(1, width.current))) * durationMs;
  return <View className={disabled ? 'opacity-40' : ''}>
    <View accessible accessibilityRole="adjustable" accessibilityLabel="Story playback position"
      {...(Platform.OS === 'web' ? {
        tabIndex: disabled ? -1 : 0,
        onKeyDown: (event: { key: string; preventDefault: () => void }) => {
          if (disabled || !['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Home', 'End'].includes(event.key)) return;
          event.preventDefault();
          const target = event.key === 'Home' ? 0 : event.key === 'End' ? durationMs
            : positionMs + (event.key === 'ArrowRight' || event.key === 'ArrowUp' ? 15000 : -15000);
          onSeek(Math.max(0, Math.min(durationMs, target)));
        },
      } : {})}
      accessibilityHint="Drag to move through the story. Adjust up or down to skip fifteen seconds."
      accessibilityState={{ disabled }}
      accessibilityValue={{ min: 0, max: Math.floor(durationMs / 1000), now: Math.floor(position / 1000), text: `${formatDuration(position)} of ${formatDuration(durationMs)}` }}
      accessibilityActions={[{ name: 'increment', label: 'Forward fifteen seconds' }, { name: 'decrement', label: 'Back fifteen seconds' }]}
      onAccessibilityAction={event => {
        if (!disabled) onSeek(Math.max(0, Math.min(durationMs, positionMs + (event.nativeEvent.actionName === 'increment' ? 15000 : -15000))));
      }}
      className="h-11 w-full justify-center"
      onLayout={event => { width.current = event.nativeEvent.layout.width; }}
      onStartShouldSetResponder={() => !disabled}
      onMoveShouldSetResponder={() => !disabled}
      onResponderTerminationRequest={() => false}
      onResponderGrant={event => { if (!disabled) setPreview(at(event.nativeEvent.locationX)); }}
      onResponderMove={event => { if (!disabled) setPreview(at(event.nativeEvent.locationX)); }}
      onResponderRelease={event => { if (!disabled) onSeek(at(event.nativeEvent.locationX)); setPreview(null); }}
      onResponderTerminate={() => setPreview(null)}>
      <View pointerEvents="none" className="h-1 w-full rounded-full bg-line">
        <View className="h-1 rounded-full bg-cocoa" style={{ width: `${progress * 100}%` }} />
        <View className="absolute -top-1 h-3 w-3 rounded-full bg-cocoa" style={{ left: `${progress * 100}%`, marginLeft: -6 }} />
      </View>
    </View>
    <View className="-mt-1 flex-row justify-between">
      <Text className="text-[11px] text-muted" style={{ fontVariant: ['tabular-nums'] }}>{formatDuration(position)}</Text>
      <Text className="text-[11px] text-muted" style={{ fontVariant: ['tabular-nums'] }}>−{formatDuration(durationMs - position)}</Text>
    </View>
  </View>;
}
