import { useState } from 'react';
import { Text, View } from 'react-native';
import { Shell } from '../components/shell';
import Account from '../components/Account';
import { Body, Button, colors, Heading, Icon } from '../components/ui';
import { useStudio } from '../context/studio';
import { openBluetoothSettings } from '../services/bluetooth-settings';

/** Compact TedTime Bear connection. Pairing happens in the phone's Bluetooth settings. */
function BearConnection() {
  const [note, setNote] = useState('');
  const connect = async () => {
    setNote('');
    try {
      if (!(await openBluetoothSettings())) setNote('Open Bluetooth settings on your phone and choose “TedTime Bear”.');
    } catch {
      setNote('Could not open Settings. Open the Settings app and tap Bluetooth.');
    }
  };
  return <View className="mt-8 rounded-[20px] bg-cream p-5">
    <View className="flex-row items-center gap-3">
      <View className="h-11 w-11 items-center justify-center rounded-full bg-cocoa">
        <Icon name="bear" size={24} color={colors.paper} />
      </View>
      <View className="flex-1">
        <Text accessibilityRole="header" className="text-[17px] font-medium text-ink">TedTime Bear</Text>
        <View accessibilityLiveRegion="polite" className="mt-1 flex-row items-center gap-1.5">
          <View className="h-2 w-2 rounded-full bg-muted" />
          <Text className="text-[12px] text-muted">Not connected</Text>
        </View>
      </View>
    </View>
    <Text className="mt-3 text-[13px] leading-[19px] text-muted">
      Turn on your bear, then choose “TedTime Bear” in your phone’s Bluetooth list. Stories you play will come from its speaker.
    </Text>
    <Button title="Connect TedTime Bear" icon="bluetooth" className="mt-4" onPress={() => { void connect(); }} />
    {note ? <Text accessibilityRole="alert" className="mt-3 text-[12px] leading-[18px] text-ink">{note}</Text> : null}
  </View>;
}

/** Profile details, sign out, and the bear connection. */
export default function AccountPage() {
  const { session, name } = useStudio();
  return <Shell>
    <View className="w-full max-w-[560px] self-center pb-8 pt-9">
      <Heading>Account</Heading>
      <Body className="mt-2">Your profile and your TedTime Bear.</Body>
      {session ? <Account key={session.user.id} userId={session.user.id} email={session.user.email} displayName={name} /> : null}
      <BearConnection />
    </View>
  </Shell>;
}
