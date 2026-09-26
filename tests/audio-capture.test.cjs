const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { test } = require('node:test');
const vm = require('node:vm');
const ts = require('typescript');

const source = ts.transpileModule(readFileSync('src/hooks/use-audio-capture.ts', 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText;
const deferred = () => {
  let resolve;
  const promise = new Promise(done => { resolve = done; });
  return { promise, resolve };
};
function setup(options = {}) {
  const calls = [];
  const takes = [];
  const states = [];
  let blur;
  let background;
  let fileId = 0;
  let stopped = false;
  const cleanups = [];
  const preset = { extension: '.m4a', sampleRate: 44100 };
  const recorder = {
    uri: 'file:///test.m4a',
    prepareToRecordAsync: async settings => {
      calls.push('prepare');
      await options.prepare;
      // SDK 57's iOS recorder allocates a new file only when options are passed.
      if (settings) {
        assert.equal(settings.extension, preset.extension);
        assert.equal(settings.directory, 'document');
        recorder.uri = `file:///take-${++fileId}.m4a`;
      }
    },
    getStatus: () => ({ durationMillis: stopped ? (options.finalDuration ?? 0) : (options.duration ?? 1200), isRecording: !stopped }),
    record: () => { stopped = false; calls.push('record'); if (options.recordError) throw new Error('Unavailable'); },
    stop: async () => { calls.push('stop'); await options.stop; if (options.stopError) throw new Error('Stop failed'); stopped = true; },
  };
  const modules = {
    react: {
      useRef: current => ({ current }),
      useCallback: callback => callback,
      useEffect: callback => { const cleanup = callback(); if (cleanup) cleanups.push(cleanup); },
      useState: initial => {
        const index = states.push(initial) - 1;
        return [initial, next => { states[index] = next; }];
      },
    },
    'react-native': {
      Platform: { OS: options.platform || 'ios' },
      AppState: { addEventListener: (_, handler) => { background = handler; return { remove() {} }; } },
    },
    'expo-router': { useFocusEffect: callback => { blur = callback(); } },
    'expo-audio': {
      useAudioRecorder: () => recorder,
      useAudioRecorderState: () => ({ durationMillis: 0 }),
      AudioModule: { requestRecordingPermissionsAsync: async () => options.permission ? await options.permission : { granted: true } },
      RecordingPresets: { HIGH_QUALITY: preset },
      setAudioModeAsync: async mode => { calls.push(mode.allowsRecording ? 'mode-record' : 'mode-play'); },
    },
  };
  const exports = {};
  vm.runInNewContext(source, { exports, require: name => {
    assert.ok(modules[name], `Unexpected module ${name}`);
    return modules[name];
  }, Date, setInterval, clearInterval });
  const hook = exports.useAudioCapture(async take => { takes.push(take); });
  return { hook, calls, takes, states, blur: () => hook.finish(), background: () => background('background') };
}
const settle = () => new Promise(resolve => setImmediate(resolve));

test('press begins capture; release saves exactly one take', async () => {
  const h = setup();
  await h.hook.start('  My note  ');
  assert.equal(h.states[1], 'recording');
  await Promise.all([h.hook.finish(), h.hook.finish()]);
  assert.equal(h.calls.filter(call => call === 'stop').length, 1);
  assert.equal(h.takes.length, 1);
  assert.equal(h.takes[0].title, 'My note');
  assert.equal(h.states[1], 'idle');
});

test('successive takes have distinct files so playback reloads the new audio', async () => {
  const h = setup();
  await h.hook.start('First');
  await h.hook.finish();
  await h.hook.start('Second');
  await h.hook.finish();
  assert.equal(h.takes.length, 2);
  assert.notEqual(h.takes[0].uri, h.takes[1].uri);
});

test('release during permission prompt never starts the microphone', async () => {
  const permission = deferred();
  const h = setup({ permission: permission.promise });
  const starting = h.hook.start('Quick tap');
  await h.hook.finish();
  permission.resolve({ granted: true });
  await starting;
  assert.deepEqual(h.calls, []);
  assert.equal(h.takes.length, 0);
  assert.equal(h.states[1], 'idle');
});

test('release during native preparation closes the recorder without saving', async () => {
  const prepare = deferred();
  const h = setup({ prepare: prepare.promise });
  const starting = h.hook.start('Quick tap');
  await settle();
  await h.hook.finish();
  prepare.resolve();
  await starting;
  assert.ok(h.calls.includes('stop'));
  assert.ok(!h.calls.includes('record'));
  assert.equal(h.takes.length, 0);
  assert.equal(h.states[1], 'idle');
});

test('permission denial is recoverable and never prepares a recorder', async () => {
  const h = setup({ permission: Promise.resolve({ granted: false }) });
  await h.hook.start('Denied');
  assert.equal(h.states[1], 'idle');
  assert.match(h.states[2], /Microphone access is off/);
  assert.deepEqual(h.calls, []);
});

test('leaving the screen while permission is pending cancels the operation', async () => {
  const permission = deferred();
  const h = setup({ permission: permission.promise });
  const starting = h.hook.start('Leaving');
  h.blur();
  permission.resolve({ granted: true });
  await starting;
  assert.deepEqual(h.calls, []);
  assert.equal(h.takes.length, 0);
});

test('backgrounding the app stops an active recording', async () => {
  const h = setup();
  await h.hook.start('Background');
  h.background();
  await settle();
  assert.equal(h.takes.length, 1);
  assert.equal(h.states[1], 'idle');
});

test('a rapid second press cannot start while the previous take is stopping', async () => {
  const stop = deferred();
  const h = setup({ stop: stop.promise });
  await h.hook.start('First');
  const stopping = h.hook.finish();
  await h.hook.start('Second');
  stop.resolve();
  await stopping;
  assert.equal(h.calls.filter(call => call === 'record').length, 1);
  assert.equal(h.takes[0].title, 'First');
});

test('a recording failure restores playback mode and reports an error', async () => {
  const h = setup({ recordError: true });
  await h.hook.start('Failed');
  assert.equal(h.states[1], 'idle');
  assert.match(h.states[2], /could not start/);
  assert.equal(h.calls.at(-1), 'mode-play');
  assert.equal(h.takes.length, 0);
});

test('a stop failure retains the take for a safe retry', async () => {
  const h = setup({ stopError: true });
  await h.hook.start('Failed stop');
  await h.hook.finish();
  assert.equal(h.states[1], 'error');
  assert.match(h.states[2], /could not finish/);
  assert.equal(h.calls.at(-1), 'mode-play');
  assert.equal(h.takes.length, 0);
});


test('duration comes from native status before iOS resets it on stop', async () => {
  const h = setup({ duration: 2784 });
  await h.hook.start();
  await h.hook.finish();
  assert.equal(h.takes[0].duration, 2784);
  assert.ok(Number.isFinite(Date.parse(h.takes[0].recordedAt)));
});

test('uses finalized duration on platforms that report it', async () => {
  const h = setup({ duration: 1200, finalDuration: 1390 });
  await h.hook.start();
  await h.hook.finish();
  assert.equal(h.takes[0].duration, 1390);
});

test('rejects sub-quarter-second audio with an explicit message', async () => {
  const h = setup({ duration: 100 });
  await h.hook.start();
  await h.hook.finish();
  assert.equal(h.takes.length, 0);
  assert.match(h.states[2], /quarter of a second/);
});

test('permanent permission denial exposes the settings action', async () => {
  const h = setup({ permission: Promise.resolve({ granted: false, canAskAgain: false }) });
  await h.hook.start();
  assert.equal(h.states[3], true);
});

test('retry after stop failure saves the original take once', async () => {
  const options = { stopError: true };
  const h = setup(options);
  await h.hook.start('Original');
  await h.hook.finish();
  await h.hook.start('Must not overwrite');
  options.stopError = false;
  await h.hook.finish();
  assert.equal(h.takes.length, 1);
  assert.equal(h.takes[0].title, 'Original');
});

test('timer polling runs only during capture and is cleaned up after stopping', async () => {
  const { load, harness } = require('./hook-harness.cjs');
  const hooks = harness(), intervals = new Map();
  let recording = false;
  const recorder = { uri: 'file:///safe.m4a',
    prepareToRecordAsync: async () => {}, record: () => { recording = true; },
    stop: async () => { recording = false; },
    getStatus: () => ({ durationMillis: recording ? 2000 : 0, isRecording: recording }),
  };
  const module = load('src/hooks/use-audio-capture.ts', {
    react: hooks.react,
    'react-native': { Platform: { OS: 'ios' }, AppState: { addEventListener: () => ({ remove() {} }) } },
    'expo-audio': { useAudioRecorder: () => recorder, RecordingPresets: { HIGH_QUALITY: {} },
      AudioModule: { requestRecordingPermissionsAsync: async () => ({ granted: true }) }, setAudioModeAsync: async () => {} },
  }, { setInterval: (fn, ms) => { assert.equal(ms, 250); intervals.set(fn, fn); return fn; }, clearInterval: id => intervals.delete(id) });
  const complete = async () => {};
  const render = () => hooks.render(() => module.useAudioCapture(complete));
  let hook = render(); assert.equal(intervals.size, 0);
  await hook.start(); hook = render(); assert.equal(intervals.size, 1);
  intervals.values().next().value(); hook = render(); assert.equal(hook.duration, 2000);
  await hook.finish(); render(); assert.equal(intervals.size, 0);
  hooks.unmount();
});
