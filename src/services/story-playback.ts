import type { AudioPlayer, AudioStatus } from 'expo-audio';
import type { RecordingSegment } from '../types/recording';
import { sortSegments } from '../utils/recordings';

type Player = Pick<AudioPlayer, 'play' | 'pause' | 'remove' | 'seekTo' | 'addListener' | 'isLoaded' | 'duration' | 'currentTime'>;
type Dependencies = {
  createPlayer: (uri: string) => Player;
  configureAudio: () => Promise<void>;
  localUri: (segment: RecordingSegment) => Promise<string | undefined>;
  remoteUri: (segment: RecordingSegment) => Promise<string>;
};
type Active = {
  player: Player; index: number; remote: boolean; version: number;
  offsetMs: number; ready: boolean; preparing: boolean; seeking: boolean;
  subscription: { remove: () => void } | null;
};
export type StoryPlaybackSnapshot = {
  moments: RecordingSegment[];
  index: number;
  positionMs: number;
  durationMs: number;
  playing: boolean;
  loading: boolean;
  finished: boolean;
  error: string;
};

/** A whole story is the ordered recordings, with one continuous playback clock.
 * Only one native player exists at a time. Each source owns its listener, so late
 * status events from a previous recording cannot advance the current story. */
export class StoryPlayback {
  private snapshot: StoryPlaybackSnapshot = {
    moments: [], index: 0, positionMs: 0, durationMs: 0,
    playing: false, loading: false, finished: false, error: '',
  };
  private listeners = new Set<() => void>();
  private durations = new Map<string, number>();
  private queueKey = '';
  private version = 0;
  private seekVersion = 0;
  private seekQueue: Promise<void> = Promise.resolve();
  private active: Active | null = null;
  private wantsPlay = false;
  private enabled = false;
  private timer: ReturnType<typeof setTimeout> | null = null;

  constructor(private readonly dependencies: Dependencies) {}
  getSnapshot = () => this.snapshot;
  subscribe = (listener: () => void) => { this.listeners.add(listener); return () => { this.listeners.delete(listener); }; };
  private update(patch: Partial<StoryPlaybackSnapshot>) {
    this.snapshot = { ...this.snapshot, ...patch };
    this.listeners.forEach(listener => listener());
  }
  private current(version: number) { return this.enabled && version === this.version; }
  private length(index: number) {
    const moment = this.snapshot.moments[index];
    return moment ? this.durations.get(moment.id) ?? moment.durationMs : 0;
  }
  momentStart = (index: number) => this.snapshot.moments.slice(0, index).reduce((sum, _, i) => sum + this.length(i), 0);
  private clearTimer() { if (this.timer) clearTimeout(this.timer); this.timer = null; }
  private releasePlayer() {
    this.clearTimer();
    this.seekQueue = Promise.resolve();
    const active = this.active;
    this.active = null;
    active?.subscription?.remove();
    if (active) {
      try { active.player.pause(); } catch { /* The OS may already have released it. */ }
      try { active.player.remove(); } catch { /* Teardown is best effort after an OS interruption. */ }
    }
  }

  setQueue = (storyKey: string, segments: RecordingSegment[]) => {
    const moments = sortSegments(segments.filter(item => !item.deletedAt && Number.isFinite(item.durationMs) && item.durationMs > 0));
    const key = JSON.stringify([storyKey, moments.map(item => [item.id, item.order, item.durationMs, item.localUri, item.storagePath, item.title])]);
    if (key === this.queueKey) return;
    this.queueKey = key;
    this.stop();
    this.durations.clear();
    this.update({ moments, durationMs: moments.reduce((sum, item) => sum + item.durationMs, 0) });
  };

  setEnabled = (enabled: boolean) => {
    if (this.enabled && !enabled) this.stop();
    this.enabled = enabled;
  };

  stop = () => {
    ++this.version;
    ++this.seekVersion;
    this.wantsPlay = false;
    this.releasePlayer();
    this.update({ index: 0, positionMs: 0, playing: false, loading: false, finished: false, error: '' });
  };

  pause = () => {
    this.wantsPlay = false;
    try { this.active?.player.pause(); } catch { /* Status/error callbacks also recover native failures. */ }
    this.update({ playing: false });
  };

  private fail(message = 'This moment couldn’t be played. Check your connection and press play to retry.') {
    ++this.version;
    this.wantsPlay = false;
    this.releasePlayer();
    this.update({ playing: false, loading: false, error: message });
  }

  private async prepare(active: Active) {
    if (!this.current(active.version) || active.preparing || active.ready) return;
    active.preparing = true;
    try {
      if (active.offsetMs > 0) await active.player.seekTo(active.offsetMs / 1000, 0, 0);
      if (!this.current(active.version)) return;
      active.ready = true;
      this.clearTimer();
      if (this.wantsPlay) active.player.play();
      this.update({ loading: false, playing: this.wantsPlay });
    } catch { if (this.current(active.version)) this.fail('We couldn’t move to that part of the story. Press play to retry.'); }
  }

