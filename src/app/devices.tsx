import { useState } from 'react';
import { ActivityIndicator, Linking, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import type { Characteristic } from 'react-native-ble-manager';
import { characteristicKey } from '../ble/client';
import { Shell } from '../components/shell';
import { Body, colors, Heading, Label } from '../components/ui';
import { useBle } from '../context/ble';

function Action({ title, onPress, disabled = false }: { title: string; onPress: () => void; disabled?: boolean }) {
  return <Pressable accessibilityRole="button" accessibilityState={{ disabled }} disabled={disabled} onPress={onPress} style={[styles.button, disabled && styles.disabled]}><Text style={styles.buttonText}>{title}</Text></Pressable>;
}

function CharacteristicCard({ characteristic }: { characteristic: Characteristic }) {
  const { client, values, notifications, busy } = useBle();
  const [hex, setHex] = useState('');
  const [sent, setSent] = useState(false);
  const key = characteristicKey(characteristic.service, characteristic.characteristic);
  const value = values[key];
  const properties = characteristic.properties;
  return <View style={styles.card}>
    <Label>CHARACTERISTIC</Label>
    <Text selectable style={styles.uuid}>{characteristic.characteristic}</Text>
    <Body>Service</Body><Text selectable style={styles.uuid}>{characteristic.service}</Text>
    <Body>{Object.keys(properties).join(' · ') || 'No available operations'}</Body>
    <View style={styles.actions}>
      {!!properties.Read && <Action title="Read value" disabled={busy} onPress={() => { void client.read(characteristic); }} />}
      {!!(properties.Notify || properties.Indicate) && <Action title={notifications.includes(key) ? 'Stop updates' : 'Listen for updates'} disabled={busy} onPress={() => { void client.toggleNotifications(characteristic); }} />}
    </View>
    {value !== undefined && <Text selectable accessibilityLiveRegion="polite" style={styles.value}>{value.length ? value.map(byte => byte.toString(16).padStart(2, '0')).join(' ').toUpperCase() : '(empty value)'}</Text>}
    {!!(properties.Write || properties.WriteWithoutResponse) && <View style={styles.write}>
      <TextInput accessibilityLabel={`Hexadecimal bytes for ${characteristic.characteristic}`} placeholder="Hex bytes, e.g. 01 A0 FF" placeholderTextColor={colors.muted} value={hex} onChangeText={text => { setHex(text); setSent(false); }} autoCapitalize="characters" autoCorrect={false} style={styles.input} />
      <Body>Up to 20 bytes. Use the commands documented by your device.</Body>
      <Action title="Send bytes" disabled={busy || !hex.trim()} onPress={() => { setSent(false); void client.write(characteristic, hex).then(() => setSent(!client.getSnapshot().error && !!client.getSnapshot().connected)); }} />
      {sent && <Body>Bytes sent.</Body>}
    </View>}
  </View>;
}

export default function Devices() {
  const { devices, connected, scanning, busy, error, state, client, unavailableReason } = useBle();
  const [searched, setSearched] = useState(false);
  const [settingsError, setSettingsError] = useState<string | null>(null);
  return <Shell><View style={styles.page}>
    <Label>A LITTLE CONNECTION</Label>
    <Heading>Your nearby devices</Heading>
    <Body>Connect to a Bluetooth Low Energy device to explore its services and exchange data. Keep the device nearby and this app open.</Body>
    {unavailableReason ? <View style={styles.card}><Body>{unavailableReason}</Body></View> : <>
      <Text accessibilityLiveRegion="polite" style={styles.status}>{connected ? `Connected to ${connected.name || connected.advertising.localName || 'device'}` : scanning ? 'Looking for nearby devices…' : busy ? 'Connecting to Bluetooth…' : state === 'on' ? 'Bluetooth is ready' : 'Scan to get started'}</Text>
      {(error || settingsError) && <View style={styles.card}>
        <Text accessibilityRole="alert" style={styles.error}>{error || settingsError}</Text>
        <Action title="Open app settings" onPress={() => { void Linking.openSettings().catch(() => setSettingsError('Could not open Settings. Open your phone’s Settings app manually.')); }} />
      </View>}
      {busy && <ActivityIndicator accessibilityLabel="Bluetooth operation in progress" color={colors.green} />}
      {connected ? <>
        <Action title="Disconnect device" disabled={busy} onPress={() => { void client.disconnect(); }} />
        <Text selectable style={styles.uuid}>{connected.id}</Text>
        <Heading style={{ fontSize: 28 }}>Device services</Heading>
        {!connected.characteristics?.length && <Body>This device did not expose any characteristics.</Body>}
        {connected.characteristics?.map(characteristic => <CharacteristicCard key={characteristicKey(characteristic.service, characteristic.characteristic)} characteristic={characteristic} />)}
      </> : <>
        <Action title={scanning ? 'Stop scanning' : 'Scan for devices'} disabled={busy} onPress={() => { setSearched(true); void (scanning ? client.stopScan() : client.scan()); }} />
        {searched && !scanning && !busy && !devices.length && !error && <Body>No devices found. Make sure your device is advertising, then scan again. On Android 11 and earlier, also turn on Location services.</Body>}
        {devices.map(device => <View key={device.id} style={styles.card}>
          <Text style={styles.deviceName}>{device.name || device.advertising.localName || 'Unnamed device'}</Text>
          <Text selectable style={styles.uuid}>{device.id}</Text>
          <Body>Signal: {device.rssi} dBm</Body>
          <Action title={device.advertising.isConnectable === false ? 'Not connectable' : 'Connect'} disabled={busy || device.advertising.isConnectable === false} onPress={() => { void client.connect(device); }} />
        </View>)}
      </>}
    </>}
  </View></Shell>;
}

const styles = StyleSheet.create({
  page: { paddingTop: 30, gap: 16, maxWidth: 760, width: '100%', alignSelf: 'center' },
  card: { backgroundColor: colors.cream, borderColor: colors.line, borderWidth: 1, borderRadius: 10, padding: 18, gap: 12 },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  button: { minHeight: 48, paddingHorizontal: 18, paddingVertical: 14, backgroundColor: colors.green, borderRadius: 6, alignItems: 'center', justifyContent: 'center' },
  buttonText: { color: colors.paper, fontWeight: '600', fontSize: 13 },
  disabled: { opacity: 0.45 },
  status: { color: colors.green, fontWeight: '600', fontSize: 14 },
  error: { color: '#943D2B', lineHeight: 22 },
  deviceName: { fontSize: 18, fontWeight: '600', color: colors.ink },
  uuid: { color: colors.muted, fontSize: 12, lineHeight: 18 },
  value: { color: colors.ink, fontSize: 14, lineHeight: 22 },
  write: { gap: 10, marginTop: 4 },
  input: { borderWidth: 1, borderColor: colors.line, borderRadius: 6, padding: 14, minHeight: 48, color: colors.ink, backgroundColor: colors.paper },
});
