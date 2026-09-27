import { LoadingSkeleton } from '../components/loading-skeleton';
import { useState } from "react";
import { useLocalSearchParams } from "expo-router";
import { Pressable, Text, TextInput, View } from "react-native";
import { Shell } from "../components/shell";
import { Body, Button, colors, Heading, Icon } from "../components/ui";
import { CreationTile } from "../components/creation-card";
import { AudioStoryGrid } from "../components/audio-story-grid";
import { useStudio } from "../context/studio";
import { useCommunityStories } from "../hooks/use-community-stories";

const tabs = ["Written Stories", "Audio Stories"] as const;
type Tab = (typeof tabs)[number];

export default function Explore() {
  const { creations, authLoading } = useStudio();
  // Home's "See all" opens the community straight to Audio Stories (?tab=audio).
  const { tab: requested } = useLocalSearchParams<{ tab?: string }>();
  const [tab, setTab] = useState<Tab>(requested === "audio" ? "Audio Stories" : "Written Stories");
  const [query, setQuery] = useState("");
  const audio = useCommunityStories(authLoading);
  const search = query.trim().toLowerCase();
  const items = creations.filter((item) =>
    `${item.title} ${item.author}`
      .replace("\n", " ")
      .toLowerCase()
      .includes(search),
  );
  const audioItems = audio.items.filter((story) =>
    `${story.title} ${story.description}`.toLowerCase().includes(search),
  );
  return (
    <Shell>
      <View className="w-full max-w-[700px] self-center pt-9">
        <Heading>Explore</Heading>
        <Body className="mt-2">
          Search our community and find stories to read, as well as pre-recorded audio to share!
        </Body>
        <View accessibilityRole="tablist" className="mt-6 flex-row rounded-[12px] bg-cream p-1">
          {tabs.map((value) => (
            <Pressable
              key={value}
              accessibilityRole="tab"
              accessibilityState={{ selected: tab === value }}
              onPress={() => setTab(value)}
              className={`min-h-11 flex-1 items-center justify-center rounded-[9px] ${tab === value ? "bg-paper" : ""}`}
            >
              <Text className={`text-[13px] font-medium ${tab === value ? "text-ink" : "text-muted"}`}>{value}</Text>
            </Pressable>
          ))}
        </View>
        <View className="mt-4 flex-row items-center gap-3 rounded-[10px] bg-cream px-4">
          <Icon name="search" size={20} color={colors.muted} />
          <TextInput
            accessibilityLabel={tab === "Audio Stories" ? "Search audio stories" : "Search community creations"}
            value={query}
            onChangeText={setQuery}
            placeholder={tab === "Audio Stories" ? "Find an audio story" : "Find a story or creator"}
            placeholderTextColor={colors.muted}
            className="min-h-[50px] flex-1 text-[14px] text-ink"
          />
          {query ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Clear search"
              onPress={() => setQuery("")}
              className="min-h-11 min-w-9 items-center justify-center"
            >
              <Icon name="close" size={18} />
            </Pressable>
          ) : null}
        </View>
        {tab === "Written Stories" ? (
          <>
            <View className="mt-5 flex-row flex-wrap justify-between gap-y-4">
              {items.map((item) => (
                <CreationTile key={item.id} item={item} />
              ))}
            </View>
            {!items.length && (
              <Body className="mt-[70px] text-center">
                No results. Try another search.
              </Body>
            )}
          </>
        ) : audio.error ? (
          <View className="mt-[60px] items-center gap-4">
            <Text accessibilityRole="alert" className="text-center text-[13px] text-rust">{audio.error}</Text>
            <Button title="Retry" secondary onPress={() => { void audio.refresh(); }} />
          </View>
        ) : (audio.loading || authLoading) && !audio.items.length ? (
          <LoadingSkeleton variant="grid" label="Loading audio stories" className="mt-5" />
        ) : audioItems.length ? (
          <AudioStoryGrid stories={audioItems} />
        ) : (
          <Body className="mt-[70px] text-center">
            {search ? "No results. Try another search." : "No audio stories yet. Publish one to the community from Create!"}
          </Body>
        )}
      </View>
    </Shell>
  );
}
