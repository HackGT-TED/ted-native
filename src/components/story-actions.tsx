import { useEffect, useRef, useState } from 'react';
import { router } from 'expo-router';
import { Text, View } from 'react-native';
import { useStudio } from '../context/studio';
import { prepareStoryAudio } from '../services/publish-story';
import { warmUp } from '../services/story-api';
import { Button } from './ui';

export function StoryActions({ disabled }: { disabled: boolean }) {
  const { draft, timeline, stories, storyId, session, authLoading } = useStudio();
  const [feedback, setFeedback] = useState<{ key: string; message: string; error: boolean } | null>(null);
  const key = `${session?.user.id ?? 'guest'}:${storyId ?? 'legacy'}`;
  const busy = useRef(false);
  const [publishing, setPublishing] = useState(false);
  // The story server sleeps when idle; wake it before anyone taps Publish.
  useEffect(() => { void warmUp(); }, []);
  const locked = disabled || authLoading || stories.saving || publishing || draft.loading || !draft.editable || !timeline.ready;
  const save = async (publish: boolean) => {
    if (locked || busy.current) return;
    if (!session) { router.push('/auth'); return; }
    if (timeline.syncPending || timeline.loading || timeline.error) {
      setFeedback({ key, message: 'Wait for your moments and edits to finish syncing. Retry any failed uploads first.', error: true });
      return;
    }
    if (publish && !draft.name.trim()) {
      setFeedback({ key, message: 'Give your story a name before publishing.', error: true });
      return;
    }
    busy.current = true;
    setFeedback(null);
    try {
      let audio;
      if (publish) {
        setPublishing(true);
        setFeedback({ key, message: 'Adding sound effects to your story. This can take a minute…', error: false });
        audio = await prepareStoryAudio(session.user.id, storyId, timeline.segments);
      }
      await stories.save(storyId, draft.name, publish, timeline.segments.map(segment => segment.id), audio);
      setFeedback({ key, message: publish ? 'Story published. Find it in your library.' : 'Story saved to your account.', error: false });
    } catch (cause) {
      setFeedback({ key, message: cause instanceof Error ? cause.message : 'Could not save your story. Please retry.', error: true });
    } finally { busy.current = false; setPublishing(false); }
  };
  const current = stories.items.find(item => item.creation_session_id === storyId);
  return <View className="mt-4 gap-2">
    {current && <Text className="text-[12px] text-muted">{current.status === 'published' ? 'Published story' : 'Draft'}</Text>}
    <View className="flex-row gap-3">
      <Button title={stories.saving ? 'Saving…' : 'Save'} secondary className="flex-1" disabled={locked} onPress={() => { void save(false); }} />
      <Button title={publishing ? 'Publishing…' : 'Publish'} className="flex-1" disabled={locked || timeline.segments.length === 0} onPress={() => { void save(true); }} />
    </View>
    {feedback?.key === key && <Text accessibilityRole={feedback.error ? 'alert' : undefined} accessibilityLiveRegion="polite"
      className={`text-[12px] ${feedback.error ? 'text-rust' : 'text-muted'}`}>{feedback.message}</Text>}
  </View>;
}
