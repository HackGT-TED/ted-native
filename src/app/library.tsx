import { useCallback, useState } from 'react';
import { router, useFocusEffect } from 'expo-router';
import { ActivityIndicator, FlatList, Pressable, Text, View } from 'react-native';
import { Shell } from '../components/shell';
import { CreationCard } from '../components/creation-card';
import { Body, Button, colors, Heading } from '../components/ui';
import { useStudio } from '../context/studio';
import { useStoryDraft } from '../hooks/use-story-draft';

type LibraryStory = { id: string | null; title?: string; status: 'draft' | 'published'; updatedAt: string; local: boolean };

function StoryCard({ item }: { item: LibraryStory }) {
  const { session, authLoading, openStory, recorder, stories } = useStudio();
  const name = useStoryDraft(session?.user.id ?? null, authLoading, item.id, item.title);
  const refreshName = name.refresh;
  useFocusEffect(useCallback(() => { refreshName(); }, [refreshName]));
  const disabled = recorder.phase !== 'idle' || stories.saving;
  return <Pressable accessibilityRole="button" accessibilityLabel={`Open ${name.name || item.title || 'Untitled story'}`}
    accessibilityState={{ disabled }} disabled={disabled}
    onPress={() => { openStory(item.id); router.push('/create'); }}
    className="mb-3 rounded-[18px] border border-line bg-cream p-5 active:opacity-70">
    <View className="flex-row items-center justify-between gap-3">
      <Text className="flex-1 text-[18px] font-medium text-ink">{name.name || item.title || 'Untitled story'}</Text>
      <Text className="text-[11px] font-medium text-cocoa">{item.status === 'published' ? 'Published' : 'Draft'}</Text>
    </View>
    <Text className="mt-2 text-[12px] text-muted">{item.local ? 'On this device · ' : ''}Updated {new Date(item.updatedAt).toLocaleDateString()}</Text>
    <Text className="mt-3 text-[12px] text-cocoa">Open story →</Text>
  </Pressable>;
}

export default function Library() {
  const { creations, saved, stories, timeline, session, storyOpen, storyId, draft } = useStudio();
  const [filter, setFilter] = useState<'all' | 'draft' | 'published'>('all');
  const { refresh } = stories;
  const refreshTimeline = timeline.refresh;
  useFocusEffect(useCallback(() => { void refresh(); void refreshTimeline(); }, [refresh, refreshTimeline]));
  const merged = new Map<string | null, LibraryStory>(stories.items.map(item => [item.creation_session_id, {
    id: item.creation_session_id, title: item.title, status: item.status, updatedAt: item.updated_at, local: false,
  }]));
  for (const project of timeline.projects) {
    if (!merged.has(project.id)) merged.set(project.id, {
      id: project.id, status: 'draft', updatedAt: project.createdAt, local: true,
    });
  }
  if (storyOpen && draft.name.trim() && !merged.has(storyId)) merged.set(storyId, {
    id: storyId, title: draft.name, status: 'draft', updatedAt: new Date().toISOString(), local: true,
  });
  const all = [...merged.values()].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  const items = all.filter(item => filter === 'all' || item.status === filter);
  const bookmarks = creations.filter(item => saved.includes(item.id));
  return <Shell scroll={false}>
    <FlatList className="w-full max-w-[700px] flex-1 self-center" contentContainerClassName="pb-8 pt-9"
      data={items} keyExtractor={item => item.id ?? 'legacy'} renderItem={({ item }) => <StoryCard item={item} />}
      refreshing={stories.loading || timeline.loading} onRefresh={() => { void refresh(); void refreshTimeline(); }}
      ListHeaderComponent={<View className="mb-6">
        <Heading>Library</Heading>
        <Body className="mt-2">Your stories, from first draft to published.</Body>
        <View className="mt-5 flex-row gap-2">
          {(['all', 'draft', 'published'] as const).map(value => <Pressable key={value} accessibilityRole="tab"
            accessibilityState={{ selected: filter === value }} onPress={() => setFilter(value)}
            className={`min-h-11 flex-1 items-center justify-center rounded-[10px] border border-line px-2 ${filter === value ? 'bg-cocoa' : 'bg-cream'}`}>
            <Text className={`text-[12px] ${filter === value ? 'text-paper' : 'text-ink'}`}>
              {value === 'all' ? 'All' : value === 'draft' ? 'Drafts' : 'Published'} ({all.filter(item => value === 'all' || item.status === value).length})
            </Text>
          </Pressable>)}
        </View>
        {stories.loading && <ActivityIndicator className="mt-4" color={colors.cocoa} />}
        {(stories.error || timeline.error) && <View className="mt-4 gap-2">
          <Text accessibilityRole="alert" className="text-[13px] text-rust">{stories.error || timeline.error}</Text>
          <Button title="Retry loading stories" secondary onPress={() => { void refresh(); void refreshTimeline(); }} />
        </View>}
        {!session && <Button className="mt-4" title="Sign in to sync your stories" secondary onPress={() => router.push('/auth')} />}
      </View>}
      ListEmptyComponent={!stories.loading && !timeline.loading ? <View className="items-center py-10">
        <Text className="text-[18px] font-medium text-ink">{filter === 'published' ? 'No published stories yet.' : filter === 'draft' ? 'No drafts yet.' : 'Your stories belong here.'}</Text>
        <Body className="mt-2 text-center">Save a draft or publish a story from Create to find it here.</Body>
        <Button title="Create a story" secondary className="mt-5" onPress={() => router.push('/')} />
      </View> : null}
      ListFooterComponent={bookmarks.length ? <View className="mt-6">
        <Text className="mb-2 text-[18px] font-medium text-ink">Saved creations</Text>
        {bookmarks.map(item => <CreationCard key={item.id} item={item} origin="library" />)}
      </View> : null}
    />
  </Shell>;
}
