import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState, Platform } from 'react-native';
import { AudioModule, RecordingPresets, setAudioModeAsync, useAudioRecorder } from 'expo-audio';
import type { Recording } from '../types/recording';

type Phase = 'idle' | 'starting' | 'recording' | 'stopping' | 'saving' | 'error';
const options = { ...RecordingPresets.HIGH_QUALITY, directory: 'document' as const };

/** Owned by StudioProvider, so route unmounts cannot dispose a finalizing take. */
export function useAudioCapture(onComplete: (recording: Recording) => Promise<void>) {
  const finishRef = useRef<() => Promise<void>>(async () => {});
  const recorder = useAudioRecorder(options, status => {
    if (status.hasError || status.isFinished) void finishRef.current();
  });
  const [elapsed, setElapsed] = useState(0);
  const [phase, setPhase] = useState<Phase>('idle');
  const [error, setError] = useState('');
  const [permissionBlocked, setPermissionBlocked] = useState(false);
  const phaseRef = useRef<Phase>('idle');
  const requested = useRef(false);
  const mounted = useRef(true);
  const startedAt = useRef(0);
  const finalDuration = useRef(0);
  const titleRef = useRef('');
  const completion = useRef(onComplete);
  const updatePhase = useCallback((next: Phase) => {
    phaseRef.current = next;
    if (mounted.current) setPhase(next);
  }, []);

  const finish = useCallback(async () => {
    requested.current = false;
    if (phaseRef.current !== 'recording' && phaseRef.current !== 'error') return;
    updatePhase('stopping');
    try {
      // iOS resets duration on stop. Read native status immediately before it,
      // then prefer the final API value on platforms that preserve it.
      finalDuration.current = Math.max(finalDuration.current, recorder.getStatus().durationMillis);
      setElapsed(finalDuration.current);
      await recorder.stop();
      const duration = Math.max(finalDuration.current, recorder.getStatus().durationMillis);
      if (!recorder.uri) throw new Error('No finalized audio file was returned.');
      const durationMs = Math.round(duration > 0 ? duration : Date.now() - startedAt.current);
      if (durationMs < 250) {
        setError('That moment was too short to save. Please record for at least a quarter of a second.');
      } else {
        updatePhase('saving');
        await completion.current({ uri: recorder.uri, duration: durationMs,
          title: titleRef.current || 'A story moment', recordedAt: new Date(startedAt.current).toISOString() });
      }
    } catch {
      if (mounted.current) setError('This moment could not finish. Retry to keep it in your story.');
      updatePhase('error');
    } finally {
      try { await setAudioModeAsync({ allowsRecording: false }); } catch { /* Keep the captured file and original error. */ }
      if (phaseRef.current !== 'error') updatePhase('idle');
    }
  }, [recorder, updatePhase]);
  useEffect(() => { finishRef.current = finish; }, [finish]);

  useEffect(() => {
    if (phase !== 'recording') return;
    const interval = setInterval(() => {
      const status = recorder.getStatus();
      finalDuration.current = Math.max(finalDuration.current, status.durationMillis);
      setElapsed(finalDuration.current);
      if (!status.isRecording || status.mediaServicesDidReset) void finishRef.current();
    }, 250);
    return () => clearInterval(interval);
  }, [phase, recorder]);

  useEffect(() => {
    mounted.current = true;
    const subscription = AppState.addEventListener('change', next => {
      if (next !== 'active') void finish();
    });
    return () => {
      mounted.current = false;
      requested.current = false;
      subscription.remove();
    };
  }, [finish]);

  const start = useCallback(async (title = '') => {
    if (phaseRef.current !== 'idle') return;
    requested.current = true;
    completion.current = onComplete; // Ownership is fixed when capture starts.
    titleRef.current = title.trim();
    finalDuration.current = 0;
    setElapsed(0);
    setError('');
    setPermissionBlocked(false);
    updatePhase('starting');
    try {
      const permission = await AudioModule.requestRecordingPermissionsAsync();
      if (!permission.granted) {
        setPermissionBlocked(permission.canAskAgain === false);
        setError('Microphone access is off. Enable it in your device or browser settings.');
        return;
      }
      if (!requested.current || !mounted.current) return;
      await setAudioModeAsync({ playsInSilentMode: true, allowsRecording: true });
      if (!requested.current || !mounted.current) {
        await setAudioModeAsync({ allowsRecording: false });
        return;
      }
      // Explicit options allocate a fresh native file on every take in SDK 57.
      await recorder.prepareToRecordAsync(options);
      if (!requested.current || !mounted.current) {
        if (Platform.OS === 'web') recorder.record();
        await recorder.stop();
        await setAudioModeAsync({ allowsRecording: false });
        return;
      }
      recorder.record();
      startedAt.current = Date.now();
      updatePhase('recording');
    } catch {
      if (mounted.current) setError('Recording could not start. Check microphone access and try again.');
      try { await setAudioModeAsync({ allowsRecording: false }); } catch { /* Keep the initialization error. */ }
    } finally {
      if ((phaseRef.current as Phase) === 'starting') updatePhase('idle');
    }
  }, [onComplete, recorder, updatePhase]);

  return { start, finish, phase, error, permissionBlocked,
    duration: phase === 'idle' || phase === 'starting' ? 0 : elapsed };
}
