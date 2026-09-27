import { useCallback, useEffect, useRef, useState } from 'react';
import { supabase } from '../lib/supabase';
import type { PublishedAudio } from '../services/publish-story';
import type { Story } from '../types/story';

const fields = 'id,author_id,title,visibility,created_at,published_at,marketplace_visible,cover_image_path';

type StoryRow = {
  id: string; author_id: string; title: string;
  visibility: 'draft' | 'published'; created_at: string; published_at: string | null;
  marketplace_visible: boolean; cover_image_path: string | null;
};

export type SaveExtras = {
  /** Publish only: the backend's mixed MP3, description, and tags. */
  audio?: PublishedAudio;
  /** Publish only: show the story in the community. */
  community?: boolean;
  /** A cover path to set, '' to remove the cover, or undefined to leave it. */
  coverPath?: string;
};

/** all_stories uses the author's own id as the story id of their unnamed legacy draft. */
function toStory(row: StoryRow): Story {
  return {
    id: row.id,
    user_id: row.author_id,
    creation_session_id: row.id === row.author_id ? null : row.id,
    title: row.title,
    status: row.visibility === 'published' ? 'published' : 'draft',
    created_at: row.created_at,
    updated_at: row.published_at ?? row.created_at,
    published_at: row.published_at,
    community: Boolean(row.marketplace_visible),
    cover_path: row.cover_image_path ?? null,
  };
}

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
          .eq('author_id', userId).order('created_at', { ascending: false }).order('id').range(offset, offset + 499);
        if (error) throw error;
        items.push(...((data ?? []) as StoryRow[]).map(toStory));
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

  const save = useCallback(async (projectId: string | null, title: string, publish: boolean, segmentIds: string[],
    { audio, community, coverPath }: SaveExtras = {}) => {
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
        ...(audio ? {
          p_stereo_audio_path: audio.stereoAudioPath,
          p_description: audio.description,
          p_category_tags: audio.categoryTags,
        } : {}),
        ...(publish && community !== undefined ? { p_marketplace: community } : {}),
        ...(coverPath !== undefined ? { p_cover_image_path: coverPath } : {}),
      });
      if (error) throw new Error('Your story could not be saved to your account. Please retry.');
      // The deployed RPC retains its original field name; normalize it for the app.
      const saved = data as (Omit<Story, 'community'> & { marketplace?: boolean }) | null;
      if (!saved || saved.user_id !== userId) throw new Error('Your story save could not be confirmed. Please retry.');
      const { marketplace, ...details } = saved;
      const story: Story = { ...details, community: Boolean(marketplace) };
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
