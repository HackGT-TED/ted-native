import { supabase } from '../lib/supabase';
import type { RecordingSegment } from '../types/recording';

function syncError(error: { code?: string; message?: string }) {
  const code = error.code ?? '';
  let reason = 'Please check your connection and retry.';
  if (['42501', 'PGRST301', 'PGRST302', 'PGRST303'].includes(code)) {
    reason = code === '42501'
      ? 'Your account does not have permission to save segment changes.'
      : 'Your session expired. Please sign in again.';
  } else if (['42703', '42P01', 'PGRST204', 'PGRST205'].includes(code)) {
    reason = 'Story syncing needs a database update before changes can be saved.';
  } else if (code === '23514') {
    reason = 'The database rejected this segment’s saved details.';
  } else if (code === '23505') {
    reason = 'This segment conflicts with another saved segment.';
  } else if (code === '22003' || code === '22P02') {
    reason = 'The database rejected this segment’s position or other saved details.';
  }
  // Keep database details (which can contain titles and row data) out of logs/UI.
  // A stable error code lets us diagnose failures without exposing story content.
  const reference = /^[A-Z0-9]{5,10}$/.test(code) ? ` (${code})` : '';
  return new Error(`Your change is saved on this device but could not sync. ${reason}${reference}`);
}

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
    if (error) throw syncError(error);
  } else {
    const fields = {
      ...(segment.pendingChange !== 'reorder' ? { title: segment.title } : {}),
      ...(segment.pendingChange === 'reorder' || segment.pendingChange === 'edit' ? { position: segment.order } : {}),
    };
    const { data, error } = await supabase.from('recording_segments').update(fields)
      .eq('user_id', segment.userId).eq('id', segment.id).is('deleted_at', null)
      .select('id').abortSignal(signal);
    if (error) throw syncError(error);
    if (!data?.length) {
      // A filtered UPDATE can succeed without updating a row (including when
      // an update policy hides it). Do not clear the pending local change.
      const { data: current, error: readError } = await supabase.from('recording_segments')
        .select('id,deleted_at').eq('user_id', segment.userId).eq('id', segment.id).abortSignal(signal);
      if (readError) throw syncError(readError);
      const reason = !current?.length
        ? 'This segment is missing from your account or is no longer accessible.'
        : current[0].deleted_at
          ? 'This segment was deleted from your account. Refresh the timeline.'
          : 'Your account can read this segment, but cannot update it. Check the segment update policy.';
      throw new Error(`Your change is saved on this device but could not sync. ${reason}`);
    }
  }
}
