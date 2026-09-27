import { useCallback, useEffect, useRef, useState } from 'react';
import { supabase } from '../lib/supabase';

export type CommunityStory = {
  id: string;
  /** The account that recorded it; a user's own stories are not saveable. */
  authorId: string;
  title: string;
  description: string;
  publishedAt: string | null;
  /** Signed URL for the story's cover, or null to show the placeholder art. */
  coverUrl: string | null;
  /** Storage path of the mixed MP3; a playable link is requested only when played. */
  audioPath: string | null;
  /** Length from the database, shown before the audio has loaded. */
  durationMs: number | null;
};

export type CommunityRow = {
  id: string; author_id: string; title: string; description: string | null;
  published_at: string | null; cover_image_path: string | null; stereo_audio_path: string | null;
  duration_ms: number | null;
};

export const communityFields = 'id,author_id,title,description,published_at,cover_image_path,stereo_audio_path,duration_ms';

export function toCommunityStory(row: CommunityRow, covers: Map<string, string>): CommunityStory {
  return {
    id: row.id,
    authorId: row.author_id,
    title: row.title,
    description: row.description ?? '',
    publishedAt: row.published_at,
    coverUrl: row.cover_image_path ? covers.get(row.cover_image_path) ?? null : null,
    audioPath: row.stereo_audio_path,
    durationMs: row.duration_ms,
  };
}

/** Published stories everyone can see (marketplace_visible), newest first. Signed in or not. */
export function useCommunityStories(authLoading: boolean) {
  const [state, setState] = useState<{ items: CommunityStory[]; loading: boolean; error: string }>({
    items: [], loading: false, error: '',
  });
  const generation = useRef(0);

  const refresh = useCallback(async () => {
    const request = ++generation.current;
    // Wait for the session so a signed-in user reads with their own access.
    if (authLoading) return;
    setState(current => ({ ...current, loading: true, error: '' }));
    try {
      if (!supabase) throw new Error('Account storage is unavailable.');
      const { data, error } = await supabase.from('all_stories').select(communityFields)
        .eq('marketplace_visible', true).eq('visibility', 'published')
        .order('published_at', { ascending: false }).order('id').limit(100);
      if (error) throw error;
      const rows = (data ?? []) as CommunityRow[];
      const covers = await signCovers(rows.map(row => row.cover_image_path).filter((path): path is string => Boolean(path)));
      if (request !== generation.current) return;
      setState({ loading: false, error: '', items: rows.map(row => toCommunityStory(row, covers)) });
    } catch {
      if (request === generation.current) {
        setState(current => ({ ...current, loading: false, error: 'Could not load audio stories. Please retry.' }));
      }
    }
  }, [authLoading]);

  useEffect(() => {
    // Opening Explore starts an external database read and exposes its loading state.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void refresh();
    const requests = generation;
    return () => { requests.current++; };
  }, [refresh]);

  return { ...state, refresh };
}

/** One story by id: any community story, or one of the signed-in user's own. */
export function useCommunityStory(id: string | undefined, authLoading: boolean) {
  const [state, setState] = useState<{ story: CommunityStory | null; loading: boolean; error: string }>({
    story: null, loading: true, error: '',
  });
  const generation = useRef(0);

  const refresh = useCallback(async () => {
    const request = ++generation.current;
    if (authLoading) return;
    if (!id) {
      setState({ story: null, loading: false, error: '' });
      return;
    }
    setState(current => ({ ...current, loading: true, error: '' }));
    try {
      if (!supabase) throw new Error('Account storage is unavailable.');
      const { data, error } = await supabase.from('all_stories').select(communityFields).eq('id', id).maybeSingle();
      if (error) throw error;
      const row = data as CommunityRow | null;
      const covers = row?.cover_image_path ? await signCovers([row.cover_image_path]) : new Map<string, string>();
      if (request === generation.current) {
        setState({ story: row ? toCommunityStory(row, covers) : null, loading: false, error: '' });
      }
    } catch {
      if (request === generation.current) {
        setState(current => ({ ...current, loading: false, error: 'Could not load this story. Please retry.' }));
      }
    }
  }, [authLoading, id]);

  useEffect(() => {
    // Opening a story starts an external database read and exposes its loading state.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void refresh();
    const requests = generation;
    return () => { requests.current++; };
  }, [refresh]);

  return { ...state, loading: authLoading || state.loading, refresh };
}

/** Covers are private files; a missing cover just falls back to the placeholder. */
export async function signCovers(paths: string[]): Promise<Map<string, string>> {
  const urls = new Map<string, string>();
  if (!paths.length || !supabase) return urls;
  try {
    const { data } = await supabase.storage.from('recordings').createSignedUrls(paths, 3600);
    for (const item of data ?? []) {
      if (item.path && item.signedUrl) urls.set(item.path, item.signedUrl);
    }
  } catch { /* Placeholders are shown instead. */ }
  return urls;
}
