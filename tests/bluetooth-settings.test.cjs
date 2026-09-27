const assert = require('node:assert/strict');
const { test } = require('node:test');
const { load, harness, tick } = require('./hook-harness.cjs');

function settings(os, { openURL, sendIntent } = {}) {
  const calls = [];
  const Linking = {
    openURL: async url => { calls.push(['openURL', url]); if (openURL) await openURL(url); },
    sendIntent: async action => { calls.push(['sendIntent', action]); if (sendIntent) await sendIntent(action); },
    openSettings: async () => { calls.push(['openSettings']); },
  };
  const module = load('src/services/bluetooth-settings.ts', { 'react-native': { Linking, Platform: { OS: os } } });
  return { open: module.openBluetoothSettings, calls };
}

test('iPhone opens Settings > Bluetooth, falling back to the Settings app', async () => {
  const ok = settings('ios');
  assert.equal(await ok.open(), true);
  assert.deepEqual(ok.calls, [['openURL', 'App-Prefs:Bluetooth']]);
  const refused = settings('ios', { openURL: async () => { throw new Error('not allowed'); } });
  assert.equal(await refused.open(), true);
  assert.deepEqual(refused.calls, [['openURL', 'App-Prefs:Bluetooth'], ['openSettings']]);
});

test('Android opens Bluetooth settings through the system intent', async () => {
  const android = settings('android');
  assert.equal(await android.open(), true);
  assert.deepEqual(android.calls, [['sendIntent', 'android.settings.BLUETOOTH_SETTINGS']]);
});

test('web cannot open settings, so the screen shows the steps instead', async () => {
  const web = settings('web');
  assert.equal(await web.open(), false);
  assert.deepEqual(web.calls, []);
});
