import { useRef, useState } from 'react';
import { Pressable, ScrollView, Text, useWindowDimensions, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { BearMark } from './bear-mark';
import { Body, Button } from './ui';

const pages = [
  {
    title: 'Tell it out loud',
    body: 'Record a moment in your own voice. TedTime keeps it as part of a story you can come back to.',
  },
  {
    title: 'Build it in pieces',
    body: 'Add another moment whenever you want. Move them around until the story feels right.',
  },
  {
    title: 'Keep it or share it',
    body: 'Save a draft, publish it for the usual view, or write something to share. You choose.',
  },
];

export function Onboarding({ onSignIn, onSkip }: { onSignIn: () => void; onSkip: () => void }) {
  const { width } = useWindowDimensions();
  const scroll = useRef<ScrollView>(null);
  const [page, setPage] = useState(0);

  return (
    <SafeAreaView className="flex-1 bg-paper" edges={['top', 'bottom']}>
      <View className="items-center px-8 pt-10">
        <BearMark size={84} />
      </View>
      <ScrollView
        ref={scroll}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        className="scrollbar-none flex-1"
        decelerationRate="fast"
        snapToInterval={width}
        snapToAlignment="start"
        disableIntervalMomentum
        onMomentumScrollEnd={event => setPage(Math.round(event.nativeEvent.contentOffset.x / width))}
      >
        {pages.map(item => (
          <View key={item.title} style={{ width }} className="justify-center px-8">
            <View className="w-full max-w-[420px] self-center">
              <Text className="font-heading text-[42px] leading-[46px] tracking-[-1px] text-ink">{item.title}</Text>
              <Body className="mt-4 max-w-[340px]">{item.body}</Body>
            </View>
          </View>
        ))}
      </ScrollView>
      <View className="w-full max-w-[420px] self-center gap-3 px-8 pb-4 pt-2">
        <View className="mb-2 flex-row justify-center gap-2">
          {pages.map((item, index) => (
            <Pressable
              key={item.title}
              accessibilityRole="button"
              accessibilityLabel={`Page ${index + 1}`}
              onPress={() => {
                setPage(index);
                scroll.current?.scrollTo({ x: width * index, animated: true });
              }}
              className={`h-2 rounded-full ${page === index ? 'w-6 bg-cocoa' : 'w-2 bg-line'}`}
            />
          ))}
        </View>
        <Button title="Sign in" onPress={onSignIn} />
        <Pressable accessibilityRole="button" onPress={onSkip} className="min-h-11 items-center justify-center">
          <Text className="text-[13px] text-muted">Not now</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}
