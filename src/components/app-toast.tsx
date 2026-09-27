import { AccessibilityInfo, Platform, Pressable, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Toast, { type ToastConfig } from 'react-native-toast-message';
import { colors, Icon } from './ui';

const config: ToastConfig = {
  success: ({ text1, text2, hide }) => (
    <View className="w-full max-w-[448px] px-6">
      <View className="flex-row items-center gap-3 rounded-[16px] border border-line bg-paper py-3 pl-4 pr-2"
        style={{ boxShadow: '0 4px 18px rgba(73, 53, 41, 0.12)' }}>
        <View className="h-9 w-9 items-center justify-center rounded-full bg-cream">
          <Icon name="check" size={18} color={colors.cocoa} />
        </View>
        <View className="flex-1" accessible accessibilityLiveRegion="polite">
          <Text className="text-[14px] font-semibold text-ink">{text1}</Text>
          {text2 ? <Text className="mt-0.5 text-[12px] leading-[18px] text-muted">{text2}</Text> : null}
        </View>
        <Pressable onPress={() => hide()} accessibilityRole="button" accessibilityLabel="Dismiss notification"
          className="h-11 w-11 items-center justify-center rounded-full active:opacity-[0.65]">
          <Icon name="close" size={16} color={colors.muted} />
        </Pressable>
      </View>
    </View>
  ),
};

export function AppToast() {
  const insets = useSafeAreaInsets();
  return <Toast config={config} position="top" topOffset={insets.top + 12} visibilityTime={4000}
    onShow={({ text1, text2 }) => {
      if (Platform.OS === 'ios') {
        AccessibilityInfo.announceForAccessibilityWithOptions([text1, text2].filter(Boolean).join('. '), { queue: true });
      }
    }} />;
}
