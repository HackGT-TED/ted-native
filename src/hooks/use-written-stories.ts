import { useCallback, useEffect, useRef, useState } from 'react';
import { supabase } from '../lib/supabase';

export type WrittenStorySummary = {
  slug: string;
  title: string;
  author: string;
  category: string;
  reading_minutes: number;
  /** The story's opening paragraph, shown as a preview. */
  excerpt: string;
};

export type WrittenStory = WrittenStorySummary & {
  paragraphs: string[];
  word_count: number;
  source_title: string;
  source_url: string;
  cover_credit: string;
};

const summaryFields = 'slug,title,author,category,reading_minutes,excerpt:paragraphs->>0';

/** Loads one query and keeps only the newest response. */
function useQuery<T>(load: (() => Promise<T>) | null, fallbackError: string) {
  const [state, setState] = useState<{ data: T | null; loading: boolean; error: string }>({ data: null, loading: true, error: '' });
  const generation = useRef(0);
  const refresh = useCallback(async () => {
    const request = ++generation.current;
    if (!load) return;
    setState(current => ({ ...current, loading: true, error: '' }));
    try {
      const data = await load();
      if (request === generation.current) setState({ data, loading: false, error: '' });
    } catch {
      if (request === generation.current) setState(current => ({ ...current, loading: false, error: fallbackError }));
    }
  }, [load, fallbackError]);
  useEffect(() => {
    // Opening the screen starts an external database read and exposes its loading state.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void refresh();
    const requests = generation;
    return () => { requests.current++; };
  }, [refresh]);
  return { ...state, refresh };
}

const loadAll = async () => {
  if (!supabase) throw new Error('Account storage is unavailable.');
  const { data, error } = await supabase.from('written_stories').select(summaryFields).order('position').order('title');
  if (error) throw error;
  return (data ?? []) as unknown as WrittenStorySummary[];
};

/** Every written story, in their curated order, without the full text. */
export function useWrittenStories() {
  const { data, ...rest } = useQuery(loadAll, 'Could not load stories. Please retry.');
  return { items: data ?? [], ...rest };
}

/** One written story with its full text. */
export function useWrittenStory(slug: string | undefined) {
  const load = useCallback(async () => {
    if (!supabase) throw new Error('Account storage is unavailable.');
    if (!slug) return null;
    const { data, error } = await supabase.from('written_stories')
      .select(`${summaryFields},paragraphs,word_count,source_title,source_url,cover_credit`).eq('slug', slug).maybeSingle();
    if (error) throw error;
    return data as unknown as WrittenStory | null;
  }, [slug]);
  const { data, ...rest } = useQuery(load, 'Could not load this story. Please retry.');
  return { story: data, ...rest };
}
