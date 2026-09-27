import type BleManager from 'react-native-ble-manager';
import type { BleManagerDidUpdateValueForCharacteristicEvent, Peripheral } from 'react-native-ble-manager';
import {
  advertisesStoryBear, encodeStoryBearCommand, parseBattery, parseStoryBearStatus, sameUuid,
  STORYBEAR_BATTERY_CHARACTERISTIC_UUID, STORYBEAR_COMMAND_CHARACTERISTIC_UUID,
  STORYBEAR_CONNECTION_TIMEOUT_MS, STORYBEAR_LAST_ID_KEY, STORYBEAR_SCAN_SECONDS,
  STORYBEAR_SERVICE_UUID, STORYBEAR_STATUS_CHARACTERISTIC_UUID, StoryBearCommand, validateStoryBear,
} from './storyBearProtocol';
import type { StoryBearEvent, StoryBearSnapshot } from './storyBearTypes';

type Driver = Pick<typeof BleManager,
  'scan' | 'stopScan' | 'connect' | 'disconnect' | 'checkState' | 'retrieveServices' |
  'startNotification' | 'read' | 'write' | 'onDiscoverPeripheral' | 'onStopScan' |
  'onDidUpdateState' | 'onDisconnectPeripheral' | 'onDidUpdateValueForCharacteristic'>;

export type StoryBearDependencies = {
  checkAvailability?: () => void;
  loadDriver: () => Promise<Driver>;
  requestPermissions: () => Promise<boolean>;
  storage: { getItem: (key: string) => Promise<string | null>; setItem: (key: string, value: string) => Promise<unknown> };
};

class BearError extends Error {
  constructor(message: string, readonly availability?: StoryBearSnapshot['availability']) { super(message); }
}
const permissionMessage = 'Bluetooth access is needed to connect to your StoryBear. Allow access in your phone’s settings, then try again.';

function bounded<T>(promise: Promise<T>, milliseconds = STORYBEAR_CONNECTION_TIMEOUT_MS): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new BearError('Your bear took too long to respond. Bring it nearby and try again.')), milliseconds);
    promise.then(value => { clearTimeout(timer); resolve(value); }, error => { clearTimeout(timer); reject(error); });
  });
}

/** App-owned connection, independent of both the connection screen and audio playback. */
export class StoryBearBle {
  private snapshot: StoryBearSnapshot = {
    state: 'idle', availability: 'unknown', bears: [], connectedBear: null, lastBearId: null,
    battery: null, ready: false, busy: false, sendingCommand: false, hasSearched: false,
    message: null, commandMessage: null,
  };
  private listeners = new Set<() => void>();
  private statusListeners = new Set<(event: StoryBearEvent) => void>();
  private subscriptions: { remove: () => void }[] = [];
  private driver: Driver | null = null;
  private generation = 0;
  private disposed = false;
  private scanning = false;
  private scanTimer: ReturnType<typeof setTimeout> | null = null;
  private target: string | null = null;
  private validated = false;
  private savedIds: Promise<unknown> = Promise.resolve();

  constructor(private readonly dependencies: StoryBearDependencies) {}

