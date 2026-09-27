import AsyncStorage from '@react-native-async-storage/async-storage';
import { useCallback, useEffect, useState } from 'react';

const KEY = 'tedtime.library-tab.v1';
// Screens unmount when switching tabs; this keeps the choice for the rest of the session.
let remembered: string | null = null;

/** The selected Library tab. Survives leaving the Library and app restarts. */
export function useLibraryTab<Tab extends string>(tabs: readonly Tab[], fallback: Tab) {
  const known = (value: string | null): value is Tab => value !== null && (tabs as readonly string[]).includes(value);
  const [tab, setTab] = useState<Tab>(known(remembered) ? remembered : fallback);

  // First visit since launch: restore the tab saved on this device.
  useEffect(() => {
    if (remembered) return;
    let live = true;
    void AsyncStorage.getItem(KEY).then(value => {
      if (!live || remembered || !(tabs as readonly string[]).includes(value ?? '')) return;
      remembered = value;
      setTab(value as Tab);
    }).catch(() => { /* Start on the fallback tab. */ });
    return () => { live = false; };
  }, [tabs]);

  const select = useCallback((next: Tab) => {
    remembered = next;
    setTab(next);
    void AsyncStorage.setItem(KEY, next).catch(() => { /* Still kept for this session. */ });
  }, []);

  return { tab, select };
}
