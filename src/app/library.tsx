import { useCallback } from 'react';
import { router, useFocusEffect } from 'expo-router';
import { FlatList, Pressable, Text, View } from 'react-native';
import { LoadingSkeleton } from '../components/loading-skeleton';
import { Shell } from '../components/shell';
import { CreationCard } from '../components/creation-card';
import { AudioStoryGrid } from '../components/audio-story-grid';
import { Body, Button, Heading } from '../components/ui';
import { useStudio } from '../context/studio';
import { useStoryDraft } from '../hooks/use-story-draft';
import { useLibraryTab } from '../hooks/use-library-tab';

const KINDS = ['draft', 'public', 'private'] as const;
type Kind = (typeof KINDS)[number];
type LibraryStory = { id: string | null; title?: string; kind: Kind; updatedAt: string; local: boolean };

const sectionInfo: Record<Kind, { title: string; caption: string; empty: string; badge: string }> = {
  draft: { title: 'Drafts', caption: 'Not published yet.', empty: 'No drafts yet.', badge: 'Draft' },
  public: { title: 'Public', caption: 'In the community for everyone to hear.', empty: 'Nothing public yet. Turn on the community switch when you publish.', badge: 'Public' },
  private: { title: 'Private', caption: 'Published, but not in the community.', empty: 'No private stories yet.', badge: 'Private' },
};

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
      {name.loading && !name.name && !item.title ? <LoadingSkeleton variant="field" label="Loading story name" className="flex-1" />
        : <Text className="flex-1 text-[18px] font-medium text-ink">{name.name || item.title || 'Untitled story'}</Text>}
      <Text className="text-[11px] font-medium text-cocoa">{sectionInfo[item.kind].badge}</Text>
    </View>
    <Text className="mt-2 text-[12px] text-muted">{item.local ? 'On this device · ' : ''}Updated {new Date(item.updatedAt).toLocaleDateString()}</Text>
    <Text className="mt-3 text-[12px] text-cocoa">Open story →</Text>
  </Pressable>;
}

export default function Library() {
  const { creations, saved, savedStories, stories, timeline, session, storyOpen, storyId, draft } = useStudio();
  // The selected tab is remembered across tab switches and app restarts.
  const { tab, select } = useLibraryTab<Kind>(KINDS, 'draft');
  const { refresh } = stories;
  const refreshTimeline = timeline.refresh;
  const refreshSaved = savedStories.refresh;
  useFocusEffect(useCallback(() => { void refresh(); void refreshTimeline(); void refreshSaved(); }, [refresh, refreshTimeline, refreshSaved]));
  const merged = new Map<string | null, LibraryStory>(stories.items.map(item => [item.creation_session_id, {
    id: item.creation_session_id, title: item.title, updatedAt: item.updated_at, local: false,
    kind: item.status !== 'published' ? 'draft' : item.community ? 'public' : 'private',
  }]));
  for (const project of timeline.projects) {
    if (!merged.has(project.id)) merged.set(project.id, {
      id: project.id, kind: 'draft', updatedAt: project.createdAt, local: true,
    });
  }
  if (storyOpen && draft.name.trim() && !merged.has(storyId)) merged.set(storyId, {
    id: storyId, title: draft.name, kind: 'draft', updatedAt: new Date().toISOString(), local: true,
  });
  const all = [...merged.values()].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  const count = (kind: Kind) => all.filter(item => item.kind === kind).length;
  const items = all.filter(item => item.kind === tab);
  const loading = stories.loading || timeline.loading;
  const bookmarks = creations.filter(item => saved.includes(item.id));
  return <Shell scroll={false}>
    <FlatList className="w-full max-w-[700px] flex-1 self-center" contentContainerClassName="pb-8 pt-9"
      data={items} keyExtractor={item => item.id ?? 'legacy'} renderItem={({ item }) => <StoryCard item={item} />}
      ListEmptyComponent={loading ? <LoadingSkeleton variant="cards" label="Loading your stories" /> : <View className="mb-2 rounded-[18px] border border-dashed border-line p-5">
        <Text className="text-[13px] text-muted">{sectionInfo[tab].empty}</Text>
        {tab === 'draft' && <Button title="Create a story" secondary className="mt-4" onPress={() => router.push('/')} />}
      </View>}
      refreshing={loading && items.length > 0} onRefresh={() => { void refresh(); void refreshTimeline(); void refreshSaved(); }}
      ListHeaderComponent={<View>
        <Heading>Library</Heading>
        <Body className="mt-2">Your stories, from first draft to published.</Body>
        {(stories.error || timeline.error) && <View className="mt-4 gap-2">
          <Text accessibilityRole="alert" className="text-[13px] text-rust">{stories.error || timeline.error}</Text>
          <Button title="Retry loading stories" secondary onPress={() => { void refresh(); void refreshTimeline(); }} />
        </View>}
        {!session && <Button className="mt-4" title="Sign in to sync your stories" secondary onPress={() => router.push('/auth')} />}
        <View accessibilityRole="tablist" className="mt-6 flex-row rounded-[12px] bg-cream p-1">
          {KINDS.map(kind => <Pressable key={kind} accessibilityRole="tab" accessibilityState={{ selected: tab === kind }}
            accessibilityLabel={`${sectionInfo[kind].title}, ${count(kind)} ${count(kind) === 1 ? 'story' : 'stories'}`}
            onPress={() => select(kind)}
            className={`min-h-11 flex-1 items-center justify-center rounded-[9px] px-1 ${tab === kind ? 'bg-paper' : ''}`}>
            <Text className={`text-[13px] font-medium ${tab === kind ? 'text-ink' : 'text-muted'}`}>
              {sectionInfo[kind].title} ({count(kind)})
            </Text>
          </Pressable>)}
        </View>
        <Text className="mb-3 mt-3 text-[12px] text-muted">{sectionInfo[tab].caption}</Text>
      </View>}
      ListFooterComponent={<>
        {session && (savedStories.loading || savedStories.items.length || savedStories.error) ? <View className="mt-6">
          <Text className="text-[18px] font-medium text-ink">Saved audio stories</Text>
          {savedStories.error ? <View className="mt-3 gap-2">
            <Text accessibilityRole="alert" className="text-[13px] text-rust">{savedStories.error}</Text>
            <Button title="Retry loading saved stories" secondary onPress={() => { void refreshSaved(); }} />
          </View> : null}
          {savedStories.loading && !savedStories.items.length ? <LoadingSkeleton variant="grid" label="Loading saved stories" className="mt-5" />
            : <AudioStoryGrid stories={savedStories.items} />}
        </View> : null}
        {bookmarks.length ? <View className="mt-6">
          <Text className="mb-2 text-[18px] font-medium text-ink">Saved creations</Text>
          {bookmarks.map(item => <CreationCard key={item.id} item={item} origin="library" />)}
        </View> : null}
      </>}
    />
  </Shell>;
}
