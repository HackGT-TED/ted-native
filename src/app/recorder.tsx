import { useCallback, useState } from 'react';
import { AccessibilityInfo, Keyboard, Pressable, StyleSheet, Text, TextInput, useWindowDimensions, View } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { Shell } from '../components/shell';
import { Body, colors, Icon, Label } from '../components/ui';
import { useStudio } from '../context/studio';
import { useHoldRecorder } from '../hooks/use-hold-recorder';
import { useRecordingPlayback } from '../hooks/use-recording-playback';
import { useRecordingUpload } from '../hooks/use-recording-upload';

function time(milliseconds: number) {
  const seconds = Math.floor(milliseconds / 1000);
  return `${Math.floor(seconds / 60).toString().padStart(2, '0')}:${(seconds % 60).toString().padStart(2, '0')}`;
}
export default function Recorder() {
  const { height } = useWindowDimensions();
  const { recording, setRecording } = useStudio();
  const [title, setTitle] = useState('');
  const [accessibleMode, setAccessibleMode] = useState(false);
  const { playback, error: playbackError, pause, toggle: togglePlayback, clearError } = useRecordingPlayback(recording?.uri ?? null);
  const { start, finish, phase, error, duration } = useHoldRecorder(setRecording);
  const { status: uploadStatus, error: uploadError, upload } = useRecordingUpload(recording);
  const active = phase === 'recording';
  const busy = phase !== 'idle';
  const compact = height < 750;

  useFocusEffect(useCallback(() => {
    let live = true;
    void AccessibilityInfo.isScreenReaderEnabled().then(enabled => { if (live) setAccessibleMode(enabled); });
    const subscription = AccessibilityInfo.addEventListener('screenReaderChanged', setAccessibleMode);
    return () => { live = false; subscription.remove(); };
  }, []));

  function begin() {
    Keyboard.dismiss();
    pause();
    clearError();
    void start(title);
  }
  return <Shell scroll={height < 640}>
    <View style={[s.recorder, compact && { paddingTop: 24 }]}>
      <View style={s.fields}>
        <Label style={{ marginBottom: 10 }}>RECORDER</Label>
        <View style={s.titleRow}>
          <TextInput accessibilityLabel="Recording title" value={title} onChangeText={setTitle} placeholder="Untitled recording" placeholderTextColor={colors.muted} maxLength={80} editable={!busy} style={s.titleInput} />
          <Icon name="create" size={19} color={colors.muted} />
        </View>
        <View style={s.statusRow}>
          <View style={s.status}><View style={[s.dot, active && { backgroundColor: colors.rust }]} /><Text style={s.statusText}>{active ? 'Recording' : phase === 'preparing' ? 'Preparing microphone' : phase === 'stopping' ? 'Finishing take' : 'Ready to record'}</Text></View>
          <Text style={s.timer}>{time(duration)}</Text>
        </View>
      </View>
      <View style={s.controlArea}>
        <Pressable accessibilityRole="button" accessibilityLabel={accessibleMode ? active ? 'Stop recording' : 'Start recording' : 'Hold to talk'} accessibilityHint={accessibleMode ? 'Double tap to start or stop recording' : 'Keep holding to record. Release to stop.'} accessibilityState={{ busy: phase === 'preparing' || phase === 'stopping' }}
          onPressIn={accessibleMode ? undefined : begin} onPressOut={accessibleMode ? undefined : () => { void finish(); }} onPress={accessibleMode ? () => { if (active) void finish(); else begin(); } : undefined}
          style={({ pressed }) => [s.recordButton, compact && { width: 164, height: 164, borderRadius: 82 }, (active || pressed) && { backgroundColor: colors.rust }]}>
          <Icon name={active ? 'stop' : 'mic'} size={56} color={colors.paper} />
        </Pressable>
        <Text style={[s.holdLabel, compact && { marginTop: 16 }]}>{active ? accessibleMode ? 'Tap to stop' : 'Release to stop' : phase === 'preparing' ? 'Getting ready…' : phase === 'stopping' ? 'Finishing…' : accessibleMode ? 'Tap to record' : 'Hold to talk'}</Text>
        <Body style={s.hint}>{active ? 'Listening.' : accessibleMode ? 'Tap again to finish.' : 'Release to finish.'}</Body>
        {(error || playbackError) ? <Text accessibilityRole="alert" style={s.error}>{error || playbackError}</Text> : null}
      </View>
      <View style={s.lastTakeArea}>
        {recording ? <><View style={s.lastTake}>
          <Pressable accessibilityRole="button" accessibilityLabel={playback.playing ? 'Pause recording' : 'Play last recording'} disabled={busy} onPress={() => { void togglePlayback(); }} style={[s.playButton, busy && { opacity: 0.35 }]}><Icon name={playback.playing ? 'pause' : 'play'} size={26} /></Pressable>
          <View style={{ flex: 1, gap: 4 }}><Text numberOfLines={1} style={s.takeTitle}>{recording.title}</Text><Text style={s.takeMeta}>Last take · {time(recording.duration)}</Text></View>
          <Pressable accessibilityRole="button" accessibilityLabel="Discard last recording" disabled={busy} onPress={() => { pause(); setRecording(null); }} style={s.playButton}><Icon name="trash" size={20} color={colors.muted} /></Pressable>
        </View>
          <Pressable accessibilityRole="button" accessibilityState={{ disabled: busy || uploadStatus === 'uploading' || uploadStatus === 'uploaded', busy: uploadStatus === 'uploading' }} disabled={busy || uploadStatus === 'uploading' || uploadStatus === 'uploaded'} onPress={() => { void upload(); }} style={({ pressed }) => [s.uploadButton, (busy || pressed) && { opacity: 0.5 }]}>
            <Text accessibilityLiveRegion="polite" style={s.uploadLabel}>{uploadStatus === 'uploading' ? 'Uploading…' : uploadStatus === 'uploaded' ? 'Uploaded' : uploadStatus === 'error' ? 'Retry upload' : 'Upload recording'}</Text>
          </Pressable>
          {uploadError ? <Text accessibilityRole="alert" style={s.error}>{uploadError}</Text> : null}
        </> : <Text style={s.localNote}>Recordings stay on this device during your session.</Text>}
      </View>
    </View>
  </Shell>;
}
const s = StyleSheet.create({
  recorder: { flex: 1, maxWidth: 440, width: '100%', alignSelf: 'center', paddingTop: 36, paddingBottom: 16 },
  fields: { gap: 12 },
  titleRow: { backgroundColor: colors.cream, borderRadius: 10, paddingHorizontal: 18, minHeight: 56, flexDirection: 'row', alignItems: 'center', gap: 12 },
  titleInput: { flex: 1, fontSize: 15, color: colors.ink, minHeight: 56 },
  statusRow: { backgroundColor: colors.cream, borderRadius: 10, paddingHorizontal: 18, minHeight: 56, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  status: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: colors.honey },
  statusText: { fontSize: 13, color: colors.muted },
  timer: { fontSize: 15, color: colors.ink, fontVariant: ['tabular-nums'] },
  controlArea: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingVertical: 16 },
  recordButton: { width: 220, height: 220, borderRadius: 110, backgroundColor: colors.cocoa, alignItems: 'center', justifyContent: 'center' },
  holdLabel: { fontSize: 17, fontWeight: '500', color: colors.ink, marginTop: 22 },
  hint: { fontSize: 12, marginTop: 7 },
  error: { color: colors.rust, fontSize: 12, lineHeight: 18, textAlign: 'center', marginTop: 15 },
  lastTakeArea: { minHeight: 56, justifyContent: 'center' },
  lastTake: { borderTopWidth: 1, borderColor: colors.line, paddingTop: 14, flexDirection: 'row', alignItems: 'center', gap: 10 },
  playButton: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  takeTitle: { fontSize: 13, color: colors.ink },
  takeMeta: { fontSize: 11, color: colors.muted },
  uploadButton: { minHeight: 44, marginTop: 12, borderRadius: 10, backgroundColor: colors.cream, alignItems: 'center', justifyContent: 'center' },
  uploadLabel: { fontSize: 13, fontWeight: '500', color: colors.cocoa },
  localNote: { fontSize: 10, textAlign: 'center', color: colors.muted },
});
