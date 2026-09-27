import { useCallback, useState } from 'react';
import { router, useFocusEffect } from 'expo-router';
import { ActivityIndicator, Text, View } from 'react-native';
import { Shell } from '../components/shell';
import { InboxList } from '../components/inbox-list';
import { Body, Button, colors, Heading, Icon } from '../components/ui';
import { useStudio } from '../context/studio';
import { openBluetoothSettings } from '../services/bluetooth-settings';

const steps = [
  'Turn on your TedTime Bear. Its light blinks when it is ready to pair.',
  'Tap Connect TedTime Bear, then choose "TedTime Bear" in your Bluetooth list.',
  'Come back here and pick a story. It will play through your bear.',
];

/** The same bear as the TedTime logo, drawn large. */
function BearArt() {
  return <View accessible={false} className="h-[120px] w-[128px]">
    <View className="absolute left-1 top-1 h-11 w-11 rounded-full bg-cocoa" />
    <View className="absolute right-1 top-1 h-11 w-11 rounded-full bg-cocoa" />
    <View className="absolute left-1 top-6 h-24 w-[120px] rounded-[48px] bg-cocoa">
      <View className="absolute left-[30px] top-9 h-3.5 w-3.5 rounded-full bg-paper" />
      <View className="absolute right-[30px] top-9 h-3.5 w-3.5 rounded-full bg-paper" />
      <View className="absolute left-[50px] top-[58px] h-3.5 w-5 rounded-full bg-paper" />
    </View>
  </View>;
}

/** Connect to the TedTime Bear and send stories to it. Pairing itself happens in the phone's Bluetooth settings. */
export default function Bear() {
  const { session, authLoading, inbox } = useStudio();
  const refreshInbox = inbox.refresh;
  // New stories may have arrived since the last visit.
  useFocusEffect(useCallback(() => { void refreshInbox(); }, [refreshInbox]));
  const [manual, setManual] = useState(false);
  const [error, setError] = useState('');
  const connect = async () => {
    setError('');
    try {
      if (!(await openBluetoothSettings())) setManual(true);
    } catch {
      setError('Could not open Settings. Open the Settings app and tap Bluetooth.');
    }
  };

  return <Shell>
    <View className="w-full max-w-[560px] self-center pb-8 pt-9">
      <Heading>TedTime Bear</Heading>
      <Body className="mt-2">Connect your bear to hear stories come to life, with sound effects, right from its speaker.</Body>

      <View className="mt-6 items-center rounded-[24px] bg-cream px-6 pb-7 pt-8">
        <BearArt />
        <View accessibilityLiveRegion="polite" className="mt-6 flex-row items-center gap-2 rounded-full bg-paper px-3.5 py-1.5">
          <View className="h-2 w-2 rounded-full bg-muted" />
          <Text className="text-[12px] font-medium text-ink">Not connected</Text>
        </View>
        <Button title="Connect TedTime Bear" icon="bluetooth" className="mt-6 self-stretch" onPress={() => { void connect(); }} />
        <Text className="mt-3 text-center text-[12px] leading-[18px] text-muted">
          Opens your phone’s Bluetooth settings.
        </Text>
        {manual ? <Text accessibilityRole="alert" className="mt-3 text-center text-[12px] leading-[18px] text-ink">
          Open Bluetooth settings on your phone and choose “TedTime Bear”.
        </Text> : null}
        {error ? <Text accessibilityRole="alert" className="mt-3 text-center text-[12px] text-rust">{error}</Text> : null}
      </View>

      <View className="mt-8">
        <View className="flex-row items-baseline justify-between">
          <Text accessibilityRole="header" className="text-[20px] font-medium text-ink">Sent to you</Text>
          {inbox.unheard ? <Text className="text-[12px] font-medium text-rust">{inbox.unheard} new</Text> : null}
        </View>
        <Text className="mb-4 mt-1 text-[13px] leading-[19px] text-muted">Stories your family and friends sent you. Play one on your bear.</Text>
        {!session && !authLoading ? <View className="gap-3 rounded-[18px] border border-dashed border-line p-5">
          <Text className="text-[13px] text-muted">Sign in to see stories sent to you.</Text>
          <Button title="Sign in" secondary onPress={() => router.push('/auth')} />
        </View> : inbox.error ? <View className="gap-3">
          <Text accessibilityRole="alert" className="text-[13px] text-rust">{inbox.error}</Text>
          <Button title="Retry" secondary onPress={() => { void inbox.refresh(); }} />
        </View> : inbox.loading && !inbox.items.length ? <ActivityIndicator accessibilityLabel="Loading stories sent to you" color={colors.cocoa} />
          : inbox.items.length ? <InboxList items={inbox.items} />
            : <View className="rounded-[18px] border border-dashed border-line p-5">
              <Text className="text-[13px] leading-[19px] text-muted">When someone sends you a story, it’ll show up here, ready to play on your bear.</Text>
            </View>}
      </View>

      <View className="mt-8">
        <Text accessibilityRole="header" className="text-[20px] font-medium text-ink">How to connect</Text>
        {steps.map((step, index) => <View key={step} className="mt-4 flex-row gap-4">
          <View className="h-8 w-8 items-center justify-center rounded-full bg-cocoa">
            <Text className="text-[13px] font-semibold text-paper">{index + 1}</Text>
          </View>
          <Text className="flex-1 pt-1.5 text-[14px] leading-[21px] text-ink">{step}</Text>
        </View>)}
      </View>

      <View className="mt-8 rounded-[20px] border border-line p-5">
        <View className="flex-row items-center gap-2">
          <Icon name="play" size={22} color={colors.cocoa} />
          <Text accessibilityRole="header" className="text-[17px] font-medium text-ink">Play on your bear</Text>
        </View>
        <Text className="mt-2 text-[13px] leading-[19px] text-muted">
          Once your bear is connected, stories you play will stream to its speaker.
        </Text>
        <View className="mt-4 gap-3">
          <Button title="Choose one of your stories" secondary onPress={() => router.replace('/library')} />
          <Button title="Find a story in the marketplace" secondary
            onPress={() => router.replace({ pathname: '/explore', params: { tab: 'audio' } })} />
        </View>
      </View>
    </View>
  </Shell>;
}
