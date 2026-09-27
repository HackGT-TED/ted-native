import { useCallback, useState } from 'react';
import { router, useFocusEffect } from 'expo-router';
import { ActivityIndicator, FlatList, Image, Modal, Pressable, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useStudio } from '../context/studio';
import { useStoryBear } from '../context/story-bear';
import { useStoryPlayback } from '../hooks/use-story-playback';
import { useStoryDraft } from '../hooks/use-story-draft';
import { storyBearDisplayName } from '../services/bluetooth/storyBearProtocol';
import { formatDuration } from '../utils/recordings';
import { Body, Button, colors, Icon, Label } from './ui';
import { PlaybackSeekBar } from './playback-seek-bar';

type StoryChoice = { id: string | null; title?: string; updatedAt: string; moments?: number };

function StoryChoiceRow({ item, selected, onChoose }: { item: StoryChoice; selected: boolean; onChoose: () => void }) {
  const { session, authLoading } = useStudio();
  const draft = useStoryDraft(session?.user.id ?? null, authLoading, item.id, item.title);
  const title = draft.name || item.title || 'Untitled story';
  return <Pressable accessibilityRole="button" accessibilityLabel={`Choose ${title}`} accessibilityState={{ selected }} onPress={onChoose}
    className={`min-h-[76px] flex-row items-center gap-4 rounded-[14px] px-3 py-3 ${selected ? 'bg-cream' : ''}`}>
    <View className="h-12 w-12 items-center justify-center rounded-lg bg-cream"><Icon name="book" color={colors.cocoa} /></View>
    <View className="flex-1"><Text className="text-[16px] font-medium text-ink">{title}</Text>
      <Text className="mt-1 text-[12px] text-muted">{item.moments ? `${item.moments} recorded ${item.moments === 1 ? 'moment' : 'moments'}` : 'Recorded story'} · {new Date(item.updatedAt).toLocaleDateString()}</Text>
    </View>
    {selected && <Icon name="check" color={colors.cocoa} />}
  </Pressable>;
}

function TransportButton({ label, icon, disabled, onPress }: {
  label: string; icon: 'previous' | 'next'; disabled: boolean; onPress: () => void;
}) {
  return <Pressable accessibilityRole="button" accessibilityLabel={label} accessibilityState={{ disabled }} disabled={disabled} onPress={onPress}
    className={`h-12 w-12 items-center justify-center active:opacity-60 ${disabled ? 'opacity-30' : ''}`}><Icon name={icon} size={32} /></Pressable>;
}

