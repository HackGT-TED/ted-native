import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AppState } from 'react-native';
import { AudioModule, useAudioStream, type AudioStreamBuffer } from 'expo-audio';
import { File, Paths } from 'expo-file-system';
import { fetchDeepgramToken, listenUrl, type DeepgramResult } from '../services/deepgram';
import { alignSpokenWords, scriptKeyterms, tokenizeScript } from '../utils/read-along';
import { createMp3Writer } from '../utils/mp3';

export type ReadAlongPhase = 'idle' | 'connecting' | 'listening' | 'stopping' | 'error';
/**
 * A finished take: the audio streamed for tracking, saved as an MP3 file, and the
 * script words it covered (`fromWord` to `toWord`, inclusive; -1 if none were read).
 */
export type ReadAlongTake = { uri: string; duration: number; recordedAt: string; fromWord: number; toWord: number };

// 16 kHz mono 16-bit PCM is what Deepgram's models are trained on and keeps bandwidth low.
const SAMPLE_RATE = 16000;
// Audio captured while the socket opens (~100 ms buffers) is replayed, so reading can start at once.
const MAX_QUEUED_BUFFERS = 50;
const CLOSE_TIMEOUT_MS = 3000;
// Clip uploads are capped at 25 MB; 48 kbps MP3 is ~360 KB a minute, so 30 minutes is well within it.
export const MAX_TAKE_MS = 30 * 60 * 1000;
const MIN_TAKE_MS = 1000;
// Speaking pace in ms per word, measured from Deepgram's word timestamps.
const DEFAULT_PACE_MS = 400;
const MIN_PACE_MS = 150;
const MAX_PACE_MS = 900;
// Unmatched words kept between Deepgram results, so a reader carrying on past a misheard
// word is still recognized when the rest of the phrase arrives in the next result.
const MAX_CARRIED_WORDS = 6;

function closeMessage(event: { code?: number; reason?: string }) {
  if (event.code === 1008) return 'Deepgram rejected the audio format. Please try again.';
  if (event.code === 1011) return 'Deepgram stopped hearing audio. Check the microphone and try again.';
  return `Connection to speech recognition closed${event.code ? ` (${event.code}${event.reason ? `: ${event.reason}` : ''})` : ''}.`;
}

/**
 * Streams the microphone to Deepgram and tracks which script word is being read.
 * `current` is the index of the word to highlight, or -1 before the first word.
 * With `onRecorded`, each session's audio is also kept and delivered as a take when
 * it ends: stop, the length cap, a dropped connection, backgrounding, or leaving the
 * screen mid-take (the callback should save through app-wide state, not the screen).
 */
