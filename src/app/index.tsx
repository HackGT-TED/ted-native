import { useCallback, useEffect, useRef, useState } from 'react';
import { router, useFocusEffect } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';
import { Shell } from '../components/shell';
import { Onboarding } from '../components/onboarding';
import { Body, Button, colors, Icon, Label } from '../components/ui';
import { useStudio } from '../context/studio';
import { formatRecordingDay } from '../utils/recordings';

const ONBOARDING_KEY = 'tedtime.onboarding.v1';

// Project IDs identify drafts; authentication and ownership are enforced separately.
function newProjectId() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, character => {
    const value = Math.floor(Math.random() * 16);
    return (character === 'x' ? value : (value & 3) | 8).toString(16);
  });
}

export default function Welcome() {
  const { timeline, recorder, openStory, session, authLoading } = useStudio();
  const opening = useRef(false);
  const [seen, setSeen] = useState<boolean | null>(null);
  useFocusEffect(useCallback(() => { opening.current = false; }, []));
  useEffect(() => {
    let live = true;
    AsyncStorage.getItem(ONBOARDING_KEY).then(value => {
      if (live) setSeen(value === 'done');
    }).catch(() => { if (live) setSeen(false); });
    return () => { live = false; };
  }, []);
  useEffect(() => {
    if (!session || seen !== false) return;
    let live = true;
    void AsyncStorage.setItem(ONBOARDING_KEY, 'done').then(() => {
      if (live) setSeen(true);
    });
    return () => { live = false; };
  }, [session, seen]);
  const unavailable = !timeline.ready || recorder.phase !== 'idle';
  const enter = (id: string | null, record = false) => {
    if (unavailable || opening.current) return;
    opening.current = true;
    openStory(id, record);
    router.push('/create');
  };
  const skip = () => {
    void AsyncStorage.setItem(ONBOARDING_KEY, 'done');
    setSeen(true);
  };

  if (authLoading || seen === null) {
    return <View className="flex-1 items-center justify-center bg-paper"><ActivityIndicator color={colors.cocoa} /></View>;
  }
  if (!seen && !session) {
    return <Onboarding onSignIn={() => router.push('/auth')} onSkip={skip} />;
  }

  return (
    <Shell>
      <View className="w-full max-w-[480px] self-center pb-8 pt-8">
        <Text accessibilityRole="header" className="font-heading text-[42px] font-normal leading-[46px] tracking-[-1.2px] text-ink">
          What do you want to make?
        </Text>
        <Body className="mt-3 max-w-[340px]">Record a voice story, or write one to share.</Body>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Record a new story"
          accessibilityHint="Opens a new story and starts the microphone."
          accessibilityState={{ disabled: unavailable, busy: !timeline.ready }}
          disabled={unavailable}
          onPress={() => enter(newProjectId(), true)}
          className={`mt-8 min-h-[112px] flex-row items-center gap-4 rounded-[20px] bg-cocoa px-5 py-5 active:opacity-80 ${unavailable ? 'opacity-50' : ''}`}
        >
          <View className="h-16 w-16 items-center justify-center rounded-full bg-cream">
            {!timeline.ready ? <ActivityIndicator color={colors.cocoa} /> : <Icon name="mic" size={32} color={colors.cocoa} />}
          </View>
          <View className="flex-1">
            <Text className="text-[18px] font-medium text-paper">Record a story</Text>
            <Text className="mt-1 text-[13px] leading-5 text-paper">Start with your voice. Add more moments on the story page.</Text>
          </View>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Write a story"
          onPress={() => router.push('/share')}
          className="mt-3 min-h-[112px] flex-row items-center gap-4 rounded-[20px] border border-line bg-cream px-5 py-5 active:opacity-80"
        >
          <View className="h-16 w-16 items-center justify-center rounded-full bg-paper">
            <Icon name="create" size={30} color={colors.cocoa} />
          </View>
          <View className="flex-1">
            <Text className="text-[18px] font-medium text-ink">Write a story</Text>
            <Text className="mt-1 text-[13px] leading-5 text-muted">Share a written creation with a title and a few words.</Text>
          </View>
        </Pressable>
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
