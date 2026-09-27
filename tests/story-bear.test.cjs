const assert = require('node:assert/strict');
const { test } = require('node:test');
const { load, deferred, tick } = require('./hook-harness.cjs');
const protocol = load('src/services/bluetooth/storyBearProtocol.ts', {});
const { STORYBEAR_SERVICE_UUID: service, STORYBEAR_COMMAND_CHARACTERISTIC_UUID: command,
  STORYBEAR_STATUS_CHARACTERISTIC_UUID: status, STORYBEAR_BATTERY_CHARACTERISTIC_UUID: battery } = protocol;

function setup(options = {}) {
  const events = new Map(); const calls = []; const timers = new Map(); let timerId = 0;
  const info = { services: [{ uuid: service.toUpperCase() }], characteristics: [
    { service, characteristic: command, properties: { Write: 'Write' } },
    { service, characteristic: status, properties: { Notify: 'Notify' } },
    { service, characteristic: battery, properties: { Read: 'Read', Notify: 'Notify' } },
  ] };
  const driver = {
    scan: async config => { calls.push(['scan', config]); },
    stopScan: async () => { calls.push(['stop']); },
    checkState: async () => options.state ?? 'on',
    connect: async id => { calls.push(['connect', id]); if (options.connection) await options.connection; },
    disconnect: async id => { calls.push(['disconnect', id]); if (options.disconnectError) throw Error('native'); },
    retrieveServices: async () => options.info ?? info,
    startNotification: async (...args) => { calls.push(['notify', ...args]); if (options.notifyError) throw Error('native'); },
    read: async () => [86],
    write: async (...args) => { calls.push(['write', ...args]); if (options.write) await options.write; if (options.writeError) throw Error('raw GATT failure'); },
  };
  for (const name of ['onDiscoverPeripheral', 'onStopScan', 'onDidUpdateState', 'onDisconnectPeripheral', 'onDidUpdateValueForCharacteristic']) {
    driver[name] = callback => { events.set(name, callback); return { remove() { events.delete(name); } }; };
  }
  const { StoryBearBle } = load('src/services/bluetooth/storyBearBle.ts', { './storyBearProtocol': protocol }, {
    setTimeout: (fn, ms) => { const id = ++timerId; timers.set(id, { fn, ms }); return id; },
    clearTimeout: id => timers.delete(id),
  });
  let permissionRequests = 0;
  const bear = new StoryBearBle({
    loadDriver: async () => { if (options.unavailable) throw Error('Bluetooth unavailable'); return driver; },
    requestPermissions: async () => { permissionRequests++; return options.permissions ?? true; },
    storage: {
      getItem: async () => options.lastId ?? null,
      setItem: async (...args) => { calls.push(['save', ...args]); if (options.storageError) throw Error('storage'); },
    },
  });
  const emit = (name, value) => events.get(name)?.(value);
  const discover = (id = 'bear-1', extra = {}) => emit('onDiscoverPeripheral', {
    id, name: 'StoryBear-7F2A', rssi: -60, advertising: { serviceUUIDs: [service], isConnectable: true }, ...extra,
  });
  const notify = (value, extra = {}) => emit('onDidUpdateValueForCharacteristic', {
    peripheral: 'bear-1', service, characteristic: status, value, ...extra,
  });
  const fire = async ms => {
    for (const [id, timer] of [...timers]) if (timer.ms === ms) { timers.delete(id); timer.fn(); }
    await tick();
  };
  bear.mount();
  return { bear, driver, calls, events, timers, info, emit, discover, notify, fire,
    permissionRequests: () => permissionRequests,
    async connect() { await bear.scanForStoryBears(); discover(); await bear.connectToStoryBear('bear-1'); await tick(); },
  };
}

test('scan uses the installed options API, rejects names alone, and deduplicates IDs', async () => {
  const h = setup(); await h.bear.scanForStoryBears();
  assert.deepEqual(Array.from(h.calls[0][1].serviceUUIDs), [service]);
  assert.equal(h.calls[0][1].seconds, 10);
  h.discover('imposter', { advertising: { serviceUUIDs: ['180f'] } });
  h.discover(); h.discover('bear-1', { rssi: -70 });
  h.discover('bear-2', { advertising: { serviceUUIDs: [service.toUpperCase()] } });
  assert.equal(h.bear.getSnapshot().bears.length, 2);
  assert.equal(h.bear.getSnapshot().bears[0].rssi, -70);
  h.emit('onStopScan', { status: 10 });
  assert.equal(h.bear.getSnapshot().state, 'found');
  assert.equal(h.timers.size, 0);
  h.bear.dispose();
});

