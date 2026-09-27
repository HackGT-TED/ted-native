import { View } from 'react-native';

const BASE_WIDTH = 26;

/** Placeholder bear. Swap this for the uploaded launch animation later. */
export function BearMark({ size = BASE_WIDTH }: { size?: number }) {
  const scale = size / BASE_WIDTH;
  return (
    <View
      accessible={false}
      pointerEvents="none"
      style={{ width: size, height: size * (25 / BASE_WIDTH) }}
      className="items-center justify-center"
    >
      <View style={{ transform: [{ scale }] }} className="h-[25px] w-[26px]">
        <View className="absolute left-px top-px h-[9px] w-[9px] rounded-[5px] bg-cocoa" />
        <View className="absolute right-px top-px h-[9px] w-[9px] rounded-[5px] bg-cocoa" />
        <View className="absolute left-px top-[5px] h-5 w-6 rounded-[10px] bg-cocoa">
          <View className="absolute left-1.5 top-[7px] h-[3px] w-[3px] rounded-[2px] bg-paper" />
          <View className="absolute right-1.5 top-[7px] h-[3px] w-[3px] rounded-[2px] bg-paper" />
          <View className="absolute left-2.5 top-3 h-[3px] w-1 rounded-[2px] bg-paper" />
        </View>
      </View>
    </View>
  );
}
