import AsyncStorage from '@react-native-async-storage/async-storage';
import { useCallback, useEffect, useRef, useState } from 'react';
import { supabase } from '../lib/supabase';
import { localRecordingUri, preserveRecordingFile } from '../services/recording-files';
import { uploadRecording } from '../services/upload-recording';
import { syncSegmentChange } from '../services/edit-recording-segment';
import type { Recording, RecordingRow, RecordingSegment } from '../types/recording';
import { mergeSegments, moveSegmentBefore, sortSegments } from '../utils/recordings';

const CACHE_KEY = 'tedtime.recording-segments.v1';

export function useRecordingSegments(userId: string | null, authLoading: boolean, projectId: string | null = null) {
  const [all, setAll] = useState<RecordingSegment[]>([]);
  const allRef = useRef(all);
  const [loaded, setLoaded] = useState(false);
  const [loadingRemote, setLoadingRemote] = useState(false);
  const [error, setError] = useState('');
  const [diskError, setDiskError] = useState('');
  const writeQueue = useRef(Promise.resolve());
  const preparing = useRef(new Set<string>());
  const uploads = useRef(new Map<string, AbortController>());
  const changes = useRef(new Set<string>());
  const revisions = useRef(new Map<string, number>());
  const refreshes = useRef(new Set<string>());
  const activeUser = useRef(userId);
  useEffect(() => { activeUser.current = userId; }, [userId]);

  const persist = useCallback((items: RecordingSegment[]) => {
    // Serialize writes so an older snapshot cannot overwrite a newer take.
    writeQueue.current = writeQueue.current.then(async () => {
      await AsyncStorage.setItem(CACHE_KEY, JSON.stringify(items));
      setDiskError('');
    }).catch(() => setDiskError('Device storage is full or unavailable. Keep the app open and retry saving.'));
  }, []);

  const commit = useCallback((update: (items: RecordingSegment[]) => RecordingSegment[]) => {
    const next = update(allRef.current);
    allRef.current = next;
    setAll(next);
    persist(next);
  }, [persist]);

  const restore = useCallback(async () => {
    try {
      const raw = await AsyncStorage.getItem(CACHE_KEY);
      const cached: RecordingSegment[] = raw ? JSON.parse(raw) : [];
      if (!Array.isArray(cached) || cached.some(item => !item || typeof item.id !== 'string'
        || (item.userId !== null && typeof item.userId !== 'string')
        || !Number.isFinite(item.durationMs) || item.durationMs <= 0
        || !Number.isSafeInteger(item.order) || item.order < 0
        || !Number.isFinite(Date.parse(item.createdAt)))) {
        throw new Error('Invalid cache');
      }
      const recovered = cached.map(item => ({ ...item, status: item.status === 'uploading' ? 'local' as const : item.status }));
      // Preserve any captures or sync results that arrived during a delayed
      // hydration (including React development effect replay).
      const merged = sortSegments([...new Map([...recovered, ...allRef.current].map(item => [item.id, item])).values()]);
      allRef.current = merged;
      setAll(merged);
      setLoaded(true);
      setDiskError('');
    } catch {
      setDiskError('Your saved timeline could not be opened. Retry loading before recording more.');
    }
  }, []);
  // Hydrate the external device store once before accepting captures.
  useEffect(() => { void restore(); }, [restore]);

  const refresh = useCallback(async () => {
    if (!userId || !supabase || refreshes.current.has(userId)) return;
    refreshes.current.add(userId);
    const initialRevisions = new Map(revisions.current);
    const pendingIds = new Set(allRef.current.filter(item => item.pendingChange).map(item => item.id));
    setLoadingRemote(true);
    setError('');
    try {
      // Pagination avoids silently losing older takes at Supabase's row limit.
      const remote: RecordingSegment[] = [];
      for (let offset = 0; ; offset += 500) {
        const { data, error: queryError } = await supabase.from('recording_segments')
          .select('id,user_id,creation_session_id,storage_path,title,recorded_at,duration_ms,position,deleted_at')
          .eq('user_id', userId)
          .order('position').order('id').range(offset, offset + 499);
        if (queryError) throw queryError;
        for (const row of (data ?? []) as RecordingRow[]) remote.push({
          id: row.id, userId: row.user_id, creationSessionId: row.creation_session_id,
          storagePath: row.storage_path ?? undefined, deletedAt: row.deleted_at ?? undefined, title: row.title, createdAt: row.recorded_at,
          durationMs: row.duration_ms, order: row.position, status: 'uploaded',
        });
        if (!data || data.length < 500) break;
      }
      if (activeUser.current === userId) commit(items => mergeSegments(items, remote.filter(item => !pendingIds.has(item.id)
        && revisions.current.get(item.id) === initialRevisions.get(item.id))));
    } catch {
      if (activeUser.current === userId) setError('Could not sync your timeline. Your local recordings are still here.');
    } finally {
      refreshes.current.delete(userId);
      if (activeUser.current === userId) setLoadingRemote(false);
    }
  }, [commit, userId]);

  useEffect(() => {
    // Reset the remote subscription when the authenticated owner changes.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setError('');
    setLoadingRemote(false);
    if (loaded && !authLoading) void refresh();
    const pending = uploads.current;
    return () => { for (const controller of pending.values()) controller.abort(); };
  }, [authLoading, loaded, refresh]);

  const upload = useCallback(async (id: string) => {
    const segment = allRef.current.find(item => item.id === id);
    if (!segment?.userId || segment.userId !== activeUser.current || segment.deletedAt || uploads.current.has(id)) return;
    const controller = new AbortController();
    uploads.current.set(id, controller);
    const patch = (changes: Partial<RecordingSegment>) => commit(items => items.map(item => item.id === id ? { ...item, ...changes } : item));
    patch({ status: 'uploading', error: undefined });
    try {
      const uri = await localRecordingUri(segment);
      if (!uri) throw new Error('The local audio is unavailable. Sync the timeline to recover a stored copy.');
      // A full device/browser disk must not prevent the available bytes from
      // being rescued remotely. The local persistence error remains visible.
      try { await preserveRecordingFile(id, uri); } catch { /* Still attempt the upload. */ }
      const result = await uploadRecording({ uri, title: segment.title, duration: segment.durationMs }, {
        signal: controller.signal,
        segment: { id, createdAt: segment.createdAt, order: segment.order, userId: segment.userId, creationSessionId: segment.creationSessionId },
      });
      patch({ status: 'uploaded', storagePath: result.path, localUri: uri });
    } catch (cause) {
      patch({ status: 'error', error: controller.signal.aborted ? 'Upload paused. Sign in to this account and retry.'
        : cause instanceof Error ? cause.message : 'Could not upload. Your recording is still on this device.' });
    } finally {
      uploads.current.delete(id);
    }
  }, [commit]);

  const syncChange = useCallback(async (id: string) => {
    const segment = allRef.current.find(item => item.id === id);
    if (!segment?.pendingChange || segment.userId !== activeUser.current || !segment.userId
      || changes.current.has(id) || uploads.current.has(id) || preparing.current.has(id)) return;
    if (!segment.deletedAt && !segment.storagePath) return; // Rename follows initial upload.
    const revision = revisions.current.get(id);
    changes.current.add(id);
    let changeError: string | undefined;
    try { await syncSegmentChange(segment); }
    catch (cause) { changeError = cause instanceof Error ? cause.message : 'Could not sync this change. Please retry.'; }
    finally {
      changes.current.delete(id);
      commit(items => items.map(item => item.id === id && revisions.current.get(id) === revision
        ? { ...item, pendingChange: changeError ? item.pendingChange : undefined, changeError } : item));
    }
  }, [commit]);

  useEffect(() => {
    if (!loaded || authLoading) return;
    for (const segment of all) {
      if (segment.userId === userId && segment.pendingChange && !segment.changeError) void syncChange(segment.id);
    }
  }, [all, authLoading, loaded, syncChange, userId]);

  const rename = useCallback((id: string, value: string) => {
    const title = value.trim();
    if (!title || title.length > 80) return;
    const segment = allRef.current.find(item => item.id === id);
    if (!segment || segment.deletedAt || segment.userId !== activeUser.current) return;
    revisions.current.set(id, (revisions.current.get(id) ?? 0) + 1);
    commit(items => items.map(item => item.id === id
      ? { ...item, title, pendingChange: item.userId ? (item.pendingChange === 'reorder' || item.pendingChange === 'edit' ? 'edit' : 'rename') : undefined, changeError: undefined } : item));
  }, [commit]);

  const move = useCallback((id: string, beforeId: string | null) => {
    const owner = activeUser.current;
    const current = sortSegments(allRef.current.filter(item => !item.deletedAt && item.userId === owner && item.creationSessionId === projectId));
    const reordered = moveSegmentBefore(current, id, beforeId);
    if (reordered === current) return;
    const positions = new Map(reordered.map(item => [item.id, item.order]));
    commit(items => sortSegments(items.map(item => {
      const order = positions.get(item.id);
      if (order === undefined || order === item.order) return item;
      revisions.current.set(item.id, (revisions.current.get(item.id) ?? 0) + 1);
      return { ...item, order, changeError: undefined,
        pendingChange: item.userId ? (item.pendingChange === 'rename' || item.pendingChange === 'edit' ? 'edit' as const : 'reorder' as const) : undefined };
    })));
  }, [commit, projectId]);

  const remove = useCallback((id: string) => {
    const segment = allRef.current.find(item => item.id === id);
    if (!segment || segment.deletedAt || segment.userId !== activeUser.current) return;
    revisions.current.set(id, (revisions.current.get(id) ?? 0) + 1);
    commit(items => items.map(item => item.id === id
      ? { ...item, deletedAt: new Date().toISOString(), pendingChange: item.userId ? 'delete' : undefined, changeError: undefined } : item));
  }, [commit]);

  useEffect(() => {
    if (!loaded || authLoading) return;
    for (const segment of all) {
      if (!segment.deletedAt && segment.userId === userId && userId && segment.status === 'local' && !preparing.current.has(segment.id)) void upload(segment.id);
    }
  }, [all, authLoading, loaded, upload, userId]);

  const addRecording = useCallback(async (recording: Recording) => {
    const id = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`;
    const createdAt = recording.recordedAt ?? new Date().toISOString();
    const lastOrder = allRef.current.filter(item => item.userId === userId).reduce((max, item) => Math.max(max, item.order), 0);
    const segment: RecordingSegment = {
      id, userId, creationSessionId: projectId, localUri: recording.uri,
      title: recording.title || 'A story moment', createdAt, durationMs: recording.duration,
      order: Math.max(Date.parse(createdAt), lastOrder + 1), status: 'local',
    };
    preparing.current.add(id);
    commit(items => sortSegments([...items, segment]));
    try {
      await preserveRecordingFile(id, recording.uri);
    } catch {
      commit(items => items.map(item => item.id === id ? { ...item, error: 'Could not save audio on this device. Keep the app open and retry.' } : item));
    } finally {
      preparing.current.delete(id);
      // A new array wakes the upload effect after local file persistence.
      commit(items => [...items]);
    }
  }, [commit, projectId, userId]);

  const retry = useCallback(async (id: string) => {
    const segment = allRef.current.find(item => item.id === id);
    if (!segment || preparing.current.has(id)) return;
    if (segment.pendingChange && (segment.deletedAt || segment.storagePath)) { await syncChange(id); return; }
    if (segment.userId) { await upload(id); return; }
    try {
      if (!segment.localUri) throw new Error('Missing audio');
      await preserveRecordingFile(id, segment.localUri);
      commit(items => items.map(item => item.id === id ? { ...item, error: undefined } : item));
    } catch { setDiskError('Could not save the local audio. Keep this page open and try again.'); }
  }, [commit, syncChange, upload]);

  const claimGuestRecordings = useCallback(() => {
    if (!userId) return;
    commit(items => items.map(item => !item.deletedAt && item.userId === null ? { ...item, userId, status: 'local', error: undefined } : item));
  }, [commit, userId]);

  const projectMap = new Map<string | null, { id: string | null; createdAt: string; moments: number }>();
  for (const segment of all) {
    if (segment.deletedAt || segment.userId !== userId) continue;
    const project = projectMap.get(segment.creationSessionId);
    if (project) {
      project.moments++;
      if (segment.createdAt < project.createdAt) project.createdAt = segment.createdAt;
    } else {
      projectMap.set(segment.creationSessionId, { id: segment.creationSessionId, createdAt: segment.createdAt, moments: 1 });
    }
  }
  const projects = [...projectMap.values()].sort((a, b) => b.createdAt.localeCompare(a.createdAt));

  return {
    projects,
    syncPending: all.some(item => item.userId === userId && item.creationSessionId === projectId
      && (item.pendingChange || (!item.deletedAt && (!item.storagePath || item.status === 'uploading')))),
    segments: all.filter(item => !item.deletedAt && item.userId === userId && item.creationSessionId === projectId),
    guestCount: userId ? all.filter(item => !item.deletedAt && item.userId === null).length : 0,
    claimGuestRecordings, addRecording, retry, refresh, rename, remove, move,
    deletionSyncError: all.some(item => item.userId === userId && item.deletedAt && item.changeError),
    retryDeletions: () => {
      for (const item of allRef.current) if (item.userId === userId && item.deletedAt && item.pendingChange) void syncChange(item.id);
    },
    loading: !loaded || authLoading || loadingRemote, ready: loaded && !authLoading,
    error, diskError, retryLocalSave: () => loaded ? persist(allRef.current) : void restore(),
  };
}
