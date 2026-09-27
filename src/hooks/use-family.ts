import { useCallback, useEffect, useRef, useState } from 'react';
import { supabase } from '../lib/supabase';

export type FamilyMember = { id: string; username: string | null; full_name: string | null; is_me: boolean };
export type Family = { id: string; name: string; invite_code: string; members: FamilyMember[] };

type State = { owner: string | null; family: Family | null; loading: boolean; error: string };

/** Database messages from the family functions are written for people; keep them, drop the rest. */
function readable(cause: unknown, fallback: string) {
  const message = cause && typeof cause === 'object' && 'message' in cause ? String(cause.message) : '';
  return /family|code|name|sign in/i.test(message) && message.length < 120 ? message.replace(/\.?$/, '.') : fallback;
}

/** The signed-in user's family (at most one), with create, join, and leave. */
export function useFamily(userId: string | null, authLoading: boolean) {
  const [state, setState] = useState<State>({ owner: null, family: null, loading: false, error: '' });
  const [busy, setBusy] = useState(false);
  const generation = useRef(0);

  const refresh = useCallback(async () => {
    const request = ++generation.current;
    if (authLoading || !userId) return;
    setState(current => ({ owner: userId, family: current.owner === userId ? current.family : null, loading: true, error: '' }));
    try {
      if (!supabase) throw new Error('Account storage is unavailable.');
      const { data, error } = await supabase.rpc('get_my_family');
      if (error) throw error;
      if (request === generation.current) setState({ owner: userId, family: (data as Family | null) ?? null, loading: false, error: '' });
    } catch {
      if (request === generation.current) {
        setState(current => ({ ...current, loading: false, error: 'Could not load your family. Please retry.' }));
      }
    }
  }, [authLoading, userId]);

  useEffect(() => {
    // Account changes start an external database read and expose its loading state.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void refresh();
    const requests = generation;
    return () => { requests.current++; };
  }, [refresh]);

  /** Runs one family action; the family it returns replaces the current one. */
  const run = useCallback(async (action: () => PromiseLike<{ data: unknown; error: unknown }>, fallback: string) => {
    if (!supabase || !userId) throw new Error('Sign in to manage your family.');
    setBusy(true);
    try {
      const { data, error } = await action();
      if (error) throw new Error(readable(error, fallback));
      generation.current++;
      setState({ owner: userId, family: (data as Family | null) ?? null, loading: false, error: '' });
    } finally {
      setBusy(false);
    }
  }, [userId]);

  const create = useCallback((name: string) => {
    if (!name.trim()) return Promise.reject(new Error('Give your family a name.'));
    return run(() => supabase!.rpc('create_family', { p_name: name.trim() }), 'Could not start your family. Please retry.');
  }, [run]);
  const join = useCallback((code: string) => {
    if (code.replace(/[^a-z0-9]/gi, '').length !== 6) return Promise.reject(new Error('Enter the 6-character code.'));
    return run(() => supabase!.rpc('join_family', { p_code: code }), 'Could not join that family. Please retry.');
  }, [run]);
  const leave = useCallback(() => run(() => supabase!.rpc('leave_family'), 'Could not leave your family. Please retry.'), [run]);

  const current = !authLoading && state.owner === userId;
  return {
    family: current ? state.family : null,
    loading: authLoading || Boolean(userId && (state.owner !== userId || state.loading)),
    error: current ? state.error : '',
    busy,
    refresh,
    create,
    join,
    leave,
  };
}
