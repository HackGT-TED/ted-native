import { Platform } from 'react-native';
import { File } from 'expo-file-system';
import type { Recording } from '../context/studio';

/** Response of the Python backend's POST /stories/transcribe (see Backend/app/schemas/api.py TranscriptOut). */
export type TranscriptResult = {
  transcript_text: string;
  duration_seconds: number;
  words: { word: string; start: number; end: number }[];
  segments: { text: string; start: number; end: number }[];
  deepgram: Record<string, unknown>;
};

type ProcessOptions = {
  signal?: AbortSignal;
};

/** Sends one take to the Python backend and returns its transcript JSON. */
export async function processStory(recording: Recording, options: ProcessOptions = {}): Promise<TranscriptResult> {
  const apiUrl = process.env.EXPO_PUBLIC_API_URL?.trim().replace(/\/+$/, '');
  if (!apiUrl) throw new Error('The story server isn’t configured yet. Set EXPO_PUBLIC_API_URL.');

  const controller = new AbortController();
  const abort = () => controller.abort();
  options.signal?.addEventListener('abort', abort);
  if (options.signal?.aborted) controller.abort();
  let timedOut = false;
  // Transcription waits on Gladia/Deepgram, so allow longer than a plain upload.
  const timeout = setTimeout(() => { timedOut = true; controller.abort(); }, 180_000);

  try {
    const body = new FormData();
    if (Platform.OS === 'web') {
      const source = await fetch(recording.uri, { signal: controller.signal });
      if (!source.ok) throw new Error('The recording could not be read. Please record another take.');
      const blob = await source.blob();
      const extension = blob.type.includes('mp4') ? 'm4a' : blob.type.includes('ogg') ? 'ogg' : 'webm';
      body.append('audio', blob, `recording.${extension}`);
    } else {
      // Expo's multipart encoder reads File/Blob bytes, not React Native URI objects.
      const file = new File(recording.uri);
      if (!file.exists || file.size === 0) {
        throw new Error('The recording could not be read. Please record another take.');
      }
      body.append('audio', file);
    }
    body.append('title', recording.title);

    // Let fetch set Content-Type with the multipart boundary.
    const response = await fetch(`${apiUrl}/stories/transcribe`, {
      method: 'POST', body, signal: controller.signal,
    });
    if (!response.ok) {
      // FastAPI errors look like {"detail": "..."}.
      const details: unknown = await response.json().catch(() => null);
      if (details && typeof details === 'object' && 'detail' in details && typeof details.detail === 'string') {
        throw new Error(details.detail);
      }
      throw new Error(`The story server returned an error (${response.status}). Please try again.`);
    }
    return (await response.json()) as TranscriptResult;
  } catch (error) {
    if (timedOut) throw new Error('The story server took too long to respond. Please try again.');
    if (error instanceof TypeError) throw new Error('Could not reach the story server. Check your connection and try again.');
    throw error;
  } finally {
    clearTimeout(timeout);
    options.signal?.removeEventListener('abort', abort);
  }
}
