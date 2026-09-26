import { Platform } from 'react-native';
import { File } from 'expo-file-system';
import { supabase } from '../lib/supabase';
import type { RecordingSegment } from '../types/recording';

const restoredBrowserUris = new Map<string, string>();

// Native captures already live in Expo's document directory. Browser blob URLs
// are ephemeral, so store the bytes in IndexedDB before attempting an upload.
async function browserFile(id: string, blob?: Blob): Promise<Blob | undefined> {
  return new Promise((resolve, reject) => {
    const opening = indexedDB.open('tedtime-recordings', 1);
    opening.onblocked = () => reject(new Error('Close other TedTime tabs and retry saving.'));
    opening.onupgradeneeded = () => opening.result.createObjectStore('audio');
    opening.onerror = () => reject(opening.error);
    opening.onsuccess = () => {
      const db = opening.result;
      const transaction = db.transaction('audio', blob ? 'readwrite' : 'readonly');
      const request = blob ? transaction.objectStore('audio').put(blob, id) : transaction.objectStore('audio').get(id);
      transaction.oncomplete = () => { db.close(); resolve(blob ?? request.result); };
      transaction.onerror = () => { db.close(); reject(transaction.error); };
      transaction.onabort = () => { db.close(); reject(transaction.error); };
    };
  });
}

export async function preserveRecordingFile(id: string, uri: string) {
  if (Platform.OS === 'web') {
    const response = await fetch(uri);
    if (!response.ok) throw new Error('The local recording could not be read.');
    await browserFile(id, await response.blob());
  } else if (!new File(uri).exists || new File(uri).size === 0) {
    throw new Error('The local recording could not be read.');
  }
}

export async function localRecordingUri(segment: RecordingSegment): Promise<string | undefined> {
  if (Platform.OS !== 'web') {
    return segment.localUri && new File(segment.localUri).exists ? segment.localUri : undefined;
  }
  if (segment.localUri) {
    try { if ((await fetch(segment.localUri)).ok) return segment.localUri; } catch { /* Restore the stored bytes. */ }
  }
  const restored = restoredBrowserUris.get(segment.id);
  if (restored) return restored;
  const blob = await browserFile(segment.id);
  if (!blob) return undefined;
  const uri = URL.createObjectURL(blob);
  restoredBrowserUris.set(segment.id, uri);
  return uri;
}

export async function remoteRecordingUri(segment: RecordingSegment) {
  if (!supabase || !segment.storagePath) throw new Error('This recording is unavailable on this device. Try syncing it again.');
  const { data, error } = await supabase.storage.from('recordings').createSignedUrl(segment.storagePath, 3600);
  if (error || !data) throw new Error('Could not load this recording. Check your connection and try again.');
  return data.signedUrl;
}
