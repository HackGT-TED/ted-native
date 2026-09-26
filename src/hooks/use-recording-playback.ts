import { useEffect, useRef, useState } from 'react';
import { useIsFocused } from 'expo-router';
import { setAudioModeAsync, useAudioPlayer, useAudioPlayerStatus } from 'expo-audio';

export function useRecordingPlayback(uri: string | null) {
  const player = useAudioPlayer(uri);
  const playback = useAudioPlayerStatus(player);
  const focused = useIsFocused();
  const [error, setError] = useState('');
  const sessionRef = useRef<{ player: typeof player; active: boolean; request: number } | null>(null);

  useEffect(() => {
    const session = { player, active: focused, request: 0 };
    sessionRef.current = session;
    // A blurred but mounted screen still owns a live player. Unmount disposal
    // belongs to useAudioPlayer; cleanup must not call any native methods.
    if (!focused) player.pause();
    return () => { session.active = false; };
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
      if (player.playing) { player.pause(); return; }
      await setAudioModeAsync({ allowsRecording: false, playsInSilentMode: true });
      // A source change, blur, unmount, or pause can occur across either await.
      if (!current()) return;
      if (player.currentTime >= player.duration) await player.seekTo(0);
      if (!current()) return;
      player.play();
    } catch {
      if (current()) setError('This recording could not be played. Try recording another take.');
    }
  }

  return { playback, error, pause, toggle, clearError: () => setError('') };
}
