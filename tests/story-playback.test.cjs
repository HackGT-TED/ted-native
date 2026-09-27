const assert = require('node:assert/strict');
const { test } = require('node:test');
const { load, deferred, tick } = require('./hook-harness.cjs');
const recordings = load('src/utils/recordings.ts', {});
const a = { id: 'a', title: 'First moment', order: 1, durationMs: 10000, localUri: 'file:///a.m4a', storagePath: 'owner/a.m4a', createdAt: '2026-09-26' };
const b = { ...a, id: 'b', title: 'Second moment', order: 2, localUri: 'file:///b.m4a', storagePath: 'owner/b.m4a' };

function setup(options = {}) {
  const calls = [], players = [], timers = new Map(); let timerId = 0;
  const { StoryPlayback } = load('src/services/story-playback.ts', { '../utils/recordings': recordings }, {
    setTimeout: (callback, ms) => { const id = ++timerId; timers.set(id, { callback, ms }); return id; },
    clearTimeout: id => timers.delete(id),
  });
  const controller = new StoryPlayback({
    localUri: async segment => options.local ? options.local(segment) : segment.localUri,
    remoteUri: async segment => { calls.push(['remote', segment.id]); return `https://private/${segment.id}`; },
    configureAudio: async () => { await options.mode; },
    createPlayer: uri => {
      assert.ok(players.every(player => player.removed), 'Only one live native player at a time');
      calls.push(['create', uri]);
      const check = () => assert.equal(player.removed, false, 'Do not touch a removed player');
      let listener;
      const player = {
        uri, removed: false, isLoaded: options.loaded ?? true, duration: 10, currentTime: 0, playing: false,
        play() { check(); player.playing = true; calls.push(['play', uri]); },
        pause() { check(); player.playing = false; calls.push(['pause', uri]); },
        remove() { check(); player.removed = true; calls.push(['remove', uri]); },
        async seekTo(seconds) { check(); calls.push(['seek', uri, seconds]); await options.seek?.(seconds); player.currentTime = seconds; },
        addListener(_, callback) { listener = callback; return { remove() { calls.push(['unsubscribe', uri]); } }; },
        // Retain the old callback deliberately to exercise stale native events.
        emit(status = {}) { listener({ isLoaded: player.isLoaded, currentTime: player.currentTime, duration: 10, playing: player.playing, isBuffering: false, didJustFinish: false, error: null, ...status }); },
      };
      players.push(player); return player;
    },
  });
  controller.setQueue('owner:story', [b, a]); controller.setEnabled(true);
  return { controller, calls, players, timers, state: controller.getSnapshot,
    async fire(ms) { for (const [id, timer] of [...timers]) if (timer.ms === ms) { timers.delete(id); timer.callback(); } await tick(); },
  };
}

test('play starts the first moment; pause/resume preserve position; stop resets the full story', async () => {
  const h = setup(); await h.controller.toggle();
  assert.equal(h.players[0].uri, a.localUri); assert.equal(h.state().playing, true);
  h.players[0].currentTime = 4; h.players[0].emit();
  await h.controller.toggle(); assert.equal(h.state().playing, false); assert.equal(h.state().positionMs, 4000);
  await h.controller.toggle(); assert.equal(h.state().playing, true); assert.equal(h.players.length, 1);
  assert.equal(h.calls.filter(call => call[0] === 'seek').length, 0);
  h.controller.stop(); assert.equal(h.state().positionMs, 0); assert.equal(h.state().index, 0); assert.equal(h.players[0].removed, true);
});

test('completion advances once in story order and keeps a continuous clock', async () => {
  const h = setup(); await h.controller.toggle();
  h.players[0].emit({ didJustFinish: true }); h.players[0].emit({ didJustFinish: true }); await tick();
  assert.equal(h.players.length, 2); assert.equal(h.state().index, 1); assert.equal(h.state().positionMs, 10000);
  h.players[1].currentTime = 2; h.players[1].emit(); assert.equal(h.state().positionMs, 12000);
  h.players[1].emit({ didJustFinish: true }); assert.equal(h.state().finished, true); assert.equal(h.state().positionMs, 20000);
  await h.controller.toggle(); assert.equal(h.state().positionMs, 0); assert.equal(h.players[2].uri, a.localUri); h.controller.dispose();
});

test('cross-moment seek resumes playback and same-moment seek uses the existing player', async () => {
  const h = setup(); await h.controller.toggle(); await h.controller.seek(13000); await tick();
  assert.equal(h.state().index, 1); assert.equal(h.state().positionMs, 13000); assert.equal(h.state().playing, true);
  assert.ok(h.calls.some(call => call[0] === 'seek' && call[1] === b.localUri && call[2] === 3));
  await h.controller.seek(16000); assert.equal(h.players.length, 2); assert.equal(h.state().positionMs, 16000); h.controller.dispose();
});

test('seek while paused stays paused, including crossing into a different moment', async () => {
  const h = setup(); await h.controller.seek(14000); await tick();
  assert.equal(h.state().playing, false); assert.equal(h.state().positionMs, 14000);
  assert.ok(!h.calls.some(call => call[0] === 'play'));
  await h.controller.toggle(); assert.equal(h.state().playing, true); h.controller.dispose();
});

