const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { test } = require('node:test');
const vm = require('node:vm');
const ts = require('typescript');
const tick = () => new Promise(resolve => setImmediate(resolve));

function setup(file, client, props = {}) {
  const source = ts.transpileModule(readFileSync(file, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX },
  }).outputText;
  const states = [], refs = [];
  let si, ri, effectRan = false, cleanup;
  const modules = {
    react: {
      useState(value) { const i = si++; if (!(i in states)) states[i] = value; return [states[i], next => { states[i] = typeof next === 'function' ? next(states[i]) : next; }]; },
      useRef(value) { const i = ri++; return refs[i] ??= { current: value }; },
      useEffect(effect) { if (!effectRan) { effectRan = true; cleanup = effect(); } },
    },
    'react/jsx-runtime': { jsx: (type, props) => ({ type, props }), jsxs: (type, props) => ({ type, props }), Fragment: 'Fragment' },
    'react-native': Object.fromEntries(['Pressable', 'Text', 'TextInput', 'View'].map(key => [key, key])),
    '../lib/supabase': { supabase: client },
    './ui': { Body: 'Body', Button: 'Button', colors: {}, fieldStyles: {} },
  };
  const exports = {};
  vm.runInNewContext(source, { exports, require: name => { assert.ok(modules[name], name); return modules[name]; }, AbortController, Error, Date });
  let tree;
  function all(node) {
    if (Array.isArray(node)) return node.flatMap(all);
    if (!node || typeof node !== 'object') return [];
    return [node, ...all(node.props?.children)];
  }
  const h = {
    render() { si = 0; ri = 0; tree = exports.default(props); return h; },
    field(label, value) { all(tree).find(node => node.props?.accessibilityLabel === label).props.onChangeText(value); h.render(); },
    press(title) { return all(tree).find(node => node.type === 'Button' && node.props.title === title).props.onPress(); },
    switch() { all(tree).find(node => node.type === 'Pressable').props.onPress(); h.render(); },
    text() { return JSON.stringify(tree); },
    unmount() { cleanup?.(); },
  };
  return h.render();
}

function credentials(h) {
  h.field('Email', ' test@example.com ');
  h.field('Password', 'secret123');
}

test('sign-in sends trimmed email and catches network rejection', async () => {
  let supplied;
  const h = setup('src/components/Auth.tsx', { auth: { signInWithPassword: async values => {
    supplied = values; throw new Error('Network unavailable');
  } } });
  credentials(h);
  h.press('Sign in');
  await tick();
  h.render();
  assert.equal(supplied.email, 'test@example.com');
  assert.equal(supplied.password, 'secret123');
  assert.match(h.text(), /Network unavailable/);
  assert.doesNotMatch(h.text(), /Please wait/);
});

test('confirmation-only signup shows instructions and switches back to sign-in', async () => {
  let supplied;
  const h = setup('src/components/Auth.tsx', { auth: { signUp: async values => {
    supplied = values; return { data: { session: null }, error: null };
  } } });
  h.switch();
  credentials(h);
  h.field('Name', ' Teddy ');
  h.press('Create account');
  await tick();
  h.render();
  assert.equal(supplied.options.data.display_name, 'Teddy');
  assert.match(h.text(), /Check your email to confirm/);
  assert.match(h.text(), /"title":"Sign in"/);
});

test('repeated submit taps send only one request', async () => {
  let resolve, calls = 0;
  const pending = new Promise(done => { resolve = done; });
  const h = setup('src/components/Auth.tsx', { auth: { signInWithPassword: () => { calls++; return pending; } } });
  credentials(h);
  h.press('Sign in');
  h.press('Sign in');
  assert.equal(calls, 1);
  resolve({ data: { session: {} }, error: null });
  await tick();
});

test('profile load failure prevents overwriting a profile and leaves sign-out available', async () => {
  let signedOut = false;
  const query = { select: () => query, eq: () => query, abortSignal: () => query,
    maybeSingle: async () => ({ data: null, error: { message: 'offline' } }) };
  const h = setup('src/components/Account.tsx', {
    from: () => query,
    auth: { signOut: async () => { signedOut = true; return { error: null }; } },
  }, { userId: 'owner' });
  await tick(); h.render();
  assert.match(h.text(), /Retry loading profile/);
  assert.doesNotMatch(h.text(), /Save profile/);
  h.press('Sign out');
  await tick();
  assert.equal(signedOut, true);
  h.unmount();
});

test('first profile save uses session owner and preserves avatar data', async () => {
  let row, metadata;
  const query = { select: () => query, eq: () => query, abortSignal: () => query,
    maybeSingle: async () => ({ data: null, error: null }),
    upsert: async value => { row = value; return { error: null }; } };
  const h = setup('src/components/Account.tsx', {
    from: () => query,
    auth: { updateUser: async value => { metadata = value; return { error: null }; } },
  }, { userId: 'owner', displayName: 'Teddy' });
  await tick(); h.render();
  h.field('Username', ' Teddy Bear ');
  h.press('Save profile');
  await tick(); h.render();
  assert.equal(row.id, 'owner');
  assert.equal(row.username, 'Teddy Bear');
  assert.equal('avatar_url' in row, false);
  assert.equal(metadata.data.display_name, 'Teddy Bear');
  assert.match(h.text(), /Profile saved/);
  h.unmount();
});
