# Bluetooth LE in TedTime

Open **Devices** in the app navigation. Scan, select a nearby advertising BLE
peripheral, and connect. The screen discovers its services and characteristics;
supported characteristics offer read, hexadecimal write, and notification controls.
Writes accept at most 20 bytes per operation. Device commands, message framing,
and larger transfers must follow the peripheral's protocol.

This integration uses `react-native-ble-manager` 12.5, the same library as the
[reference project](https://github.com/cmcWebCode40/React-Native-Expo-Bluetooth-Integration).
It uses the current options-object scan API and discovers actual services instead
of assuming the example's device-specific UUIDs. It does not implement Bluetooth
Classic pairing, audio streaming, or automatic reconnection.

## Run on hardware

BLE requires a native build on a physical iOS or Android device. Expo Go and the
web version display an availability message. `expo-dev-client` and EAS build
profiles are configured. To create a development build:

```sh
npx eas-cli@latest build --profile development --platform android
# Or, for an iPhone registered with your Apple development team:
npx eas-cli@latest build --profile development --platform ios
```

On first build, EAS may prompt for app identifiers and signing credentials.
Install the build, then run:

```sh
npx expo start --dev-client
```

Rebuild after changing native dependencies or permission configuration. An OTA
update alone cannot add the Bluetooth module. See
[Expo development builds](https://docs.expo.dev/develop/development-builds/introduction/).

## Permissions and lifecycle

- Android 12+: requests Nearby devices (`BLUETOOTH_SCAN` and `BLUETOOTH_CONNECT`).
- Android 11 and earlier: requests fine location for scanning. Location services
  must also be enabled on these versions.
- iOS: the system prompts for Bluetooth access when the native manager starts.
- The BLE config plugin generates scan/location manifest entries and the iOS
  usage description. `neverForLocation` is enabled; scanning is not used to infer
  location. Android may filter some beacon advertisements with this flag.
- Permissions are requested when the user scans or connects, not at app startup.
- Scans last eight seconds. Connections have a 15-second timeout, including service
  discovery. One device is connected at a time.
- Connections persist across screens. Backgrounding the app or unmounting the
  root provider stops scanning, disconnects, and removes native listeners.
- No background BLE modes are enabled. Return to Devices and scan to reconnect.

## App integration points

- `src/ble/client.ts`: session state, scan/connect/disconnect, service discovery,
  reads, writes, notifications, and cleanup; native API injected for testing.
- `src/ble/runtime.ts`: lazy native module initialization and Android permissions.
- `src/ble/runtime.web.ts`: web fallback without loading the native module.
- `src/context/ble.tsx`: app-wide provider and `useBle()` hook.
- `src/app/devices.tsx`: device browser and GATT controls.

Use `useBle()` elsewhere in the app to access the active connection and its
characteristics. Pass a discovered characteristic to `client.read`,
`client.write(characteristic, hexBytes)`, or `client.toggleNotifications`.
Values are raw byte arrays keyed by `characteristicKey(service, characteristic)`.
Operations expose failures through the hook's `error` field. No device-specific
UUIDs, text encoding, sensor decoding, or commands are assumed.

## Validation

```sh
node --experimental-strip-types --test tests/ble-client.test.mjs
npx expo lint
npx tsc --noEmit
```

The tests run on Node 22.6+ without Bluetooth hardware. They cover permission
denial, powered-off adapters, scan failures, duplicate discoveries, GATT arguments,
invalid writes, notifications, disconnects, connection timeouts, and cleanup.
Expo generates route types when its development server starts; start it once if
typechecking reports missing routes after adding a screen.

Physical-device acceptance checks remain necessary: deny/re-grant permissions,
scan with Bluetooth off/on, connect to the intended peripheral, inspect its UUIDs,
read/write a known value, receive notifications, disconnect from the peripheral,
and background/reopen the app. Validate on both iOS and Android before release.
