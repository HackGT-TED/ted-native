import type { Peripheral, PeripheralInfo } from 'react-native-ble-manager';
import type { StoryBearEvent } from './storyBearTypes';

// Provisional firmware contract. Replace these four UUIDs together with firmware.
export const STORYBEAR_SERVICE_UUID = '7a6e1000-6b73-4f2d-8a19-535442454152';
export const STORYBEAR_COMMAND_CHARACTERISTIC_UUID = '7a6e1001-6b73-4f2d-8a19-535442454152';
export const STORYBEAR_STATUS_CHARACTERISTIC_UUID = '7a6e1002-6b73-4f2d-8a19-535442454152';
export const STORYBEAR_BATTERY_CHARACTERISTIC_UUID = '7a6e1003-6b73-4f2d-8a19-535442454152';
export const STORYBEAR_LAST_ID_KEY = 'storybear:last-connected:v1';
export const STORYBEAR_SCAN_SECONDS = 10;
export const STORYBEAR_CONNECTION_TIMEOUT_MS = 15000;

export enum StoryBearCommand {
  TestHaptic = 0x01,
}

export const sameUuid = (a: string, b: string) => a.toLowerCase() === b.toLowerCase();

export function advertisesStoryBear(peripheral: Peripheral): boolean {
  return peripheral.advertising.serviceUUIDs?.some(uuid => sameUuid(uuid, STORYBEAR_SERVICE_UUID)) ?? false;
}

// Never display arbitrary advertised identifiers (including MAC addresses).
export function storyBearDisplayName(name?: string): string {
  return name && /^StoryBear-[a-z0-9]{4,12}$/i.test(name) ? name : 'StoryBear';
}

export function validateStoryBear(info: PeripheralInfo) {
  const hasService = info.services?.some(service => sameUuid(service.uuid, STORYBEAR_SERVICE_UUID))
    || info.serviceUUIDs?.some(uuid => sameUuid(uuid, STORYBEAR_SERVICE_UUID));
  const characteristic = (uuid: string) => info.characteristics?.find(item =>
    sameUuid(item.service, STORYBEAR_SERVICE_UUID) && sameUuid(item.characteristic, uuid));
  const command = characteristic(STORYBEAR_COMMAND_CHARACTERISTIC_UUID);
  const status = characteristic(STORYBEAR_STATUS_CHARACTERISTIC_UUID);
  if (!hasService || !command?.properties.Write || !(status?.properties.Notify || status?.properties.Indicate)) {
    throw new Error('This bear is not ready to connect. Check that its software is up to date and try again.');
  }
  return { status, battery: characteristic(STORYBEAR_BATTERY_CHARACTERISTIC_UUID) };
}

export function encodeStoryBearCommand(command: StoryBearCommand): number[] {
  if (command !== StoryBearCommand.TestHaptic) throw new Error('That bear interaction is not supported yet.');
  return [command];
}

export function parseBattery(value: number[]): number | null {
  return value.length === 1 && Number.isInteger(value[0]) && value[0] >= 0 && value[0] <= 100 ? value[0] : null;
}

// One complete frame per notification: ready [1], battery [2, percent],
// paw [3, 0=left/1=right], device error [127, code]. Ignore unknown/malformed frames.
export function parseStoryBearStatus(value: number[]): StoryBearEvent | null {
  if (!value.every(byte => Number.isInteger(byte) && byte >= 0 && byte <= 255)) return null;
  if (value.length === 1 && value[0] === 0x01) return { type: 'ready' };
  if (value.length !== 2) return null;
  if (value[0] === 0x02 && parseBattery([value[1]]) !== null) return { type: 'battery', level: value[1] };
  if (value[0] === 0x03 && (value[1] === 0 || value[1] === 1)) {
    return { type: 'button_press', button: value[1] === 0 ? 'left_paw' : 'right_paw' };
  }
  if (value[0] === 0x7f) return { type: 'error', code: value[1] };
  return null;
}
