import { Pressable, Text, TextInput, View } from 'react-native';
import { useStudio } from '../context/studio';
import { colors } from './ui';

export function StoryNameForm({ disabled = false }: { disabled?: boolean }) {
  const { draft } = useStudio();
  return <View className="mb-2 mt-5 gap-2">
    <Text nativeID="story-name-label" className="text-[13px] font-medium text-ink">Story name</Text>
    <TextInput
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
      className="min-h-14 rounded-[12px] border border-line bg-cream px-4 text-[17px] text-ink"
    />
    {draft.error ? <View className="gap-1">
      <Text accessibilityRole="alert" className="text-[12px] text-rust">{draft.error}</Text>
      <Pressable accessibilityRole="button" accessibilityLabel="Retry saving story name" onPress={draft.retry} className="min-h-11 justify-center self-start pr-4">
        <Text className="text-[12px] font-medium text-cocoa">Retry</Text>
      </Pressable>
    </View> : draft.loading || draft.saving ? <Text className="text-[11px] text-muted">
      {draft.loading ? 'Loading story name…' : 'Saving…'}
    </Text> : null}
  </View>;
}
