import { LoadingSkeleton } from "../components/loading-skeleton";
import { useCallback, useEffect, useRef } from "react";
import { router, useFocusEffect } from "expo-router";
import {
  Keyboard,
  Linking,
  Platform,
  Pressable,
  Text,
  View,
} from "react-native";
import { Shell } from "../components/shell";
import { Body, Button, colors, Heading, Icon } from "../components/ui";
import { RecordingTimelineItem } from "../components/recording/recording-timeline-item";
import { DraggableRecordingList } from "../components/recording/draggable-recording-list";
import { useSegmentDrag } from "../hooks/use-segment-drag";
import { StoryTitle } from "../components/story-title";
import { StoryCoverPicker } from "../components/story-cover-picker";
import { StoryActions } from "../components/story-actions";
import { ContinueReading } from "../components/read-along/continue-reading";
import { useStudio } from "../context/studio";
import { useTimelinePlayback } from "../hooks/use-timeline-playback";
import {
  formatDuration,
  newProjectId,
} from "../utils/recordings";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";
import type { FlatList } from "react-native-gesture-handler";
import type { RecordingSegment } from "../types/recording";

export default function Create() {
  const { storyOpen, openStory } = useStudio();
  // Reached from the tab bar with no story open: start a fresh one instead of bouncing to Home.
  useEffect(() => {
    if (!storyOpen) openStory(newProjectId());
  }, [openStory, storyOpen]);
  return storyOpen ? (
    <StoryWorkspace />
  ) : (
    <Shell scroll={false}>
      <LoadingSkeleton
        variant="workspace"
        label="Opening a new story"
        className="mt-6 w-full max-w-[480px] self-center"
      />
    </Shell>
  );
}

