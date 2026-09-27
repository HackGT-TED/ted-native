import { useState } from "react";
import { router } from "expo-router";
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  Text,
  TextInput,
  View,
} from "react-native";
import { Shell } from "../components/shell";
import { Body, Button, colors, Heading } from "../components/ui";
import { useStudio } from "../context/studio";

export default function Create() {
  const { name, session, authLoading, addCreation } = useStudio();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("Stories");
  const [error, setError] = useState("");
  const [created, setCreated] = useState("");
  function publish() {
    if (!title.trim() || !description.trim()) {
      setError("Add a title and description.");
      return;
    }
    if (authLoading) return;
    if (!session) {
      router.push("/auth");
      return;
    }
    const id = `creation-${Date.now()}`;
    addCreation({
      id,
      title: title.trim(),
      subtitle: description.trim(),
      category,
      color: colors.cream,
      author: name,
    });
    setError("");
    setCreated(id);
  }
  return (
    <Shell>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        className="w-full max-w-[480px] self-center pt-9"
      >
        <Heading>{created ? "Shared." : "Create"}</Heading>
        <Body className="mt-2">
          {created
            ? "Your creation is now in Explore."
            : "Share a little of your world with the community."}
        </Body>
        {created ? (
          <View className="mt-9 gap-3">
            <Button
              title="View creation"
              onPress={() =>
                router.push({ pathname: "/item/[id]", params: { id: created } })
              }
            />
            <Button
              title="Create another"
              secondary
              onPress={() => {
                setCreated("");
                setTitle("");
                setDescription("");
              }}
            />
          </View>
        ) : (
          <>
            <Text className="mb-1.5 mt-4 text-[13px] leading-4 tracking-[-0.15px] text-ink">Category</Text>
            <View className="flex-row gap-2.5">
              {["Stories", "Journals", "Art"].map((item) => (
                <Pressable
                  key={item}
                  accessibilityRole="button"
                  accessibilityState={{ selected: category === item }}
                  onPress={() => setCategory(item)}
                  className={`min-h-11 flex-1 items-center justify-center rounded-lg border ${category === item ? "border-ink bg-ink" : "border-line"}`}
                >
                  <Text
                    className={`text-[13px] ${category === item ? "text-paper" : "text-muted"}`}
                  >
                    {item}
                  </Text>
                </Pressable>
              ))}
            </View>
            <Text className="mb-1.5 mt-4 text-[13px] leading-4 tracking-[-0.15px] text-ink">Title</Text>
            <TextInput
              accessibilityLabel="Creation title"
              value={title}
              onChangeText={setTitle}
              maxLength={65}
              placeholder="Give it a name"
              placeholderTextColor={colors.muted}
              className="min-h-[52px] rounded-[10px] border border-line bg-paper px-4 text-[15px] tracking-[-0.2px] text-ink"
            />
            <Text className="mb-1.5 mt-4 text-[13px] leading-4 tracking-[-0.15px] text-ink">Description</Text>
            <TextInput
              accessibilityLabel="Creation description"
              value={description}
              onChangeText={setDescription}
              maxLength={160}
              multiline
              placeholder="A few words about your creation"
              placeholderTextColor={colors.muted}
              className="min-h-[130px] rounded-[10px] border border-line bg-paper px-4 py-3 text-[15px] leading-5 tracking-[-0.2px] text-ink align-top"
            />
            {error ? (
              <Text accessibilityRole="alert" className="my-3 text-[13px] leading-[18px] tracking-[-0.15px] text-rust">
                {error}
              </Text>
            ) : null}
            <Button
              title={
                authLoading
                  ? "Restoring session…"
                  : session
                    ? "Share with community"
                    : "Sign in to share"
              }
              disabled={authLoading}
              onPress={publish}
              className="mt-5"
            />
            <Body className="mt-4 text-center !text-[11px]">
              Shared creations are available for this demo session.
            </Body>
          </>
        )}
      </KeyboardAvoidingView>
    </Shell>
  );
}
