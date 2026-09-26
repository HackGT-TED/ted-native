import { Platform } from 'react-native';
import { File } from 'expo-file-system';
import type { Recording } from '../types/recording';
import { supabase } from '../lib/supabase';

type UploadOptions = {
  url?: string;
  signal?: AbortSignal;
  segment?: { id: string; createdAt: string; order: number; userId: string };
};

export type UploadedRecording = { id: string; path: string };

/** Sends one take. The API must accept multipart audio, title, and durationMs. */
export async function uploadRecording(recording: Recording, options: UploadOptions = {}): Promise<UploadedRecording> {
  const url = options.url ?? (process.env.EXPO_PUBLIC_UPLOAD_URL?.trim() || '/api/recordings');
  if (!/^https?:\/\//i.test(url) && !/^\/(?!\/)/.test(url)) {
    throw new Error('Uploads aren’t available yet. Please try again later.');
  }

  const controller = new AbortController();
  const abort = () => controller.abort();
  options.signal?.addEventListener('abort', abort);
  if (options.signal?.aborted) controller.abort();
  let timedOut = false;
  const timeout = setTimeout(() => { timedOut = true; controller.abort(); }, 120_000);

  try {
    if (!supabase) throw new Error('Uploads aren’t available yet. Please try again later.');
    const { data, error } = await supabase.auth.getSession();
    if (error || !data.session) throw new Error('Sign in to upload recordings.');
    if (options.segment && data.session.user.id !== options.segment.userId) throw new Error('Sign in to the account that owns this recording.');
    if (controller.signal.aborted) throw new Error('Upload cancelled.');
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
    body.append('durationMs', String(recording.duration));
    if (options.segment) {
      body.append('id', options.segment.id);
      body.append('recordedAt', options.segment.createdAt);
      body.append('position', String(options.segment.order));
    }
    if (controller.signal.aborted) throw new Error('Upload cancelled.');

    // Let fetch set Content-Type with the multipart boundary.
    const response = await fetch(url, {
      method: 'POST', body, signal: controller.signal,
      headers: { Authorization: `Bearer ${data.session.access_token}` },
    });
    if (!response.ok) {
      const details: unknown = await response.json().catch(() => null);
      if (details && typeof details === 'object' && 'error' in details && typeof details.error === 'string') {
        throw new Error(details.error);
      }
      throw new Error(response.status === 413
        ? 'This recording is too large to upload. Try a shorter take.'
        : `Upload failed (${response.status}). Please try again.`);
    }
    const result: unknown = await response.json();
    if (!result || typeof result !== 'object' || !('id' in result) || typeof result.id !== 'string'
      || !('path' in result) || typeof result.path !== 'string') {
      throw new Error('The upload was not confirmed. Please retry.');
    }
    return { id: result.id, path: result.path };
  } catch (error) {
    if (timedOut) throw new Error('The upload timed out. Please try again.');
    if (error instanceof TypeError) throw new Error('Could not connect. Check your connection and try again.');
    throw error;
  } finally {
    clearTimeout(timeout);
    options.signal?.removeEventListener('abort', abort);
  }
}
