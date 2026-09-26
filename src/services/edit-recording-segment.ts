import { supabase } from '../lib/supabase';
import type { RecordingSegment } from '../types/recording';

export async function syncSegmentChange(segment: RecordingSegment) {
  if (!supabase || !segment.userId) throw new Error('Sign in to sync your changes.');
  const { data: auth, error: authError } = await supabase.auth.getSession();
  if (authError || auth.session?.user.id !== segment.userId) throw new Error('Sign in to the account that owns this segment.');
  const signal = AbortSignal.timeout(30_000);
  if (segment.deletedAt) {
    // Keep a deletion marker even when an earlier upload's response was lost.
    // A late POST uses ignoreDuplicates, so it cannot resurrect this segment.
    const { error } = await supabase.from('recording_segments').upsert({
      id: segment.id, user_id: segment.userId, title: segment.title,
      creation_session_id: segment.creationSessionId, storage_path: segment.storagePath ?? null,
      duration_ms: segment.durationMs, recorded_at: segment.createdAt,
      position: segment.order, deleted_at: segment.deletedAt,
    }, { onConflict: 'user_id,id' }).abortSignal(signal);
    if (error) throw new Error('The deletion is saved on this device but could not sync. Please retry.');
  } else {
    const fields = {
      ...(segment.pendingChange !== 'reorder' ? { title: segment.title } : {}),
      ...(segment.pendingChange === 'reorder' || segment.pendingChange === 'edit' ? { position: segment.order } : {}),
    };
    const { data, error } = await supabase.from('recording_segments').update(fields)
      .eq('user_id', segment.userId).eq('id', segment.id).is('deleted_at', null)
      .select('id').abortSignal(signal);
    if (error || !data?.length) throw new Error('The change is saved on this device but could not sync. Please retry.');
  }
}
