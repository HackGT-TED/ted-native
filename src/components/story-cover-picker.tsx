import { LoadingSkeleton } from './loading-skeleton';
import { Image } from 'expo-image';
import { Pressable, Text, View } from 'react-native';
import { useStudio } from '../context/studio';
import { colors, Icon } from './ui';

/** Square cover image for the story being created; saved with the next Save or Publish. */
export function StoryCoverPicker({ disabled = false }: { disabled?: boolean }) {
  const { cover } = useStudio();
  const locked = disabled || cover.uploading;
  return <View className="mt-5 w-full max-w-[280px] self-center gap-2">
    <View className="aspect-square w-full overflow-hidden rounded-[20px] border border-line bg-cream">
      <Pressable accessibilityRole="button" accessibilityLabel={cover.hasCover ? 'Change cover image' : 'Add a cover image'}
        accessibilityState={{ disabled: locked, busy: cover.uploading }} disabled={locked} onPress={() => { void cover.pick(); }}
        className="absolute inset-0 items-center justify-center active:opacity-70">
        {cover.previewUri
          ? <Image source={{ uri: cover.previewUri }} contentFit="cover" style={{ width: '100%', height: '100%' }} accessibilityIgnoresInvertColors />
          : <Icon name="image" size={52} color={colors.muted} />}
        {cover.uploading ? <View className="absolute inset-0 items-center justify-center bg-paper/70">
          <LoadingSkeleton variant="cover" label="Uploading cover image" className="h-full w-full" />
        </View> : null}
      </Pressable>
      <View className="absolute bottom-0 left-0 right-0 flex-row items-center justify-center gap-2 bg-paper/95 px-3 py-1">
        <Pressable accessibilityRole="button" accessibilityLabel={cover.hasCover ? 'Change cover image' : 'Add a cover image'}
          accessibilityState={{ disabled: locked }} disabled={locked} onPress={() => { void cover.pick(); }} className="min-h-11 items-center justify-center px-4">
          <Text className={`text-[13px] font-medium text-cocoa ${locked ? 'opacity-50' : ''}`}>{cover.hasCover ? 'Change' : 'Add cover'}</Text>
        </Pressable>
        {cover.hasCover ? <Pressable accessibilityRole="button" accessibilityLabel="Remove cover image" disabled={locked}
          accessibilityState={{ disabled: locked }} onPress={cover.remove} className="min-h-11 items-center justify-center px-4">
          <Text className={`text-[13px] text-muted ${locked ? 'opacity-50' : ''}`}>Remove</Text>
        </Pressable> : null}
      </View>
    </View>
    {cover.error ? <Text accessibilityRole="alert" className="text-center text-[12px] leading-[18px] text-rust">{cover.error}</Text> : null}
  </View>;
}
