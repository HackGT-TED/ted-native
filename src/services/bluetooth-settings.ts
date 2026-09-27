import { Linking, Platform } from 'react-native';

/**
 * Opens the phone's Bluetooth settings so the user can pair their TedTime Bear.
 * Returns false when the platform cannot (web), so the screen can show steps instead.
 *
 * iOS has no public link to Settings > Bluetooth. "App-Prefs:Bluetooth" is an
 * undocumented scheme that works on many iOS versions but can be flagged in App
 * Store review; if iOS refuses it, the Settings app opens instead.
 */
export async function openBluetoothSettings(): Promise<boolean> {
  if (Platform.OS === 'web') return false;
  try {
    if (Platform.OS === 'ios') await Linking.openURL('App-Prefs:Bluetooth');
    else await Linking.sendIntent('android.settings.BLUETOOTH_SETTINGS');
    return true;
  } catch {
    await Linking.openSettings();
    return true;
  }
}
