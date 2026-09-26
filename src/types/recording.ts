/** A finalized local file, before it is inserted into the draft timeline. */
export type Recording = { uri: string; title: string; duration: number; recordedAt?: string };

export type RecordingSegment = {
  id: string;
  userId: string | null;
  /** null is the user's legacy draft; new stories have their own project UUID. */
  creationSessionId: string | null;
  localUri?: string;
  storagePath?: string;
  title: string;
  createdAt: string;
  durationMs: number;
  order: number;
  status: 'local' | 'uploading' | 'uploaded' | 'processing' | 'ready' | 'error';
  error?: string;
  deletedAt?: string;
  pendingChange?: 'rename' | 'reorder' | 'edit' | 'delete';
  changeError?: string;
};

export type RecordingRow = {
  id: string;
  user_id: string;
  creation_session_id: string | null;
  storage_path: string | null;
  title: string;
  recorded_at: string;
  duration_ms: number;
  position: number;
  deleted_at?: string | null;
};
