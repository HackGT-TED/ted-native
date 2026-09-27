import AsyncStorage from '@react-native-async-storage/async-storage';
import { PermissionsAndroid, Platform, TurboModuleRegistry } from 'react-native';
import type BleManager from 'react-native-ble-manager';
import type { StoryBearDependencies } from './storyBearBle';

let driverPromise: Promise<typeof BleManager> | null = null;

function checkAvailability() {
  if (Platform.OS !== 'ios' && Platform.OS !== 'android') {
    throw new Error('Use the StoryBear app on your phone to connect your bear.');
  }
  // The library throws in its module constructor when native code is absent.
  // Metro can report that import-time exception even if import() is caught later.
  // get() is nullable, unlike getEnforcing(), so probe before evaluating the library.
  if (!TurboModuleRegistry.get('BleManager')) {
    throw new Error('Bear connections aren’t included in this version of the app. Install the updated StoryBear app on your phone and try again.');
  }
}

async function loadDriver() {
  checkAvailability();
  // Import only on demand: web/SSR and Expo Go must not load the native module at startup.
  if (!driverPromise) {
    driverPromise = (async () => {
      const { default: manager } = await import('react-native-ble-manager');
      await manager.start({ showAlert: false });
      return manager;
    })().catch(() => {
      driverPromise = null;
      throw new Error('Bear connections are unavailable in this app version. Install the StoryBear app built for your phone.');
    });
  }
  return driverPromise;
}

async function requestPermissions() {
  if (Platform.OS !== 'android') return true;
  const permissions = Number(Platform.Version) >= 31
    ? [PermissionsAndroid.PERMISSIONS.BLUETOOTH_SCAN, PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT]
    : [PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION];
  const result = await PermissionsAndroid.requestMultiple(permissions);
  return permissions.every(permission => result[permission] === PermissionsAndroid.RESULTS.GRANTED);
}

export const storyBearDependencies: StoryBearDependencies = {
  checkAvailability,
  loadDriver,
  requestPermissions,
  storage: AsyncStorage,
};
