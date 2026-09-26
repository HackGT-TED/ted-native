import { useEffect, useRef, useState } from 'react';
import type { Recording } from '../context/studio';
import { uploadRecording } from '../services/upload-recording';

type UploadState = { uri: string; status: 'uploading' | 'uploaded' | 'error'; error?: string };

export function useRecordingUpload(recording: Recording | null) {
  const request = useRef<AbortController | null>(null);
  const [state, setState] = useState<UploadState | null>(null);
  const uri = recording?.uri;

  useEffect(() => () => {
    request.current?.abort();
    request.current = null;
  }, [uri]);

  const current = state?.uri === uri ? state : null;
  async function upload() {
    if (!recording || request.current || current?.status === 'uploaded') return;
    const controller = new AbortController();
    request.current = controller;
    setState({ uri: recording.uri, status: 'uploading' });
    try {
      await uploadRecording(recording, { signal: controller.signal });
      if (!controller.signal.aborted) setState({ uri: recording.uri, status: 'uploaded' });
    } catch (error) {
      if (!controller.signal.aborted) setState({
        uri: recording.uri, status: 'error',
        error: error instanceof Error ? error.message : 'Upload failed. Please try again.',
      });
    } finally {
      if (request.current === controller) request.current = null;
    }
  }
  return { status: current?.status ?? 'idle', error: current?.error, upload };
}