export function useReadAlong(script: string, { onRecorded }: { onRecorded?: (take: ReadAlongTake) => void } = {}) {
  const words = useMemo(() => tokenizeScript(script), [script]);
  const [phase, setPhase] = useState<ReadAlongPhase>('idle');
  const [current, setCurrent] = useState(-1);
  const [heard, setHeard] = useState('');
  const [error, setError] = useState('');
  const [pace, setPace] = useState(DEFAULT_PACE_MS);
  const [elapsed, setElapsed] = useState(0);
  const phaseRef = useRef<ReadAlongPhase>('idle');
  const socket = useRef<WebSocket | null>(null);
  const queue = useRef<ArrayBuffer[]>([]);
  // Final results are committed; interim results are re-aligned from the committed position
  // each time, so Deepgram revising a guess ("pear" -> "bear") never corrupts the position.
  const committed = useRef(0);
  const carried = useRef<string[]>([]);
  const shown = useRef(0);
  const session = useRef(0);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const wordsRef = useRef(words);
  useEffect(() => { wordsRef.current = words; }, [words]);
  const paceRef = useRef(DEFAULT_PACE_MS);
  const take = useRef<{
    writer: ReturnType<typeof createMp3Writer> | null; failed: boolean;
    bytes: number; rate: number; startedAt: string; fromWord: number;
  } | null>(null);
  const onRecordedRef = useRef(onRecorded);
  useEffect(() => { onRecordedRef.current = onRecorded; }, [onRecorded]);
  const stopRef = useRef<() => void>(() => {});

  const onBuffer = useCallback((buffer: AudioStreamBuffer) => {
    const recording = take.current;
    if (recording && !recording.failed) {
      try {
        // The encoder needs the rate the hardware actually delivers, known from the first buffer.
        recording.writer ??= createMp3Writer(buffer.sampleRate);
        recording.writer.write(buffer.data);
      } catch {
        recording.failed = true;
      }
      recording.bytes += buffer.data.byteLength;
      recording.rate = buffer.sampleRate;
      const ms = (recording.bytes / 2 / buffer.sampleRate) * 1000;
      setElapsed(Math.floor(ms / 1000) * 1000);
      if (ms >= MAX_TAKE_MS) stopRef.current();
    }
    const ws = socket.current;
    if (ws?.readyState === WebSocket.OPEN) ws.send(buffer.data);
    else if (phaseRef.current === 'connecting' && queue.current.length < MAX_QUEUED_BUFFERS) queue.current.push(buffer.data);
  }, []);
  const { stream } = useAudioStream({ sampleRate: SAMPLE_RATE, channels: 1, encoding: 'int16', onBuffer });

  const updatePhase = useCallback((next: ReadAlongPhase) => {
    phaseRef.current = next;
    setPhase(next);
  }, []);

  /** Ends audio capture and, unless discarding, writes the take to an MP3 file and delivers it. */
  const finishTake = useCallback((deliver: boolean) => {
    const recording = take.current;
    take.current = null;
    if (!recording || !deliver || !onRecordedRef.current) return;
    const duration = Math.round((recording.bytes / 2 / recording.rate) * 1000);
    if (duration < MIN_TAKE_MS || !recording.writer) return;
    try {
      if (recording.failed) throw new Error('The take could not be encoded.');
      const file = new File(Paths.document, `reading-${Date.now()}.mp3`);
      file.create();
      file.write(recording.writer.finish());
      onRecordedRef.current({ uri: file.uri, duration, recordedAt: recording.startedAt,
        fromWord: recording.fromWord, toWord: shown.current - 1 });
    } catch {
      setError('This take could not be saved on your device. Please try again.');
    }
  }, []);

  const moveTo = useCallback((position: number, allowBackward: boolean) => {
    // Interim guesses only move forward so the highlight doesn't flicker back and forth.
    shown.current = allowBackward ? position : Math.max(shown.current, position);
    setCurrent(shown.current - 1);
  }, []);

  const handleResult = useCallback((result: DeepgramResult) => {
    const alternative = result.channel?.alternatives?.[0];
    if (!alternative) return;
    const timed = alternative.words;
    const { position, unmatched } = alignSpokenWords(wordsRef.current,
      [...carried.current, ...timed.map(w => w.word)], committed.current);
    if (result.is_final) {
      committed.current = position;
      carried.current = unmatched.slice(-MAX_CARRIED_WORDS);
    }
    // Measure how fast the reader is going, so the highlighter can keep up with them.
    if (timed.length >= 3) {
      const span = (timed[timed.length - 1].start - timed[0].start) * 1000;
      if (span > 300) {
        const sample = span / (timed.length - 1);
        paceRef.current = Math.min(MAX_PACE_MS, Math.max(MIN_PACE_MS, paceRef.current * 0.6 + sample * 0.4));
        setPace(Math.round(paceRef.current));
      }
    }
    moveTo(position, result.is_final);
    if (alternative.transcript) setHeard(alternative.transcript);
  }, [moveTo]);

  const teardown = useCallback((next: ReadAlongPhase, keepTake = true) => {
    session.current++;
    clearTimeout(closeTimer.current);
    try { stream?.stop(); } catch { /* Already stopped. */ }
    finishTake(keepTake);
    const ws = socket.current;
    socket.current = null;
    if (ws) {
      ws.onopen = ws.onmessage = ws.onerror = ws.onclose = null;
      if (ws.readyState === WebSocket.CONNECTING || ws.readyState === WebSocket.OPEN) ws.close();
    }
    queue.current = [];
    updatePhase(next);
  }, [finishTake, stream, updatePhase]);

  const start = useCallback(async () => {
    if (phaseRef.current !== 'idle' && phaseRef.current !== 'error') return;
    const id = ++session.current;
    setError('');
    setHeard('');
    setElapsed(0);
    committed.current = shown.current; // Resume from the highlighted word.
    carried.current = [];
    queue.current = [];
    updatePhase('connecting');
    try {
      const permission = await AudioModule.requestRecordingPermissionsAsync();
      if (id !== session.current) return;
      if (!permission.granted) throw new Error('Microphone access is off. Enable it in Settings.');
      const token = fetchDeepgramToken();
      token.catch(() => {}); // Awaited below; avoids an unhandled rejection while the mic starts.
      if (onRecordedRef.current) {
        take.current = { writer: null, failed: false, bytes: 0, rate: SAMPLE_RATE,
          startedAt: new Date().toISOString(), fromWord: shown.current };
      }
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
        teardown('error'); // Keeps the take: the audio so far is still worth saving.
        setError(closeMessage(event));
      };
    } catch (cause) {
      if (id !== session.current) return;
      teardown('error', false); // Nothing worth saving if the session never got going.
      setError(cause instanceof Error && cause.message ? cause.message : 'Read-along could not start. Please try again.');
    }
  }, [handleResult, script, stream, teardown, updatePhase]);

  const stop = useCallback(() => {
    if (phaseRef.current === 'connecting') return teardown('idle', false);
    if (phaseRef.current !== 'listening') return;
    try { stream.stop(); } catch { /* Already stopped. */ }
    const ws = socket.current;
    if (ws?.readyState !== WebSocket.OPEN) return teardown('idle');
    // CloseStream makes Deepgram flush final results for the last words; the take is
    // delivered once they arrive (or after the timeout), so it covers every word read.
    ws.send(JSON.stringify({ type: 'CloseStream' }));
    updatePhase('stopping');
    closeTimer.current = setTimeout(() => teardown('idle'), CLOSE_TIMEOUT_MS);
  }, [stream, teardown, updatePhase]);
  useEffect(() => { stopRef.current = stop; }, [stop]);

  /** Moves the highlight to a word (or before the first with -1), e.g. when the reader taps it. */
  const seek = useCallback((index: number) => {
    committed.current = index + 1;
    carried.current = [];
    moveTo(index + 1, true);
  }, [moveTo]);

  useEffect(() => {
    // iOS suspends the microphone in the background, so end the session cleanly (keeping the
    // take). Not on 'inactive': the microphone permission prompt makes the app briefly inactive.
    const subscription = AppState.addEventListener('change', next => {
      if (next === 'background') teardown('idle');
    });
    return () => {
      subscription.remove();
      teardown('idle');
    };
  }, [teardown]);

  return { words, phase, current, heard, error, pace, elapsed, start, stop, seek };
}
