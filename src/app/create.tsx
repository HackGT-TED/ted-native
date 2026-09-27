import { useCallback, useEffect, useRef } from "react";
import { Redirect, router, useFocusEffect } from "expo-router";
import {
  ActivityIndicator,
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
import { StoryNameForm } from "../components/story-name-form";
import { StoryActions } from "../components/story-actions";
import { CreateModeSwitch } from "../components/create-mode-switch";
import { useStudio } from "../context/studio";
import { useTimelinePlayback } from "../hooks/use-timeline-playback";
import { formatDuration } from "../utils/recordings";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";
import type { FlatList } from "react-native-gesture-handler";
import type { RecordingSegment } from "../types/recording";

export default function Create() {
  const { storyOpen } = useStudio();
  return storyOpen ? <StoryWorkspace /> : <Redirect href="/" />;
}

function StoryWorkspace() {
  const { timeline, session, recorder, draft, autoRecord, consumeAutoRecord, stories } = useStudio();
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
  const dragState = useSegmentDrag(timeline.segments, session?.user.id ?? null,
    ready && phase === "idle" && !stories.saving, timeline.move, stop);
  const unavailable = !ready || finalizing || phase === "error" || dragState.dragging || stories.saving;
  const begin = useCallback(() => {
    if (holding.current || dragState.dragging || !ready || phase !== "idle" || stories.saving) return;
    holding.current = true;
    scrollToLatest.current = true;
    previousLastId.current = timeline.segments.at(-1)?.id;
    Keyboard.dismiss();
    stop();
    void start();
  }, [dragState.dragging, phase, ready, start, stop, stories.saving, timeline.segments]);
  const release = useCallback(() => {
    if (!holding.current) return;
    holding.current = false;
    void finish();
  }, [finish]);
  const toggleRecording = useCallback(() => {
    if (capturing) {
      release();
      return;
    }
    begin();
  }, [begin, capturing, release]);
  useEffect(() => {
    if (holding.current || !autoRecord || !ready || draft.loading || phase !== "idle" || stories.saving) return;
    consumeAutoRecord();
    holding.current = true;
    scrollToLatest.current = true;
    void start();
  }, [autoRecord, consumeAutoRecord, draft.loading, phase, ready, start, stories.saving]);
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
  const deleteSegment = useCallback((id: string) => {
    if (audio.activeId === id) stop();
    remove(id);
  }, [audio.activeId, remove, stop]);

  return (
    <Shell scroll={false} quiet={capturing}>
      <View className="w-full max-w-[480px] self-center pt-6">
        <Heading>Create</Heading>
        <CreateModeSwitch mode="voice" disabled={phase !== "idle" || stories.saving} />
        <StoryNameForm disabled={phase !== "idle" || stories.saving} />
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={capturing ? "Stop recording" : "Record a moment"}
          accessibilityHint={capturing ? "Tap to add this recording to your story." : "Tap to start recording. Tap again to add it to your story."}
          accessibilityState={{ disabled: unavailable && !capturing, busy: finalizing }}
          disabled={unavailable && !capturing}
          onPress={toggleRecording}
          className={`mt-4 min-h-[88px] flex-row items-center gap-4 rounded-[18px] px-4 py-4 ${capturing ? "bg-rust" : "bg-cocoa"} ${unavailable && !capturing ? "opacity-50" : ""}`}
        >
          <View className="h-14 w-14 items-center justify-center rounded-full bg-cream">
            {finalizing ? <ActivityIndicator color={colors.cocoa} /> : <Icon name={capturing ? "stop" : "mic"} size={28} color={colors.cocoa} />}
          </View>
          <View className="flex-1">
            <Text className="text-[16px] font-medium text-paper">
              {phase === "recording" ? "Recording" : phase === "starting" ? "Opening microphone…" : finalizing ? "Adding your moment…" : phase === "error" ? "Let’s keep this moment" : "Record a moment"}
            </Text>
            {capturing || finalizing ? (
              <Text className="mt-1 text-[28px] font-light text-paper" style={{ fontVariant: ["tabular-nums"] }}>
                {formatDuration(duration)}
              </Text>
            ) : (
              <Text className="mt-1 text-[12px] leading-[18px] text-cream">Tap to start. Tap again when you are done.</Text>
            )}
          </View>
        </Pressable>
        {error && (
          <Text accessibilityRole="alert" className="mt-3 text-[12px] leading-[18px] text-rust">{error}</Text>
        )}
        {phase === "error" && (
          <Button title="Retry finishing this moment" secondary className="mt-3" onPress={() => { void finish(); }} />
        )}
        {permissionBlocked && Platform.OS !== "web" && (
          <Button title="Open microphone settings" secondary className="mt-3" onPress={() => { void Linking.openSettings(); }} />
        )}
      </View>
      <Animated.View
        className="min-h-0 w-full max-w-[480px] flex-1 self-center"
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
          className="scrollbar-none w-full flex-1"
          contentContainerClassName="pb-3 pt-4"
          data={dragState.data}
          keyExtractor={(item) => item.id}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          refreshing={!dragState.dragging && timeline.loading}
          onRefresh={dragState.dragging ? undefined : () => {
            void refresh();
          }}
          ListHeaderComponent={
            <View className="mb-3">
              {timeline.loading && (
                <ActivityIndicator className="mt-2" color={colors.cocoa} />
              )}
              {timeline.error && (
                <View className="mt-2 gap-2">
                  <Text accessibilityRole="alert" className="text-[13px] text-rust">{timeline.error}</Text>
                  <Button title="Retry sync" secondary onPress={() => { void refresh(); }} />
                </View>
              )}
              {timeline.deletionSyncError && (
                <View className="mt-2 gap-2">
                  <Text accessibilityRole="alert" className="text-[13px] text-rust">
                    A segment was removed here, but the deletion could not sync yet.
                  </Text>
                  <Button title="Retry syncing deletions" secondary onPress={timeline.retryDeletions} />
                </View>
              )}
              {timeline.diskError && (
                <View className="mt-2 gap-2">
                  <Text accessibilityRole="alert" className="text-[13px] text-rust">{timeline.diskError}</Text>
                  <Button title="Retry device storage" secondary onPress={timeline.retryLocalSave} />
                </View>
              )}
              {!session && timeline.segments.length > 0 && (
                <Button className="mt-2" title="Sign in to save to your account" secondary onPress={() => router.push("/auth")} />
              )}
              {timeline.guestCount > 0 && (
                <Button
                  className="mt-2"
                  title={`Add ${timeline.guestCount} device recording${timeline.guestCount === 1 ? "" : "s"} to my account`}
                  secondary
                  onPress={timeline.claimGuestRecordings}
                />
              )}
            </View>
          }
          ListEmptyComponent={
            !timeline.loading ? (
              <View className="rounded-[18px] border border-line bg-cream px-5 py-7">
                <Text className="text-[18px] font-medium text-ink">A story starts with a moment.</Text>
                <Body className="mt-2">Tap record a moment to add the first piece of this story.</Body>
              </View>
            ) : null
          }
          renderItem={({ item, getIndex, drag, isActive }) => {
            const index = getIndex() ?? 0;
            const active = audio.activeId === item.id;
            const clipDuration = active && audio.durationMs > 0 ? audio.durationMs : item.durationMs;
            return (
              <RecordingTimelineItem
                recording={item}
                disabled={recorder.phase !== "idle" || dragState.dragging || stories.saving}
                playing={active && audio.playing}
                loading={active && audio.loading}
                progress={active ? Math.min(1, Math.max(0, audio.positionMs / clipDuration)) : 0}
                playbackError={active ? audio.error : undefined}
                onPlay={play}
                onRetry={timeline.retry}
                onRename={timeline.rename}
                onDelete={deleteSegment}
                drag={drag}
                isDragging={isActive}
                position={index + 1}
                total={dragState.data.length}
                onMoveEarlier={() => { if (index > 0) timeline.move(item.id, dragState.data[index - 1].id); }}
                onMoveLater={() => { if (index + 1 < dragState.data.length) timeline.move(item.id, dragState.data[index + 2]?.id ?? null); }}
              />
            );
          }}
          ListFooterComponent={
            timeline.segments.length > 0 ? (
              <Text className="mb-3 text-[12px] text-muted">
                {timeline.segments.length}{" "}
                {timeline.segments.length === 1 ? "moment" : "moments"} ·{" "}
                {formatDuration(timeline.segments.reduce((total, segment) => total + segment.durationMs, 0))}{" "}
                in your draft
              </Text>
            ) : null
          }
        />
      </Animated.View>
      <View className="w-full max-w-[480px] self-center border-t border-line py-3">
        <StoryActions disabled={phase !== "idle" || dragState.dragging} />
      </View>
    </Shell>
  );
}
