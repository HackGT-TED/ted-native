import { Platform } from 'react-native';
import type { Recording } from '../context/studio';

type UploadOptions = {
  url?: string;
  signal?: AbortSignal;
};

/** Sends one take. The API must accept multipart audio, title, and durationMs. */
export async function uploadRecording(recording: Recording, options: UploadOptions = {}): Promise<void> {
  const url = options.url ?? process.env.EXPO_PUBLIC_UPLOAD_URL;
  if (!url || !/^https?:\/\//i.test(url)) {
    throw new Error('Uploads aren’t available yet. Please try again later.');
  }

  const controller = new AbortController();
  const abort = () => controller.abort();
  options.signal?.addEventListener('abort', abort);
  if (options.signal?.aborted) controller.abort();
  let timedOut = false;
  const timeout = setTimeout(() => { timedOut = true; controller.abort(); }, 120_000);

  try {
    const body = new FormData();
    if (Platform.OS === 'web') {
      const source = await fetch(recording.uri, { signal: controller.signal });
      if (!source.ok) throw new Error('The recording could not be read. Please record another take.');
      const blob = await source.blob();
      const extension = blob.type.includes('mp4') ? 'm4a' : blob.type.includes('ogg') ? 'ogg' : 'webm';
      body.append('audio', blob, `recording.${extension}`);
    } else {
      // React Native's FormData accepts local file URIs; DOM typings only describe Blob.
      body.append('audio', { uri: recording.uri, name: 'recording.m4a', type: 'audio/mp4' } as unknown as Blob);
    }
    body.append('title', recording.title);
    body.append('durationMs', String(recording.duration));
    if (controller.signal.aborted) throw new Error('Upload cancelled.');

    // Let fetch set Content-Type with the multipart boundary.
    const response = await fetch(url, { method: 'POST', body, signal: controller.signal });
    if (!response.ok) {
      throw new Error(response.status === 413
        ? 'This recording is too large to upload. Try a shorter take.'
        : `Upload failed (${response.status}). Please try again.`);
    }
  } catch (error) {
    if (timedOut) throw new Error('The upload timed out. Please try again.');
    if (error instanceof TypeError) throw new Error('Could not connect. Check your connection and try again.');
    throw error;
  } finally {
    clearTimeout(timeout);
    options.signal?.removeEventListener('abort', abort);
  }
}
