import { LoadingSkeleton } from '../components/loading-skeleton';
import { useCallback, useRef } from 'react';
import { router, useFocusEffect } from 'expo-router';
import { Pressable, Text, View } from 'react-native';
import { Shell } from '../components/shell';
import { AudioStoryGrid } from '../components/audio-story-grid';
import { openSentStory } from '../components/inbox-list';
import { Body, Button, colors, Heading, Icon } from '../components/ui';
import { useStudio } from '../context/studio';
import { useCommunityStories } from '../hooks/use-community-stories';
import { formatRecordingDay, newProjectId } from '../utils/recordings';

const RECENT_LIMIT = 3;
const EXPLORE_LIMIT = 4;

function openCommunity() {
  router.replace({ pathname: '/explore', params: { tab: 'audio' } });
}

function SectionHeader({ title, action, onAction }: { title: string; action?: string; onAction?: () => void }) {
  return <View className="mb-3 flex-row items-center justify-between">
    <Text accessibilityRole="header" className="text-[20px] font-medium text-ink">{title}</Text>
    {action && onAction ? <Pressable accessibilityRole="link" onPress={onAction} className="min-h-11 flex-row items-center gap-1 pl-3">
      <Text className="text-[13px] font-medium text-cocoa">{action}</Text>
      <Icon name="arrow" size={16} color={colors.cocoa} />
    </Pressable> : null}
  </View>;
}