test('empty scans and native scan errors have distinct outcomes', async () => {
  const h = setup(); await h.bear.scanForStoryBears(); h.emit('onStopScan', { status: 10 });
  assert.equal(h.bear.getSnapshot().state, 'idle'); assert.equal(h.bear.getSnapshot().hasSearched, true);
  await h.bear.scanForStoryBears(); h.emit('onStopScan', { status: 3 });
  assert.equal(h.bear.getSnapshot().state, 'error'); h.bear.dispose();
});

test('scan watchdog stops the native scan if its stop event never arrives', async () => {
  const h = setup(); await h.bear.scanForStoryBears(); await h.fire(12000);
  assert.equal(h.bear.getSnapshot().state, 'idle'); assert.ok(h.calls.some(call => call[0] === 'stop'));
  h.bear.dispose();
});

test('permission denial, power off and missing native support never scan', async () => {
  for (const [options, availability] of [[{ permissions: false }, 'denied'], [{ state: 'off' }, 'off'], [{ unavailable: true }, 'unavailable'], [{ state: 'unauthorized' }, 'denied']]) {
    const h = setup(options); await h.bear.scanForStoryBears();
    assert.equal(h.bear.getSnapshot().state, 'error'); assert.equal(h.bear.getSnapshot().availability, availability);
    assert.ok(!h.calls.some(call => call[0] === 'scan')); h.bear.dispose();
  }
});

test('cancel while awaiting permission prevents a later scan; duplicate taps are ignored', async () => {
  const permission = deferred(); const h = setup({ permissions: permission.promise });
  const first = h.bear.scanForStoryBears(); await h.bear.scanForStoryBears();
  assert.equal(h.permissionRequests(), 1);
  await h.bear.stopStoryBearScan(); permission.resolve(true); await first;
  assert.equal(h.bear.getSnapshot().state, 'idle'); assert.ok(!h.calls.some(call => call[0] === 'scan')); h.bear.dispose();
});

test('cannot connect an arbitrary ID or a nonconnectable advertisement', async () => {
  const h = setup(); await h.bear.scanForStoryBears();
  await h.bear.connectToStoryBear('unseen');
  h.discover('bear-1', { advertising: { serviceUUIDs: [service], isConnectable: false } });
  await h.bear.connectToStoryBear('bear-1'); assert.ok(!h.calls.some(call => call[0] === 'connect')); h.bear.dispose();
});

test('valid connection subscribes before success, reads battery and persists the bear', async () => {
  const h = setup(); await h.connect();
  const snapshot = h.bear.getSnapshot();
  assert.equal(snapshot.state, 'connected'); assert.equal(snapshot.battery, 86); assert.equal(snapshot.ready, false);
  assert.ok(h.calls.some(call => call[0] === 'notify' && call[3] === status));
  assert.ok(h.calls.some(call => call[0] === 'save' && call[2] === 'bear-1'));
  h.bear.dispose();
});

test('missing or incorrectly scoped characteristics and services are disconnected', async () => {
  for (const kind of ['service', 'command', 'status', 'wrong-service', 'write-property']) {
    const h = setup(); await h.bear.scanForStoryBears(); h.discover();
    if (kind === 'service') h.info.services = [];
    if (kind === 'command' || kind === 'status') h.info.characteristics = h.info.characteristics.filter(c => c.characteristic !== (kind === 'command' ? command : status));
    if (kind === 'wrong-service') h.info.characteristics[0].service = '180f';
    if (kind === 'write-property') h.info.characteristics[0].properties = { WriteWithoutResponse: 'WriteWithoutResponse' };
    await h.bear.connectToStoryBear('bear-1');
    assert.equal(h.bear.getSnapshot().state, 'error', kind);
    assert.equal(h.bear.getSnapshot().connectedBear, null);
    assert.ok(h.calls.some(call => call[0] === 'disconnect')); assert.ok(!h.calls.some(call => call[0] === 'save'));
    h.bear.dispose();
  }
});

test('required notification failure rejects connection; optional storage failure does not', async () => {
  const bad = setup({ notifyError: true }); await bad.connect(); assert.equal(bad.bear.getSnapshot().state, 'error'); bad.bear.dispose();
  const good = setup({ storageError: true }); await good.connect(); assert.equal(good.bear.getSnapshot().state, 'connected'); good.bear.dispose();
});