test('seek waits for the new source to load, and pause during preparation prevents autoplay', async () => {
  const h = setup({ loaded: false }); await h.controller.toggle();
  assert.equal(h.state().loading, true); assert.ok(!h.calls.some(call => call[0] === 'play'));
  await h.controller.seek(15000); h.controller.pause();
  h.players[1].emit({ isLoaded: true }); await tick();
  assert.ok(h.calls.some(call => call[0] === 'seek' && call[2] === 5));
  assert.equal(h.state().playing, false); assert.equal(h.state().loading, false); h.controller.dispose();
});

test('rapid seeks are serialized and the latest requested position wins', async () => {
  const pending = deferred(); const h = setup({ seek: seconds => seconds === 2 ? pending.promise : undefined });
  await h.controller.toggle(); const first = h.controller.seek(2000); await tick();
  const second = h.controller.seek(7000); pending.resolve(); await Promise.all([first, second]);
  assert.deepEqual(h.calls.filter(call => call[0] === 'seek').map(call => call[2]), [2, 7]);
  assert.equal(h.state().positionMs, 7000); assert.equal(h.state().playing, true); h.controller.dispose();
});

test('stop during pending file resolution prevents late playback', async () => {
  const pending = deferred(); const h = setup({ local: () => pending.promise });
  const starting = h.controller.toggle(); h.controller.stop(); pending.resolve(a.localUri); await starting;
  assert.equal(h.players.length, 0); assert.equal(h.state().playing, false); assert.equal(h.state().positionMs, 0);
});

test('story or account change cancels old loads and drops old playback state', async () => {
  const pending = deferred(); const h = setup({ local: segment => segment.id === 'a' ? pending.promise : segment.localUri });
  const starting = h.controller.toggle(); h.controller.setQueue('other-owner:story', [b]); pending.resolve(a.localUri); await starting;
  assert.equal(h.players.length, 0); assert.equal(h.state().durationMs, 10000);
  await h.controller.toggle(); assert.equal(h.players[0].uri, b.localUri); h.controller.dispose();
});

test('disconnect, blur or background disable playback and cancel a pending seek safely', async () => {
  const pending = deferred(); const h = setup({ seek: () => pending.promise });
  await h.controller.toggle(); const seeking = h.controller.seek(2000); await tick();
  h.controller.setEnabled(false); pending.resolve(); await seeking;
  assert.equal(h.state().playing, false); assert.equal(h.state().positionMs, 0);
  assert.equal(h.calls.filter(call => call[0] === 'play').length, 1);
  await h.controller.toggle(); assert.equal(h.players.length, 1);
  h.controller.setEnabled(true); assert.equal(h.state().playing, false); h.controller.dispose();
});

test('failed local audio falls back once to the private remote file; remote failure is recoverable', async () => {
  const h = setup(); await h.controller.toggle(); h.players[0].emit({ error: 'decode' }); await tick();
  assert.equal(h.players[1].uri, 'https://private/a');
  h.players[1].emit({ error: 'network' }); assert.match(h.state().error, /retry/); assert.equal(h.state().playing, false);
  assert.equal(h.calls.filter(call => call[0] === 'remote').length, 1); h.controller.dispose();
});

test('a native load timeout releases the player and ignores late readiness', async () => {
  const h = setup({ loaded: false }); await h.controller.toggle(); await h.fire(15000);
  assert.match(h.state().error, /too long/); assert.equal(h.players[0].removed, true);
  h.players[0].emit({ isLoaded: true }); assert.ok(!h.calls.some(call => call[0] === 'play')); h.controller.dispose();
});

test('unmount while configuring audio never creates a player afterward', async () => {
  const pending = deferred(); const h = setup({ mode: pending.promise });
  const starting = h.controller.toggle(); await tick(); h.controller.dispose(); pending.resolve(); await starting;
  assert.equal(h.players.length, 0);
});

test('previous restarts after three seconds; skip and end seeking are clamped', async () => {
  const h = setup(); await h.controller.selectMoment(1); h.players[0].currentTime = 4; h.players[0].emit();
  await h.controller.previous(); assert.equal(h.state().index, 1); assert.equal(h.state().positionMs, 10000);
  await h.controller.previous(); assert.equal(h.state().index, 0);
  await h.controller.skip(-15); assert.equal(h.state().positionMs, 0);
  await h.controller.seek(999999); assert.equal(h.state().positionMs, 20000); assert.equal(h.state().finished, true); h.controller.dispose();
});

test('empty stories are inert; removed moments are excluded and measured durations update the clock', async () => {
  const h = setup(); h.controller.setQueue('empty', []); await h.controller.toggle(); assert.equal(h.players.length, 0);
  h.controller.setQueue('recorded', [b, { ...a, deletedAt: '2026-09-26' }]); await h.controller.toggle();
  assert.equal(h.state().moments.length, 1); h.players[0].emit({ duration: 12 }); assert.equal(h.state().durationMs, 12000); h.controller.dispose();
});
