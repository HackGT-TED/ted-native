import { useCallback, useEffect, useRef } from 'react';
import { Pressable, ScrollView, Text, View, type LayoutRectangle } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import type { ScriptWord } from '../../utils/read-along';

export const HIGHLIGHT = 'rgba(139, 92, 246, 0.32)';
const PAD_X = 4;
const PAD_Y = 1;
const MOVE = { duration: 140 };

/**
 * Renders the script word by word with a purple highlighter that glides to `current`.
 * Each word is its own view so its position can be measured; tapping a word seeks to it.
 */
export function HighlightedScript({ words, current, onSeek }: {
  words: ScriptWord[]; current: number; onSeek?: (index: number) => void;
}) {
  const layouts = useRef<LayoutRectangle[]>([]);
  const scroll = useRef<ScrollView>(null);
  const viewport = useRef(0);
  const offset = useRef(0);
  const x = useSharedValue(0), y = useSharedValue(0), width = useSharedValue(0), height = useSharedValue(0);
  const opacity = useSharedValue(0);

  const place = useCallback((index: number, animate: boolean) => {
    const box = layouts.current[index];
    if (index < 0 || !box) {
      opacity.set(withTiming(0, MOVE));
      return;
    }
    const to = (value: number) => (animate ? withTiming(value, MOVE) : value);
    x.set(to(box.x - PAD_X));
    y.set(to(box.y - PAD_Y));
    width.set(to(box.width + PAD_X * 2));
    height.set(to(box.height + PAD_Y * 2));
    opacity.set(withTiming(1, MOVE));
    // Keep the current line in the upper third so the reader can see what's next.
    const top = offset.current, bottom = top + viewport.current;
    if (viewport.current && (box.y < top + 40 || box.y + box.height > bottom - viewport.current * 0.4)) {
      scroll.current?.scrollTo({ y: Math.max(0, box.y - viewport.current * 0.3), animated: true });
    }
  }, [height, opacity, width, x, y]);

  useEffect(() => { place(current, true); }, [current, place]);

  const style = useAnimatedStyle(() => ({
    transform: [{ translateX: x.get() }, { translateY: y.get() }],
    width: width.get(), height: height.get(), opacity: opacity.get(),
  }));

  return <ScrollView ref={scroll} className="flex-1" contentContainerClassName="pb-16 pt-2"
    onLayout={event => { viewport.current = event.nativeEvent.layout.height; }}
    onScroll={event => { offset.current = event.nativeEvent.contentOffset.y; }} scrollEventThrottle={32}>
    <View className="flex-row flex-wrap gap-y-1.5">
      <Animated.View pointerEvents="none" className="absolute left-0 top-0 rounded-[6px]" style={[{ backgroundColor: HIGHLIGHT }, style]} />
      {words.map((word, index) => (
        <Pressable key={index} disabled={!onSeek} onPress={() => onSeek?.(index)}
          accessibilityLabel={word.text} accessibilityState={{ selected: index === current }}
          onLayout={event => {
            layouts.current[index] = event.nativeEvent.layout;
            // Re-place after reflow (rotation, font scaling) without animating.
            if (index === current) place(index, false);
          }}
          className="mr-[7px]">
          <Text className={`font-heading text-[30px] leading-[38px] ${index <= current ? 'text-ink' : 'text-muted'}`}>
            {word.text}
          </Text>
        </Pressable>
      ))}
    </View>
  </ScrollView>;
}
