import { memo, useCallback, useEffect, useMemo, useRef, type ComponentProps } from 'react';
import { FlatList, Text, View, type LayoutChangeEvent } from 'react-native';
import Animated, { Easing, useAnimatedStyle, useSharedValue, withTiming, type SharedValue } from 'react-native-reanimated';
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
type Paragraph = { index: number; start: number; words: ScriptWord[] };

/**
 * Renders the script paragraph by paragraph, with a purple highlighter that slides to
 * `current`. Paragraphs are virtualized so long stories stay light. The highlighter
 * follows a fractional word position, so a jump of several words animates through each
 * one in turn. Tapping a word seeks to it.
 */
export function HighlightedScript({ words, current, pace = 400, onSeek }: {
  /** The reader's speaking pace in ms per word. */
  words: ScriptWord[]; current: number; pace?: number; onSeek?: (index: number) => void;
}) {
  const paragraphs = useMemo(() => {
    const list: Paragraph[] = [];
    words.forEach((word, index) => {
      const last = list[list.length - 1];
      if (last && last.index === word.paragraph) last.words.push(word);
      else list.push({ index: word.paragraph, start: index, words: [word] });
    });
    return list;
  }, [words]);
  const rowOf = useMemo(() => {
    const map: number[] = [];
    paragraphs.forEach((paragraph, row) => paragraph.words.forEach(() => map.push(row)));
    return map;
  }, [paragraphs]);

  const progress = useSharedValue(-1);
  const opacity = useSharedValue(0);
  const list = useRef<FlatList<Paragraph>>(null);
  const tops = useRef(new Map<number, number>()); // row -> y in the list's content
  const boxes = useRef(new Map<number, Box>()); // word index -> box within its paragraph
  const viewport = useRef(0);
  const offset = useRef(0);
  const pending = useRef(-1); // a word to scroll to once its paragraph is measured
  const previous = useRef(-1);
  // Read when the highlight moves; a pace change alone shouldn't restart the glide.
  const paceRef = useRef(pace);
  useEffect(() => { paceRef.current = pace; }, [pace]);

  const keepVisible = useCallback((index: number) => {
    if (index < 0 || !viewport.current) return;
    const row = rowOf[index];
    const top = tops.current.get(row);
    const box = boxes.current.get(index);
    if (top === undefined || !box) {
      // Not rendered yet (far away): bring its paragraph in, then refine once measured.
      pending.current = index;
      if (row !== undefined) list.current?.scrollToIndex({ index: row, viewPosition: 0.3, animated: true });
      return;
    }
    pending.current = -1;
    // Keep the current line in the upper third so the reader can see what's next.
    const y = top + box.y;
    if (y < offset.current + 40 || y + box.height > offset.current + viewport.current * 0.6) {
      list.current?.scrollToOffset({ offset: Math.max(0, y - viewport.current * 0.3), animated: true });
    }
  }, [rowOf]);

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

  const onWordLayout = useCallback((index: number, box: Box) => {
    boxes.current.set(index, box);
    if (pending.current === index) keepVisible(index);
  }, [keepVisible]);

  // Cells are direct children of the list's content, so their layout gives each paragraph's offset.
  const Cell = useMemo(() => function Cell({ index, onLayout, ...props }: ComponentProps<typeof View> & { index: number }) {
    return <View {...props} onLayout={(event: LayoutChangeEvent) => {
      onLayout?.(event);
      tops.current.set(index, event.nativeEvent.layout.y);
      if (pending.current >= 0 && rowOf[pending.current] === index) keepVisible(pending.current);
    }} />;
  }, [keepVisible, rowOf]);

  return <FlatList ref={list} className="flex-1" contentContainerClassName="pb-16 pt-2"
    data={paragraphs} keyExtractor={paragraph => String(paragraph.index)}
    extraData={`${current}:${Boolean(onSeek)}`}
    CellRendererComponent={Cell}
    initialNumToRender={6} maxToRenderPerBatch={6} windowSize={7}
    onLayout={event => { viewport.current = event.nativeEvent.layout.height; }}
    onScroll={event => { offset.current = event.nativeEvent.contentOffset.y; }} scrollEventThrottle={32}
    onScrollToIndexFailed={({ index, averageItemLength }) => {
      // Jump near it by estimate; the paragraph's layout then triggers the precise scroll.
      list.current?.scrollToOffset({ offset: averageItemLength * index, animated: false });
    }}
    renderItem={({ item }) => {
      const count = item.words.length;
      // Only the paragraph being read sees `read` change, so only it re-renders.
      const read = current < item.start ? -1 : current >= item.start + count ? count : current - item.start;
      return <ParagraphView paragraph={item} read={read} progress={progress} opacity={opacity}
        onSeek={onSeek} onWordLayout={onWordLayout} />;
    }} />;
}

const ParagraphView = memo(function ParagraphView({ paragraph, read, progress, opacity, onSeek, onWordLayout }: {
  paragraph: Paragraph;
  /** Local index of the last word read in this paragraph (-1 none, words.length all). */
  read: number;
  progress: SharedValue<number>; opacity: SharedValue<number>;
  onSeek?: (index: number) => void; onWordLayout: (index: number, box: Box) => void;
}) {
  const { start, words } = paragraph;
  const boxes = useRef<Box[]>([]);
  const queued = useRef(false);
  const layouts = useSharedValue<Box[]>([]);

  // Word layouts arrive one onLayout at a time; hand them to the UI thread once per frame.
  const syncLayouts = useCallback(() => {
    if (queued.current) return;
    queued.current = true;
    requestAnimationFrame(() => {
      queued.current = false;
      layouts.set(boxes.current.slice(0, words.length));
    });
  }, [layouts, words.length]);

  const style = useAnimatedStyle(() => {
    const position = progress.get();
    const index = Math.floor(position);
    const local = index - start;
    const all = layouts.get();
    const a = all[local];
    if (local < 0 || !a) return { opacity: 0 };
    const b = all[local + 1];
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

  return <View className="mb-5 flex-row flex-wrap gap-y-1.5">
    <Animated.View pointerEvents="none" className="absolute left-0 top-0 rounded-[6px]" style={[{ backgroundColor: HIGHLIGHT }, style]} />
    {words.map((word, local) => (
      <Text key={local} onPress={onSeek ? () => onSeek(start + local) : undefined}
        accessibilityRole={onSeek ? 'button' : 'text'} accessibilityState={{ selected: local === read }}
        onLayout={event => {
          const box = event.nativeEvent.layout;
          boxes.current[local] = box;
          syncLayouts();
          onWordLayout(start + local, box);
        }}
        className={`mr-[6px] font-heading text-[25px] leading-[33px] ${local <= read ? 'text-ink' : 'text-muted'}`}>
        {word.text}
      </Text>
    ))}
  </View>;
});