function StoryWorkspace() {
  const {
    timeline,
    session,
    storyId,
    recorder,
    draft,
    autoRecord,
    consumeAutoRecord,
    stories,
  } = useStudio();
  const audio = useTimelinePlayback();
  const { refresh, ready } = timeline;
  const { start, finish, phase, duration, error, permissionBlocked } = recorder;
  const list = useRef<FlatList<RecordingSegment>>(null);
  const scrollToLatest = useRef(false);
  const previousLastId = useRef<string | undefined>(undefined);
  const holding = useRef(false);
  const capturing = phase === "starting" || phase === "recording";
  const finalizing = phase === "stopping" || phase === "saving";
  const fade = useSharedValue(1);
  useEffect(() => {
    fade.value = withTiming(capturing ? 0.18 : 1, { duration: 180 });
  }, [capturing, fade]);
  const timelineStyle = useAnimatedStyle(() => ({ opacity: fade.value }));
  const { stop } = audio;
  const dragState = useSegmentDrag(
    timeline.segments,
    session?.user.id ?? null,
    ready && phase === "idle" && !stories.saving,
    timeline.move,
    stop,
  );
  const unavailable =
    !ready ||
    finalizing ||
    phase === "error" ||
    dragState.dragging ||
    stories.saving;
  const begin = useCallback(() => {
    if (
      holding.current ||
      dragState.dragging ||
      !ready ||
      phase !== "idle" ||
      stories.saving
    )
      return;
    holding.current = true;
    scrollToLatest.current = true;
    previousLastId.current = timeline.segments.at(-1)?.id;
    Keyboard.dismiss();
    stop();
    void start();
  }, [
    dragState.dragging,
    phase,
    ready,
    start,
    stop,
    stories.saving,
    timeline.segments,
  ]);
  const release = useCallback(() => {
    if (!holding.current) return;
    holding.current = false;
    void finish();
  }, [finish]);
  useEffect(() => {
    if (
      holding.current ||
      !autoRecord ||
      !ready ||
      draft.loading ||
      phase !== "idle" ||
      stories.saving
    )
      return;
    consumeAutoRecord();
    holding.current = true;
    scrollToLatest.current = true;
    void start();
  }, [
    autoRecord,
    consumeAutoRecord,
    draft.loading,
    phase,
    ready,
    start,
    stories.saving,
  ]);
  // Navigation, OS interruptions, and touch cancellation all finalize the take.
  useFocusEffect(useCallback(() => release, [release]));
  useEffect(() => {
    if (Platform.OS !== "web") return;
    window.addEventListener("blur", release);
    return () => window.removeEventListener("blur", release);
  }, [release]);
  useFocusEffect(
    useCallback(() => {
      if (ready) void refresh();
    }, [ready, refresh]),
  );
  const { toggle } = audio;
  const play = useCallback(
    (segment: RecordingSegment) => {
      void toggle(segment);
    },
    [toggle],
  );

  const { remove } = timeline;
  const deleteSegment = useCallback(
    (id: string) => {
      if (audio.activeId === id) stop();
      remove(id);
    },
    [audio.activeId, remove, stop],
  );

  return (
    <Shell scroll={false} quiet={capturing}>
      <Animated.View
        className="flex-1"
        style={timelineStyle}
        pointerEvents={capturing ? "none" : "auto"}
        accessibilityElementsHidden={capturing}
        importantForAccessibility={capturing ? "no-hide-descendants" : "auto"}
      >
        <DraggableRecordingList
          key={`${session?.user.id ?? "guest"}:${dragState.generation}`}
          onDragBegin={dragState.onDragBegin}
          onDragEnd={dragState.onDragEnd}
          autoscrollThreshold={64}
          autoscrollSpeed={140}
          activationDistance={8}
          ref={list}
          onContentSizeChange={() => {
            if (
              scrollToLatest.current &&
              timeline.segments.at(-1)?.id !== previousLastId.current
            ) {
              list.current?.scrollToEnd({ animated: true });
              scrollToLatest.current = false;
            }
          }}
          className="w-full max-w-[480px] flex-1 self-center"
          contentContainerClassName="pb-3 pt-6"
          data={dragState.data}
          keyExtractor={(item) => item.id}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          refreshing={
            !dragState.dragging &&
            timeline.loading &&
            timeline.segments.length > 0
          }
          onRefresh={
            dragState.dragging
              ? undefined
              : () => {
                  void refresh();
                }
          }
          ListHeaderComponent={
            <View className="mb-7">
              <Heading>Create</Heading>
              <StoryCoverPicker disabled={phase !== "idle" || stories.saving} />
              <StoryTitle key={`${session?.user.id ?? "guest"}:${storyId ?? "legacy"}`}
                disabled={phase !== "idle" || stories.saving || dragState.dragging} />
              <StoryActions disabled={phase !== "idle" || dragState.dragging} />
              {timeline.error && (
                <View className="mt-4 gap-2">
                  <Text
                    accessibilityRole="alert"
                    className="text-[13px] text-rust"
                  >
                    {timeline.error}
                  </Text>
                  <Button
                    title="Retry sync"
                    secondary
                    onPress={() => {
                      void refresh();
                    }}
                  />
                </View>
              )}
              {timeline.deletionSyncError && (
                <View className="mt-4 gap-2">
                  <Text
                    accessibilityRole="alert"
                    className="text-[13px] text-rust"
                  >
                    A segment was removed here, but the deletion could not sync
                    yet.
                  </Text>
                  <Button
                    title="Retry syncing deletions"
                    secondary
                    onPress={timeline.retryDeletions}
                  />
                </View>
              )}
              {timeline.diskError && (
                <View className="mt-4 gap-2">
                  <Text
                    accessibilityRole="alert"
                    className="text-[13px] text-rust"
                  >
                    {timeline.diskError}
                  </Text>
                  <Button
                    title="Retry device storage"
                    secondary
                    onPress={timeline.retryLocalSave}
                  />
                </View>
              )}
              {!session && timeline.segments.length > 0 && (
                <Button
                  className="mt-4"
                  title="Sign in to save to your account"
                  secondary
                  onPress={() => router.push("/auth")}
                />
              )}
              {timeline.guestCount > 0 && (
                <Button
                  className="mt-4"
                  title={`Add ${timeline.guestCount} device recording${timeline.guestCount === 1 ? "" : "s"} to my account`}
                  secondary
                  onPress={timeline.claimGuestRecordings}
                />
              )}
            </View>
          }
          ListEmptyComponent={
            !ready || timeline.loading ? (
              <LoadingSkeleton label="Loading your moments" />
            ) : (
              <View className="rounded-[20px] border border-line bg-cream px-6 py-9">
                <Text className="text-[19px] font-medium text-ink">
                  A story starts with a moment.
                </Text>
                <Body className="mt-3">
                  A memory, a little adventure, a familiar voice. Hold the
                  microphone below to add your first moment.
                </Body>
              </View>
            )
          }
          renderItem={({ item, getIndex, drag, isActive }) => {
            const index = getIndex() ?? 0;
            const active = audio.activeId === item.id;
            const duration =
              active && audio.durationMs > 0
                ? audio.durationMs
                : item.durationMs;
            return (
              <RecordingTimelineItem
                recording={item}
                disabled={
                  recorder.phase !== "idle" ||
                  dragState.dragging ||
                  stories.saving
                }
                playing={active && audio.playing}
                loading={active && audio.loading}
                progress={
                  active
                    ? Math.min(1, Math.max(0, audio.positionMs / duration))
                    : 0
                }
                playbackError={active ? audio.error : undefined}
                onPlay={play}
                onRetry={timeline.retry}
                onRename={timeline.rename}
                onDelete={deleteSegment}
                drag={drag}
                isDragging={isActive}
                position={index + 1}
                total={dragState.data.length}
                onMoveEarlier={() => {
                  if (index > 0)
                    timeline.move(item.id, dragState.data[index - 1].id);
                }}
                onMoveLater={() => {
                  if (index + 1 < dragState.data.length)
                    timeline.move(
                      item.id,
                      dragState.data[index + 2]?.id ?? null,
                    );
                }}
              />
            );
          }}
          ListFooterComponent={
            <View>
              {timeline.segments.length > 0 && (
                <Text className="mb-3 text-[12px] text-muted">
                  {timeline.segments.length}{" "}
                  {timeline.segments.length === 1 ? "moment" : "moments"} ·{" "}
                  {formatDuration(
                    timeline.segments.reduce(
                      (total, segment) => total + segment.durationMs,
                      0,
                    ),
                  )}{" "}
                  in your draft
                </Text>
              )}
            </View>
          }
        />
      </Animated.View>
      <View className="w-full max-w-[480px] self-center border-t border-line py-4">
        <View className="flex-row items-center gap-5">
          {/* Tap to start, tap again to stop. Keep it enabled while recording. */}
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={
              capturing ? "Stop recording" : "Record a story moment"
            }
            accessibilityHint={
              capturing
                ? "Tap to add this recording to your story."
                : "Tap to start recording. Tap again when you are finished."
            }
            accessibilityState={{ disabled: unavailable, busy: finalizing }}
            disabled={unavailable}
            onPress={() => {
              if (capturing) release();
              else begin();
            }}
            className={`h-24 w-24 items-center justify-center rounded-full border-[6px] ${capturing ? "border-line bg-rust" : "border-cream bg-cocoa"} ${unavailable ? "opacity-50" : ""}`}
          >
            {finalizing ? (
              <LoadingSkeleton variant="inline" label="Saving your recording" />
            ) : (
              <Icon
                name={capturing ? "stop" : "mic"}
                size={34}
                color={colors.paper}
              />
            )}
          </Pressable>
          <View className="min-h-[100px] flex-1 justify-center">
            <View className="flex-row items-center gap-2">
              {phase === "recording" && (
                <View className="h-2 w-2 rounded-full bg-rust" />
              )}
              <Text
                className="text-[15px] font-medium text-ink"
                accessibilityLiveRegion="polite"
              >
                {phase === "recording"
                  ? "Recording"
                  : phase === "starting"
                    ? "Opening microphone…"
                    : finalizing
                      ? "Adding your moment…"
                      : phase === "error"
                        ? "Let’s keep this moment"
                        : "Tap to record"}
              </Text>
            </View>
            {capturing || finalizing ? (
              <Text
                className="mt-1 text-[36px] font-light text-ink"
                style={{ fontVariant: ["tabular-nums"] }}
              >
                {formatDuration(duration)}
              </Text>
            ) : null}
          </View>
        </View>
        {error && (
          <Text
            accessibilityRole="alert"
            className="mt-3 text-[12px] leading-[18px] text-rust"
          >
            {error}
          </Text>
        )}
        {phase === "error" && (
          <Button
            title="Retry finishing this moment"
            secondary
            className="mt-3"
            onPress={() => {
              void finish();
            }}
          />
        )}
        {permissionBlocked && Platform.OS !== "web" && (
          <Button
            title="Open microphone settings"
            secondary
            className="mt-3"
            onPress={() => {
              void Linking.openSettings();
            }}
          />
        )}
      </View>
    </Shell>
  );
}
