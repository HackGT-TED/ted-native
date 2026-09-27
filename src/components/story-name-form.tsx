import { Pressable, Text, TextInput, View } from 'react-native';
import { useStudio } from '../context/studio';
import { colors } from './ui';
import { LoadingSkeleton } from './loading-skeleton';

export function StoryNameForm({ disabled = false }: { disabled?: boolean }) {
  const { draft } = useStudio();
  return <View className="mb-2 mt-4 gap-1.5">
    <Text nativeID="story-name-label" className="text-[13px] font-medium leading-4 tracking-[-0.15px] text-ink">Story name</Text>
    {draft.loading ? <LoadingSkeleton variant="field" label="Loading story name" /> : <TextInput
      accessibilityLabel="Story name"
      accessibilityLabelledBy="story-name-label"
      value={draft.name}
      onChangeText={draft.saveName}
      placeholder="Give your story a name"
      placeholderTextColor={colors.muted}
      editable={draft.editable && !disabled}
      maxLength={80}
      autoCapitalize="sentences"
      returnKeyType="done"
      submitBehavior="blurAndSubmit"
      className="min-h-14 rounded-[12px] border border-line bg-cream px-4 text-[17px] tracking-[-0.2px] text-ink"
    />}
    {draft.error ? <View className="gap-1">
      <Text accessibilityRole="alert" className="text-[12px] text-rust">{draft.error}</Text>
      <Pressable accessibilityRole="button" accessibilityLabel="Retry saving story name" onPress={draft.retry} className="min-h-11 justify-center self-start pr-4">
        <Text className="text-[12px] font-medium text-cocoa">Retry</Text>
      </Pressable>
    </View> : draft.saving ? <Text className="text-[11px] text-muted">
      Saving…
    </Text> : null}
  </View>;
}
