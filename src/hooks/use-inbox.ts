import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';
import { supabase } from '../lib/supabase';
import { signCovers, type MarketplaceStory } from './use-marketplace-stories';

export type InboxStory = MarketplaceStory & {
  shareId: string;
  senderName: string;
  sentAt: string;
  /** null until the recipient plays it: shows the "new" dot. */
  listenedAt: string | null;
};

type Row = {
  share_id: string; story_id: string; author_id: string; sender_name: string; sent_at: string;
  listened_at: string | null; title: string; description: string | null; published_at: string | null;
  cover_image_path: string | null; stereo_audio_path: string | null; duration_ms: number | null;
};

type State = { owner: string | null; items: InboxStory[]; loading: boolean; error: string };

/** Stories other people sent to the signed-in user, newest first. */
export function useInbox(userId: string | null, authLoading: boolean) {
  const [state, setState] = useState<State>({ owner: null, items: [], loading: false, error: '' });
  const generation = useRef(0);

  const refresh = useCallback(async () => {
    const request = ++generation.current;
    if (authLoading || !userId) return;
    setState(current => ({ owner: userId, items: current.owner === userId ? current.items : [], loading: true, error: '' }));
    try {
      if (!supabase) throw new Error('Account storage is unavailable.');
      const { data, error } = await supabase.rpc('get_inbox');
      if (error) throw error;
      const rows = (data ?? []) as Row[];
      const covers = await signCovers(rows.map(row => row.cover_image_path).filter((path): path is string => Boolean(path)));
      if (request !== generation.current) return;
      setState({ owner: userId, loading: false, error: '', items: rows.map(row => ({
        id: row.story_id, authorId: row.author_id, title: row.title, description: row.description ?? '',
        publishedAt: row.published_at, audioPath: row.stereo_audio_path, durationMs: row.duration_ms,
        coverUrl: row.cover_image_path ? covers.get(row.cover_image_path) ?? null : null,
        shareId: row.share_id, senderName: row.sender_name, sentAt: row.sent_at, listenedAt: row.listened_at,
      })) });
    } catch {
      if (request === generation.current) {
        setState(current => ({ ...current, loading: false, error: 'Could not load stories sent to you. Please retry.' }));
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

  // Hear about new shares as they arrive, and catch up when the app returns to the foreground.
  useEffect(() => {
    const client = supabase;
    if (!client || !userId || authLoading) return;
    const channel = client.channel(`inbox:${userId}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'story_shares', filter: `recipient_id=eq.${userId}` },
        () => { void refresh(); })
      .subscribe();
    const appState = AppState.addEventListener('change', next => { if (next === 'active') void refresh(); });
    return () => {
      void client.removeChannel(channel);
      appState.remove();
    };
  }, [authLoading, refresh, userId]);

  /** Clears the "new" dot. Best effort: a failed update just shows the dot again next time. */
  const markListened = useCallback((shareId: string) => {
    if (!supabase || !userId) return;
    const now = new Date().toISOString();
    setState(current => ({ ...current, items: current.items.map(item =>
      item.shareId === shareId && !item.listenedAt ? { ...item, listenedAt: now } : item) }));
    void supabase.from('story_shares').update({ listened_at: now })
      .eq('id', shareId).eq('recipient_id', userId).is('listened_at', null)
      .then(() => undefined, () => undefined);
  }, [userId]);

  const visible = !authLoading && state.owner === userId ? state.items : [];
  return {
    items: visible,
    unheard: visible.filter(item => !item.listenedAt).length,
    loading: authLoading || Boolean(userId && (state.owner !== userId || state.loading)),
    error: !authLoading && state.owner === userId ? state.error : '',
    refresh,
    markListened,
  };
}
