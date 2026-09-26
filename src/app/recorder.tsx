import { useCallback, useState } from "react";
import {
  AccessibilityInfo,
  Keyboard,
  Pressable,
  Text,
  TextInput,
  useWindowDimensions,
  View,
} from "react-native";
import { useFocusEffect } from "expo-router";
import { Shell } from "../components/shell";
import { Body, colors, Icon, Label } from "../components/ui";
import { useStudio } from "../context/studio";
import { useHoldRecorder } from "../hooks/use-hold-recorder";
import { useRecordingPlayback } from "../hooks/use-recording-playback";
import { useRecordingUpload } from "../hooks/use-recording-upload";

function time(milliseconds: number) {
  const seconds = Math.floor(milliseconds / 1000);
  return `${Math.floor(seconds / 60)
    .toString()
    .padStart(2, "0")}:${(seconds % 60).toString().padStart(2, "0")}`;
}
export default function Recorder() {
  const { height } = useWindowDimensions();
  const { recording, setRecording } = useStudio();
  const [title, setTitle] = useState("");
  const [accessibleMode, setAccessibleMode] = useState(false);
  const {
    playback,
    error: playbackError,
    pause,
    toggle: togglePlayback,
    clearError,
  } = useRecordingPlayback(recording?.uri ?? null);
  const { start, finish, phase, error, duration } =
    useHoldRecorder(setRecording);
  const {
    status: uploadStatus,
    error: uploadError,
    upload,
  } = useRecordingUpload(recording);
  const active = phase === "recording";
  const busy = phase !== "idle";
  const compact = height < 750;

  useFocusEffect(
    useCallback(() => {
      let live = true;
      void AccessibilityInfo.isScreenReaderEnabled().then((enabled) => {
        if (live) setAccessibleMode(enabled);
      });
      const subscription = AccessibilityInfo.addEventListener(
        "screenReaderChanged",
        setAccessibleMode,
      );
      return () => {
        live = false;
        subscription.remove();
      };
    }, []),
  );

  function begin() {
    Keyboard.dismiss();
    pause();
    clearError();
    void start(title);
  }
  return (
    <Shell scroll={height < 640}>
      <View className={`w-full max-w-[440px] flex-1 self-center pb-4 ${compact ? "pt-6" : "pt-9"}`}>
        <View className="gap-3">
          <Label className="mb-2.5">RECORDER</Label>
          <View className="min-h-14 flex-row items-center gap-3 rounded-[10px] bg-cream px-[18px]">
            <TextInput
              accessibilityLabel="Recording title"
              value={title}
              onChangeText={setTitle}
              placeholder="Untitled recording"
              placeholderTextColor={colors.muted}
              maxLength={80}
              editable={!busy}
              className="min-h-14 flex-1 text-[15px] text-ink"
            />
            <Icon name="create" size={19} color={colors.muted} />
          </View>
          <View className="min-h-14 flex-row items-center justify-between rounded-[10px] bg-cream px-[18px]">
            <View className="flex-row items-center gap-2.5">
              <View
                className={`h-1.5 w-1.5 rounded-[3px] ${active ? "bg-rust" : "bg-honey"}`}
              />
              <Text className="text-[13px] text-muted">
                {active
                  ? "Recording"
                  : phase === "preparing"
                    ? "Preparing microphone"
                    : phase === "stopping"
                      ? "Finishing take"
                      : "Ready to record"}
              </Text>
            </View>
            <Text className="text-[15px] text-ink web:tabular-nums native:[-rn-font-variant:tabular-nums]">{time(duration)}</Text>
          </View>
        </View>
        <View className="flex-1 items-center justify-center py-4">
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={
              accessibleMode
                ? active
                  ? "Stop recording"
                  : "Start recording"
                : "Hold to talk"
            }
            accessibilityHint={
              accessibleMode
                ? "Double tap to start or stop recording"
                : "Keep holding to record. Release to stop."
            }
            accessibilityState={{
              busy: phase === "preparing" || phase === "stopping",
            }}
            onPressIn={accessibleMode ? undefined : begin}
            onPressOut={
              accessibleMode
                ? undefined
                : () => {
                    void finish();
                  }
            }
            onPress={
              accessibleMode
                ? () => {
                    if (active) void finish();
                    else begin();
                  }
                : undefined
            }
            className={`items-center justify-center active:bg-rust ${compact ? "h-[164px] w-[164px] rounded-[82px]" : "h-[220px] w-[220px] rounded-[110px]"} ${active ? "bg-rust" : "bg-cocoa"}`}
          >
            <Icon
              name={active ? "stop" : "mic"}
              size={56}
              color={colors.paper}
            />
          </Pressable>
          <Text className={`text-[17px] font-medium text-ink ${compact ? "mt-4" : "mt-[22px]"}`}>
            {active
              ? accessibleMode
                ? "Tap to stop"
                : "Release to stop"
              : phase === "preparing"
                ? "Getting ready…"
                : phase === "stopping"
                  ? "Finishing…"
                  : accessibleMode
                    ? "Tap to record"
                    : "Hold to talk"}
          </Text>
          <Body className="mt-[7px] !text-[12px]">
            {active
              ? "Listening."
              : accessibleMode
                ? "Tap again to finish."
                : "Release to finish."}
          </Body>
          {error || playbackError ? (
            <Text accessibilityRole="alert" className="mt-[15px] text-center text-[12px] leading-[18px] text-rust">
              {error || playbackError}
            </Text>
          ) : null}
        </View>
        <View className="min-h-14 justify-center">
          {recording ? (
            <>
              <View className="flex-row items-center gap-2.5 border-t border-line pt-3.5">
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={
                    playback.playing ? "Pause recording" : "Play last recording"
                  }
                  disabled={busy}
                  onPress={() => {
                    void togglePlayback();
                  }}
                  className={`h-11 w-11 items-center justify-center ${busy ? "opacity-[0.35]" : ""}`}
                >
                  <Icon name={playback.playing ? "pause" : "play"} size={26} />
                </Pressable>
                <View className="flex-1 gap-1">
                  <Text numberOfLines={1} className="text-[13px] text-ink">
                    {recording.title}
                  </Text>
                  <Text className="text-[11px] text-muted">
                    Last take · {time(recording.duration)}
                  </Text>
                </View>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Discard last recording"
                  disabled={busy}
                  onPress={() => {
                    pause();
                    setRecording(null);
                  }}
                  className="h-11 w-11 items-center justify-center"
                >
                  <Icon name="trash" size={20} color={colors.muted} />
                </Pressable>
              </View>
              <Pressable
                accessibilityRole="button"
                accessibilityState={{
                  disabled:
                    busy ||
                    uploadStatus === "uploading" ||
                    uploadStatus === "uploaded",
                  busy: uploadStatus === "uploading",
                }}
                disabled={
                  busy ||
                  uploadStatus === "uploading" ||
                  uploadStatus === "uploaded"
                }
                onPress={() => {
                  void upload();
                }}
                className={`mt-3 min-h-11 items-center justify-center rounded-[10px] bg-cream active:opacity-50 ${busy ? "opacity-50" : ""}`}
              >
                <Text accessibilityLiveRegion="polite" className="text-[13px] font-medium text-cocoa">
                  {uploadStatus === "uploading"
                    ? "Uploading…"
                    : uploadStatus === "uploaded"
                      ? "Uploaded"
                      : uploadStatus === "error"
                        ? "Retry upload"
                        : "Upload recording"}
                </Text>
              </Pressable>
              {uploadError ? (
                <Text accessibilityRole="alert" className="mt-[15px] text-center text-[12px] leading-[18px] text-rust">
                  {uploadError}
                </Text>
              ) : null}
            </>
          ) : (
            <Text className="text-center text-[10px] text-muted">
              Recordings stay on this device during your session.
            </Text>
          )}
        </View>
      </View>
    </Shell>
  );
}
