import assert from 'node:assert/strict';
import { test } from 'node:test';
import { BleClient, characteristicKey } from '../src/ble/client.ts';

const device = { id: 'test-device', name: 'Test device', rssi: -45, advertising: {} };
const characteristic = { service: 'ABCD', characteristic: '1234', properties: { Read: 'Read', Write: 'Write', Notify: 'Notify' } };
function setup(overrides = {}, permissions = async () => {}) {
  const events = new Map();
  const calls = [];
  const manager = {
    checkState: async () => 'on',
    scan: async options => { calls.push(['scan', options]); },
    stopScan: async () => {},
    connect: async () => {},
    disconnect: async id => { calls.push(['disconnect', id]); },
    retrieveServices: async () => ({ ...device, characteristics: [characteristic] }),
    read: async (...args) => { calls.push(['read', ...args]); return [1, 255]; },
    write: async (...args) => { calls.push(['write', ...args]); },
    startNotification: async (...args) => { calls.push(['notify', ...args]); },
    stopNotification: async () => {},
    ...overrides,
  };
  for (const event of ['onDiscoverPeripheral', 'onStopScan', 'onDidUpdateState', 'onDisconnectPeripheral', 'onDidUpdateValueForCharacteristic']) {
    manager[event] = callback => { events.set(event, callback); return { remove: () => events.delete(event) }; };
  }
  const client = new BleClient(async () => manager, permissions, 15);
  return { client, calls, events };
}

test('permission rejection prevents native scanning and permits retry', async () => {
  let denied = true;
  const { client, calls } = setup({}, async () => { if (denied) throw new Error('Permission denied'); });
  await client.scan();
  assert.equal(client.getSnapshot().error, 'Permission denied');
  assert.equal(client.getSnapshot().busy, false);
  assert.equal(calls.length, 0);
  denied = false;
  await client.scan();
  assert.equal(client.getSnapshot().scanning, true);
  client.dispose();
});

test('powered-off adapter never scans', async () => {
  const { client, calls } = setup({ checkState: async () => 'off' });
  await client.scan();
  assert.match(client.getSnapshot().error, /Turn on Bluetooth/);
  assert.equal(calls.length, 0);
  client.dispose();
});

test('scan uses v12 options, deduplicates discoveries, and resets on failure', async () => {
  const { client, events, calls } = setup();
  await Promise.all([client.scan(), client.scan()]);
  assert.equal(calls.filter(call => call[0] === 'scan').length, 1);
  assert.equal(calls[0][1].seconds, 8);
  events.get('onDiscoverPeripheral')(device);
  events.get('onDiscoverPeripheral')({ ...device, rssi: -60 });
  assert.equal(client.getSnapshot().devices.length, 1);
  assert.equal(client.getSnapshot().devices[0].rssi, -60);
  events.get('onStopScan')({ status: 2 });
  assert.equal(client.getSnapshot().scanning, false);
  assert.match(client.getSnapshot().error, /code 2/);
  client.dispose();
});

test('scan rejection resets busy and scanning state', async () => {
  const { client } = setup({ scan: async () => { throw new Error('Scan failed'); } });
  await client.scan();
  assert.equal(client.getSnapshot().scanning, false);
  assert.equal(client.getSnapshot().busy, false);
  assert.equal(client.getSnapshot().error, 'Scan failed');
  client.dispose();
});

test('discovers services before connecting and uses correct GATT argument order', async () => {
  const { client, events, calls } = setup();
  await client.connect(device);
  assert.equal(client.getSnapshot().connected.id, device.id);
  await client.read(characteristic);
  assert.deepEqual(calls.find(call => call[0] === 'read'), ['read', device.id, 'ABCD', '1234']);
  await client.write(characteristic, '01 A0 FF');
  assert.deepEqual(calls.find(call => call[0] === 'write'), ['write', device.id, 'ABCD', '1234', [1, 160, 255], 20]);
  await client.toggleNotifications(characteristic);
  const key = characteristicKey('ABCD', '1234');
  events.get('onDidUpdateValueForCharacteristic')({ peripheral: device.id, service: 'abcd', characteristic: '1234', value: [2] });
  assert.deepEqual(client.getSnapshot().values[key], [2]);
  events.get('onDidUpdateValueForCharacteristic')({ peripheral: 'other-device', service: 'abcd', characteristic: '1234', value: [3] });
  assert.deepEqual(client.getSnapshot().values[key], [2]);
  events.get('onDisconnectPeripheral')({ peripheral: device.id });
  assert.equal(client.getSnapshot().connected, null);
  assert.deepEqual(client.getSnapshot().values, {});
  assert.deepEqual(client.getSnapshot().notifications, []);
  client.dispose();
});

test('rejects malformed or oversized writes without sending data', async () => {
  const { client, calls } = setup();
  await client.connect(device);
  for (const value of ['', '0', 'GG', 'AB'.repeat(21)]) {
    await client.write(characteristic, value);
    assert.ok(client.getSnapshot().error);
  }
  assert.equal(calls.filter(call => call[0] === 'write').length, 0);
  client.dispose();
});

test('service discovery failure rolls back connection', async () => {
  const { client, calls } = setup({ retrieveServices: async () => { throw new Error('Discovery failed'); } });
  await client.connect(device);
  assert.equal(client.getSnapshot().connected, null);
  assert.equal(client.getSnapshot().busy, false);
  assert.ok(calls.some(call => call[0] === 'disconnect'));
  client.dispose();
});

test('connection timeout cancels a pending connection and ignores late success', async () => {
  let resolveConnect;
  const { client, calls } = setup({ connect: () => new Promise(resolve => { resolveConnect = resolve; }) });
  await client.connect(device);
  assert.match(client.getSnapshot().error, /timed out/);
  resolveConnect();
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(client.getSnapshot().connected, null);
  assert.ok(calls.some(call => call[0] === 'disconnect'));
  client.dispose();
});

test('cleanup removes listeners and cannot be undone by delayed permissions', async () => {
  let grant;
  const { client, events, calls } = setup({}, () => new Promise(resolve => { grant = resolve; }));
  const pending = client.scan();
  client.dispose();
  grant();
  await pending;
  assert.equal(client.getSnapshot().scanning, false);
  assert.equal(client.getSnapshot().busy, false);
  assert.equal(events.size, 0);
  assert.equal(calls.length, 0);
});

test('turning Bluetooth off during service discovery cannot restore a stale connection', async () => {
  let finishDiscovery;
  const { client, events } = setup({ retrieveServices: () => new Promise(resolve => { finishDiscovery = resolve; }) });
  const pending = client.connect(device);
  await new Promise(resolve => setImmediate(resolve));
  events.get('onDidUpdateState')({ state: 'off' });
  finishDiscovery({ ...device, characteristics: [characteristic] });
  await pending;
  assert.equal(client.getSnapshot().connected, null);
  assert.equal(client.getSnapshot().busy, false);
  client.dispose();
});