  private onStatus(active: Active, status: AudioStatus) {
    if (!this.current(active.version) || this.active !== active) return;
    if (status.error) {
      const segment = this.snapshot.moments[active.index];
      if (!active.remote && segment.storagePath) {
        const offset = Math.max(0, this.snapshot.positionMs - this.momentStart(active.index));
        void this.loadMoment(active.index, offset, this.wantsPlay, true);
      } else this.fail();
      return;
    }
    if (Number.isFinite(status.duration) && status.duration > 0 && this.length(active.index) !== status.duration * 1000) {
      this.durations.set(this.snapshot.moments[active.index].id, status.duration * 1000);
      this.update({ durationMs: this.momentStart(this.snapshot.moments.length) });
    }
    if (!active.ready) {
      if (status.isLoaded) void this.prepare(active);
      return;
    }
    if (active.seeking) return;
    if (status.didJustFinish) {
      if (active.index + 1 < this.snapshot.moments.length) {
        void this.loadMoment(active.index + 1, 0, this.wantsPlay);
      } else {
        this.wantsPlay = false;
        ++this.version;
        this.releasePlayer();
        this.update({ playing: false, loading: false, finished: true, positionMs: this.snapshot.durationMs });
      }
      return;
    }
    this.update({ playing: status.playing, loading: status.isBuffering,
      positionMs: this.momentStart(active.index) + Math.min(this.length(active.index), Math.max(0, status.currentTime * 1000)) });
  }

  private async loadMoment(index: number, offsetMs: number, play: boolean, forceRemote = false) {
    const segment = this.snapshot.moments[index];
    if (!this.enabled || !segment) return;
    const version = ++this.version;
    ++this.seekVersion;
    this.releasePlayer();
    this.wantsPlay = play;
    this.update({ index, positionMs: this.momentStart(index) + offsetMs, playing: false, loading: true, finished: false, error: '' });
    this.timer = setTimeout(() => {
      if (this.current(version)) this.fail('This story is taking too long to load. Check your connection and press play to retry.');
    }, 15000);
    try {
      let uri: string | undefined;
      if (!forceRemote) {
        try { uri = await this.dependencies.localUri(segment); } catch { /* Fall back to private cloud audio. */ }
      }
      if (!this.current(version)) return;
      const remote = !uri;
      uri ??= await this.dependencies.remoteUri(segment);
      if (!this.current(version)) return;
      await this.dependencies.configureAudio();
      if (!this.current(version)) return;
      const player = this.dependencies.createPlayer(uri);
      const active: Active = { player, index, remote, version, offsetMs, ready: false, preparing: false, seeking: false, subscription: null };
      this.active = active;
      active.subscription = player.addListener('playbackStatusUpdate', status => this.onStatus(active, status));
      if (player.isLoaded) void this.prepare(active);
    } catch { if (this.current(version)) this.fail(); }
  }

  toggle = async () => {
    if (!this.enabled || !this.snapshot.moments.length) return;
    if (this.snapshot.playing || (this.snapshot.loading && this.wantsPlay)) { this.pause(); return; }
    this.wantsPlay = true;
    const active = this.active;
    if (active?.ready && !active.seeking) {
      try { active.player.play(); this.update({ playing: true, error: '' }); } catch { this.fail(); }
    } else if (!this.snapshot.loading) {
      const index = this.snapshot.finished ? 0 : this.snapshot.index;
      const offset = this.snapshot.finished ? 0 : Math.max(0, this.snapshot.positionMs - this.momentStart(index));
      await this.loadMoment(index, offset, true);
    }
  };

  seek = async (positionMs: number) => {
    if (!this.enabled || !this.snapshot.moments.length || !Number.isFinite(positionMs)) return;
    const target = Math.max(0, Math.min(this.snapshot.durationMs, positionMs));
    const resume = this.snapshot.playing || (this.snapshot.loading && this.wantsPlay);
    if (target === this.snapshot.durationMs) {
      ++this.version;
      this.wantsPlay = false;
      this.releasePlayer();
      this.update({ index: this.snapshot.moments.length - 1, positionMs: target, playing: false, loading: false, finished: true, error: '' });
      return;
    }
    let index = 0;
    while (index + 1 < this.snapshot.moments.length && target >= this.momentStart(index + 1)) index++;
    const offset = target - this.momentStart(index);
    const active = this.active;
    if (!active?.ready || active.index !== index) { await this.loadMoment(index, offset, resume); return; }
    const seekVersion = ++this.seekVersion;
    // Keep user intent through multiple seeks queued while the native player is paused.
    if (!active.seeking) this.wantsPlay = resume;
    active.seeking = true;
    try { active.player.pause(); } catch { this.fail(); return; }
    this.update({ positionMs: target, playing: false, loading: true, finished: false, error: '' });
    this.clearTimer();
    this.timer = setTimeout(() => {
      if (this.current(active.version)) this.fail('We couldn’t move to that part of the story. Press play to retry.');
    }, 8000);
    this.seekQueue = this.seekQueue.catch(() => {}).then(async () => {
      if (!this.current(active.version) || seekVersion !== this.seekVersion) return;
      try {
        await active.player.seekTo(offset / 1000, 0, 0);
        if (!this.current(active.version) || seekVersion !== this.seekVersion) return;
        active.seeking = false;
        this.clearTimer();
        if (this.wantsPlay) active.player.play();
        this.update({ positionMs: target, loading: false, playing: this.wantsPlay });
      } catch { if (this.current(active.version) && seekVersion === this.seekVersion) this.fail('We couldn’t move to that part of the story. Press play to retry.'); }
    });
    await this.seekQueue;
  };

  skip = (seconds: number) => this.seek(this.snapshot.positionMs + seconds * 1000);
  selectMoment = (index: number) => this.loadMoment(index, 0, true);
  next = () => this.snapshot.index + 1 < this.snapshot.moments.length
    ? this.loadMoment(this.snapshot.index + 1, 0, this.wantsPlay || this.snapshot.playing)
    : this.seek(this.snapshot.durationMs);
  previous = () => {
    const offset = this.snapshot.positionMs - this.momentStart(this.snapshot.index);
    const index = offset > 3000 ? this.snapshot.index : Math.max(0, this.snapshot.index - 1);
    return this.loadMoment(index, 0, this.wantsPlay || this.snapshot.playing);
  };
  dispose = () => { this.stop(); this.enabled = false; };
}
