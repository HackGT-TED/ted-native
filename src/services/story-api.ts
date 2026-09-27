import { Platform } from 'react-native';
import { File, Paths } from 'expo-file-system';

/** Client for the Story SFX backend. See Backend/FRONTEND_HANDOFF.md. Nothing is stored server-side. */
const DEFAULT_API_BASE = 'https://backend-1opa.onrender.com';
export const API_BASE = (process.env.EXPO_PUBLIC_API_URL?.trim() || DEFAULT_API_BASE).replace(/\/+$/, '');
// Render + a sleeping server can take well over a minute.
const TIMEOUT_MS = 180_000;

export class StoryApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

export type StoryHashtag =
  | 'spooky' | 'calm' | 'funny' | 'adventure' | 'bedtime'
  | 'animals' | 'nature' | 'family' | 'magic';

export type StoryDescription = {
  audio: string | null;
  duration_seconds: number;
  transcript_text: string;
  description: string;
  hashtags: StoryHashtag[];
};

export type RenderedStory = {
  /** Playable local MP3: a file URI on native, an object URL on web. */
  uri: string;
  cueCount: number;
  durationSeconds: number;
  warnings: string | null;
};

type RequestOptions = { signal?: AbortSignal };

/** Wakes the server, which sleeps when idle. Safe to call and forget. */
export async function warmUp(): Promise<void> {
  try { await fetch(`${API_BASE}/health`); } catch { /* Best effort only. */ }
}

/**
 * Sends a recording to /stories/render and saves the mixed MP3 on the device.
 * Several recordings (a story's moments, in order) are joined by the server into one.
 */
export async function renderStory(recordingUris: string | string[], options: RequestOptions = {}): Promise<RenderedStory> {
  const response = await post('/stories/render', await audioForm(recordingUris), options);
  const header = (name: string) => response.headers.get(name);
  const blob = await response.blob();
  return {
    uri: await saveMp3(blob),
    cueCount: Number(header('X-Story-Cue-Count') ?? '0'),
    durationSeconds: Number(header('X-Story-Duration-Seconds') ?? '0'),
    warnings: header('X-Story-Warnings'),
  };
}

/** Sends a recording (or a story's moments, in order) to /stories/describe for a summary, hashtags, and transcript. */
export async function describeStory(recordingUris: string | string[], options: RequestOptions = {}): Promise<StoryDescription> {
  const response = await post('/stories/describe', await audioForm(recordingUris), options);
  return (await response.json()) as StoryDescription;
}

/** One repeated `audio` field per recording, in order; the server joins several into one. */
async function audioForm(uris: string | string[]): Promise<FormData> {
  const list = typeof uris === 'string' ? [uris] : uris;
  if (list.length === 0) throw new StoryApiError(0, 'Record at least one moment first.');
  const body = new FormData();
  for (const [index, uri] of list.entries()) {
    if (Platform.OS === 'web') {
      const source = await fetch(uri);
      if (!source.ok) throw new StoryApiError(0, 'The recording could not be read. Please record another take.');
      const blob = await source.blob();
      const extension = blob.type.includes('mp4') ? 'm4a' : blob.type.includes('ogg') ? 'ogg' : 'webm';
      body.append('audio', blob, `moment-${index + 1}.${extension}`);
    } else {
      // Expo's multipart encoder reads File bytes, not React Native URI objects.
      const file = new File(uri);
      if (!file.exists || file.size === 0) {
        throw new StoryApiError(0, 'The recording could not be read. Please record another take.');
      }
      body.append('audio', file);
    }
  }
  return body;
}

async function post(path: string, body: FormData, options: RequestOptions): Promise<Response> {
  const controller = new AbortController();
  const abort = () => controller.abort();
  options.signal?.addEventListener('abort', abort);
  if (options.signal?.aborted) controller.abort();
  let timedOut = false;
  const timer = setTimeout(() => { timedOut = true; controller.abort(); }, TIMEOUT_MS);
  try {
    // Let fetch set the multipart boundary.
    const response = await fetch(`${API_BASE}${path}`, { method: 'POST', body, signal: controller.signal });
    if (!response.ok) {
      let message = `The story server returned an error (${response.status}). Please try again.`;
      try { message = detailToMessage((await response.json()).detail) || message; } catch { /* Keep the default. */ }
      throw new StoryApiError(response.status, message);
    }
    return response;
  } catch (error) {
    if (error instanceof StoryApiError) throw error;
    if (timedOut) throw new StoryApiError(0, 'The story server took too long to respond. Please try again.');
    if (options.signal?.aborted) throw new StoryApiError(0, 'Cancelled.');
    throw new StoryApiError(0, 'Could not reach the story server. Check your connection and try again.');
  } finally {
    clearTimeout(timer);
    options.signal?.removeEventListener('abort', abort);
  }
}

/** FastAPI's detail is usually a string, but can be an object with message, or an array. */
function detailToMessage(detail: unknown): string {
  if (typeof detail === 'string') return detail;
  if (detail && typeof detail === 'object' && 'message' in detail) return String(detail.message);
  return detail === undefined ? '' : JSON.stringify(detail);
}

async function saveMp3(blob: Blob): Promise<string> {
  if (Platform.OS === 'web') return URL.createObjectURL(blob);
  // React Native has no Blob URLs, so write the bytes to disk via base64.
  const base64 = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(String(reader.result).split(',')[1] ?? '');
    reader.onerror = () => reject(new StoryApiError(0, 'The mixed story could not be saved on this device.'));
    reader.readAsDataURL(blob);
  });
  const file = new File(Paths.document, `story_${Date.now()}.mp3`);
  file.write(base64, { encoding: 'base64' });
  return file.uri;
}
