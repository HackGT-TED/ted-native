import { useRef, useState } from 'react';
import { router } from 'expo-router';
import { Modal, Pressable, Text, View } from 'react-native';
import { useStudio } from '../context/studio';
import { Body, Button } from './ui';

export function StoryActions({ disabled }: { disabled: boolean }) {
  const { draft, timeline, stories, storyId, session, authLoading } = useStudio();
  const [feedback, setFeedback] = useState<{ key: string; message: string; error: boolean } | null>(null);
  const [chooser, setChooser] = useState<string | null>(null);
  const key = `${session?.user.id ?? 'guest'}:${storyId ?? 'legacy'}`;
  const busy = useRef(false);
  const locked = disabled || authLoading || stories.saving || draft.loading || !draft.editable || !timeline.ready;
  const save = async (publish: boolean, visibility: 'public' | 'private' | 'draft' = 'draft') => {
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
      await stories.save(storyId, draft.name, publish, timeline.segments.map(segment => segment.id));
      setFeedback({
        key,
        message: publish
          ? 'Story published to the default view. Find it in your library.'
          : visibility === 'private'
            ? 'Kept private on your account. Only you can open it until a friend can be invited.'
            : 'Story saved to your account.',
        error: false,
      });
    } catch (cause) {
      setFeedback({ key, message: cause instanceof Error ? cause.message : 'Could not save your story. Please retry.', error: true });
    } finally { busy.current = false; }
  };
  const choose = (publish: boolean) => {
    setChooser(null);
    void save(publish, publish ? 'public' : 'private');
  };
  const current = stories.items.find(item => item.creation_session_id === storyId);
  const open = chooser === key;
  return <View className="gap-2">
    {current && <Text className="text-[12px] text-muted">{current.status === 'published' ? 'Published story' : 'Draft'}</Text>}
    <View className="flex-row gap-3">
      <Button title={stories.saving ? 'Saving…' : 'Save'} secondary className="flex-1" disabled={locked} onPress={() => { void save(false); }} />
      <Button title="Publish" className="flex-1" disabled={locked || timeline.segments.length === 0} onPress={() => { if (!locked) setChooser(key); }} />
    </View>
    {feedback?.key === key && <Text accessibilityRole={feedback.error ? 'alert' : undefined} accessibilityLiveRegion="polite"
      className={`text-[12px] ${feedback.error ? 'text-rust' : 'text-muted'}`}>{feedback.message}</Text>}
    <Modal visible={open} transparent animationType="fade" onRequestClose={() => setChooser(null)}>
      <View className="flex-1 justify-end">
        <Pressable accessibilityRole="button" accessibilityLabel="Close publish options" onPress={() => setChooser(null)} className="absolute inset-0 bg-[rgba(49,34,24,0.35)]" />
        <View className="w-full max-w-[480px] self-center rounded-t-3xl bg-paper px-6 pb-8 pt-6">
          <Text className="text-[22px] font-semibold text-ink">Publish this story</Text>
          <Body className="mt-2">Public uses the default published view. Private stays on your account until you can share it with a friend.</Body>
          <Button title="Public" className="mt-5" disabled={locked} onPress={() => choose(true)} />
          <Button title="Private" secondary className="mt-3" disabled={locked} onPress={() => choose(false)} />
          <Button title="Cancel" secondary className="mt-3" onPress={() => setChooser(null)} />
        </View>
      </View>
    </Modal>
  </View>;
}
