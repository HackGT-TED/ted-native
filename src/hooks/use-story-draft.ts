import AsyncStorage from '@react-native-async-storage/async-storage';
import { useCallback, useEffect, useRef, useState } from 'react';

type Draft = {
  key: string;
  name: string;
  status: 'ready' | 'saving' | 'error' | 'load-error';
};

/** The current draft's name is local and separate from individual audio titles. */
export function useStoryDraft(userId: string | null, authLoading: boolean) {
  const key = `tedtime.story-draft.v1.${userId ?? 'guest'}`;
  const [draft, setDraft] = useState<Draft | null>(null);
  const [reload, setReload] = useState(0);
  const writes = useRef(Promise.resolve());

  useEffect(() => {
    if (authLoading) return;
    let live = true;
    // Finish queued edits before restoring an account that was just switched.
    void writes.current.then(() => AsyncStorage.getItem(key)).then(name => {
      if (live) setDraft({ key, name: name ?? '', status: 'ready' });
    }).catch(() => {
      if (live) setDraft({ key, name: '', status: 'load-error' });
    });
    return () => { live = false; };
  }, [authLoading, key, reload]);

  const saveName = useCallback((value: string) => {
    const name = value.slice(0, 80);
    setDraft({ key, name, status: 'saving' });
    const updateStatus = (status: Draft['status']) => setDraft(current =>
      current?.key === key && current.name === name ? { ...current, status } : current);
    writes.current = writes.current.then(async () => {
      await AsyncStorage.setItem(key, name);
      updateStatus('ready');
    }).catch(() => updateStatus('error'));
  }, [key]);

  const current = !authLoading && draft?.key === key ? draft : null;
  return {
    name: current?.name ?? '',
    loading: !current,
    editable: Boolean(current && current.status !== 'load-error'),
    saving: current?.status === 'saving',
    error: current?.status === 'load-error' ? 'Your story name could not be loaded.'
      : current?.status === 'error' ? 'Your story name could not be saved on this device.' : '',
    saveName,
    retry: () => current?.status === 'load-error' ? setReload(value => value + 1) : saveName(current?.name ?? ''),
  };
}
