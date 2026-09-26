import { useState } from "react";
import { Pressable, Text, TextInput, View } from "react-native";
import { Shell } from "../components/shell";
import { Body, colors, Heading, Icon } from "../components/ui";
import { CreationCard } from "../components/creation-card";
import { useStudio } from "../context/studio";

export default function Explore() {
  const { creations } = useStudio();
  const [category, setCategory] = useState("All");
  const [query, setQuery] = useState("");
  const items = creations.filter(
    (item) =>
      (category === "All" || item.category === category) &&
      `${item.title} ${item.author}`
        .replace("\n", " ")
        .toLowerCase()
        .includes(query.trim().toLowerCase()),
  );
  return (
    <Shell>
      <View className="w-full max-w-[700px] self-center pt-9">
        <Heading>Explore</Heading>
        <Body className="mt-2">
          Stories, thoughts, and art from the community.
        </Body>
        <View className="mt-7 flex-row items-center gap-3 rounded-[10px] bg-cream px-4">
          <Icon name="search" size={20} color={colors.muted} />
          <TextInput
            accessibilityLabel="Search community creations"
            value={query}
            onChangeText={setQuery}
            placeholder="Find a story or creator"
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
        <View className="mt-5 flex-row flex-wrap gap-[22px] border-b border-line">
          {["All", "Stories", "Journals", "Art"].map((value) => (
            <Pressable
              accessibilityRole="button"
              accessibilityState={{ selected: category === value }}
              onPress={() => setCategory(value)}
              key={value}
              className={`min-h-11 justify-center ${category === value ? "border-b-2 border-ink" : ""}`}
            >
              <Text
                className={`text-[12px] ${category === value ? "text-ink" : "text-muted"}`}
              >
                {value}
              </Text>
            </Pressable>
          ))}
        </View>
        {items.map((item) => (
          <CreationCard key={item.id} item={item} />
        ))}
        {!items.length && (
          <Body className="mt-[70px] text-center">
            No results. Try another search.
          </Body>
        )}
      </View>
    </Shell>
  );
}
