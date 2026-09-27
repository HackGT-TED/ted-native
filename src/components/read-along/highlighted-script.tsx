import { useCallback, useEffect, useRef } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import Animated, { Easing, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import type { ScriptWord } from '../../utils/read-along';

export const HIGHLIGHT = 'rgba(139, 92, 246, 0.32)';
const PAD_X = 4;
const PAD_Y = 1;
const FADE = { duration: 140 };
const BACKWARD = { duration: 160 };
// Deepgram reports words in bursts, a moment after they are spoken, so the highlighter
// is already behind. It glides through each word of a burst in half the reader's
// measured time per word (faster for fast readers), catching up without jumping.
const SWEEP_FRACTION = 0.5;
const MIN_WORD_MS = 50;
const MAX_WORD_MS = 220;
const MIN_SWEEP_MS = 80;
const MAX_SWEEP_MS = 450;

type Box = { x: number; y: number; width: number; height: number };

/**
 * Renders the script word by word with a purple highlighter that slides to `current`.
 * The highlighter follows a fractional word position, so a jump of several words
 * animates through each one in turn. Tapping a word seeks to it.
 */
export function HighlightedScript({ words, current, pace = 400, onSeek }: {
  /** The reader's speaking pace in ms per word. */
  words: ScriptWord[]; current: number; pace?: number; onSeek?: (index: number) => void;
}) {
  const boxes = useRef<Box[]>([]);
  const syncQueued = useRef(false);
  const layouts = useSharedValue<Box[]>([]);
  const progress = useSharedValue(-1);
  const opacity = useSharedValue(0);
  const previous = useRef(-1);
  // Read when the highlight moves; a pace change alone shouldn't restart the glide.
  const paceRef = useRef(pace);
  useEffect(() => { paceRef.current = pace; }, [pace]);
  const scroll = useRef<ScrollView>(null);
  const viewport = useRef(0);
  const offset = useRef(0);

  // Word layouts arrive one onLayout at a time; hand them to the UI thread once per frame.
  const syncLayouts = useCallback(() => {
    if (syncQueued.current) return;
    syncQueued.current = true;
    requestAnimationFrame(() => {
      syncQueued.current = false;
      layouts.set(boxes.current.slice(0, words.length));
    });
  }, [layouts, words.length]);

  const keepVisible = useCallback((index: number) => {
    const box = boxes.current[index];
    if (!box || !viewport.current) return;
    // Keep the current line in the upper third so the reader can see what's next.
    const top = offset.current, bottom = top + viewport.current;
    if (box.y < top + 40 || box.y + box.height > bottom - viewport.current * 0.4) {
      scroll.current?.scrollTo({ y: Math.max(0, box.y - viewport.current * 0.3), animated: true });
    }
  }, []);

  useEffect(() => {
    const from = previous.current;
    previous.current = current;
    if (current < 0) {
      opacity.set(withTiming(0, FADE));
    } else if (from < 0) {
      progress.set(current);
      opacity.set(withTiming(1, FADE));
    } else if (current > from) {
      const perWord = Math.min(MAX_WORD_MS, Math.max(MIN_WORD_MS, paceRef.current * SWEEP_FRACTION));
      const duration = Math.min(MAX_SWEEP_MS, Math.max(MIN_SWEEP_MS, (current - from) * perWord));
      // Starts from wherever the highlighter is, so back-to-back bursts form one continuous glide.
      progress.set(withTiming(current, { duration, easing: Easing.linear }));
    } else if (current < from) {
      progress.set(withTiming(current, BACKWARD));
    }
    keepVisible(current);
  }, [current, keepVisible, opacity, progress]);

  const style = useAnimatedStyle(() => {
    const all = layouts.get();
    const position = Math.max(0, progress.get());
    const index = Math.floor(position);
    const a = all[index];
    if (!a) return { opacity: 0 };
    const b = all[index + 1];
    const t = position - index;
    let box = a;
    if (b && t > 0) {
      box = Math.abs(a.y - b.y) < 1
        // Same line: slide and resize from one word to the next.
        ? { x: a.x + (b.x - a.x) * t, y: a.y, width: a.width + (b.width - a.width) * t, height: a.height }
        // Line wrap: hop to the next line halfway through rather than cutting diagonally across the text.
        : t < 0.5 ? a : b;
    }
    return {
      transform: [{ translateX: box.x - PAD_X }, { translateY: box.y - PAD_Y }],
      width: box.width + PAD_X * 2, height: box.height + PAD_Y * 2, opacity: opacity.get(),
    };
  });

  return <ScrollView ref={scroll} className="flex-1" contentContainerClassName="pb-16 pt-2"
    onLayout={event => { viewport.current = event.nativeEvent.layout.height; }}
    onScroll={event => { offset.current = event.nativeEvent.contentOffset.y; }} scrollEventThrottle={32}>
    <View className="flex-row flex-wrap gap-y-1.5">
      <Animated.View pointerEvents="none" className="absolute left-0 top-0 rounded-[6px]" style={[{ backgroundColor: HIGHLIGHT }, style]} />
      {words.map((word, index) => (
        <Pressable key={index} disabled={!onSeek} onPress={() => onSeek?.(index)}
          accessibilityLabel={word.text} accessibilityState={{ selected: index === current }}
          onLayout={event => {
            boxes.current[index] = event.nativeEvent.layout;
            syncLayouts();
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
