import type BleManager from 'react-native-ble-manager';
import type { BleManagerDidUpdateValueForCharacteristicEvent, Characteristic, Peripheral, PeripheralInfo } from 'react-native-ble-manager';

export type Manager = typeof BleManager;
export type BleSnapshot = {
  devices: Peripheral[];
  connected: PeripheralInfo | null;
  scanning: boolean;
  busy: boolean;
  state: string;
  error: string | null;
  values: Record<string, number[]>;
  notifications: string[];
};
export const characteristicKey = (service: string, characteristic: string) => `${service.toLowerCase()}/${characteristic.toLowerCase()}`;
export const initialSnapshot: BleSnapshot = { devices: [], connected: null, scanning: false, busy: false, state: 'unknown', error: null, values: {}, notifications: [] };

// Owns one foreground BLE session. The native adapter is injected for hardware-free tests.
export class BleClient {
  private snapshot = initialSnapshot;
  private listeners = new Set<() => void>();
  private subscriptions: { remove: () => void }[] = [];
  private manager: Manager | null = null;
  private operation = 0;
  private pendingId: string | null = null;
  private scanTimer: ReturnType<typeof setTimeout> | undefined;
  private connectTimeout: number;
  private load: () => Promise<Manager>;
  private permissions: () => Promise<void>;

