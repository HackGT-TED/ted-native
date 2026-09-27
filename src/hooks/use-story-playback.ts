import { useEffect, useState, useSyncExternalStore } from 'react';
import { AppState } from 'react-native';
import { useIsFocused } from 'expo-router';
import { createAudioPlayer, setAudioModeAsync } from 'expo-audio';
import type { RecordingSegment } from '../types/recording';
import { StoryPlayback } from '../services/story-playback';
import { localRecordingUri, remoteRecordingUri } from '../services/recording-files';

export function useStoryPlayback(storyKey: string, segments: RecordingSegment[], enabled: boolean) {
  const focused = useIsFocused();
  const [controller] = useState(() => new StoryPlayback({
    createPlayer: uri => createAudioPlayer(uri, { updateInterval: 250, keepAudioSessionActive: true }),
    configureAudio: () => setAudioModeAsync({ allowsRecording: false, playsInSilentMode: true, interruptionMode: 'doNotMix' }),
    localUri: localRecordingUri,
    remoteUri: remoteRecordingUri,
  }));
  const snapshot = useSyncExternalStore(controller.subscribe, controller.getSnapshot, controller.getSnapshot);
  useEffect(() => { controller.setQueue(storyKey, segments); }, [controller, storyKey, segments]);
  useEffect(() => {
    controller.setEnabled(enabled && focused && AppState.currentState !== 'background');
    const subscription = AppState.addEventListener('change', state => {
      controller.setEnabled(enabled && focused && state === 'active');
    });
    return () => { subscription.remove(); controller.dispose(); };
  }, [controller, enabled, focused]);
  return { ...snapshot, controller };
}
