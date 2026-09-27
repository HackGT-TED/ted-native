# StoryBear connection and firmware contract

Open **My Bear** from the app navigation. Find My Bear runs a ten-second service-filtered search; choose Connect when your bear appears. Multiple bears can be selected individually. The service validates the discovered service and characteristic capabilities before displaying a connection, subscribes to status notifications, and exposes Test Vibration. Battery and readiness remain unknown until reported by the device. There is no automatic reconnect loop: after losing a connection, find and connect again. The last successful ID is stored locally and labelled when rediscovered.

## Development build

Installed with `npx expo install`: `react-native-ble-manager` 12.5.3 and `expo-dev-client` ~57.0.19. The lockfile records exact versions. This project uses Expo SDK 57, React Native 0.86 and the new architecture. Use a physical iOS or Android phone and an Expo development build; Expo Go cannot load the Bluetooth native module. Web displays a friendly phone-app message when connection is requested.

The existing `development` profile in `eas.json` already enables the development client and internal distribution:

```sh
npx eas-cli@latest build --profile development --platform android
# Or, for a registered physical iPhone:
npx eas-cli@latest build --profile development --platform ios

# Install the resulting build on the phone, then start Metro:
npx expo start --dev-client
```

EAS authentication and, for iOS, signing/device registration are required. These commands are instructions; no cloud build was submitted during implementation. Rebuild the native app after installing the packages or changing plugin permissions. An over-the-air JS update cannot add this native module.

If the console reports `BleManagerModule not found`, the running app does not expose the native Bluetooth module. Install a new development build made from this project, and launch that installed app rather than Expo Go. Restart Metro with `npx expo start --dev-client --clear` after installing the build. Clearing Metro alone cannot add native code. The app checks native module availability before requesting permissions or importing the library so an older build shows a recoverable message without triggering the library's import-time error.

`app.json` uses the library's bundled config plugin with `neverForLocation: true`, `isBleRequired: false`, `companionDeviceEnabled: false`, and a StoryBear-specific `bluetoothAlwaysPermission`. Introspection confirms `NSBluetoothAlwaysUsageDescription`, Android `BLUETOOTH_SCAN` with `neverForLocation`, and `BLUETOOTH_CONNECT`. The plugin also supplies legacy Bluetooth and location permissions; location permission is capped at API 30. Runtime code requests scan/connect on Android 12+ and fine location on earlier supported Android versions. iOS prompts through CoreBluetooth initialization. No native directories were created, and no background Bluetooth modes are enabled. Scans stop on screen exit or app backgrounding.

