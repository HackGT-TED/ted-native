const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { test } = require('node:test');
const vm = require('node:vm');
const ts = require('typescript');

const source = ts.transpileModule(readFileSync('src/hooks/use-recording-playback.ts', 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText;
function deferred() {
  let resolve;
  const promise = new Promise(done => { resolve = done; });
  return { promise, resolve };
}

// Native method calls and property reads throw once Expo releases the player.
function makePlayer(options) {
  let released = false;
  let playing = false;
  let position = options.currentTime ?? 10;
  const listeners = new Set();
  const calls = [];
  function live() { assert.equal(released, false, 'Native shared object has been released'); }
  return {
    calls,
    addListener(event, listener) {
      assert.equal(event, 'playbackStatusUpdate');
      listeners.add(listener);
      return { remove() { listeners.delete(listener); } };
    },
    emit(status) {
      if ('playing' in status) playing = status.playing;
      if ('currentTime' in status) position = status.currentTime;
      for (const listener of listeners) listener(status);
    },
    release() { released = true; calls.push('release'); },
    get playing() { live(); return playing; },
    get currentTime() { live(); return position; },
    get duration() { live(); return options.duration ?? 10; },
    pause() { live(); playing = false; calls.push('pause'); },
    play() { live(); playing = true; calls.push('play'); },
    async seekTo(seconds, before, after) {
      live();
      calls.push('seek');
      assert.equal(seconds, 0);
      assert.equal(before, 0, 'Replay must seek exactly to the start on iOS');
      assert.equal(after, 0, 'Replay must seek exactly to the start on iOS');
      await options.seek;
      position = seconds;
    },
  };
}
function setup(options = {}) {
  const refs = [];
  const states = [];
  let refIndex;
  let stateIndex;
  let previousDeps;
  let cleanup;
  let pendingEffect;
  let uri = 'file:///first.m4a';
  let focused = true;
  let player = makePlayer(options);
  const players = [player];
  const modules = {
    react: {
      useRef(initial) { const index = refIndex++; return refs[index] ??= { current: initial }; },
      useState(initial) {
        const index = stateIndex++;
        if (!(index in states)) states[index] = initial;
        return [states[index], next => { states[index] = next; }];
      },
      useEffect(effect, deps) {
        if (!previousDeps || deps.some((dep, i) => dep !== previousDeps[i])) {
          pendingEffect = effect;
          previousDeps = deps;
        }
      },
    },
    'expo-router': { useIsFocused: () => focused },
    'expo-audio': {
      useAudioPlayer: (uri, config) => {
        assert.equal(config.keepAudioSessionActive, true, 'Do not queue iOS session deactivation between plays');
        return player;
      },
      useAudioPlayerStatus: () => ({ playing: player.playing, ...options.status }),
      setAudioModeAsync: async () => { await options.mode; },
    },
  };
  const exports = {};
  vm.runInNewContext(source, { exports, require: name => {
    assert.ok(modules[name], `Unexpected module ${name}`);
    return modules[name];
  } });
  const h = {
    players,
    render(next = {}) {
      if ('uri' in next && next.uri !== uri) {
        // Exercise the dangerous ordering: disposal before consumer cleanup.
        player.release();
        player = makePlayer(options);
        players.push(player);
        uri = next.uri;
      }
      if ('focused' in next) focused = next.focused;
      refIndex = 0;
      stateIndex = 0;
      h.result = exports.useRecordingPlayback(uri);
      if (pendingEffect) {
        cleanup?.();
        cleanup = pendingEffect();
        pendingEffect = undefined;
      }
      return h.result;
    },
    unmount() { player.release(); cleanup?.(); },
  };
  h.render();
  return h;
}

test('cleanup does not pause an already released native player', () => {
  const h = setup();
  h.unmount();
  assert.deepEqual(h.players[0].calls, ['release']);
});

test('a blurred mounted screen pauses its live player', () => {
  const h = setup();
  h.render({ focused: false });
  assert.deepEqual(h.players[0].calls, ['pause']);
  h.unmount();
});

test('source replacement and discard never touch the released player', () => {
  const h = setup();
  const oldControls = h.result;
  h.render({ uri: 'file:///second.m4a' });
  oldControls.pause();
  h.render({ uri: null });
  assert.deepEqual(h.players[0].calls, ['release']);
  assert.deepEqual(h.players[1].calls, ['release']);
  h.unmount();
});

test('pending audio mode setup cannot resume after unmount', async () => {
  const mode = deferred();
  const h = setup({ mode: mode.promise });
  const pending = h.result.toggle();
  h.unmount();
  mode.resolve();
  await pending;
  assert.deepEqual(h.players[0].calls, ['release']);
});

test('pending seek cannot play a released player after source replacement', async () => {
  const seek = deferred();
  const h = setup({ seek: seek.promise });
  const pending = h.result.toggle();
  await new Promise(resolve => setImmediate(resolve));
  h.render({ uri: 'file:///replacement.m4a' });
  seek.resolve();
  await pending;
  assert.deepEqual(h.players[0].calls, ['seek', 'release']);
  h.unmount();
});

test('pausing to start a new recording cancels pending playback', async () => {
  const mode = deferred();
  const h = setup({ mode: mode.promise });
  const pending = h.result.toggle();
  h.result.pause();
  mode.resolve();
  await pending;
  assert.deepEqual(h.players[0].calls, ['pause']);
  h.unmount();
});

test('playback resumes after focus returns and rewinds completed audio', async () => {
  const h = setup();
  h.render({ focused: false });
  await h.result.toggle();
  h.render({ focused: true });
  await h.result.toggle();
  await h.result.toggle();
  assert.deepEqual(h.players[0].calls, ['pause', 'seek', 'play', 'pause']);
  h.unmount();
});

test('unknown duration starts playback without waiting for a premature seek', async () => {
  const h = setup({ duration: 0, currentTime: 0 });
  await h.result.toggle();
  assert.deepEqual(h.players[0].calls, ['play']);
  h.unmount();
});

test('pausing a recording with missing duration metadata preserves its position', async () => {
  const h = setup({ duration: 0, currentTime: 3 });
  await h.result.toggle();
  await h.result.toggle();
  await h.result.toggle();
  assert.deepEqual(h.players[0].calls, ['play', 'pause', 'play']);
  h.unmount();
});

test('completed audio with missing duration metadata still rewinds', async () => {
  const h = setup({ duration: 0, currentTime: 3 });
  h.players[0].emit({ didJustFinish: true, playing: false });
  await h.result.toggle();
  assert.deepEqual(h.players[0].calls, ['seek', 'play']);
  h.unmount();
});

test('repeated playback rewinds even after the transient finish flag is cleared', async () => {
  const status = { didJustFinish: false };
  const h = setup({ currentTime: 0, duration: 10, status });
  const player = h.players[0];
  await h.result.toggle();
  for (let replay = 0; replay < 3; replay++) {
    // A native end event can precede a periodic update and React's next render.
    // The reported position can also be just short of the duration.
    player.emit({ didJustFinish: true, currentTime: 9.99, playing: false });
    player.emit({ didJustFinish: false });
    h.render();
    await h.result.toggle();
    assert.equal(player.currentTime, 0);
    assert.equal(player.playing, true);
  }
  assert.deepEqual(player.calls, ['play', 'seek', 'play', 'seek', 'play', 'seek', 'play']);
  h.unmount();
});

test('resume after a replay preserves position instead of rewinding again', async () => {
  const h = setup({ currentTime: 0, duration: 10 });
  const player = h.players[0];
  player.emit({ didJustFinish: true, playing: false });
  await h.result.toggle();
  player.emit({ currentTime: 4, didJustFinish: false });
  await h.result.toggle();
  await h.result.toggle();
  assert.equal(player.currentTime, 4);
  assert.deepEqual(player.calls, ['seek', 'play', 'pause', 'play']);
  h.unmount();
});

test('completion survives leaving and returning to the same player', async () => {
  const h = setup({ duration: 0, currentTime: 3 });
  const player = h.players[0];
  player.emit({ didJustFinish: true, playing: false });
  h.render({ focused: false });
  h.render({ focused: true });
  await h.result.toggle();
  assert.deepEqual(player.calls, ['pause', 'seek', 'play']);
  assert.equal(player.currentTime, 0);
  h.unmount();
});

test('asynchronous loading errors are surfaced without a play() exception', () => {
  const status = { error: null };
  const h = setup({ status });
  status.error = 'The audio file could not be opened';
  assert.match(h.render().error, /The audio file could not be opened/);
  status.error = null;
  h.render({ uri: 'file:///valid.m4a' });
  assert.equal(h.result.error, '');
  h.unmount();
});
