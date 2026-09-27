import { useState } from 'react';
import { router } from 'expo-router';
import { Text, View } from 'react-native';
import { useStudio } from '../context/studio';
import type { MarketplaceStory } from '../hooks/use-marketplace-stories';
import { AudioStoryTile } from './audio-story-tile';

/** Story tiles that open the player page; saves sync to the user's library. */
export function AudioStoryGrid({ stories }: { stories: MarketplaceStory[] }) {
  const { savedStories, session } = useStudio();
  const [saveError, setSaveError] = useState('');
  return <View className="mt-5">
    {saveError ? <Text accessibilityRole="alert" className="mb-3 text-[12px] text-rust">{saveError}</Text> : null}
    <View className="flex-row flex-wrap justify-between gap-y-4">
      {stories.map(story => <AudioStoryTile
        key={story.id}
        story={story}
        own={story.authorId === session?.user.id}
        saved={savedStories.ids.has(story.id)}
        saving={savedStories.pending.includes(story.id)}
        onOpen={() => router.push({ pathname: '/story/[id]', params: { id: story.id } })}
        onToggleSave={() => {
          if (!session) { router.push('/auth'); return; }
          setSaveError('');
          savedStories.toggle(story).catch((cause: unknown) => {
            setSaveError(cause instanceof Error ? cause.message : 'Could not update your library. Please retry.');
          });
        }}
      />)}
    </View>
  </View>;
}
