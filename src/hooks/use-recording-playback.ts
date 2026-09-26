import { useEffect, useRef, useState } from 'react';
import { useIsFocused } from 'expo-router';
import { setAudioModeAsync, useAudioPlayer, useAudioPlayerStatus } from 'expo-audio';

export function useRecordingPlayback(uri: string | null) {
  // Avoid iOS scheduling a session shutdown between pause/end and replay.
  const player = useAudioPlayer(uri, { keepAudioSessionActive: true });
  const playback = useAudioPlayerStatus(player);
  const focused = useIsFocused();
  const [error, setError] = useState('');
  const sessionRef = useRef<{ player: typeof player; active: boolean; request: number; finished: boolean } | null>(null);

  useEffect(() => {
    const previous = sessionRef.current;
    const session = {
      player, active: focused, request: 0,
      finished: previous?.player === player && previous.finished,
    };
    sessionRef.current = session;
    // didJustFinish is a one-event flag. A later status update clears it, so
    // remember completion until we explicitly rewind, even between renders.
    const subscription = player.addListener('playbackStatusUpdate', status => {
      if (status.didJustFinish) session.finished = true;
    });
    // A blurred but mounted screen still owns a live player. Unmount disposal
    // belongs to useAudioPlayer; cleanup must not call any native methods.
    if (!focused) player.pause();
    return () => {
      session.active = false;
      subscription.remove();
    };
  }, [focused, player]);

  function pause() {
    const session = sessionRef.current;
    if (!session?.active || session.player !== player) return;
    session.request += 1;
    player.pause();
  }

  async function toggle() {
    const session = sessionRef.current;
    if (!uri || !session?.active || session.player !== player) return;
    const request = ++session.request;
    const current = () => session.active && session.request === request;
    try {
      setError('');
      if (player.playing && !session.finished) { player.pause(); return; }
      await setAudioModeAsync({ allowsRecording: false, playsInSilentMode: true });
      // A source change, blur, unmount, or pause can occur across either await.
      if (!current()) return;
      // A zero duration can mean metadata is still loading (or missing on web).
      // Only rewind audio known to have finished, preserving pause/resume.
      if (session.finished || (player.duration > 0 && player.currentTime >= player.duration)) {
        // iOS otherwise allows an approximate seek; replay must start at zero.
        await player.seekTo(0, 0, 0);
      }
      if (!current()) return;
      session.finished = false;
      player.play();
    } catch (cause) {
      if (current()) setError(cause instanceof Error
        ? `This recording could not be played. ${cause.message}`
        : 'This recording could not be played. Try recording another take.');
    }
  }

  // Loading/decoding failures arrive through status events, not play() throws.
  const playbackError = playback.error ? `This recording could not be played. ${playback.error}` : error;
  return { playback, error: playbackError, pause, toggle, clearError: () => setError('') };
}
