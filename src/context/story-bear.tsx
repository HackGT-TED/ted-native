import { createContext, ReactNode, useContext, useEffect, useState, useSyncExternalStore } from 'react';
import { AppState } from 'react-native';
import { StoryBearBle } from '../services/bluetooth/storyBearBle';
import { storyBearDependencies } from '../services/bluetooth/storyBearNative';

const Context = createContext<StoryBearBle | null>(null);

export function StoryBearProvider({ children }: { children: ReactNode }) {
  const [service] = useState(() => new StoryBearBle(storyBearDependencies));
  useEffect(() => {
    service.mount();
    const subscription = AppState.addEventListener('change', state => {
      if (state === 'background') void service.stopStoryBearScan();
    });
    return () => { subscription.remove(); service.dispose(); };
  }, [service]);
  return <Context.Provider value={service}>{children}</Context.Provider>;
}

export function useStoryBear() {
  const service = useContext(Context);
  if (!service) throw new Error('StoryBearProvider is required');
  const snapshot = useSyncExternalStore(service.subscribe, service.getSnapshot, service.getSnapshot);
  return { ...snapshot, storyBear: service };
}
