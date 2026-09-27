import { useState } from 'react';
import { Pressable, Text, TextInput, View } from 'react-native';
import { useStudio } from '../context/studio';
import { colors } from './ui';
import { LoadingSkeleton } from './loading-skeleton';

export function StoryTitle({ disabled = false }: { disabled?: boolean }) {
  const { draft } = useStudio();
  const [editing, setEditing] = useState(false);
  const locked = disabled || draft.loading || !draft.editable;
  const startEditing = () => { if (!locked) setEditing(true); };
  const finishEditing = () => setEditing(false);
  return <View className="mb-2 mt-4 gap-1.5">
    {draft.loading ? <LoadingSkeleton variant="field" label="Loading story title" /> : editing && !locked ? <TextInput
      accessibilityLabel="Story title"
      value={draft.name}
      onChangeText={draft.saveName}
      placeholder="Untitled story"
      placeholderTextColor={colors.muted}
      autoFocus
      selectTextOnFocus
      maxLength={80}
      autoCapitalize="sentences"
      returnKeyType="done"
      submitBehavior="blurAndSubmit"
      onSubmitEditing={finishEditing}
      onBlur={finishEditing}
      className="min-h-11 w-full border-b border-line px-2 text-center text-[24px] font-medium leading-8 text-ink"
    /> : <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Edit story title: ${draft.name.trim() || 'Untitled story'}`}
      accessibilityHint="Hold to change the title."
      accessibilityState={{ disabled: locked }}
      accessibilityActions={[{ name: 'activate', label: 'Edit title' }, { name: 'longpress', label: 'Edit title' }]}
      onAccessibilityAction={({ nativeEvent }) => {
        if (nativeEvent.actionName === 'activate' || nativeEvent.actionName === 'longpress') startEditing();
      }}
      disabled={locked}
      onLongPress={startEditing}
      delayLongPress={500}
      className="min-h-11 w-full items-center justify-center px-2 active:opacity-70"
    >
      <Text className="text-center text-[24px] font-medium leading-8 text-ink">
        {draft.name.trim() || 'Untitled story'}
      </Text>
    </Pressable>}
    {!draft.loading && !locked && !editing ? <Text className="text-center text-[11px] text-muted">Hold to edit title</Text> : null}
    {draft.error ? <View className="gap-1">
      <Text accessibilityRole="alert" className="text-[12px] text-rust">{draft.error}</Text>
      <Pressable accessibilityRole="button" accessibilityLabel="Retry saving story name" onPress={draft.retry} className="min-h-11 justify-center self-start pr-4">
        <Text className="text-[12px] font-medium text-cocoa">Retry</Text>
      </Pressable>
    </View> : draft.saving ? <Text className="text-center text-[11px] text-muted">
      Saving…
    </Text> : null}
  </View>;
}
