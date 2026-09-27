const assert = require('node:assert/strict');
const { test } = require('node:test');
const { load, harness, tick } = require('./hook-harness.cjs');

const TABS = ['draft', 'public', 'private'];

function loadHook(stored) {
  const storage = { 'tedtime.library-tab.v1': stored };
  // Route the module's React calls to whichever mount is rendering.
  let current = harness();
  const react = Object.fromEntries(['useState', 'useEffect', 'useCallback', 'useRef']
    .map(name => [name, (...args) => current.react[name](...args)]));
  const module = load('src/hooks/use-library-tab.ts', {
    react,
    '@react-native-async-storage/async-storage': { __esModule: true, default: {
      getItem: async key => storage[key] ?? null, setItem: async (key, value) => { storage[key] = value; } } },
  });
  // Each visit to the Library is a fresh mount of the same loaded module.
  const mount = () => {
    const hooks = harness();
    const view = { render() { current = hooks; view.result = hooks.render(() => module.useLibraryTab(TABS, 'draft')); return view.result; },
      async flush() { await tick(); view.render(); } };
    view.render();
    return view;
  };
  return { mount, storage };
}

test('the selected tab is kept after leaving the Library and coming back', async () => {
  const { mount, storage } = loadHook(null);
  const first = mount(); await first.flush();
  assert.equal(first.result.tab, 'draft');
  first.result.select('private'); first.render();
  assert.equal(first.result.tab, 'private');
  assert.equal(mount().result.tab, 'private', 'restored immediately on the next visit');
  assert.equal(storage['tedtime.library-tab.v1'], 'private');
});

test('the tab saved on this device is restored after an app restart', async () => {
  const { mount } = loadHook('public');
  const view = mount(); await view.flush();
  assert.equal(view.result.tab, 'public');
});

test('an unknown saved value falls back to Drafts', async () => {
  const { mount } = loadHook('archived');
  const view = mount(); await view.flush();
  assert.equal(view.result.tab, 'draft');
});
