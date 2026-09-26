import { createContext, useContext, useEffect, useState, useSyncExternalStore, type ReactNode } from 'react';
import { AppState } from 'react-native';
import { BleClient, initialSnapshot } from '../ble/client';
import { loadManager, requestPermissions, unavailableReason } from '../ble/runtime';

const Context = createContext<BleClient | null>(null);
export function BleProvider({ children }: { children: ReactNode }) {
  const [client] = useState(() => new BleClient(loadManager, requestPermissions));
  useEffect(() => {
    const subscription = AppState.addEventListener('change', state => {
      if (state === 'background') client.dispose();
    });
    return () => { subscription.remove(); client.dispose(); };
  }, [client]);
  return <Context.Provider value={client}>{children}</Context.Provider>;
}
export function useBle() {
  const client = useContext(Context);
  if (!client) throw new Error('BleProvider is required.');
  const snapshot = useSyncExternalStore(client.subscribe, client.getSnapshot, () => initialSnapshot);
  return { ...snapshot, client, unavailableReason };
}
