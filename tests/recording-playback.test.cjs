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
function makePlayer(seek) {
  let released = false;
  let playing = false;
  const calls = [];
  function live() { assert.equal(released, false, 'Native shared object has been released'); }
  return {
    calls,
    release() { released = true; calls.push('release'); },
    get playing() { live(); return playing; },
    get currentTime() { live(); return 10; },
    get duration() { live(); return 10; },
    pause() { live(); playing = false; calls.push('pause'); },
    play() { live(); playing = true; calls.push('play'); },
    async seekTo() { live(); calls.push('seek'); await seek; },
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
  let player = makePlayer(options.seek);
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
      useAudioPlayer: () => player,
      useAudioPlayerStatus: () => ({ playing: player.playing }),
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
        player = makePlayer(options.seek);
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
