const assert = require('node:assert/strict');
const { test } = require('node:test');
const { load, harness, tick, deferred } = require('./hook-harness.cjs');
const a = { id: 'moment-a', localUri: 'file:///a.m4a', storagePath: 'owner/a.m4a' };
const b = { id: 'moment-b', localUri: 'file:///b.m4a' };

function setup(options = {}) {
  const hooks = harness();
  const calls = [];
  const listeners = new Set();
  let focused = true, released = false, background;
  const check = () => assert.equal(released, false, 'Native player was released');
  const player = {
    playing: false, currentTime: 0, duration: 10,
    pause() { check(); this.playing = false; calls.push('pause'); },
    play() { check(); this.playing = true; calls.push('play'); },
    replace(uri) { check(); this.currentTime = 0; calls.push(uri); },
    async seekTo(...args) { check(); calls.push(['seek', ...args]); await options.seek; this.currentTime = 0; },
    addListener(_, listener) { listeners.add(listener); return { remove: () => listeners.delete(listener) }; },
  };
  const module = load('src/hooks/use-timeline-playback.ts', {
    react: hooks.react,
    'react-native': { AppState: { addEventListener: (_, fn) => { background = fn; return { remove() {} }; } } },
    'expo-router': { useIsFocused: () => focused },
    'expo-audio': { useAudioPlayer: () => player, useAudioPlayerStatus: () => ({ playing: player.playing, currentTime: player.currentTime, duration: 10 }),
      setAudioModeAsync: async () => { await options.mode; } },
    '../services/recording-files': {
      localRecordingUri: async segment => options.local ? options.local(segment) : segment.localUri,
      remoteRecordingUri: async () => { calls.push('signed-url'); return 'https://private/audio'; },
    },
  });
  const h = { calls, player,
    render() { h.result = hooks.render(module.useTimelinePlayback); return h.result; },
    blur() { focused = false; h.render(); },
    unmount() { released = true; hooks.unmount(); },
    emit(status) { for (const listener of listeners) listener(status); },
    background() { background('background'); },
  };
  h.render(); return h;
}

test('switching cards pauses the single player before replacing its source', async () => {
  const h = setup();
  await h.result.toggle(a); await h.result.toggle(b);
  assert.deepEqual(h.calls, ['pause', a.localUri, 'play', 'pause', b.localUri, 'play']);
  assert.equal(h.render().activeId, b.id);
});

test('slow source resolution cannot replace a more recently selected moment', async () => {
  const pending = deferred();
  const h = setup({ local: segment => segment.id === a.id ? pending.promise : segment.localUri });
  const first = h.result.toggle(a);
  await h.result.toggle(b);
  pending.resolve(a.localUri); await first;
  assert.equal(h.calls.includes(a.localUri), false);
  assert.equal(h.render().activeId, b.id);
});

test('completion rewinds exactly once, while pause and resume preserve position', async () => {
  const h = setup();
  await h.result.toggle(a);
  h.player.currentTime = 4;
  await h.result.toggle(a); await h.result.toggle(a);
  assert.equal(h.calls.some(Array.isArray), false);
  h.emit({ didJustFinish: true }); h.emit({ didJustFinish: false });
  await h.result.toggle(a);
  assert.deepEqual(h.calls.find(Array.isArray), ['seek', 0, 0, 0]);
});

test('missing local files fall back to a signed storage URL', async () => {
  const h = setup({ local: async () => undefined });
  await h.result.toggle(a);
  assert.ok(h.calls.includes('https://private/audio'));
});

test('decode errors try the remote file once then isolate the error to that card', async () => {
  const h = setup();
  await h.result.toggle(a);
  h.emit({ error: 'decode failed' }); await tick();
  assert.ok(h.calls.includes('https://private/audio'));
  h.emit({ error: 'remote also failed' });
  assert.match(h.render().error, /could not be played/);
  await h.result.toggle(b);
  assert.equal(h.render().error, '');
});

test('blur cancels pending setup and pauses playback', async () => {
  const mode = deferred(); const h = setup({ mode: mode.promise });
  const pending = h.result.toggle(a); await tick();
  h.blur(); mode.resolve(); await pending;
  assert.equal(h.calls.includes('play'), false);
});

test('unmount never touches the disposed player, including pending seeks', async () => {
  const seek = deferred(); const h = setup({ seek: seek.promise });
  await h.result.toggle(a); h.emit({ didJustFinish: true });
  const pending = h.result.toggle(a);
  h.unmount(); seek.resolve(); await pending;
  assert.equal(h.calls.filter(call => call === 'play').length, 1);
});

test('backgrounding stops the timeline player', async () => {
  const h = setup(); await h.result.toggle(a); h.background();
  assert.equal(h.player.playing, false);
  assert.equal(h.render().activeId, null);
});

test('starting capture stops playback and cancels a pending source load', async () => {
  const pending = deferred();
  const h = setup({ local: segment => segment.id === b.id ? pending.promise : segment.localUri });
  await h.result.toggle(a);
  const loading = h.result.toggle(b);
  h.result.stop();
  assert.equal(h.player.playing, false);
  assert.equal(h.render().activeId, null);
  pending.resolve(b.localUri);
  await loading;
  assert.equal(h.calls.includes(b.localUri), false);
  assert.equal(h.player.playing, false);
});

test('capture cancels playback already waiting on audio mode configuration', async () => {
  const mode = deferred();
  const h = setup({ mode: mode.promise });
  const loading = h.result.toggle(a);
  await tick();
  h.result.stop();
  mode.resolve();
  await loading;
  assert.equal(h.calls.includes('play'), false);
});
