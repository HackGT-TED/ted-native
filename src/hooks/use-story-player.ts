import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';
import { useIsFocused } from 'expo-router';
import { setAudioModeAsync, useAudioPlayer, useAudioPlayerStatus } from 'expo-audio';
import { supabase } from '../lib/supabase';
import type { MarketplaceStory } from './use-marketplace-stories';

/** One player per screen: playing another story switches to it. */
export function useStoryPlayer() {
  const player = useAudioPlayer(null, { updateInterval: 250 });
  const status = useAudioPlayerStatus(player);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<{ id: string; message: string } | null>(null);
  const request = useRef(0);
  const finished = useRef(false);
  const isFocused = useIsFocused();

  const stop = useCallback(() => {
    request.current += 1;
    player.pause();
    setActiveId(null);
    setLoading(false);
  }, [player]);

  useEffect(() => {
    // Leaving the screen or the app stops the story.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (!isFocused) stop();
    const subscription = AppState.addEventListener('change', next => { if (next !== 'active') stop(); });
    return () => subscription.remove();
  }, [isFocused, stop]);

  useEffect(() => {
    const subscription = player.addListener('playbackStatusUpdate', update => {
      if (update.didJustFinish) finished.current = true;
    });
    return () => subscription.remove();
  }, [player]);

  const toggle = useCallback(async (story: MarketplaceStory) => {
    if (activeId === story.id && !loading) {
      if (player.playing) { player.pause(); return; }
      if (finished.current) { await player.seekTo(0); finished.current = false; }
      player.play();
      return;
    }
    const version = ++request.current;
    player.pause();
    finished.current = false;
    setActiveId(story.id);
    setLoading(true);
    setError(null);
    try {
      if (!story.audioPath) throw new Error('This story has no audio yet.');
      if (!supabase) throw new Error('Account storage is unavailable.');
      const { data, error: urlError } = await supabase.storage.from('recordings').createSignedUrl(story.audioPath, 3600);
      if (urlError || !data) throw new Error('This story could not be played. Tap to retry.');
      if (version !== request.current) return;
      await setAudioModeAsync({ allowsRecording: false, playsInSilentMode: true });
      if (version !== request.current) return;
      player.replace(data.signedUrl);
      player.play();
    } catch (cause) {
      if (version === request.current) {
        setActiveId(null);
        setError({ id: story.id, message: cause instanceof Error ? cause.message : 'This story could not be played. Tap to retry.' });
      }
    } finally {
      if (version === request.current) setLoading(false);
    }
  }, [activeId, loading, player]);

  /** Jumps within the loaded story; clamps to its start and end. */
  const seekTo = useCallback(async (ms: number) => {
    if (!activeId) return;
    const end = player.duration > 0 ? player.duration : Infinity;
    await player.seekTo(Math.min(Math.max(0, ms / 1000), end));
    finished.current = false;
  }, [activeId, player]);
  const skip = useCallback((deltaMs: number) => seekTo(player.currentTime * 1000 + deltaMs), [player, seekTo]);

  return {
    activeId,
    seekTo,
    skip,
    playing: Boolean(activeId) && status.playing,
    loading: loading || (Boolean(activeId) && status.isBuffering),
    positionMs: status.currentTime * 1000,
    durationMs: status.duration * 1000,
    error,
    toggle,
    stop,
  };
}
