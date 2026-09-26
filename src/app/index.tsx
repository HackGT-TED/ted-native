import { useCallback, useRef } from 'react';
import { router, useFocusEffect } from 'expo-router';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';
import { Shell } from '../components/shell';
import { Body, Button, colors, Icon, Label } from '../components/ui';
import { useStudio } from '../context/studio';
import { formatRecordingDay } from '../utils/recordings';

// Project IDs identify drafts; authentication and ownership are enforced separately.
function newProjectId() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, character => {
    const value = Math.floor(Math.random() * 16);
    return (character === 'x' ? value : (value & 3) | 8).toString(16);
  });
}

export default function Welcome() {
  const { timeline, recorder, openStory, name } = useStudio();
  const opening = useRef(false);
  useFocusEffect(useCallback(() => { opening.current = false; }, []));
  const unavailable = !timeline.ready || recorder.phase !== 'idle';
  const enter = (id: string | null, record = false) => {
    if (unavailable || opening.current) return;
    opening.current = true;
    openStory(id, record);
    router.push('/create');
  };

  return (
    <Shell>
      <View className="w-full max-w-[480px] self-center items-center pb-8 pt-12">
        <Label>{name ? `Welcome, ${name}` : 'Welcome to TedTime'}</Label>
        <Text accessibilityRole="header" className="mt-5 text-center font-heading text-[46px] font-normal leading-[54px] tracking-[-1.4px] text-ink">
          Every story starts{'\n'}with your voice.
        </Text>
        <Body className="mt-4 max-w-[310px] text-center">
          A little memory. A big adventure. A moment worth keeping. Let’s tell your story.
        </Body>
        <View className="my-9 h-[208px] w-[208px] items-center justify-center rounded-full border border-line">
          <View className="h-[184px] w-[184px] items-center justify-center rounded-full bg-cream">
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Start recording a new story"
              accessibilityHint="Creates a new story and opens the microphone. Tap stop when you are finished."
              accessibilityState={{ disabled: unavailable, busy: !timeline.ready }}
              disabled={unavailable}
              onPress={() => enter(newProjectId(), true)}
              className={`h-40 w-40 items-center justify-center rounded-full bg-cocoa active:opacity-80 ${unavailable ? 'opacity-50' : ''}`}
            >
              {!timeline.ready ? <ActivityIndicator color={colors.paper} /> : <Icon name="mic" size={66} color={colors.paper} />}
            </Pressable>
          </View>
        </View>
        <Text className="text-[18px] font-medium text-ink">Tap to start your story</Text>
        <Body className="mt-2 max-w-[280px] text-center !text-[13px]">We’ll create a new project as you begin. Just bring your voice.</Body>
        {timeline.diskError && <View className="mt-5 gap-3">
          <Text accessibilityRole="alert" className="text-center text-[13px] text-rust">{timeline.diskError}</Text>
          <Button title="Retry device storage" secondary onPress={timeline.retryLocalSave} />
        </View>}
        {timeline.projects.length > 0 && <View className="mt-10 w-full border-t border-line pt-6">
          <Label>RETURN TO A STORY</Label>
          {timeline.projects.map((project, index) => <Pressable
            key={project.id ?? 'legacy'}
            accessibilityRole="button"
            disabled={unavailable}
            accessibilityState={{ disabled: unavailable }}
            onPress={() => enter(project.id)}
            className="mt-3 min-h-[64px] flex-row items-center gap-4 rounded-[14px] bg-cream px-4 py-3"
          >
            <Icon name="book" color={colors.cocoa} />
            <View className="flex-1">
              <Text className="text-[14px] font-medium text-ink">{project.id ? `Story ${timeline.projects.length - index}` : 'Your earlier story'}</Text>
              <Text className="mt-1 text-[12px] text-muted">{formatRecordingDay(project.createdAt)} · {project.moments} {project.moments === 1 ? 'moment' : 'moments'}</Text>
            </View>
            <Icon name="arrow" size={18} color={colors.muted} />
          </Pressable>)}
        </View>}
      </View>
    </Shell>
  );
}
