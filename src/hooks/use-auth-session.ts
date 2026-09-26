import { useEffect, useState } from 'react';
import { AppState, Platform } from 'react-native';
import type { Session } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';

export function useAuthSession() {
  const [session, setSession] = useState<Session | null>(null);
  const [authLoading, setLoading] = useState(Boolean(supabase));
  const [authError, setError] = useState('');

  useEffect(() => {
    const client = supabase;
    if (!client) return;
    let live = true;
    let receivedEvent = false;
    // Keep this callback synchronous: Supabase auth calls here can deadlock.
    const { data: { subscription } } = client.auth.onAuthStateChange((_event, next) => {
      if (!live) return;
      receivedEvent = true;
      setSession(next);
      setLoading(false);
      setError('');
    });
    void client.auth.getSession().then(({ data, error }) => {
      if (!live || receivedEvent) return;
      setSession(data.session);
      setError(error ? 'Your session could not be restored. Please sign in again.' : '');
      setLoading(false);
    }).catch(() => {
      if (!live || receivedEvent) return;
      setError('Your session could not be restored. Please sign in again.');
      setLoading(false);
    });

    const refresh = (state: string) => {
      if (state === 'active') void client.auth.startAutoRefresh();
      else void client.auth.stopAutoRefresh();
    };
    const appState = Platform.OS !== 'web' ? AppState.addEventListener('change', refresh) : null;
    if (Platform.OS !== 'web') refresh(AppState.currentState);
    return () => {
      live = false;
      subscription.unsubscribe();
      appState?.remove();
      if (Platform.OS !== 'web') void client.auth.stopAutoRefresh();
    };
  }, []);

  return { session, authLoading, authError };
}
