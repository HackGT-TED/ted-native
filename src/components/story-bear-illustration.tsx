import { View } from 'react-native';

/** A small companion drawn with the app's existing cocoa/cream palette. */
export function StoryBearIllustration({ connected = false }: { connected?: boolean }) {
  return <View accessible={false} importantForAccessibility="no-hide-descendants" className="h-[224px] w-[224px] items-center justify-center rounded-full border border-line">
    <View className="h-[202px] w-[202px] items-center justify-center rounded-full bg-cream">
      <View className="absolute left-[26px] top-[34px] h-[48px] w-[48px] rounded-full bg-cocoa items-center justify-center"><View className="h-7 w-7 rounded-full bg-honey" /></View>
      <View className="absolute right-[26px] top-[34px] h-[48px] w-[48px] rounded-full bg-cocoa items-center justify-center"><View className="h-7 w-7 rounded-full bg-honey" /></View>
      <View className="mt-3 h-[130px] w-[148px] rounded-[64px] bg-cocoa items-center">
        <View className="mt-[43px] w-[70px] flex-row justify-between"><View className="h-[9px] w-[9px] rounded-full bg-paper" /><View className="h-[9px] w-[9px] rounded-full bg-paper" /></View>
        <View className="mt-2 h-[49px] w-[62px] items-center rounded-[25px] bg-cream">
          <View className="mt-[10px] h-[12px] w-[19px] rounded-[7px] bg-ink" />
          <View className="h-[12px] w-[2px] bg-ink" />
          <View className="h-[2px] w-[18px] rounded-full bg-ink" />
        </View>
      </View>
    </View>
    {connected && <View className="absolute bottom-3 right-4 h-9 w-9 items-center justify-center rounded-full border-[4px] border-paper bg-cocoa"><View className="h-2 w-2 rounded-full bg-paper" /></View>}
  </View>;
}