  getSnapshot = () => this.snapshot;
  subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => { this.listeners.delete(listener); };
  };
  subscribeToStoryBearStatus = (listener: (event: StoryBearEvent) => void) => {
    this.statusListeners.add(listener);
    return () => { this.statusListeners.delete(listener); };
  };
  private update(patch: Partial<StoryBearSnapshot>) {
    this.snapshot = { ...this.snapshot, ...patch };
    this.listeners.forEach(listener => listener());
  }
  private current(token: number) { return !this.disposed && token === this.generation; }
  private assertCurrent(token: number) {
    if (!this.current(token)) throw new BearError('Connection cancelled.');
  }
  private clearScanTimer() {
    if (this.scanTimer) clearTimeout(this.scanTimer);
    this.scanTimer = null;
  }
  private fail(error: unknown, fallback: string) {
    this.update({ state: 'error', busy: false,
      message: error instanceof BearError ? error.message : fallback,
      ...(error instanceof BearError && error.availability ? { availability: error.availability } : {}),
    });
  }

  mount = () => {
    this.disposed = false;
    const token = this.generation;
    void this.dependencies.storage.getItem(STORYBEAR_LAST_ID_KEY).then(id => {
      if (this.current(token) && !this.snapshot.lastBearId) this.update({ lastBearId: id });
    }).catch(() => { /* Remembering a bear is optional; controls still work without storage. */ });
  };

  private onDiscovered = (peripheral: Peripheral) => {
    if (!this.scanning || !advertisesStoryBear(peripheral)) return;
    const previous = this.snapshot.bears.find(bear => bear.id === peripheral.id);
    const bear = {
      id: peripheral.id, name: peripheral.advertising.localName || peripheral.name || previous?.name,
      rssi: peripheral.rssi, isConnectable: peripheral.advertising.isConnectable ?? previous?.isConnectable,
    };
    this.update({ bears: previous
      ? this.snapshot.bears.map(item => item.id === bear.id ? bear : item)
      : [...this.snapshot.bears, bear] });
  };

  private onState = (state: string) => {
    const availability = state === 'on' ? 'on' : state === 'unauthorized' ? 'denied'
      : state === 'unsupported' ? 'unavailable' : state === 'off' || state === 'turning_off' ? 'off' : 'unknown';
    this.update({ availability });
    if (availability === 'on' || (!this.scanning && !this.target)) return;
    ++this.generation;
    this.clearScanTimer();
    this.scanning = false;
    const target = this.target;
    this.target = null;
    this.validated = false;
    if (this.driver) {
      void bounded(this.driver.stopScan(), 3000).catch(() => {});
      if (target) void bounded(this.driver.disconnect(target), 3000).catch(() => {});
    }
    this.update({ connectedBear: null, battery: null, ready: false, sendingCommand: false });
    this.fail(this.stateError(availability), 'Bluetooth is unavailable. Please try again.');
  };

  private stateError(availability: StoryBearSnapshot['availability']) {
    return new BearError(availability === 'denied' ? permissionMessage : availability === 'off'
      ? 'Bluetooth is turned off. Turn on Bluetooth to find your StoryBear.'
      : availability === 'unavailable' ? 'Bluetooth is unavailable on this device. Use a phone with Bluetooth to connect your bear.'
      : 'Bluetooth is getting ready. Please try again in a moment.', availability);
  }

  private emitStatus(event: StoryBearEvent) {
    if (event.type === 'battery') this.update({ battery: event.level });
    if (event.type === 'ready') this.update({ ready: true, message: null });
    if (event.type === 'error') this.update({ ready: false, message: 'Your bear needs a moment. Try turning it off and on again.' });
    this.statusListeners.forEach(listener => {
      try { listener(event); } catch { /* A consumer must not interrupt the connection service. */ }
    });
  }

  private onValue = (event: BleManagerDidUpdateValueForCharacteristicEvent) => {
    if (!this.validated || event.peripheral !== this.target || !sameUuid(event.service, STORYBEAR_SERVICE_UUID)) return;
    if (sameUuid(event.characteristic, STORYBEAR_STATUS_CHARACTERISTIC_UUID)) {
      const parsed = parseStoryBearStatus(event.value);
      if (parsed) this.emitStatus(parsed);
    } else if (sameUuid(event.characteristic, STORYBEAR_BATTERY_CHARACTERISTIC_UUID)) {
      const level = parseBattery(event.value);
      if (level !== null) this.emitStatus({ type: 'battery', level });
    }
  };

  private attach(driver: Driver) {
    if (this.subscriptions.length) return;
    this.subscriptions.push(
      driver.onDiscoverPeripheral(this.onDiscovered),
      driver.onDidUpdateState(({ state }) => this.onState(state)),
      driver.onDidUpdateValueForCharacteristic(this.onValue),
      driver.onStopScan(({ status }) => {
        if (!this.scanning) return;
        this.scanning = false;
        this.clearScanTimer();
        if (status !== undefined && status !== 0 && status !== 10) {
          this.fail(null, 'We couldn’t look for your bear. Wait a moment and try again.');
        } else {
          this.update({ state: this.snapshot.bears.length ? 'found' : 'idle', hasSearched: true });
        }
      }),
      driver.onDisconnectPeripheral(({ peripheral }) => {
        if (peripheral !== this.target) return;
        const intentional = this.snapshot.state === 'disconnecting';
        ++this.generation;
        this.target = null;
        this.validated = false;
        this.update({ state: 'disconnected', connectedBear: null, battery: null, ready: false,
          busy: false, sendingCommand: false, commandMessage: null, bears: [],
          message: intentional ? 'Your bear is disconnected.' : 'Your bear disconnected. Bring it nearby and find it again.' });
      }),
    );
  }

  private async ensureBluetooth(token: number) {
    // Report a missing native build before requesting permissions it cannot use.
    try { this.dependencies.checkAvailability?.(); }
    catch (error) { throw new BearError(error instanceof Error ? error.message : 'Bluetooth is unavailable on this device.', 'unavailable'); }
    let allowed: boolean;
    try { allowed = await this.dependencies.requestPermissions(); }
    catch { throw new BearError(permissionMessage, 'denied'); }
    this.assertCurrent(token);
    if (!allowed) throw new BearError(permissionMessage, 'denied');
    let driver: Driver;
    try { driver = await this.dependencies.loadDriver(); }
    catch (error) { throw new BearError(error instanceof Error ? error.message : 'Bluetooth is unavailable on this device.', 'unavailable'); }
    this.assertCurrent(token);
    this.driver = driver;
    this.attach(driver);
    let state = await bounded(driver.checkState(), 4000);
    // CoreBluetooth can briefly report unknown while initializing or showing permission UI.
    for (let attempt = 0; ['unknown', 'resetting', 'turning_on'].includes(state) && attempt < 10; attempt++) {
      await new Promise(resolve => setTimeout(resolve, 250));
      this.assertCurrent(token);
      state = await bounded(driver.checkState(), 4000);
    }
    this.assertCurrent(token);
    this.onState(state);
    if (state !== 'on') throw this.stateError(this.snapshot.availability);
    return driver;
  }

  initializeBluetooth = async () => {
    if (this.snapshot.busy || this.scanning || this.target || this.disposed) return false;
    const token = ++this.generation;
    this.update({ busy: true, message: null });
    try { await this.ensureBluetooth(token); return true; }
    catch (error) { if (this.current(token)) this.fail(error, 'Bluetooth could not start. Please try again.'); return false; }
    finally { if (this.current(token)) this.update({ busy: false }); }
  };

  scanForStoryBears = async () => {
    if (this.snapshot.busy || this.scanning || this.target || this.disposed) return;
    const token = ++this.generation;
    this.update({ state: 'scanning', bears: [], busy: true, hasSearched: false, message: null, commandMessage: null });
    try {
      const driver = await this.ensureBluetooth(token);
      this.assertCurrent(token);
      this.scanning = true;
      const start = driver.scan({ serviceUUIDs: [STORYBEAR_SERVICE_UUID], seconds: STORYBEAR_SCAN_SECONDS, allowDuplicates: true });
      void start.then(() => { if (!this.current(token)) return driver.stopScan(); }).catch(() => {});
      await bounded(start, 5000);
      this.assertCurrent(token);
      if (this.scanning) this.scanTimer = setTimeout(() => { void this.stopStoryBearScan(false); }, (STORYBEAR_SCAN_SECONDS + 2) * 1000);
    } catch (error) {
      if (this.current(token)) {
        ++this.generation;
        this.scanning = false;
        this.clearScanTimer();
        if (this.driver) void bounded(this.driver.stopScan(), 3000).catch(() => {});
        this.fail(error, 'We couldn’t look for your bear. Check Bluetooth and try again.');
      }
    } finally { if (this.current(token)) this.update({ busy: false }); }
  };

  stopStoryBearScan = async (cancelled = true) => {
    if (this.snapshot.state !== 'scanning' && !this.scanning) return;
    const token = ++this.generation;
    this.scanning = false;
    this.clearScanTimer();
    this.update({ busy: true });
    try { if (this.driver) await bounded(this.driver.stopScan(), 3000); }
    catch { /* Native scan has its own ten-second limit as a second backstop. */ }
    if (this.current(token)) this.update({ state: this.snapshot.bears.length ? 'found' : 'idle', busy: false, hasSearched: !cancelled });
  };

  connectToStoryBear = async (id: string) => {
    if (this.snapshot.busy || this.target || this.disposed) return;
    const bear = this.snapshot.bears.find(item => item.id === id);
    if (!bear || bear.isConnectable === false) return;
    const token = ++this.generation;
    this.scanning = false;
    this.clearScanTimer();
    this.update({ state: 'connecting', busy: true, message: null, battery: null, ready: false, commandMessage: null });
    try {
      const driver = await this.ensureBluetooth(token);
      await bounded(driver.stopScan(), 3000);
      this.assertCurrent(token);
      this.target = id;
      const connection = driver.connect(id, { autoconnect: false });
      void connection.then(() => {
        // iOS may complete a timed-out connection later. Never retain that orphan.
        if (!this.current(token) && this.target !== id) return driver.disconnect(id);
      }).catch(() => {});
      await bounded(connection);
      this.assertCurrent(token);
      const info = await bounded(driver.retrieveServices(id));
      this.assertCurrent(token);
      let characteristics: ReturnType<typeof validateStoryBear>;
      try { characteristics = validateStoryBear(info); }
      catch (error) {
        this.update({ bears: this.snapshot.bears.filter(item => item.id !== id) });
        throw new BearError((error as Error).message);
      }
      this.validated = true;
      await bounded(driver.startNotification(id, STORYBEAR_SERVICE_UUID, STORYBEAR_STATUS_CHARACTERISTIC_UUID));
      this.assertCurrent(token);
      this.update({ state: 'connected', connectedBear: bear, lastBearId: id, busy: false });
      // Serialize storage so an older write can never overwrite a newer connection.
      this.savedIds = this.savedIds.catch(() => {}).then(() => this.dependencies.storage.setItem(STORYBEAR_LAST_ID_KEY, id)).catch(() => {});
      void this.readOptionalValues(driver, id, token, characteristics);
    } catch (error) {
      if (!this.current(token)) return;
      const cleanupToken = ++this.generation;
      this.target = null;
      this.validated = false;
      if (this.driver) await bounded(this.driver.disconnect(id), 3000).catch(() => {});
      if (this.current(cleanupToken)) {
        this.update({ connectedBear: null, battery: null, ready: false });
        this.fail(error, 'We couldn’t connect to your bear. Bring it closer and try again.');
      }
    }
  };

  private async readOptionalValues(driver: Driver, id: string, token: number, characteristics: ReturnType<typeof validateStoryBear>) {
    const read = async (characteristic: string) => {
      try {
        const value = await bounded(driver.read(id, STORYBEAR_SERVICE_UUID, characteristic), 4000);
        if (this.current(token)) this.onValue({ peripheral: id, service: STORYBEAR_SERVICE_UUID, characteristic, value });
      } catch { /* Unknown battery/readiness is preferable to a fabricated value. */ }
    };
    if (characteristics.status.properties.Read) void read(STORYBEAR_STATUS_CHARACTERISTIC_UUID);
    if (characteristics.battery?.properties.Read) void read(STORYBEAR_BATTERY_CHARACTERISTIC_UUID);
    if (characteristics.battery?.properties.Notify || characteristics.battery?.properties.Indicate) {
      try { await bounded(driver.startNotification(id, STORYBEAR_SERVICE_UUID, STORYBEAR_BATTERY_CHARACTERISTIC_UUID), 4000); }
      catch { /* Status notifications can also supply battery values. */ }
    }
  }

  disconnectStoryBear = async () => {
    if (this.snapshot.busy || !this.target || !this.driver) return;
    const id = this.target;
    const token = ++this.generation;
    this.update({ state: 'disconnecting', busy: true, sendingCommand: false, commandMessage: null });
    try {
      await bounded(this.driver.disconnect(id), 5000);
      if (!this.current(token)) return; // Native disconnect event already updated the state.
      this.target = null;
      this.validated = false;
      this.update({ state: 'disconnected', busy: false, connectedBear: null, battery: null, ready: false,
        bears: [], message: 'Your bear is disconnected.' });
    } catch {
      if (this.current(token)) this.update({ state: 'connected', busy: false,
        message: 'We couldn’t disconnect your bear. Please try again, or turn your bear off.' });
    }
  };

  sendStoryBearCommand = async (command: StoryBearCommand): Promise<boolean> => {
    if (!this.driver || !this.target || this.snapshot.state !== 'connected' || this.snapshot.sendingCommand) return false;
    const token = this.generation;
    this.update({ sendingCommand: true, commandMessage: null });
    try {
      await bounded(this.driver.write(this.target, STORYBEAR_SERVICE_UUID,
        STORYBEAR_COMMAND_CHARACTERISTIC_UUID, encodeStoryBearCommand(command)), 5000);
      if (!this.current(token)) return false;
      this.update({ commandMessage: 'Vibration request sent. Did your bear give a little buzz?' });
      return true;
    } catch {
      if (this.current(token)) this.update({ commandMessage: 'Your bear couldn’t receive that request. Bring it closer and try again.' });
      return false;
    } finally { if (this.current(token)) this.update({ sendingCommand: false }); }
  };
  sendCommand = this.sendStoryBearCommand;
  testHaptic = () => this.sendStoryBearCommand(StoryBearCommand.TestHaptic);

  dispose = () => {
    this.disposed = true;
    ++this.generation;
    this.clearScanTimer();
    const wasScanning = this.scanning;
    this.scanning = false;
    const target = this.target;
    this.target = null;
    this.validated = false;
    this.subscriptions.forEach(subscription => subscription.remove());
    this.subscriptions = [];
    this.statusListeners.clear();
    if (this.driver) {
      if (wasScanning) void bounded(this.driver.stopScan(), 3000).catch(() => {});
      if (target) void bounded(this.driver.disconnect(target), 3000).catch(() => {});
    }
    this.update({ state: 'idle', busy: false, connectedBear: null, bears: [], battery: null, ready: false, sendingCommand: false });
  };
}
