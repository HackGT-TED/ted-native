import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';
import { useIsFocused } from 'expo-router';
import { setAudioModeAsync, useAudioPlayer, useAudioPlayerStatus } from 'expo-audio';
import { localRecordingUri, remoteRecordingUri } from '../services/recording-files';
import type { RecordingSegment } from '../types/recording';

export function useTimelinePlayback() {
  // One native player for the whole timeline; changing cards replaces its source.
  const player = useAudioPlayer(null, { updateInterval: 250, keepAudioSessionActive: true });
  const playback = useAudioPlayerStatus(player);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const request = useRef(0);
  const focused = useRef(true);
  const isFocused = useIsFocused();
  const selected = useRef<{ segment: RecordingSegment; remote: boolean; ready: boolean; finished: boolean } | null>(null);
  const loadRef = useRef<(segment: RecordingSegment, remote?: boolean) => Promise<void>>(async () => {});

  // Cancel pending loads as well as audible playback before opening the mic.
  const stop = useCallback(() => {
    request.current += 1;
    player.pause();
    selected.current = null;
    setActiveId(null);
    setLoading(false);
  }, [player]);

  const load = useCallback(async (segment: RecordingSegment, remote = false) => {
    const version = ++request.current;
    const current = () => focused.current && version === request.current;
    player.pause();
    selected.current = { segment, remote, ready: false, finished: false };
    setActiveId(segment.id);
    setLoading(true);
    setError('');
    try {
      let uri: string | undefined;
      if (!remote) {
        try { uri = await localRecordingUri(segment); } catch { /* Try the private stored file. */ }
      }
      const usingRemote = !uri;
      uri ??= await remoteRecordingUri(segment);
      if (!current()) return;
      await setAudioModeAsync({ allowsRecording: false, playsInSilentMode: true });
      if (!current()) return;
      selected.current = { segment, remote: usingRemote, ready: true, finished: false };
      player.replace(uri);
      player.play();
    } catch (cause) {
      if (current()) {
        if (selected.current) selected.current.ready = false;
        setError(cause instanceof Error ? cause.message : 'This moment could not be played. Tap play to retry.');
      }
    } finally {
      if (current()) setLoading(false);
    }
  }, [player]);
  useEffect(() => { loadRef.current = load; }, [load]);

  useEffect(() => {
    const subscription = player.addListener('playbackStatusUpdate', status => {
      const current = selected.current;
      if (!focused.current || !current?.ready) return;
      if (status.didJustFinish) current.finished = true;
      if (status.error) {
        current.ready = false;
        if (!current.remote && current.segment.storagePath) void loadRef.current(current.segment, true);
        else setError('This moment could not be played. Tap play to retry.');
      }
    });
    return () => subscription.remove();
  }, [player]);

  useEffect(() => {
    focused.current = isFocused;
    // Synchronize visible controls with the native player stopped on blur.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (!isFocused) stop();
    const subscription = AppState.addEventListener('change', next => { if (next !== 'active') stop(); });
    return () => {
      focused.current = false;
      subscription.remove();
      request.current += 1;
      selected.current = null;
    };
  }, [isFocused, stop]);

  const toggle = useCallback(async (segment: RecordingSegment) => {
    const current = selected.current;
    if (current?.segment.id !== segment.id || !current.ready) { await load(segment); return; }
    const version = ++request.current;
    if (player.playing && !current.finished) { player.pause(); return; }
    try {
      if (current.finished || (player.duration > 0 && player.currentTime >= player.duration)) await player.seekTo(0, 0, 0);
      if (!focused.current || request.current !== version) return;
      current.finished = false;
      player.play();
    } catch {
      current.ready = false;
      setError('This moment could not be played. Tap play to retry.');
    }
  }, [load, player]);

  return { activeId, toggle, stop, error, loading: loading || playback.isBuffering,
    playing: playback.playing, positionMs: playback.currentTime * 1000,
    durationMs: playback.duration * 1000 };
}
