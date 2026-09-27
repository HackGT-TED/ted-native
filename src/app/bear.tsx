import { useCallback, useState } from 'react';
import { useFocusEffect } from 'expo-router';
import { ActivityIndicator, Linking, Platform, Text, View } from 'react-native';
import { Shell } from '../components/shell';
import { Body, Button, colors, Label } from '../components/ui';
import { StoryBearIllustration } from '../components/story-bear-illustration';
import { StoryBearPlayer } from '../components/story-bear-player';
import { useStoryBear } from '../context/story-bear';
import { storyBearDisplayName } from '../services/bluetooth/storyBearProtocol';

export default function MyBear() {
  const { storyBear, state, availability, bears, connectedBear, lastBearId,
    busy, hasSearched, message } = useStoryBear();
  const [settingsError, setSettingsError] = useState<string | null>(null);
  useFocusEffect(useCallback(() => () => { void storyBear.stopStoryBearScan(); }, [storyBear]));
  const connected = Boolean(connectedBear);
  const scanning = state === 'scanning';
  const connecting = state === 'connecting';
  const found = !connected && !connecting && bears.length > 0;
  const empty = !connected && !scanning && !connecting && !found && hasSearched && state !== 'error';
  const title = connected ? 'Your StoryBear' : connecting ? 'Making a little connection…'
    : found ? bears.length > 1 ? 'A few friendly faces!' : 'We found your StoryBear!'
    : scanning ? 'Looking for your bear…' : empty ? 'A little closer, perhaps?' : 'Connect your StoryBear';
  const description = connected ? 'A little companion for every adventure.'
    : connecting ? 'Stay close. Your bear will be with you in a moment.'
    : found ? bears.length > 1 ? 'Choose the bear you’d like to connect.' : 'Your next story has a listening buddy.'
    : scanning ? 'Make sure your StoryBear is turned on and nearby.'
    : empty ? 'We haven’t found a bear yet. Turn yours on, bring it closer, and try again.'
    : 'Bring your bear nearby and we’ll find it automatically.';
  const openSettings = async () => {
    setSettingsError(null);
    try { await Linking.openSettings(); }
    catch { setSettingsError('Open your phone’s settings to allow Bluetooth access, then return here.'); }
  };

  if (connected) return <Shell><StoryBearPlayer /></Shell>;

  return <Shell>
    <View className="w-full max-w-[440px] self-center items-center pb-8 pt-8">
      <Label>A LITTLE COMPANION, A BIG IMAGINATION</Label>
      <View className="mb-7 mt-8"><StoryBearIllustration connected={connected} /></View>
      <Text accessibilityRole="header" className="text-center font-heading text-[36px] leading-[44px] text-ink">{title}</Text>
      <Body className="mt-3 max-w-[310px] text-center">{description}</Body>

      {(scanning || connecting || state === 'disconnecting') && <View accessibilityLiveRegion="polite" className="mt-5 flex-row items-center gap-3">
        <ActivityIndicator color={colors.cocoa} />
        <Text className="text-[13px] text-muted">{connecting ? 'Connecting to your bear' : state === 'disconnecting' ? 'Saying goodbye for now' : 'Looking for nearby bears'}</Text>
      </View>}

      {message && <View accessibilityRole="alert" className="mt-5 w-full rounded-[14px] border border-line bg-cream p-4">
        <Text className="text-center text-[14px] leading-[21px] text-ink">{message}</Text>
      </View>}
      {availability === 'denied' && Platform.OS !== 'web' && <Button className="mt-3 w-full" title="Open Settings" secondary onPress={() => { void openSettings(); }} />}
      {settingsError && <Text accessibilityRole="alert" className="mt-3 text-center text-rust">{settingsError}</Text>}

      {found && <View className="mt-6 w-full gap-3">
        {bears.map((bear, index) => <View key={bear.id} className="rounded-[18px] border border-line bg-cream p-5">
          <View className="mb-4 flex-row items-center justify-between gap-3">
            <View className="flex-1">
              <Text className="text-[18px] font-medium text-ink">{storyBearDisplayName(bear.name)}{!bear.name && bears.length > 1 ? ` ${index + 1}` : ''}</Text>
              <Text className="mt-1 text-[12px] text-muted">{bear.isConnectable === false ? 'Not ready to connect' : typeof bear.rssi === 'number' && bear.rssi < -75 ? 'Try bringing your bear closer' : 'Nearby'}{bear.id === lastBearId ? ' · Your last bear' : ''}</Text>
            </View>
            <Text accessible={false} className="text-[24px]">🧸</Text>
          </View>
          <Button title="Connect" disabled={busy || bear.isConnectable === false} onPress={() => { void storyBear.connectToStoryBear(bear.id); }} />
        </View>)}
      </View>}

      {scanning && <Button className="mt-5 w-full" title="Cancel" secondary onPress={() => { void storyBear.stopStoryBearScan(); }} />}
      {!connected && !scanning && !connecting && <Button className="mt-6 w-full" title={found || empty || state === 'error' ? 'Look Again' : 'Find My Bear'} secondary={found} disabled={busy} onPress={() => { void storyBear.scanForStoryBears(); }} />}
      {!connected && !connecting && <Body className="mt-5 max-w-[290px] text-center !text-[12px]">Just your StoryBear and you. Turn on your bear and keep it within arm’s reach to get started.</Body>}
      {connecting && <Text className="mt-6 text-[12px] text-muted">This should only take a moment.</Text>}
    </View>
  </Shell>;
}
