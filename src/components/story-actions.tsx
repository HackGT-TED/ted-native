import { useEffect, useRef, useState } from "react";
import { router } from "expo-router";
import { Switch, Text, View } from "react-native";
import Toast from "react-native-toast-message";
import { useStudio } from "../context/studio";
import { prepareStoryAudio } from "../services/publish-story";
import { warmUp } from "../services/story-api";
import { personName, sendStory, type Person } from "../services/story-shares";
import { StoryRecipients } from "./story-recipients";
import { Button, colors } from "./ui";

export function StoryActions({ disabled }: { disabled: boolean }) {
  const { draft, cover, timeline, stories, storyId, session, authLoading } =
    useStudio();
  const [feedback, setFeedback] = useState<{
    key: string;
    message: string;
    error: boolean;
  } | null>(null);
  const key = `${session?.user.id ?? "guest"}:${storyId ?? "legacy"}`;
  const busy = useRef(false);
  const [publishing, setPublishing] = useState(false);
  // Per story: off by default, or whatever the story was last published with.
  const [communityChoice, setCommunityChoice] = useState<{
    key: string;
    on: boolean;
  } | null>(null);
  // Per story: the people to send it to when it is published.
  const [recipientChoice, setRecipientChoice] = useState<{
    key: string;
    people: Person[];
  } | null>(null);
  const recipients = recipientChoice?.key === key ? recipientChoice.people : [];
  // The story server sleeps when idle; wake it before anyone taps Publish.
  useEffect(() => {
    void warmUp();
  }, []);
  const locked =
    disabled ||
    authLoading ||
    stories.saving ||
    publishing ||
    cover.uploading ||
    draft.loading ||
    !draft.editable ||
    !timeline.ready;
  const save = async (publish: boolean) => {
    if (locked || busy.current) return;
    if (!session) {
      router.push("/auth");
      return;
    }
    if (timeline.syncPending || timeline.loading || timeline.error) {
      setFeedback({
        key,
        message:
          "Wait for your moments and edits to finish syncing. Retry any failed uploads first.",
        error: true,
      });
      return;
    }
    if (publish && !draft.name.trim()) {
      setFeedback({
        key,
        message: "Give your story a name before publishing.",
        error: true,
      });
      return;
    }
    busy.current = true;
    setFeedback(null);
    try {
      let audio;
      if (publish) {
        setPublishing(true);
        setFeedback({
          key,
          message:
            "Adding sound effects to your story. This can take a minute…",
          error: false,
        });
        audio = await prepareStoryAudio(
          session.user.id,
          storyId,
          timeline.segments,
        );
      }
      const story = await stories.save(
        storyId,
        draft.name,
        publish,
        timeline.segments.map((segment) => segment.id),
        {
          audio,
          community: publish ? community : undefined,
          coverPath: cover.pathForSave,
        },
      );
      if (!publish) {
        Toast.show({
          type: "success",
          text1: "Creation saved",
          text2: "Your story is saved to your account.",
        });
        return;
      }
      const sentTo = publish ? recipients : [];
      if (sentTo.length) {
        await sendStory(
          story.id,
          sentTo.map((person) => person.id),
        );
        setRecipientChoice(null);
      }
      const sentNote = sentTo.length
        ? ` Sent to ${sentTo.length === 1 ? personName(sentTo[0]) : `${sentTo.length} people`}.`
        : "";
      setFeedback({
        key,
        message:
          (community
            ? "Story published to the community for everyone to see."
            : "Story published. Find it in your library.") + sentNote,
        error: false,
      });
    } catch (cause) {
      setFeedback({
        key,
        message:
          cause instanceof Error
            ? cause.message
            : "Could not save your story. Please retry.",
        error: true,
      });
    } finally {
      busy.current = false;
      setPublishing(false);
    }
  };
  const current = stories.items.find(
    (item) => item.creation_session_id === storyId,
  );
  const community =
    communityChoice?.key === key
      ? communityChoice.on
      : (current?.community ?? false);
  return (
    <View className="mt-2 gap-2">
      {current && (
        <Text className="text-[12px] text-muted">
          {current.status !== "published"
            ? "Draft"
            : current.community
              ? "Published to the community"
              : "Published story"}
        </Text>
      )}
      <View className="min-h-11 flex-row items-center justify-center gap-3">
        <Text
          nativeID="community-switch-label"
          className="text-center text-[13px] text-ink"
        >
          Make Public
        </Text>
        <Switch
          accessibilityLabel="Publish to Community for all to see!"
          accessibilityLabelledBy="community-switch-label"
          accessibilityHint="Takes effect the next time you tap Publish."
          value={community}
          onValueChange={(on) => setCommunityChoice({ key, on })}
          disabled={locked}
          trackColor={{ false: colors.line, true: colors.cocoa }}
        />
      </View>
      {session ? (
        <StoryRecipients
          selected={recipients}
          disabled={locked}
          onChange={(people) => setRecipientChoice({ key, people })}
        />
      ) : null}
      {recipients.length ? (
        <Text className="text-[11px] text-muted">
          They’ll get it in their Bear tab when you tap Publish.
        </Text>
      ) : null}
      <View className="flex-row gap-3">
        <Button
          title={stories.saving ? "Saving…" : "Save"}
          secondary
          className="flex-1"
          disabled={locked}
          onPress={() => {
            void save(false);
          }}
        />
        <Button
          title={publishing ? "Publishing…" : "Publish"}
          className="flex-1"
          disabled={locked || timeline.segments.length === 0}
          onPress={() => {
            void save(true);
          }}
        />
      </View>
      {feedback?.key === key && (
        <Text
          accessibilityRole={feedback.error ? "alert" : undefined}
          accessibilityLiveRegion="polite"
          className={`text-[12px] ${feedback.error ? "text-rust" : "text-muted"}`}
        >
          {feedback.message}
        </Text>
      )}
    </View>
  );
}
