export type DiscoveredStoryBear = {
  id: string;
  name?: string;
  rssi?: number;
  isConnectable?: boolean;
};

export type StoryBearConnectionState =
  | 'idle' | 'scanning' | 'found' | 'connecting' | 'connected'
  | 'disconnecting' | 'disconnected' | 'error';

export type StoryBearEvent =
  | { type: 'button_press'; button: 'left_paw' | 'right_paw' }
  | { type: 'battery'; level: number }
  | { type: 'ready' }
  | { type: 'error'; code: number };

export type StoryBearSnapshot = {
  state: StoryBearConnectionState;
  availability: 'unknown' | 'on' | 'off' | 'denied' | 'unavailable';
  bears: DiscoveredStoryBear[];
  connectedBear: DiscoveredStoryBear | null;
  lastBearId: string | null;
  battery: number | null;
  ready: boolean;
  busy: boolean;
  sendingCommand: boolean;
  hasSearched: boolean;
  message: string | null;
  commandMessage: string | null;
};