/** Home: start a recording, return to recent stories, and browse a slice of the community. */
export default function Home() {
  const { timeline, recorder, openStory, stories, name, authLoading, session, inbox } = useStudio();
  const community = useCommunityStories(authLoading);
  const opening = useRef(false);
  useFocusEffect(useCallback(() => { opening.current = false; }, []));
  const unavailable = !timeline.ready || recorder.phase !== 'idle';
  const enter = (id: string | null, record = false) => {
    if (unavailable || opening.current) return;
    opening.current = true;
    openStory(id, record);
    router.push('/create');
  };
  const recent = timeline.projects.slice(0, RECENT_LIMIT);
  const titleFor = (id: string | null, index: number) =>
    stories.items.find(item => item.creation_session_id === id)?.title
    ?? (id ? `Story ${timeline.projects.length - index}` : 'Your earlier story');

  const newest = session ? inbox.items.find(item => !item.listenedAt) : undefined;

  return (
    <Shell>
      <View className="w-full max-w-[700px] self-center pt-9">
        {/* Someone sent you a story */}
        {newest ? <View className="mb-6 flex-row items-center gap-2 rounded-[14px] border border-line bg-cream py-1 pl-3 pr-1">
          <View className="h-2.5 w-2.5 rounded-full bg-rust" />
          <Pressable accessibilityRole="link"
            accessibilityLabel={`New story from ${newest.senderName}: ${newest.title}. Open it.`}
            onPress={() => openSentStory(newest, inbox.markListened)}
            className="min-h-11 flex-1 justify-center py-1.5 active:opacity-70">
            <Text numberOfLines={1} className="text-[13px] text-ink">
              <Text className="font-semibold">{newest.senderName}</Text> sent you a story
            </Text>
            <Text numberOfLines={1} className="text-[12px] text-muted">
              {newest.title}{inbox.unheard > 1 ? ` · and ${inbox.unheard - 1} more` : ''}
            </Text>
          </Pressable>
          {inbox.unheard > 1 ? <Pressable accessibilityRole="link" accessibilityLabel="View all stories sent to you"
            onPress={() => router.replace('/family')} className="min-h-11 justify-center px-2">
            <Text className="text-[12px] font-medium text-cocoa">View all</Text>
          </Pressable> : <View className="pr-2"><Icon name="arrow" size={16} color={colors.cocoa} /></View>}
        </View> : null}

        <Heading>{name ? `Welcome back, ${name}` : 'Welcome to TedTime'}</Heading>
        <Body className="mt-2">Send your stories to the people you love, no matter where they are.</Body>

        {/* Start recording */}
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Tap to record a new story"
          accessibilityHint="Creates a new story, opens Create, and starts the microphone."
          accessibilityState={{ disabled: unavailable, busy: !timeline.ready }}
          disabled={unavailable}
          onPress={() => enter(newProjectId(), true)}
          className={`mt-6 flex-row items-center gap-5 rounded-[20px] bg-cream p-5 active:opacity-80 ${unavailable ? 'opacity-60' : ''}`}
        >
          <View className="h-[76px] w-[76px] items-center justify-center rounded-full bg-cocoa">
            {!timeline.ready ? <LoadingSkeleton variant="inline" label="Preparing recorder" /> : <Icon name="mic" size={36} color={colors.paper} />}
          </View>
          <View className="flex-1">
            <Text className="text-[18px] font-medium text-ink">Tap to record</Text>
            <Text className="mt-1 text-[13px] leading-[19px] text-muted">Start a new story. Just bring your voice.</Text>
          </View>
        </Pressable>
        {timeline.diskError && <View className="mt-4 gap-3">
          <Text accessibilityRole="alert" className="text-[13px] text-rust">{timeline.diskError}</Text>
          <Button title="Retry device storage" secondary onPress={timeline.retryLocalSave} />
        </View>}

        {/* Pick up where you left off */}
        <View className="mt-10">
          <SectionHeader title="Pick up where you left off"
            action={timeline.projects.length > RECENT_LIMIT ? 'See all' : undefined} onAction={() => router.replace('/library')} />
          {!recent.length && (!timeline.ready || timeline.loading || stories.loading) ? <LoadingSkeleton label="Loading recent stories" /> : recent.length ? recent.map((project, index) => <Pressable
            key={project.id ?? 'legacy'}
            accessibilityRole="button"
            accessibilityLabel={`Continue ${titleFor(project.id, index)}`}
            disabled={unavailable}
            accessibilityState={{ disabled: unavailable }}
            onPress={() => enter(project.id)}
            className="mb-3 min-h-[64px] flex-row items-center gap-4 rounded-[14px] border border-line bg-paper px-4 py-3 active:opacity-70"
          >
            <Icon name="book" color={colors.cocoa} />
            <View className="flex-1">
              <Text numberOfLines={1} className="text-[14px] font-medium text-ink">{titleFor(project.id, index)}</Text>
              <Text className="mt-1 text-[12px] text-muted">{formatRecordingDay(project.createdAt)} · {project.moments} {project.moments === 1 ? 'moment' : 'moments'}</Text>
            </View>
            <Icon name="arrow" size={18} color={colors.muted} />
          </Pressable>) : <View className="rounded-[14px] border border-dashed border-line p-5">
            <Text className="text-[13px] text-muted">Your recordings will show up here. Tap to record to begin your first story.</Text>
          </View>}
        </View>

        {/* Explore: a slice of the community */}
        <View className="mt-10">
          <SectionHeader title="Explore" action="See all" onAction={openCommunity} />
          <Body className="-mt-1 !text-[13px]">Stories from the community, ready to play.</Body>
          {community.error ? <View className="mt-4 gap-3">
            <Text accessibilityRole="alert" className="text-[13px] text-rust">{community.error}</Text>
            <Button title="Retry" secondary onPress={() => { void community.refresh(); }} />
          </View> : (community.loading || authLoading) && !community.items.length ? <LoadingSkeleton variant="grid" label="Loading stories" className="mt-5" />
            : community.items.length ? <AudioStoryGrid stories={community.items.slice(0, EXPLORE_LIMIT)} />
              : <View className="mt-4 rounded-[14px] border border-dashed border-line p-5">
                <Text className="text-[13px] text-muted">No stories in the community yet. Publish one from Create to be the first!</Text>
              </View>}
          <Button title="See more" secondary className="mt-5" onPress={openCommunity} />
        </View>
      </View>
    </Shell>
  );
}