test('status parser handles the firmware contract and rejects malformed frames', () => {
  assert.equal(protocol.parseStoryBearStatus([1]).type, 'ready');
  assert.equal(protocol.parseStoryBearStatus([2, 86]).level, 86);
  assert.equal(protocol.parseStoryBearStatus([3, 0]).button, 'left_paw');
  assert.equal(protocol.parseStoryBearStatus([3, 1]).button, 'right_paw');
  assert.equal(protocol.parseStoryBearStatus([127, 5]).code, 5);
  for (const bytes of [[], [1, 0], [2, 101], [2, -1], [3, 2], [2, 5, 0], [255], [2, 0.5]]) assert.equal(protocol.parseStoryBearStatus(bytes), null);
  assert.equal(protocol.storyBearDisplayName('AA:BB:CC:DD:EE:FF'), 'StoryBear');
});

test('notifications are scoped to the current bear and service; consumers can unsubscribe', async () => {
  const h = setup(); await h.connect(); const received = [];
  const unsubscribe = h.bear.subscribeToStoryBearStatus(event => received.push(event));
  h.notify([1], { peripheral: 'other' }); h.notify([1], { service: '180f' }); h.notify([2, 120]);
  assert.equal(received.length, 0); assert.equal(h.bear.getSnapshot().ready, false);
  h.notify([1]); h.notify([2, 72]);
  assert.equal(h.bear.getSnapshot().ready, true); assert.equal(h.bear.getSnapshot().battery, 72);
  unsubscribe(); h.notify([3, 0]); assert.equal(received.length, 2); h.bear.dispose();
});

test('testHaptic writes exactly 0x01 and gracefully handles write rejection', async () => {
  const h = setup(); assert.equal(await h.bear.testHaptic(), false); await h.connect();
  assert.equal(await h.bear.testHaptic(), true);
  const write = h.calls.find(call => call[0] === 'write');
  assert.equal(write[1], 'bear-1'); assert.equal(write[2], service); assert.equal(write[3], command); assert.deepEqual(Array.from(write[4]), [1]);
  h.bear.dispose();
  const bad = setup({ writeError: true }); await bad.connect(); assert.equal(await bad.bear.testHaptic(), false);
  assert.equal(bad.bear.getSnapshot().state, 'connected'); assert.match(bad.bear.getSnapshot().commandMessage, /try again/); bad.bear.dispose();
});

test('disconnect invalidates pending writes and clears bear status without reconnecting', async () => {
  const write = deferred(); const h = setup({ write: write.promise }); await h.connect();
  const pending = h.bear.testHaptic(); h.emit('onDisconnectPeripheral', { peripheral: 'bear-1' });
  write.resolve(); assert.equal(await pending, false);
  assert.equal(h.bear.getSnapshot().state, 'disconnected'); assert.equal(h.bear.getSnapshot().battery, null);
  assert.equal(h.bear.getSnapshot().commandMessage, null); assert.equal(h.calls.filter(call => call[0] === 'connect').length, 1); h.bear.dispose();
});

test('connection timeout closes a late native connection and never publishes success', async () => {
  const connection = deferred(); const h = setup({ connection: connection.promise });
  await h.bear.scanForStoryBears(); h.discover(); const pending = h.bear.connectToStoryBear('bear-1');
  await tick(); await h.fire(15000); await pending;
  assert.equal(h.bear.getSnapshot().state, 'error');
  const before = h.calls.filter(call => call[0] === 'disconnect').length;
  connection.resolve(); await tick();
  assert.equal(h.calls.filter(call => call[0] === 'disconnect').length, before + 1);
  assert.ok(!h.calls.some(call => call[0] === 'save')); h.bear.dispose();
});

test('radio loss during connection prevents late success', async () => {
  const connection = deferred(); const h = setup({ connection: connection.promise });
  await h.bear.scanForStoryBears(); h.discover(); const pending = h.bear.connectToStoryBear('bear-1'); await tick();
  h.emit('onDidUpdateState', { state: 'off' }); connection.resolve(); await pending;
  assert.equal(h.bear.getSnapshot().state, 'error'); assert.equal(h.bear.getSnapshot().availability, 'off'); h.bear.dispose();
});

test('disconnect failure retains a usable connection and permits retry', async () => {
  const h = setup({ disconnectError: true }); await h.connect(); await h.bear.disconnectStoryBear();
  assert.equal(h.bear.getSnapshot().state, 'connected'); assert.match(h.bear.getSnapshot().message, /couldn’t disconnect/); h.bear.dispose();
});

