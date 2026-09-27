import { Image } from 'expo-image';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';
import { useStudio } from '../context/studio';
import { colors, Icon } from './ui';

/** Square cover image for the story being created; saved with the next Save or Publish. */
export function StoryCoverPicker({ disabled = false }: { disabled?: boolean }) {
  const { cover } = useStudio();
  const locked = disabled || cover.uploading;
  return <View className="mt-5 flex-row items-center gap-4">
    <Pressable accessibilityRole="button" accessibilityLabel={cover.hasCover ? 'Change cover image' : 'Add a cover image'}
      accessibilityState={{ disabled: locked, busy: cover.uploading }} disabled={locked} onPress={() => { void cover.pick(); }}
      className="h-24 w-24 items-center justify-center overflow-hidden rounded-xl border border-dashed border-line bg-cream active:opacity-70">
      {cover.previewUri
        ? <Image source={{ uri: cover.previewUri }} contentFit="cover" style={{ width: 96, height: 96 }} accessibilityIgnoresInvertColors />
        : <Icon name="image" size={30} color={colors.muted} />}
      {cover.uploading ? <View className="absolute inset-0 items-center justify-center bg-paper/70">
        <ActivityIndicator color={colors.cocoa} />
      </View> : null}
    </Pressable>
    <View className="flex-1 gap-1">
      <Text className="text-[13px] font-medium text-ink">Cover image</Text>
      <Text className="text-[11px] leading-[16px] text-muted">
        {cover.uploading ? 'Uploading…' : cover.unsaved ? 'Tap Save or Publish to keep this cover.' : 'Shown on your story in the marketplace.'}
      </Text>
      <View className="flex-row gap-4">
        <Pressable accessibilityRole="button" disabled={locked} onPress={() => { void cover.pick(); }} className="min-h-11 justify-center">
          <Text className={`text-[12px] font-medium text-cocoa ${locked ? 'opacity-50' : ''}`}>{cover.hasCover ? 'Change' : 'Add cover'}</Text>
        </Pressable>
        {cover.hasCover ? <Pressable accessibilityRole="button" accessibilityLabel="Remove cover image" disabled={locked}
          onPress={cover.remove} className="min-h-11 justify-center">
          <Text className={`text-[12px] text-muted ${locked ? 'opacity-50' : ''}`}>Remove</Text>
        </Pressable> : null}
      </View>
      {cover.error ? <Text accessibilityRole="alert" className="text-[11px] text-rust">{cover.error}</Text> : null}
    </View>
  </View>;
}
