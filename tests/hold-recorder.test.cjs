const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { test } = require('node:test');
const vm = require('node:vm');
const ts = require('typescript');

const source = ts.transpileModule(readFileSync('src/hooks/use-hold-recorder.ts', 'utf8'), {
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
  const recorder = {
    uri: 'file:///test.m4a',
    prepareToRecordAsync: async () => { calls.push('prepare'); await options.prepare; },
    record: () => { calls.push('record'); if (options.recordError) throw new Error('Unavailable'); },
    stop: async () => { calls.push('stop'); await options.stop; if (options.stopError) throw new Error('Stop failed'); },
  };
  const modules = {
    react: {
      useRef: current => ({ current }),
      useCallback: callback => callback,
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
      RecordingPresets: { HIGH_QUALITY: {} },
      setAudioModeAsync: async mode => { calls.push(mode.allowsRecording ? 'mode-record' : 'mode-play'); },
    },
  };
  const exports = {};
  vm.runInNewContext(source, { exports, require: name => {
    assert.ok(modules[name], `Unexpected module ${name}`);
    return modules[name];
  }, Date });
  const hook = exports.useHoldRecorder(take => takes.push(take));
  return { hook, calls, takes, states, blur: () => blur(), background: () => background('background') };
}
const settle = () => new Promise(resolve => setImmediate(resolve));

test('holding records; releasing saves exactly one take', async () => {
  const h = setup();
  await h.hook.start('  My note  ');
  assert.equal(h.states[0], 'recording');
  await Promise.all([h.hook.finish(), h.hook.finish()]);
  assert.equal(h.calls.filter(call => call === 'stop').length, 1);
  assert.equal(h.takes.length, 1);
  assert.equal(h.takes[0].title, 'My note');
  assert.equal(h.states[0], 'idle');
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
  assert.equal(h.states[0], 'idle');
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
  assert.equal(h.states[0], 'idle');
});

test('permission denial is recoverable and never prepares a recorder', async () => {
  const h = setup({ permission: Promise.resolve({ granted: false }) });
  await h.hook.start('Denied');
  assert.equal(h.states[0], 'idle');
  assert.match(h.states[1], /Microphone access is off/);
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
  assert.equal(h.states[0], 'idle');
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
  assert.equal(h.states[0], 'idle');
  assert.match(h.states[1], /could not start/);
  assert.equal(h.calls.at(-1), 'mode-play');
  assert.equal(h.takes.length, 0);
});

test('a stop failure still disables recording mode', async () => {
  const h = setup({ stopError: true });
  await h.hook.start('Failed stop');
  await h.hook.finish();
  assert.equal(h.states[0], 'idle');
  assert.match(h.states[1], /Could not save/);
  assert.equal(h.calls.at(-1), 'mode-play');
  assert.equal(h.takes.length, 0);
});
