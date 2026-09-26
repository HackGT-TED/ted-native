import { useCallback, useRef, useState } from 'react';
import { AppState, Platform } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { AudioModule, RecordingPresets, setAudioModeAsync, useAudioRecorder, useAudioRecorderState } from 'expo-audio';
import { Recording } from '../context/studio';

type Phase = 'idle' | 'preparing' | 'recording' | 'stopping';
export function useHoldRecorder(onComplete: (recording: Recording) => void) {
  const recorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);
  const state = useAudioRecorderState(recorder, 100);
  const [phase, setPhase] = useState<Phase>('idle');
  const [error, setError] = useState('');
  const phaseRef = useRef<Phase>('idle');
  const held = useRef(false);
  const focused = useRef(true);
  const startedAt = useRef(0);
  const titleRef = useRef('');
  const updatePhase = useCallback((next: Phase) => {
    phaseRef.current = next;
    if (focused.current) setPhase(next);
  }, []);

  const finish = useCallback(async () => {
    held.current = false;
    if (phaseRef.current !== 'recording') return;
    updatePhase('stopping');
    try {
      const duration = Date.now() - startedAt.current;
      await recorder.stop();
      if (recorder.uri) onComplete({ uri: recorder.uri, duration, title: titleRef.current || 'Untitled recording' });
    } catch {
      if (focused.current) setError('Could not save this take. Please try again.');
    } finally {
      try {
        await setAudioModeAsync({ allowsRecording: false });
      } catch {
        if (focused.current) setError('Could not reset the microphone. Please reopen the recorder.');
      }
      updatePhase('idle');
    }
  }, [onComplete, recorder, updatePhase]);

  useFocusEffect(useCallback(() => {
    focused.current = true;
    setPhase(phaseRef.current);
    const subscription = AppState.addEventListener('change', next => {
      if (next !== 'active') void finish();
    });
    return () => {
      focused.current = false;
      held.current = false;
      subscription.remove();
      void finish();
    };
  }, [finish]));

  async function start(title: string) {
    if (phaseRef.current !== 'idle') return;
    held.current = true;
    titleRef.current = title.trim();
    setError('');
    updatePhase('preparing');
    try {
      const permission = await AudioModule.requestRecordingPermissionsAsync();
      if (!permission.granted) {
        if (focused.current) setError('Microphone access is off. Enable it in your device or browser settings.');
        return;
      }
      if (!held.current || !focused.current) return;
      await setAudioModeAsync({ playsInSilentMode: true, allowsRecording: true });
      if (!held.current || !focused.current) {
        await setAudioModeAsync({ allowsRecording: false });
        return;
      }
      await recorder.prepareToRecordAsync();
      if (!held.current || !focused.current) {
        // Web MediaRecorder must be started before stop can release its microphone stream.
        if (Platform.OS === 'web') recorder.record();
        await recorder.stop();
        await setAudioModeAsync({ allowsRecording: false });
        return;
      }
      recorder.record();
      startedAt.current = Date.now();
      updatePhase('recording');
    } catch {
      if (focused.current) setError('Recording could not start. Check microphone access and try again.');
      try { await setAudioModeAsync({ allowsRecording: false }); } catch { /* Preserve the recording error. */ }
    } finally {
      if ((phaseRef.current as Phase) === 'preparing') updatePhase('idle');
    }
  }
  return { start, finish, phase, error, duration: phase === 'recording' ? state.durationMillis : 0 };
}
