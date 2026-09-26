import { useCallback, useEffect, useRef, useState } from 'react';
import { supabase } from '../lib/supabase';
import type { Story } from '../types/story';

const fields = 'id,user_id,creation_session_id,title,status,created_at,updated_at,published_at';

export function useStories(userId: string | null, authLoading: boolean) {
  const [state, setState] = useState<{ owner: string | null; items: Story[]; loading: boolean; error: string }>({
    owner: null, items: [], loading: false, error: '',
  });
  const generation = useRef(0);
  const savingOwner = useRef<string | null>(null);
  const [saving, setSaving] = useState(false);
  const activeOwner = useRef(userId);
  useEffect(() => { activeOwner.current = userId; }, [userId]);

  const refresh = useCallback(async () => {
    const request = ++generation.current;
    if (authLoading || !userId) return;
    setState(current => ({ owner: userId, items: current.owner === userId ? current.items : [], loading: true, error: '' }));
    try {
      if (!supabase) throw new Error('Account storage is unavailable.');
      const items: Story[] = [];
      for (let offset = 0; ; offset += 500) {
        const { data, error } = await supabase.from('all_stories').select(fields)
          .eq('user_id', userId).order('updated_at', { ascending: false }).order('id').range(offset, offset + 499);
        if (error) throw error;
        items.push(...(data ?? []) as Story[]);
        if (!data || data.length < 500) break;
      }
      if (request === generation.current && activeOwner.current === userId) {
        setState({ owner: userId, items, loading: false, error: '' });
      }
    } catch {
      if (request === generation.current && activeOwner.current === userId) {
        setState(current => ({ ...current, loading: false, error: 'Could not load your saved stories. Please retry.' }));
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

  const save = useCallback(async (projectId: string | null, title: string, publish: boolean, segmentIds: string[]) => {
    if (!supabase || !userId || authLoading) throw new Error('Sign in to save your story to your account.');
    if (savingOwner.current) throw new Error('A story save is already in progress.');
    savingOwner.current = userId;
    setSaving(true);
    try {
      const { data, error } = await supabase.rpc('save_story', {
        p_creation_session_id: projectId,
        p_title: title.trim() || 'Untitled story',
        p_publish: publish,
        p_segment_ids: segmentIds,
      });
      if (error) throw new Error('Your story could not be saved to your account. Please retry.');
      const story = data as Story;
      if (!story || story.user_id !== userId) throw new Error('Your story save could not be confirmed. Please retry.');
      if (activeOwner.current === userId) {
        // A list request started before this save must not replace its result.
        generation.current++;
        setState(current => ({ owner: userId, loading: false, error: '', items: [story,
          ...(current.owner === userId ? current.items : []).filter(item => item.id !== story.id)] }));
      }
      return story;
    } finally {
      savingOwner.current = null;
      setSaving(false);
    }
  }, [authLoading, userId]);

  const visible = !authLoading && state.owner === userId;
  return { items: visible ? state.items : [], loading: authLoading || Boolean(userId && (!visible || state.loading)),
    error: visible ? state.error : '', saving, refresh, save };
}
