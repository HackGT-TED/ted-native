import Constants from 'expo-constants';
import { PermissionsAndroid, Platform } from 'react-native';
import type { Manager } from './client';

export const unavailableReason = Platform.OS === 'web'
  ? 'Bluetooth is available in the TedTime iOS and Android app.'
  : Constants.executionEnvironment === 'storeClient'
    ? 'Bluetooth requires a TedTime development build. Expo Go does not include Bluetooth support.' : null;

let started: Promise<Manager> | undefined;
export async function loadManager() {
  if (unavailableReason) throw new Error(unavailableReason);
  // Do not evaluate the native module in Expo Go or during web rendering.
  started ??= import('react-native-ble-manager').then(async ({ default: manager }) => {
    await manager.start({ showAlert: false });
    return manager;
  }).catch(() => {
    started = undefined;
    throw new Error('Bluetooth could not start. Install a new development build with Bluetooth support and try again.');
  });
  return started;
}
export async function requestPermissions() {
  if (unavailableReason) throw new Error(unavailableReason);
  if (Platform.OS !== 'android') return;
  const permissions = Number(Platform.Version) >= 31
    ? [PermissionsAndroid.PERMISSIONS.BLUETOOTH_SCAN, PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT]
    : [PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION];
  const result = await PermissionsAndroid.requestMultiple(permissions);
  if (!permissions.every(permission => result[permission] === PermissionsAndroid.RESULTS.GRANTED)) {
    throw new Error('Bluetooth permission is required. Allow Nearby devices (or Location on Android 11 and earlier) in Settings, then try again.');
  }
}
