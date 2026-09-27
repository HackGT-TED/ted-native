import { createContext, ReactNode, useCallback, useContext, useState } from 'react';
import type { Session } from '@supabase/supabase-js';
import { useAuthSession } from '../hooks/use-auth-session';
import { useRecordingSegments } from '../hooks/use-recording-segments';
import { useAudioCapture } from '../hooks/use-audio-capture';
import { useStoryDraft } from '../hooks/use-story-draft';
import { useStories } from '../hooks/use-stories';
import { useSavedStories } from '../hooks/use-saved-stories';
import { useStoryCover } from '../hooks/use-story-cover';
import { useInbox } from '../hooks/use-inbox';
import { useFamily } from '../hooks/use-family';
import { useReadingAutoSave } from '../hooks/use-reading-autosave';
export type Creation = {
  id: string;
  title: string;
  author: string;
  category: string;
  color: string;
  subtitle: string;
  illustrated?: boolean;
};
// Written stories now come from public.written_stories; creations are only ones shared in this session.
export const originals: Creation[] = [];
type Studio = {
  storyId: string | null;
  stories: ReturnType<typeof useStories>;
  /** Community stories this user saved to their library. */
  savedStories: ReturnType<typeof useSavedStories>;
  /** Stories other people sent to this user. */
  inbox: ReturnType<typeof useInbox>;
  /** The user's family and its invite code. */
  family: ReturnType<typeof useFamily>;
  storyOpen: boolean;
  autoRecord: boolean;
  openStory: (id: string | null, record?: boolean) => void;
  consumeAutoRecord: () => void;
  draft: ReturnType<typeof useStoryDraft>;
  /** The open story's cover image. */
  cover: ReturnType<typeof useStoryCover>;
  timeline: ReturnType<typeof useRecordingSegments>;
  recorder: ReturnType<typeof useAudioCapture>;
  name: string;
  session: Session | null;
  authLoading: boolean;
  authError: string;
  creations: Creation[];
  addCreation: (item: Creation) => void;
  saved: string[];
  toggleSave: (id: string) => void;
};
const Context = createContext<Studio | null>(null);
export function StudioProvider({
  children
}: {
  children: ReactNode;
}) {
  const { session, authLoading, authError } = useAuthSession();
  const displayName = session?.user.user_metadata.display_name;
  const name = session ? (typeof displayName === 'string' && displayName.trim() ? displayName.trim() : session.user.email?.split('@')[0] || 'Member') : '';
  const [story, setStory] = useState<{ id: string | null; owner: string | null; autoRecord: boolean } | null>(null);
  const owner = session?.user.id ?? null;
  const currentStory = story?.owner === owner ? story : null;
  const openStory = useCallback((id: string | null, record = false) => {
    setStory({ id, owner, autoRecord: record });
  }, [owner]);
  const consumeAutoRecord = useCallback(() => {
    setStory(current => current ? { ...current, autoRecord: false } : current);
  }, []);
  const timeline = useRecordingSegments(session?.user.id ?? null, authLoading, currentStory?.id ?? null);
  const stories = useStories(owner, authLoading);
  const savedStories = useSavedStories(owner, authLoading);
  const inbox = useInbox(owner, authLoading);
  const family = useFamily(owner, authLoading);
  const savedStory = stories.items.find(item => item.creation_session_id === (currentStory?.id ?? null));
  const draft = useStoryDraft(owner, authLoading, currentStory?.id ?? null, savedStory?.title);
  const cover = useStoryCover(owner, authLoading, currentStory?.id ?? null, savedStory?.cover_path);
  const recorder = useAudioCapture(timeline.addRecording);
  // Read-along stories save themselves once their clips upload, even after leaving the reader.
  useReadingAutoSave(owner, currentStory?.id ?? null, timeline, stories, draft.name);
  const [creations, setCreations] = useState(originals);
  const [saved, setSaved] = useState<string[]>([]);
  return <Context.Provider value={{
    storyId: currentStory?.id ?? null,
    stories,
    savedStories,
    inbox,
    family,
    storyOpen: Boolean(currentStory),
    autoRecord: currentStory?.autoRecord ?? false,
    openStory,
    consumeAutoRecord,
    draft,
    cover,
    timeline,
    recorder,
    name,
    session,
    authLoading,
    authError,
    creations,
    addCreation: item => setCreations(items => [item, ...items]),
    saved,
    toggleSave: id => setSaved(items => items.includes(id) ? items.filter(i => i !== id) : [...items, id])
  }}>{children}</Context.Provider>;
}
export function useStudio() {
  const studio = useContext(Context);
  if (!studio) throw new Error('StudioProvider is required');
  return studio;
}
