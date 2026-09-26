import type { Manager } from './client';

export const unavailableReason = 'Bluetooth is available in the TedTime iOS and Android app.';
export async function loadManager(): Promise<Manager> { throw new Error(unavailableReason); }
export async function requestPermissions() { throw new Error(unavailableReason); }
