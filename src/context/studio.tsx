import { createContext, ReactNode, useContext, useState } from 'react';
import type { Session } from '@supabase/supabase-js';
import { useAuthSession } from '../hooks/use-auth-session';
import { useRecordingSegments } from '../hooks/use-recording-segments';
import { useAudioCapture } from '../hooks/use-audio-capture';
import { useStoryDraft } from '../hooks/use-story-draft';
export type Creation = {
  id: string;
  title: string;
  author: string;
  category: string;
  color: string;
  subtitle: string;
  illustrated?: boolean;
};
export const originals: Creation[] = [{
  id: 'woodland',
  title: 'The Woodland\nCompanion',
  author: 'Florence & Fern',
  category: 'Stories',
  color: '#E4CDB0',
  subtitle: 'A collection of small adventures',
  illustrated: true
}, {
  id: 'ordinary',
  title: 'The art of\nordinary days',
  author: 'Eleanor Rose',
  category: 'Journals',
  color: '#EEDFCB',
  subtitle: 'A journal for noticing more'
}, {
  id: 'wildflowers',
  title: 'Wildflowers\n& little wonders',
  author: 'The Quiet Studio',
  category: 'Art',
  color: '#DBC4A6',
  subtitle: 'Botanical notes from the meadow'
}, {
  id: 'sunday',
  title: 'A pocketful\nof Sundays',
  author: 'Oliver Moss',
  category: 'Stories',
  color: '#E7CBBB',
  subtitle: 'Stories for taking your time'
}];
type Studio = {
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
  const timeline = useRecordingSegments(session?.user.id ?? null, authLoading);
  const draft = useStoryDraft(session?.user.id ?? null, authLoading);
  const recorder = useAudioCapture(timeline.addRecording);
  const [creations, setCreations] = useState(originals);
  const [saved, setSaved] = useState<string[]>([]);
  return <Context.Provider value={{
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