  constructor(load: () => Promise<Manager>, permissions: () => Promise<void>, connectTimeout = 15000) {
    this.load = load;
    this.permissions = permissions;
    this.connectTimeout = connectTimeout;
  }
  getSnapshot = () => this.snapshot;
  subscribe = (listener: () => void) => { this.listeners.add(listener); return () => { this.listeners.delete(listener); }; };
  private update(patch: Partial<BleSnapshot>) {
    this.snapshot = { ...this.snapshot, ...patch };
    this.listeners.forEach(listener => listener());
  }
  private async run(action: (token: number) => Promise<void>) {
    if (this.snapshot.busy) return;
    const token = ++this.operation;
    this.update({ busy: true, error: null });
    try { await action(token); }
    catch (error) { if (token === this.operation) this.update({ error: error instanceof Error ? error.message : String(error) }); }
    finally { if (token === this.operation) this.update({ busy: false }); }
  }
  private finishScan() {
    clearTimeout(this.scanTimer);
    this.update({ scanning: false });
  }
  private clearConnection() {
    this.update({ connected: null, values: {}, notifications: [] });
  }
  private async ready(token: number) {
    await this.permissions();
    if (token !== this.operation) throw new Error('Bluetooth operation cancelled.');
    const manager = await this.load();
    if (token !== this.operation) throw new Error('Bluetooth operation cancelled.');
    if (!this.subscriptions.length) {
      this.manager = manager;
      this.subscriptions = [
        manager.onDiscoverPeripheral(device => {
          if (!this.snapshot.scanning) return;
          const devices = new Map(this.snapshot.devices.map(item => [item.id, item]));
          devices.set(device.id, device);
          this.update({ devices: [...devices.values()] });
        }),
        manager.onStopScan(({ status }) => {
          this.finishScan();
          if (status && status !== 10) this.update({ error: `Bluetooth scan stopped (code ${status}). Try scanning again.` });
        }),
        manager.onDidUpdateState(({ state }) => {
          this.update({ state });
          if (state !== 'on') {
            this.pendingId = null;
            this.finishScan();
            this.clearConnection();
          }
        }),
        manager.onDisconnectPeripheral(({ peripheral }) => {
          if (peripheral === this.pendingId) this.pendingId = null;
          if (peripheral === this.snapshot.connected?.id) {
            this.clearConnection();
            this.update({ error: 'The device disconnected. Scan again to reconnect.' });
          }
        }),
        manager.onDidUpdateValueForCharacteristic(event => this.receive(event)),
      ];
    }
    const state = await manager.checkState();
    if (token !== this.operation) throw new Error('Bluetooth operation cancelled.');
    this.update({ state });
    if (state !== 'on') throw new Error(state === 'unauthorized'
      ? 'Bluetooth access is disabled. Allow Bluetooth in Settings, then try again.'
      : state === 'unsupported' ? 'This device does not support Bluetooth LE.'
        : 'Turn on Bluetooth in Settings, then try again.');
    return manager;
  }
  private receive(event: BleManagerDidUpdateValueForCharacteristicEvent) {
    if (event.peripheral !== this.snapshot.connected?.id) return;
    this.update({ values: { ...this.snapshot.values, [characteristicKey(event.service, event.characteristic)]: event.value } });
  }
  scan = () => this.run(async token => {
    if (this.snapshot.connected || this.snapshot.scanning) return;
    const manager = await this.ready(token);
    if (token !== this.operation) return;
    this.update({ devices: [], scanning: true });
    try {
      // v12 takes one options object; the reference example uses the old signature.
      await manager.scan({ serviceUUIDs: [], seconds: 8, allowDuplicates: false });
      if (token !== this.operation) { await manager.stopScan(); return; }
      this.scanTimer = setTimeout(() => { void this.stopScan(); }, 10000);
    } catch (error) { this.finishScan(); throw error; }
  });
  stopScan = async () => {
    try { if (this.manager && this.snapshot.scanning) await this.manager.stopScan(); }
    catch (error) { this.update({ error: `Could not stop scanning: ${String(error)}` }); }
    finally { this.finishScan(); }
  };
  connect = (device: Peripheral) => this.run(async token => {
    if (this.snapshot.connected) return;
    const manager = await this.ready(token);
    await this.stopScan();
    if (token !== this.operation) return;
    this.pendingId = device.id;
    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
      const info = await Promise.race([
        (async () => {
          await manager.connect(device.id);
          if (token !== this.operation || this.pendingId !== device.id) {
            await manager.disconnect(device.id);
            throw new Error('Connection cancelled.');
          }
          return manager.retrieveServices(device.id);
        })(),
        new Promise<never>((_, reject) => { timer = setTimeout(() => reject(new Error('Connection timed out. Move closer to the device and try again.')), this.connectTimeout); }),
      ]);
      if (token !== this.operation || this.pendingId !== device.id) throw new Error('The device disconnected during setup.');
      this.update({ connected: { ...device, ...info }, values: {}, notifications: [] });
    } catch (error) {
      this.pendingId = null;
      await manager.disconnect(device.id).catch(() => undefined);
      throw error;
    } finally { clearTimeout(timer); this.pendingId = null; }
  });
  disconnect = () => this.run(async () => {
    if (!this.manager || !this.snapshot.connected) return;
    await this.manager.disconnect(this.snapshot.connected.id);
    this.clearConnection();
    this.update({ error: null });
  });
  private connection(characteristic: Characteristic) {
    if (!this.manager || !this.snapshot.connected) throw new Error('Connect to a device first.');
    const key = characteristicKey(characteristic.service, characteristic.characteristic);
    if (!this.snapshot.connected.characteristics?.some(item => characteristicKey(item.service, item.characteristic) === key)) throw new Error('Characteristic is not available on this device.');
    return { manager: this.manager, id: this.snapshot.connected.id, key };
  }
  read = (characteristic: Characteristic) => this.run(async () => {
    const { manager, id } = this.connection(characteristic);
    if (!characteristic.properties.Read) throw new Error('This characteristic cannot be read.');
    const value = await manager.read(id, characteristic.service, characteristic.characteristic);
    this.receive({ peripheral: id, service: characteristic.service, characteristic: characteristic.characteristic, value });
  });
  write = (characteristic: Characteristic, hex: string) => this.run(async () => {
    const { manager, id } = this.connection(characteristic);
    const compact = hex.replace(/\s/g, '');
    if (!compact || compact.length % 2 || !/^[0-9a-f]+$/i.test(compact)) throw new Error('Enter complete hexadecimal bytes, for example: 01 A0 FF.');
    // One default ATT payload. Larger messages require the device's framing/MTU protocol.
    if (compact.length > 40) throw new Error('Send at most 20 bytes at a time.');
    const bytes = compact.match(/../g)!.map(byte => parseInt(byte, 16));
    if (characteristic.properties.Write) await manager.write(id, characteristic.service, characteristic.characteristic, bytes, 20);
    else if (characteristic.properties.WriteWithoutResponse) await manager.writeWithoutResponse(id, characteristic.service, characteristic.characteristic, bytes, 20);
    else throw new Error('This characteristic cannot be written.');
  });
  toggleNotifications = (characteristic: Characteristic) => this.run(async () => {
    const { manager, id, key } = this.connection(characteristic);
    if (!characteristic.properties.Notify && !characteristic.properties.Indicate) throw new Error('This characteristic does not support notifications.');
    const enabled = this.snapshot.notifications.includes(key);
    if (enabled) await manager.stopNotification(id, characteristic.service, characteristic.characteristic);
    else await manager.startNotification(id, characteristic.service, characteristic.characteristic);
    if (this.snapshot.connected?.id === id) this.update({ notifications: enabled ? this.snapshot.notifications.filter(item => item !== key) : [...this.snapshot.notifications, key] });
  });
  // Root-provider cleanup and foreground-only policy invalidate in-flight work.
  dispose = () => {
    ++this.operation;
    clearTimeout(this.scanTimer);
    const id = this.snapshot.connected?.id ?? this.pendingId;
    this.pendingId = null;
    if (this.manager) {
      void this.manager.stopScan().catch(() => undefined);
      if (id) void this.manager.disconnect(id).catch(() => undefined);
    }
    this.subscriptions.forEach(subscription => subscription.remove());
    this.subscriptions = [];
    this.update({ ...initialSnapshot });
  };
}