References: [library Expo plugin](https://innoveit.github.io/react-native-ble-manager/expo/), [current methods](https://innoveit.github.io/react-native-ble-manager/methods/), [events](https://innoveit.github.io/react-native-ble-manager/events/), [Expo development builds](https://docs.expo.dev/develop/development-builds/introduction/).

## Provisional ESP32 contract

All UUIDs and encoding/decoding live in `src/services/bluetooth/storyBearProtocol.ts`. These are placeholders that must be agreed with firmware before hardware testing:

| Purpose | UUID | Required capability |
| --- | --- | --- |
| Service | `7a6e1000-6b73-4f2d-8a19-535442454152` | Advertised custom service |
| Command | `7a6e1001-6b73-4f2d-8a19-535442454152` | Write with response |
| Status | `7a6e1002-6b73-4f2d-8a19-535442454152` | Notify or Indicate; Read recommended |
| Battery | `7a6e1003-6b73-4f2d-8a19-535442454152` | Optional Read and/or Notify/Indicate |

1. Advertise the custom service UUID in the advertising service list. A name such as `StoryBear-7F2A` is only a display label. A matching name alone never admits a device. Include the full 128-bit service in advertising; if legacy advertising space is tight, put the name in the scan response.
2. Expose command and status characteristics under that same service, with the capabilities above. The app rejects a similarly named device with missing or mismatched services/characteristics. Service matching is an identity convention, not cryptographic device authentication.
3. On a command write of `[0x01]`, trigger a short, firmware-bounded vibration. The app uses an acknowledged write. A successful write only means the request was accepted; it cannot prove that a physical motor moved.
4. Send exactly one complete frame per status notification. Unknown or malformed frames are ignored:

   | Bytes | Event |
   | --- | --- |
   | `[0x01]` | Ready; interactions display On |
   | `[0x02, level]` | Battery percentage, integer 0–100 |
   | `[0x03, 0x00]` / `[0x03, 0x01]` | Left / right paw button event |
   | `[0x7f, code]` | Device error, unsigned byte code |

5. Send Ready after the app enables status notifications. If Status supports Read, return a current status frame so readiness can also be recovered when the device was ready before subscription. The optional battery characteristic returns/notifies a single byte 0–100; battery may instead arrive as a status frame. Paw events are parsed and exposed to subscribers but have no screen or playback behavior yet. Error codes are exposed to subscribers and show a generic recovery message to users.

## Shared app API

`StoryBearProvider` owns one service for the app, independently of the connection screen and the audio player. Screens or future playback hooks can use:

```tsx
const { connectedBear, storyBear } = useStoryBear();
await storyBear.testHaptic(); // Promise<boolean>; false for unavailable/failed/busy writes
await storyBear.sendCommand(StoryBearCommand.TestHaptic);

// Subscribe in an effect and return the unsubscribe function:
useEffect(() => storyBear.subscribeToStoryBearStatus(event => {
  // Future button or timeline interaction.
}), [storyBear]);
```

The service also exposes `initializeBluetooth`, `scanForStoryBears`, `stopStoryBearScan`, `connectToStoryBear`, and `disconnectStoryBear`. Initialization is lazy, with one native manager initialization. The provider cleans up listeners, scans and connections on teardown. Native operations have time limits, and generation guards reject stale async results. The service's status and action methods handle native errors rather than exposing raw platform messages to the screen.

Audio continues through the existing player. Users pair/select the bear as a speaker through their phone's Bluetooth/audio controls. The screen deliberately reports only **Bear controls connected** and explains **Audio output** separately; no audio-route detection, speaker pairing, BLE audio transfer, or automatic timeline haptics were added.

## Validation and remaining hardware work

Run `npx expo lint`, `npx tsc --noEmit`, and `node --test tests/*.test.cjs`. Tests mock the native boundary and cover admission filtering, duplicate discoveries, permissions, scan limits/cancellation, invalid services, notification failures/parsing, battery, haptic writes, late connections, disconnect races, persistence and cleanup. These checks do not establish radio/firmware compatibility.

On physical iOS and Android development builds, verify:

- Allow, deny, permanently deny, and restore permission; Bluetooth off/unavailable; enable Bluetooth and retry. On Android 11 and earlier, enable system Location if scanning returns no results.
- No bear, one bear, multiple bears, weak signal, screen exit/background during search, and rapid repeated actions. An unrelated peripheral named StoryBear must not appear.
- Valid service discovery, invalid firmware rejection, readiness notifications, battery updates, actual motor vibration, and command-write failure.
- Bear power loss, phone Bluetooth toggles, moving out of range, manual reconnect, disconnect failure/retry, and last-bear persistence after restarting the app.
- Story playback and recording remain functional; select the bear speaker using OS controls and verify audio routing independently.
- Check the new screen visually on both phone platforms, including large text and screen-reader navigation. Browser visual inspection was unavailable in the implementation environment.

Firmware still needs to implement/finalize these UUIDs and frames, notify readiness after subscription, supply real battery readings, and safely drive the motor. The separate speaker/A2DP hardware and OS pairing are outside this BLE implementation.

## Files

- Added `src/services/bluetooth/storyBearBle.ts`, `storyBearNative.ts`, `storyBearProtocol.ts`, `storyBearTypes.ts`.
- Added `src/context/story-bear.tsx`, `src/app/bear.tsx`, `src/components/story-bear-illustration.tsx`, `tests/story-bear.test.cjs`, and this document.
- Updated `src/app/_layout.tsx`, `src/components/shell.tsx`, `app.json`, `package.json`, `package-lock.json`, and `README.md`.
