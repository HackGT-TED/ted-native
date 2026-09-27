import { createContext, ReactNode, useCallback, useContext, useState } from 'react';
import type { Session } from '@supabase/supabase-js';
import { useAuthSession } from '../hooks/use-auth-session';
import { useRecordingSegments } from '../hooks/use-recording-segments';
import { useAudioCapture } from '../hooks/use-audio-capture';
import { useStoryDraft } from '../hooks/use-story-draft';
import { useStories } from '../hooks/use-stories';
export type Creation = {
  id: string;
  title: string;
  author: string;
  category: string;
  color: string;
  subtitle: string;
  illustrated?: boolean;
};
/** Placeholder community pieces. Replace these with real stories when they are ready. */
export const originals: Creation[] = [{
  id: 'lantern-creek',
  title: 'The Lantern by the Creek',
  author: 'Mira Ellison',
  category: 'Stories',
  color: '#E4CDB0',
  subtitle: 'A paper lantern drifts downstream, and a child follows it into the evening her grandmother never finished telling.',
  illustrated: true
}, {
  id: 'shoes-door',
  title: 'Shoes by the Door',
  author: 'Jonah Adeyemi',
  category: 'Journals',
  color: '#EEDFCB',
  subtitle: 'Notes from the first week of living alone, written in the quiet between locking the door and turning on the lamp.'
}, {
  id: 'salt-windowsill',
  title: 'Salt on the Windowsill',
  author: 'Helen Cho',
  category: 'Stories',
  color: '#E7CBBB',
  subtitle: 'In a seaside town, every house keeps a dish of salt so the rooms remember who has come home.'
}, {
  id: 'market-breakfast',
  title: 'The Market Before Breakfast',
  author: 'Rafael Ortiz',
  category: 'Journals',
  color: '#DBC4A6',
  subtitle: 'A walk through the stalls at dawn, stall by stall, before the city starts performing for the day.'
}, {
  id: 'paper-boats',
  title: 'Paper Boats in August',
  author: 'Amina Diallo',
  category: 'Stories',
  color: '#E4CDB0',
  subtitle: 'Two cousins send secrets across a flooded street and wait to see which ones find their way back.'
}, {
  id: 'back-step',
  title: 'Field Guide to the Back Step',
  author: 'The Marigold Press',
  category: 'Art',
  color: '#EEDFCB',
  subtitle: 'Drawings of the moths, cracks, and coffee rings that collected on one porch over a single summer.',
  illustrated: true
}, {
  id: 'kitchen-heard',
  title: 'What the Kitchen Heard',
  author: 'Priya Raman',
  category: 'Stories',
  color: '#DBC4A6',
  subtitle: 'A family recipe told the way the room remembers it: who laughed, who burned the onions, who stayed to wash up.'
}, {
  id: 'library-letters',
  title: 'Letters Left in Library Books',
  author: 'Edith Lang',
  category: 'Journals',
  color: '#E7CBBB',
  subtitle: 'Short letters slipped into returned books. None of them are addressed. All of them were meant.'
}, {
  id: 'orange-tree',
  title: 'The Orange Tree Upstairs',
  author: 'Mateo Alvarez',
  category: 'Stories',
  color: '#E4CDB0',
  subtitle: 'A building agrees to keep an orange tree on the roof if the tenants will tell it one true thing each week.'
}, {
  id: 'blue-thread',
  title: 'Blue Thread, Loose Button',
  author: 'Naomi Berg',
  category: 'Art',
  color: '#EEDFCB',
  subtitle: 'Studies of clothes people could not throw away, and the afternoons still caught in the seams.',
  illustrated: true
}];
type Studio = {
  storyId: string | null;
  stories: ReturnType<typeof useStories>;
  storyOpen: boolean;
  autoRecord: boolean;
  openStory: (id: string | null, record?: boolean) => void;
  consumeAutoRecord: () => void;
  draft: ReturnType<typeof useStoryDraft>;
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
  const savedStory = stories.items.find(item => item.creation_session_id === (currentStory?.id ?? null));
  const draft = useStoryDraft(owner, authLoading, currentStory?.id ?? null, savedStory?.title);
  const recorder = useAudioCapture(timeline.addRecording);
  const [creations, setCreations] = useState(originals);
  const [saved, setSaved] = useState<string[]>([]);
  return <Context.Provider value={{
    storyId: currentStory?.id ?? null,
    stories,
    storyOpen: Boolean(currentStory),
    autoRecord: currentStory?.autoRecord ?? false,
    openStory,
    consumeAutoRecord,
    draft,
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
