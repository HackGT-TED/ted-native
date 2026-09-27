import { Image } from 'expo-image';
import { router, useLocalSearchParams } from 'expo-router';
import { ActivityIndicator, Linking, Pressable, Text, useWindowDimensions, View } from 'react-native';
import { Shell } from '../../components/shell';
import { Body, Button, colors, Heading, Icon } from '../../components/ui';
import { storyCovers } from '../../content/story-covers';
import { useWrittenStory } from '../../hooks/use-written-stories';

function goBack() {
  if (router.canGoBack()) router.back();
  else router.replace('/explore');
}

/** Reads a written story: its cover, then the full text, then where it came from. */
export default function ReadStory() {
  const { slug } = useLocalSearchParams<{ slug: string }>();
  const { story, loading, error, refresh } = useWrittenStory(slug);
  const art = Math.min(useWindowDimensions().width - 48, 320);
  const cover = slug ? storyCovers[slug] : undefined;

  return <Shell><View className="w-full max-w-[600px] self-center pb-12 pt-3">
    <Pressable accessibilityRole="button" accessibilityLabel="Back" onPress={goBack}
      className="min-h-[60px] flex-row items-center gap-2.5 self-start pr-4">
      <Icon name="back" size={18} /><Text className="text-[13px] text-muted">Back</Text>
    </Pressable>

    {loading && !story ? <ActivityIndicator accessibilityLabel="Loading story" className="mt-[80px]" color={colors.cocoa} />
      : error ? <View className="mt-[60px] items-center gap-4">
        <Text accessibilityRole="alert" className="text-center text-[13px] text-rust">{error}</Text>
        <Button title="Retry" secondary onPress={() => { void refresh(); }} />
      </View>
      : !story ? <View className="mt-[60px] items-center gap-2">
        <Heading className="text-center">Story not found</Heading>
        <Body className="text-center">It may have been removed.</Body>
      </View>
      : <>
        {cover ? <View className="items-center">
          <View className="overflow-hidden rounded-2xl bg-cream"
            style={{ width: art, shadowColor: colors.ink, shadowOpacity: 0.15, shadowRadius: 14, shadowOffset: { width: 0, height: 8 }, elevation: 6 }}>
            <Image source={cover} contentFit="cover" style={{ width: art, aspectRatio: 0.78 }} accessibilityIgnoresInvertColors />
          </View>
        </View> : null}

        <Heading className="mt-8 !text-[32px] !leading-[40px]">{story.title}</Heading>
        <Text className="mt-2 text-[14px] text-ink">{story.author}</Text>
        <Text className="mt-1 text-[12px] text-muted">{story.category} · {story.reading_minutes} min read aloud</Text>

        <View className="mt-8 gap-5">
          {story.paragraphs.map((paragraph, index) => <Text key={index}
            className={`text-[17px] leading-[28px] text-ink ${paragraph.includes('\n') ? 'pl-4 italic' : ''}`}>
            {paragraph}
          </Text>)}
        </View>

        <View className="mt-10 gap-2 border-t border-line pt-5">
          <Text className="text-[12px] leading-[18px] text-muted">
            Text from {story.source_title}, courtesy of Project Gutenberg. This story is in the public domain.
          </Text>
          <Text className="text-[12px] leading-[18px] text-muted">{story.cover_credit}</Text>
          <Pressable accessibilityRole="link" onPress={() => { void Linking.openURL(story.source_url); }} className="min-h-11 justify-center self-start">
            <Text className="text-[12px] font-medium text-cocoa">View the source on Project Gutenberg</Text>
          </Pressable>
        </View>
      </>}
  </View></Shell>;
}