export function StoryBearPlayer() {
  const { session, authLoading, storyId, storyOpen, draft, timeline, stories, recorder, openStory, name } = useStudio();
  const { connectedBear, state, battery, ready, busy, sendingCommand, message, commandMessage, storyBear } = useStoryBear();
  const [pickerOpen, setPickerOpen] = useState(false);
  const [queueOpen, setQueueOpen] = useState(false);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const enabled = storyOpen && timeline.ready && !authLoading && recorder.phase === 'idle' && state === 'connected';
  const audio = useStoryPlayback(JSON.stringify([session?.user.id ?? 'guest', storyId]), storyOpen ? timeline.segments : [], enabled);
  const { controller } = audio;
  const refreshStories = stories.refresh;
  const refreshTimeline = timeline.refresh;
  useFocusEffect(useCallback(() => { void refreshStories(); void refreshTimeline(); }, [refreshStories, refreshTimeline]));

  const choices = new Map<string | null, StoryChoice>(stories.items.map(item => [item.creation_session_id, {
    id: item.creation_session_id, title: item.title, updatedAt: item.updated_at,
  }]));
  for (const project of timeline.projects) {
    const stored = choices.get(project.id);
    choices.set(project.id, { id: project.id, title: stored?.title, updatedAt: stored?.updatedAt ?? project.createdAt, moments: project.moments });
  }
  const availableStories = [...choices.values()].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  const selectedStory = stories.items.find(item => item.creation_session_id === storyId);
  const title = storyOpen ? draft.name || selectedStory?.title || 'Untitled story' : 'Choose your next story';
  const playable = enabled && audio.moments.length > 0;
  const current = audio.moments[audio.index];
  const choose = (id: string | null) => { controller.stop(); openStory(id); setPickerOpen(false); setQueueOpen(false); };
  const chooseButton = () => { setPickerOpen(true); void refreshStories(); void refreshTimeline(); };

  return <View className="w-full max-w-[420px] self-center pb-6 pt-5">
    <Pressable accessibilityRole="button" accessibilityLabel="Choose a recorded story" onPress={chooseButton}
      className="mb-5 min-h-11 flex-row items-center justify-between gap-3">
      <Icon name="down" size={25} />
      <View className="flex-1 items-center"><Label>PLAYING FROM YOUR LIBRARY</Label><Text className="mt-1 text-[13px] font-semibold text-ink">Your recorded stories</Text></View>
      <Icon name="book" size={22} />
    </Pressable>

    <View className="aspect-square w-full max-w-[360px] self-center overflow-hidden rounded-[12px] bg-cream">
      <Image source={require('../../assets/images/tedtime/storybook.png')} resizeMode="cover" accessible={false} className="absolute inset-0 h-full w-full" />
      <View className="absolute bottom-4 left-4 rounded-full bg-paper px-3 py-1.5"><Text className="text-[10px] font-semibold tracking-[2px] text-cocoa">TEDTIME STORIES</Text></View>
    </View>

    <View className="mt-6 flex-row items-center justify-between gap-3">
      <View className="flex-1"><Text accessibilityRole="header" numberOfLines={2} className="text-[27px] font-bold leading-[33px] tracking-[-0.6px] text-ink">{title}</Text>
        <Text numberOfLines={1} className="mt-1.5 text-[14px] text-muted">{storyOpen ? `${name || 'Your voice'} · ${audio.moments.length} ${audio.moments.length === 1 ? 'moment' : 'moments'}` : 'A familiar voice. A new adventure.'}</Text>
      </View>
      <Pressable accessibilityRole="button" accessibilityLabel="Choose another story" onPress={chooseButton} className="h-12 w-12 items-center justify-center"><Icon name="book" size={26} color={colors.cocoa} /></Pressable>
    </View>
    <View className="mt-3"><PlaybackSeekBar positionMs={audio.positionMs} durationMs={audio.durationMs} disabled={!playable}
      onSeek={position => { void controller.seek(position); }} /></View>

    <View className="mt-5 flex-row items-center justify-between">
      <Pressable accessibilityRole="button" accessibilityLabel="Back fifteen seconds" accessibilityState={{ disabled: !playable }} disabled={!playable} onPress={() => { void controller.skip(-15); }}
        className={`h-12 w-11 items-center justify-center ${!playable ? 'opacity-30' : ''}`}><Text className="text-[18px] font-semibold text-ink">−15</Text></Pressable>
      <TransportButton label="Previous moment" icon="previous" disabled={!playable} onPress={() => { void controller.previous(); }} />
      <Pressable accessibilityRole="button" accessibilityLabel={audio.playing ? 'Pause story' : audio.loading ? 'Pause or resume loading story' : audio.finished ? 'Replay story' : 'Play story'}
        accessibilityState={{ disabled: !playable, busy: audio.loading }} disabled={!playable} onPress={() => { void controller.toggle(); }}
        className={`h-[76px] w-[76px] items-center justify-center rounded-full bg-cocoa active:opacity-70 ${!playable ? 'opacity-40' : ''}`}>
        {audio.loading ? <ActivityIndicator color={colors.paper} /> : <Icon name={audio.playing ? 'pause' : 'play'} size={42} color={colors.paper} />}
      </Pressable>
      <TransportButton label="Next moment" icon="next" disabled={!playable || audio.finished} onPress={() => { void controller.next(); }} />
      <Pressable accessibilityRole="button" accessibilityLabel="Forward fifteen seconds" accessibilityState={{ disabled: !playable }} disabled={!playable} onPress={() => { void controller.skip(15); }}
        className={`h-12 w-11 items-center justify-center ${!playable ? 'opacity-30' : ''}`}><Text className="text-[18px] font-semibold text-ink">+15</Text></Pressable>
    </View>

    <View className="mt-4 flex-row items-center justify-between">
      <Pressable accessibilityRole="button" accessibilityLabel="Bear connection and audio information" accessibilityState={{ expanded: detailsOpen }} onPress={() => setDetailsOpen(value => !value)} className="min-h-11 flex-1 flex-row items-center gap-2 pr-2">
        <Icon name="devices" size={18} color={colors.cocoa} /><Text className="flex-shrink text-[11px] text-cocoa">{storyBearDisplayName(connectedBear?.name)} · {state === 'disconnecting' ? 'Disconnecting…' : 'Controls connected'}</Text>
      </Pressable>
      <Pressable accessibilityRole="button" accessibilityLabel="Stop story and return to the beginning" onPress={controller.stop} disabled={!playable} accessibilityState={{ disabled: !playable }}
        className={`min-h-11 flex-row items-center gap-1 px-2 ${!playable ? 'opacity-30' : ''}`}><Icon name="stop" size={19} /><Text className="text-[11px] text-ink">Stop</Text></Pressable>
      <Pressable accessibilityRole="button" accessibilityLabel="Show story timeline" accessibilityState={{ expanded: queueOpen }} onPress={() => setQueueOpen(value => !value)} className="h-11 w-11 items-center justify-center"><Icon name="queue" size={24} /></Pressable>
    </View>

    {current && <Text accessibilityLiveRegion="polite" numberOfLines={2} className="mt-1 text-[12px] leading-5 text-muted">{audio.finished ? 'Story complete · Play to listen again' : `${audio.index + 1} of ${audio.moments.length} · ${current.title || 'A story moment'}`}</Text>}
    {audio.error && <Text accessibilityRole="alert" className="mt-3 text-[13px] leading-5 text-rust">{audio.error}</Text>}
    {!playable && <View className="mt-3 gap-3">
      {timeline.loading || authLoading ? <ActivityIndicator color={colors.cocoa} /> : <Body className="!text-[13px]">{!storyOpen ? 'Pick a story from your library to start listening.' : recorder.phase !== 'idle' ? 'Finish recording before playing your story.' : 'This story has no recorded moments yet.'}</Body>}
      <Button title="Choose a story" secondary onPress={chooseButton} />
      {storyOpen && !timeline.loading && !audio.moments.length && <Button title="Record a moment" onPress={() => router.push('/create')} />}
    </View>}
    {(timeline.error || stories.error) && <View className="mt-3 gap-2"><Text accessibilityRole="alert" className="text-[13px] text-rust">{timeline.error || stories.error}</Text><Button title="Retry loading stories" secondary onPress={() => { void refreshTimeline(); void refreshStories(); }} /></View>}
    {timeline.diskError && <View className="mt-3 gap-2"><Text accessibilityRole="alert" className="text-[13px] text-rust">{timeline.diskError}</Text><Button title="Retry device storage" secondary onPress={timeline.retryLocalSave} /></View>}
    {message && <Text accessibilityRole="alert" className="mt-3 text-[13px] leading-5 text-rust">{message}</Text>}

    <View className="mt-5 border-t border-line pt-4">
      <Label>AUDIO OUTPUT</Label>
      <Body className="mt-2 !text-[12px] !leading-[19px]">Select StoryBear in your phone’s Bluetooth/audio controls to hear your story through your bear. Bear controls and audio connect separately.</Body>
    </View>
    {detailsOpen && <View className="mt-5 gap-3 rounded-[18px] bg-cream p-5">
      <Label>YOUR STORYBEAR</Label>
      <View className="flex-row justify-between"><Body>Battery</Body><Text className="text-[14px] text-ink">{battery === null ? 'Not reported yet' : `${battery}%`}</Text></View>
      <View className="flex-row justify-between"><Body>Interactions</Body><Text className="text-[14px] text-ink">{ready ? 'On' : 'Waiting for bear'}</Text></View>
      <Button title={sendingCommand ? 'Sending a little buzz…' : 'Test Vibration'} disabled={busy || sendingCommand} onPress={() => { void storyBear.testHaptic(); }} />
      {commandMessage && <Text accessibilityLiveRegion="polite" className="text-[12px] leading-5 text-muted">{commandMessage}</Text>}
      <Button title={state === 'disconnecting' ? 'Disconnecting…' : 'Disconnect Bear'} secondary disabled={busy} onPress={() => { controller.stop(); void storyBear.disconnectStoryBear(); }} />
    </View>}

    <Modal visible={queueOpen} animationType="slide" transparent onRequestClose={() => setQueueOpen(false)}>
      <View className="flex-1 justify-end bg-black/40">
        <Pressable accessibilityRole="button" accessibilityLabel="Close story timeline" className="flex-1" onPress={() => setQueueOpen(false)} />
        <SafeAreaView edges={['bottom']} className="max-h-[80%] rounded-t-[28px] bg-paper px-6 pt-5">
          <View className="mb-3 flex-row items-center justify-between"><Text accessibilityRole="header" className="text-[25px] font-bold text-ink">Story timeline</Text><Pressable accessibilityRole="button" accessibilityLabel="Close story timeline" onPress={() => setQueueOpen(false)} className="h-11 w-11 items-center justify-center"><Icon name="close" /></Pressable></View>
          <Body className="mb-4 !text-[12px]">Every recorded moment, in story order.</Body>
          <FlatList data={audio.moments} keyExtractor={item => item.id} extraData={[audio.index, audio.playing, playable]} contentContainerClassName="pb-6"
            ListEmptyComponent={<Body className="py-5 !text-[13px]">Choose a recorded story to see its timeline.</Body>}
            renderItem={({ item: moment, index }) => <Pressable accessibilityRole="button" accessibilityLabel={`Play moment ${index + 1}: ${moment.title}`}
              accessibilityState={{ selected: index === audio.index, disabled: !playable }} disabled={!playable} onPress={() => { void controller.selectMoment(index); }} className="min-h-[64px] flex-row items-center gap-3 border-t border-line py-3">
              <Text className="w-5 text-center text-[12px] text-muted">{index === audio.index && audio.playing ? '♫' : index + 1}</Text>
              <View className="flex-1"><Text numberOfLines={2} className={`text-[14px] ${index === audio.index ? 'font-semibold text-cocoa' : 'text-ink'}`}>{moment.title || `Moment ${index + 1}`}</Text><Text className="mt-1 text-[11px] text-muted">{formatDuration(controller.momentStart(index))} into your story</Text></View>
              <Text className="text-[11px] text-muted">{formatDuration(moment.durationMs)}</Text>
            </Pressable>} />
        </SafeAreaView>
      </View>
    </Modal>

    <Modal visible={pickerOpen} animationType="slide" transparent onRequestClose={() => setPickerOpen(false)}>
      <View className="flex-1 justify-end bg-black/40">
        <Pressable accessibilityRole="button" accessibilityLabel="Close story picker" className="flex-1" onPress={() => setPickerOpen(false)} />
        <SafeAreaView edges={['bottom']} className="max-h-[80%] rounded-t-[28px] bg-paper px-6 pt-5">
          <View className="mb-3 flex-row items-center justify-between"><Text accessibilityRole="header" className="text-[25px] font-bold text-ink">Your stories</Text><Pressable accessibilityRole="button" accessibilityLabel="Close story picker" onPress={() => setPickerOpen(false)} className="h-11 w-11 items-center justify-center"><Icon name="close" /></Pressable></View>
          <FlatList data={availableStories} keyExtractor={item => item.id ?? 'legacy'} contentContainerClassName="pb-6" keyboardShouldPersistTaps="handled"
            refreshing={stories.loading || timeline.loading} onRefresh={() => { void refreshStories(); void refreshTimeline(); }}
            renderItem={({ item }) => <StoryChoiceRow item={item} selected={storyOpen && storyId === item.id} onChoose={() => choose(item.id)} />}
            ListEmptyComponent={<View className="gap-4 py-6"><Body>No recorded stories yet. Make a little memory in Create, then listen here.</Body><Button title="Create a story" onPress={() => { setPickerOpen(false); router.push('/'); }} /></View>}
          />
        </SafeAreaView>
      </View>
    </Modal>
  </View>;
}