test('provider disposal removes listeners and active connections; remount does not duplicate listeners', async () => {
  const h = setup({ lastId: 'previous-bear' }); await tick(); assert.equal(h.bear.getSnapshot().lastBearId, 'previous-bear');
  await h.connect(); assert.equal(h.events.size, 5); h.bear.dispose(); assert.equal(h.events.size, 0);
  assert.ok(h.calls.some(call => call[0] === 'disconnect'));
  h.bear.mount(); await h.bear.scanForStoryBears(); assert.equal(h.events.size, 5); h.bear.dispose();
});

function nativeAdapter(os, version = 31, permission = 'granted', nativeAvailable = true) {
  const requests = []; const lookups = []; let starts = 0; let imports = 0;
  const driver = { start: async () => { starts++; } };
  const { storyBearDependencies } = load('src/services/bluetooth/storyBearNative.ts', {
    '@react-native-async-storage/async-storage': { __esModule: true, default: {} },
    get 'react-native-ble-manager'() { imports++; return { __esModule: true, default: driver }; },
    'react-native': {
      Platform: { OS: os, Version: version },
      TurboModuleRegistry: { get: name => { lookups.push(name); return nativeAvailable ? driver : null; } },
      PermissionsAndroid: {
        PERMISSIONS: { BLUETOOTH_SCAN: 'scan', BLUETOOTH_CONNECT: 'connect', ACCESS_FINE_LOCATION: 'location' },
        RESULTS: { GRANTED: 'granted' },
        requestMultiple: async permissions => {
          requests.push(Array.from(permissions));
          return Object.fromEntries(permissions.map(name => [name, permission]));
        },
      },
    },
  });
  return { adapter: storyBearDependencies, requests, lookups, starts: () => starts, imports: () => imports };
}

test('Android runtime permissions match pre-12 and 12+ requirements, including permanent denial', async () => {
  const modern = nativeAdapter('android'); assert.equal(await modern.adapter.requestPermissions(), true);
  assert.deepEqual(modern.requests, [['scan', 'connect']]);
  const older = nativeAdapter('android', 30); assert.equal(await older.adapter.requestPermissions(), true);
  assert.deepEqual(older.requests, [['location']]);
  const denied = nativeAdapter('android', 31, 'never_ask_again'); assert.equal(await denied.adapter.requestPermissions(), false);
});

test('iOS defers permission to CoreBluetooth and native initialization is shared', async () => {
  const h = nativeAdapter('ios'); assert.equal(await h.adapter.requestPermissions(), true); assert.equal(h.requests.length, 0);
  assert.equal(h.starts(), 0);
  const [first, second] = await Promise.all([h.adapter.loadDriver(), h.adapter.loadDriver()]);
  assert.equal(first, second); assert.equal(h.starts(), 1);
});

test('web does not import or start native Bluetooth', async () => {
  const h = nativeAdapter('web'); await assert.rejects(h.adapter.loadDriver(), /phone/); assert.equal(h.starts(), 0);
  assert.equal(h.imports(), 0); assert.equal(h.lookups.length, 0);
});

test('Expo Go or an older development build never imports the missing native library', async () => {
  for (const os of ['ios', 'android']) {
    const h = nativeAdapter(os, 31, 'granted', false);
    await assert.rejects(h.adapter.loadDriver(), /Install the updated StoryBear app/);
    await assert.rejects(h.adapter.loadDriver(), /Install the updated StoryBear app/);
    assert.equal(h.starts(), 0); assert.equal(h.imports(), 0);
    assert.deepEqual(h.lookups, ['BleManager', 'BleManager']);
  }
});

test('missing native module becomes an unavailable state before any permission prompt', async () => {
  const h = nativeAdapter('android', 31, 'granted', false);
  const { StoryBearBle } = load('src/services/bluetooth/storyBearBle.ts', { './storyBearProtocol': protocol });
  const bear = new StoryBearBle(h.adapter);
  await bear.scanForStoryBears();
  assert.equal(bear.getSnapshot().state, 'error');
  assert.equal(bear.getSnapshot().availability, 'unavailable');
  assert.match(bear.getSnapshot().message, /Install the updated StoryBear app/);
  assert.equal(h.requests.length, 0); assert.equal(h.imports(), 0);
  bear.dispose();
});
