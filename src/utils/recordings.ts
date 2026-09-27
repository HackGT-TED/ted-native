import type { RecordingSegment } from '../types/recording';

export function formatDuration(milliseconds: number) {
  const seconds = Math.floor(Math.max(0, milliseconds) / 1000);
  return `${Math.floor(seconds / 60).toString().padStart(2, '0')}:${(seconds % 60).toString().padStart(2, '0')}`;
}

export function recordingDayKey(timestamp: string) {
  const date = new Date(timestamp);
  return `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
}

export function formatRecordingDay(timestamp: string, now = new Date()) {
  if (recordingDayKey(timestamp) === recordingDayKey(now.toISOString())) return 'Today';
  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  if (recordingDayKey(timestamp) === recordingDayKey(yesterday.toISOString())) return 'Yesterday';
  const date = new Date(timestamp);
  return date.toLocaleDateString(undefined, {
    month: 'long', day: 'numeric',
    ...(date.getFullYear() !== now.getFullYear() ? { year: 'numeric' as const } : {}),
  });
}

export function formatRecordingTime(timestamp: string) {
  return new Date(timestamp).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
}

export function sortSegments(segments: RecordingSegment[]) {
  return [...segments].sort((a, b) => (a.order ?? Date.parse(a.createdAt)) - (b.order ?? Date.parse(b.createdAt))
    || Date.parse(a.createdAt) - Date.parse(b.createdAt) || a.id.localeCompare(b.id));
}

/** A late refetch must not erase a newly captured file or a pending upload. */
export function mergeSegments(local: RecordingSegment[], remote: RecordingSegment[]) {
  const merged = new Map(local.map(segment => [segment.id, segment]));
  for (const segment of remote) {
    const previous = merged.get(segment.id);
    merged.set(segment.id, {
      ...previous, ...segment, localUri: previous?.localUri,
      title: previous?.pendingChange ? previous.title : segment.title,
      order: previous?.pendingChange === 'reorder' || previous?.pendingChange === 'edit' ? previous.order : segment.order,
      deletedAt: previous?.deletedAt ?? segment.deletedAt,
    });
  }
  return sortSegments([...merged.values()]);
}

/** Move within the current draft without replacing metadata from a drag snapshot. */
export function moveSegmentBefore(segments: RecordingSegment[], id: string, beforeId: string | null) {
  const moving = segments.find(item => item.id === id);
  if (!moving || id === beforeId) return segments;
  const remaining = segments.filter(item => item.id !== id);
  const index = beforeId === null ? remaining.length : remaining.findIndex(item => item.id === beforeId);
  if (index < 0) return segments;
  const result = [...remaining];
  result.splice(index, 0, moving);
  if (result.every((item, i) => item.id === segments[i].id)) return segments;

  // Usually only one row needs an update. Re-space integer positions only when
  // repeated moves exhaust the gap between neighbors (Postgres stores bigint).
  const previous = result[index - 1]?.order ?? -1;
  const next = result[index + 1]?.order;
  const order = next === undefined ? previous + 1024 : previous + Math.floor((next - previous) / 2);
  if (Number.isSafeInteger(order) && order >= 0 && order > previous && (next === undefined || order < next)) {
    result[index] = { ...moving, order };
    return result;
  }
  return result.map((item, i) => item.order === (i + 1) * 1024 ? item : { ...item, order: (i + 1) * 1024 });
}

// Project IDs identify drafts; authentication and ownership are enforced separately.
export function newProjectId() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, character => {
    const value = Math.floor(Math.random() * 16);
    return (character === 'x' ? value : (value & 3) | 8).toString(16);
  });
}
