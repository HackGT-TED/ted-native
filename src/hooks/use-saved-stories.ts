import { useCallback, useEffect, useRef, useState } from 'react';
import { supabase } from '../lib/supabase';
import {
  communityFields, signCovers, toCommunityStory,
  type CommunityRow, type CommunityStory,
} from './use-community-stories';

type State = { owner: string | null; items: CommunityStory[]; loading: boolean; error: string };

/** The signed-in user's saved community stories (saved_stories), newest save first. */
export function useSavedStories(userId: string | null, authLoading: boolean) {
  const [state, setState] = useState<State>({ owner: null, items: [], loading: false, error: '' });
  const [pending, setPending] = useState<string[]>([]);
  const generation = useRef(0);

  const refresh = useCallback(async () => {
    const request = ++generation.current;
    if (authLoading || !userId) return;
    setState(current => ({ owner: userId, items: current.owner === userId ? current.items : [], loading: true, error: '' }));
    try {
      if (!supabase) throw new Error('Account storage is unavailable.');
      const { data, error } = await supabase.from('saved_stories')
        .select(`created_at, story:all_stories(${communityFields})`)
        .eq('user_id', userId).order('created_at', { ascending: false }).limit(200);
      if (error) throw error;
      // A story its author took off the community comes back as null. The user's own
      // stories already live in their Library sections, so they are never "saved".
      const rows = ((data ?? []) as unknown as { story: CommunityRow | null }[])
        .map(row => row.story)
        .filter((story): story is CommunityRow => Boolean(story) && story?.author_id !== userId);
      const covers = await signCovers(rows.map(row => row.cover_image_path).filter((path): path is string => Boolean(path)));
      if (request === generation.current) {
        setState({ owner: userId, loading: false, error: '', items: rows.map(row => toCommunityStory(row, covers)) });
      }
    } catch {
      if (request === generation.current) {
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

  const visible = !authLoading && state.owner === userId ? state.items : [];

  /** Saves or removes a story. The list updates right away and rolls back if the request fails. */
  const toggle = useCallback(async (story: CommunityStory) => {
    if (!supabase || !userId) throw new Error('Sign in to save stories to your library.');
    if (story.authorId === userId) throw new Error('This is your story. Find it under Public in your Library.');
    if (pending.includes(story.id)) return;
    const wasSaved = state.owner === userId && state.items.some(item => item.id === story.id);
    // A newer list read must not replace this change.
    generation.current++;
    setPending(ids => [...ids, story.id]);
    setState(current => ({ ...current, owner: userId, error: '', items: wasSaved
      ? current.items.filter(item => item.id !== story.id)
      : [story, ...current.items.filter(item => item.id !== story.id)] }));
    try {
      const { error } = wasSaved
        ? await supabase.from('saved_stories').delete().eq('user_id', userId).eq('story_id', story.id)
        : await supabase.from('saved_stories').insert({ user_id: userId, story_id: story.id });
      if (error) throw error;
    } catch {
      setState(current => current.owner !== userId ? current : { ...current, items: wasSaved
        ? [story, ...current.items.filter(item => item.id !== story.id)]
        : current.items.filter(item => item.id !== story.id) });
      throw new Error(wasSaved ? 'Could not remove this story. Please retry.' : 'Could not save this story. Please retry.');
    } finally {
      setPending(ids => ids.filter(id => id !== story.id));
    }
  }, [pending, state, userId]);

  return {
    items: visible,
    ids: new Set(visible.map(item => item.id)),
    pending,
    loading: authLoading || Boolean(userId && (state.owner !== userId || state.loading)),
    error: !authLoading && state.owner === userId ? state.error : '',
    refresh,
    toggle,
  };
}
