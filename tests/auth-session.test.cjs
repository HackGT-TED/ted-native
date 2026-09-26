const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { test } = require('node:test');
const vm = require('node:vm');
const ts = require('typescript');

const source = ts.transpileModule(readFileSync('src/hooks/use-auth-session.ts', 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText;
const tick = () => new Promise(resolve => setImmediate(resolve));
function setup({ configured = true, os = 'ios' } = {}) {
  const states = [];
  let index = 0;
  let cleanup;
  let effectRan = false;
  let onAuth;
  let onAppState;
  let restore;
  const calls = [];
  const initial = new Promise(resolve => { restore = resolve; });
  const client = { auth: {
    getSession: () => initial,
    onAuthStateChange: callback => {
      onAuth = callback;
      return { data: { subscription: { unsubscribe: () => calls.push('unsubscribe') } } };
    },
    startAutoRefresh: () => calls.push('start'),
    stopAutoRefresh: () => calls.push('stop'),
  } };
  const modules = {
    react: {
      useState: value => { const key = index++; if (!(key in states)) states[key] = value; return [states[key], next => { states[key] = next; }]; },
      useEffect: effect => { if (!effectRan) { effectRan = true; cleanup = effect(); } },
    },
    'react-native': { Platform: { OS: os }, AppState: { currentState: 'active', addEventListener: (_name, callback) => {
      onAppState = callback; return { remove: () => calls.push('remove') };
    } } },
    '../lib/supabase': { supabase: configured ? client : null },
  };
  const exports = {};
  vm.runInNewContext(source, { exports, require: name => modules[name] });
  const h = {
    render() { index = 0; return exports.useAuthSession(); },
    emit: (event, session) => onAuth(event, session),
    restore: session => restore({ data: { session }, error: null }),
    fail: () => restore({ data: { session: null }, error: { message: 'offline' } }),
    background: () => onAppState('background'),
    foreground: () => onAppState('active'),
    unmount: () => cleanup?.(), calls,
  };
  h.render();
  return h;
}

test('restores persisted session and tracks sign-in and sign-out', async () => {
  const h = setup();
  assert.equal(h.render().authLoading, true);
  const session = { user: { id: 'first' } };
  h.restore(session);
  await tick();
  assert.equal(h.render().session, session);
  assert.equal(h.render().authLoading, false);
  h.emit('SIGNED_OUT', null);
  assert.equal(h.render().session, null);
  const other = { user: { id: 'second' } };
  h.emit('SIGNED_IN', other);
  assert.equal(h.render().session, other);
  h.unmount();
});

test('late restoration cannot overwrite a more recent sign-out', async () => {
  const h = setup();
  h.emit('SIGNED_OUT', null);
  h.restore({ user: { id: 'stale' } });
  await tick();
  assert.equal(h.render().session, null);
  h.unmount();
});

test('native refresh pauses in background and listeners are cleaned up', async () => {
  const h = setup();
  h.background();
  h.foreground();
  h.unmount();
  assert.deepEqual(h.calls, ['start', 'stop', 'start', 'unsubscribe', 'remove', 'stop']);
  h.restore({ user: { id: 'late' } });
  h.emit('SIGNED_IN', { user: { id: 'later' } });
  await tick();
  assert.equal(h.render().session, null);
});

test('web leaves refresh management to Supabase', () => {
  const h = setup({ os: 'web' });
  h.unmount();
  assert.deepEqual(h.calls, ['unsubscribe']);
});

test('missing config does not leave the app loading or create subscriptions', () => {
  const h = setup({ configured: false });
  assert.equal(h.render().authLoading, false);
  assert.equal(h.render().session, null);
  assert.deepEqual(h.calls, []);
});

test('restoration failure allows a fresh sign-in', async () => {
  const h = setup();
  h.fail();
  await tick();
  assert.equal(h.render().authLoading, false);
  assert.match(h.render().authError, /sign in again/);
  h.emit('SIGNED_IN', { user: { id: 'new' } });
  assert.equal(h.render().authError, '');
  h.unmount();
});
