import { useCallback, useRef, useState } from 'react';
import { AppState, Keyboard } from 'react-native';
import { useFocusEffect } from 'expo-router';
import type { DragEndParams } from 'react-native-draggable-flatlist';
import type { RecordingSegment } from '../types/recording';

type DragSession = { owner: string | null; items: RecordingSegment[] };

export function useSegmentDrag(segments: RecordingSegment[], owner: string | null, enabled: boolean,
  move: (id: string, beforeId: string | null) => void, stopPlayback: () => void) {
  const [snapshot, setSnapshot] = useState<DragSession | null>(null);
  const [generation, setGeneration] = useState(0);
  const active = useRef<DragSession | null>(null);
  const cancel = useCallback(() => {
    if (!active.current) return;
    active.current = null;
    setSnapshot(null);
    setGeneration(value => value + 1); // Dispose a cancelled native gesture.
  }, []);

  useFocusEffect(useCallback(() => {
    if (active.current && active.current.owner !== owner) cancel();
    const subscription = AppState.addEventListener('change', state => { if (state !== 'active') cancel(); });
    return () => { subscription.remove(); cancel(); };
  }, [cancel, owner]));

  const onDragBegin = useCallback(() => {
    if (!enabled || active.current) return;
    Keyboard.dismiss();
    stopPlayback();
    const session = { owner, items: segments };
    active.current = session;
    setSnapshot(session);
  }, [enabled, owner, segments, stopPlayback]);

  const onDragEnd = useCallback(({ data, from, to }: DragEndParams<RecordingSegment>) => {
    const session = active.current;
    active.current = null;
    setSnapshot(null);
    if (!session || session.owner !== owner || !enabled || from === to || !data[to]) return;
    // Apply only the requested move to live state; never replace it with stale
    // drag data that could discard a concurrent upload, deletion, or refetch.
    move(data[to].id, data[to + 1]?.id ?? null);
  }, [enabled, move, owner]);

  const current = snapshot?.owner === owner ? snapshot : null;
  return { data: current?.items ?? segments, dragging: Boolean(current), generation, onDragBegin, onDragEnd };
}
