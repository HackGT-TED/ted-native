import { Platform } from 'react-native';
import { Directory, File, Paths } from 'expo-file-system';
import { supabase } from '../lib/supabase';
import type { RecordingSegment } from '../types/recording';
import { localRecordingUri, remoteRecordingUri } from './recording-files';
import { describeStory, renderStory } from './story-api';

export type PublishedAudio = {
  /** Storage path in the recordings bucket; all_stories requires <author>/<story id>/. */
  stereoAudioPath: string;
  description: string;
  /** The backend's hashtags, comma-separated for all_stories.category_tags. */
  categoryTags: string;
};

/**
 * Sends the story to the backend for the mixed MP3 and summary, then stores the MP3.
 * The database row is written afterwards by save_story with these values.
 */
export async function prepareStoryAudio(userId: string, storyId: string | null,
  segments: RecordingSegment[]): Promise<PublishedAudio> {
  if (segments.length === 0) throw new Error('Record at least one moment before publishing.');
  // Timeline order is playback order; the server joins the moments into one recording.
  const sources = await Promise.all(segments.map(sourceUri));
  const [rendered, summary] = await Promise.all([renderStory(sources), describeStory(sources)]);

  if (!supabase) throw new Error('Account storage is unavailable.');
  // A new name per publish: the bucket allows inserts only, not overwrites.
  const path = `${userId}/${storyId ?? userId}/story_${Date.now()}.mp3`;
  const bytes = Platform.OS === 'web'
    ? await (await fetch(rendered.uri)).blob()
    : await new File(rendered.uri).arrayBuffer();
  const { error } = await supabase.storage.from('recordings')
    .upload(path, bytes, { contentType: 'audio/mpeg', upsert: false });
  if (error) throw new Error('The story with sound effects could not be uploaded. Please retry.');

  return { stereoAudioPath: path, description: summary.description, categoryTags: summary.hashtags.join(',') };
}

/** The moment's audio as something the backend upload can read. */
async function sourceUri(segment: RecordingSegment): Promise<string> {
  const local = await localRecordingUri(segment);
  if (local) return local;
  const remote = await remoteRecordingUri(segment);
  if (Platform.OS === 'web') return remote;
  // Native uploads need a file on disk, so fetch the synced copy first.
  const file = await File.downloadFileAsync(remote, new Directory(Paths.cache), { idempotent: true });
  return file.uri;
}
