import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AppState } from 'react-native';
import { AudioModule, useAudioStream, type AudioStreamBuffer } from 'expo-audio';
import { fetchDeepgramToken, listenUrl, type DeepgramResult } from '../services/deepgram';
import { alignSpokenWords, scriptKeyterms, tokenizeScript } from '../utils/read-along';

export type ReadAlongPhase = 'idle' | 'connecting' | 'listening' | 'stopping' | 'error';

// 16 kHz mono 16-bit PCM is what Deepgram's models are trained on and keeps bandwidth low.
const SAMPLE_RATE = 16000;
// Audio captured while the socket opens (~100 ms buffers) is replayed, so reading can start at once.
const MAX_QUEUED_BUFFERS = 50;
const CLOSE_TIMEOUT_MS = 3000;

function closeMessage(event: { code?: number; reason?: string }) {
  if (event.code === 1008) return 'Deepgram rejected the audio format. Please try again.';
  if (event.code === 1011) return 'Deepgram stopped hearing audio. Check the microphone and try again.';
  return `Connection to speech recognition closed${event.code ? ` (${event.code}${event.reason ? `: ${event.reason}` : ''})` : ''}.`;
}

/**
 * Streams the microphone to Deepgram and tracks which script word is being read.
 * `current` is the index of the word to highlight, or -1 before the first word.
 */
export function useReadAlong(script: string) {
  const words = useMemo(() => tokenizeScript(script), [script]);
  const [phase, setPhase] = useState<ReadAlongPhase>('idle');
  const [current, setCurrent] = useState(-1);
  const [heard, setHeard] = useState('');
  const [error, setError] = useState('');
  const phaseRef = useRef<ReadAlongPhase>('idle');
  const socket = useRef<WebSocket | null>(null);
  const queue = useRef<ArrayBuffer[]>([]);
  // Final results are committed; interim results are re-aligned from the committed position
  // each time, so Deepgram revising a guess ("bare" -> "bear") never corrupts the position.
  const committed = useRef(0);
  const shown = useRef(0);
  const session = useRef(0);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const wordsRef = useRef(words);
  useEffect(() => { wordsRef.current = words; }, [words]);

  const onBuffer = useCallback((buffer: AudioStreamBuffer) => {
    const ws = socket.current;
    if (ws?.readyState === WebSocket.OPEN) ws.send(buffer.data);
    else if (phaseRef.current === 'connecting' && queue.current.length < MAX_QUEUED_BUFFERS) queue.current.push(buffer.data);
  }, []);
  const { stream } = useAudioStream({ sampleRate: SAMPLE_RATE, channels: 1, encoding: 'int16', onBuffer });

  const updatePhase = useCallback((next: ReadAlongPhase) => {
    phaseRef.current = next;
    setPhase(next);
  }, []);

  const moveTo = useCallback((position: number, allowBackward: boolean) => {
    // Interim guesses only move forward so the highlight doesn't flicker back and forth.
    shown.current = allowBackward ? position : Math.max(shown.current, position);
    setCurrent(shown.current - 1);
  }, []);

  const handleResult = useCallback((result: DeepgramResult) => {
    const alternative = result.channel?.alternatives?.[0];
    if (!alternative) return;
    const { position, relocated } = alignSpokenWords(wordsRef.current, alternative.words.map(w => w.word), committed.current);
    if (result.is_final) committed.current = position;
    moveTo(position, result.is_final || relocated);
    if (alternative.transcript) setHeard(alternative.transcript);
  }, [moveTo]);

  const teardown = useCallback((next: ReadAlongPhase) => {
    session.current++;
    clearTimeout(closeTimer.current);
    try { stream?.stop(); } catch { /* Already stopped. */ }
    const ws = socket.current;
    socket.current = null;
    if (ws) {
      ws.onopen = ws.onmessage = ws.onerror = ws.onclose = null;
      if (ws.readyState === WebSocket.CONNECTING || ws.readyState === WebSocket.OPEN) ws.close();
    }
    queue.current = [];
    updatePhase(next);
  }, [stream, updatePhase]);

  const start = useCallback(async () => {
    if (phaseRef.current !== 'idle' && phaseRef.current !== 'error') return;
    const id = ++session.current;
    setError('');
    setHeard('');
    committed.current = shown.current; // Resume from the highlighted word.
    queue.current = [];
    updatePhase('connecting');
    try {
      const permission = await AudioModule.requestRecordingPermissionsAsync();
      if (id !== session.current) return;
      if (!permission.granted) throw new Error('Microphone access is off. Enable it in Settings.');
      const token = fetchDeepgramToken();
      token.catch(() => {}); // Awaited below; avoids an unhandled rejection while the mic starts.
      await stream.start();
      if (id !== session.current) { stream.stop(); return; }
      const accessToken = await token;
      if (id !== session.current) return;

      // React Native's WebSocket accepts headers (the DOM typings don't know), so the token never appears in the URL.
      const NativeWebSocket = WebSocket as unknown as new (url: string, protocols: null, options: { headers: Record<string, string> }) => WebSocket;
      const ws = new NativeWebSocket(listenUrl(stream.sampleRate || SAMPLE_RATE, scriptKeyterms(script)), null,
        { headers: { Authorization: `Bearer ${accessToken}` } });
      socket.current = ws;
      ws.onopen = () => {
        if (id !== session.current) return;
        for (const buffer of queue.current) ws.send(buffer);
        queue.current = [];
        updatePhase('listening');
      };
      ws.onmessage = event => {
        if (id !== session.current || typeof event.data !== 'string') return;
        try {
          const message = JSON.parse(event.data);
          if (message.type === 'Results') handleResult(message);
        } catch { /* Ignore malformed frames. */ }
      };
      ws.onclose = event => {
        if (id !== session.current) return;
        if (phaseRef.current === 'stopping') return teardown('idle');
        teardown('error');
        setError(closeMessage(event));
      };
    } catch (cause) {
      if (id !== session.current) return;
      teardown('error');
      setError(cause instanceof Error && cause.message ? cause.message : 'Read-along could not start. Please try again.');
    }
  }, [handleResult, script, stream, teardown, updatePhase]);

  const stop = useCallback(() => {
    if (phaseRef.current === 'connecting') return teardown('idle');
    if (phaseRef.current !== 'listening') return;
    try { stream.stop(); } catch { /* Already stopped. */ }
    const ws = socket.current;
    if (ws?.readyState !== WebSocket.OPEN) return teardown('idle');
    // CloseStream makes Deepgram flush final results for the last words before closing.
    ws.send(JSON.stringify({ type: 'CloseStream' }));
    updatePhase('stopping');
    closeTimer.current = setTimeout(() => teardown('idle'), CLOSE_TIMEOUT_MS);
  }, [stream, teardown, updatePhase]);

  /** Moves the highlight to a word (or before the first with -1), e.g. when the reader taps it. */
  const seek = useCallback((index: number) => {
    committed.current = index + 1;
    moveTo(index + 1, true);
  }, [moveTo]);

  useEffect(() => {
    // iOS suspends the microphone in the background, so end the session cleanly. Not on
    // 'inactive': the microphone permission prompt makes the app briefly inactive.
    const subscription = AppState.addEventListener('change', next => {
      if (next === 'background') teardown('idle');
    });
    return () => {
      subscription.remove();
      teardown('idle');
    };
  }, [teardown]);

  return { words, phase, current, heard, error, start, stop, seek };
}
