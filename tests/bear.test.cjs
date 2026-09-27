const assert = require('node:assert/strict');
const { test } = require('node:test');
const { load, harness, tick } = require('./hook-harness.cjs');

function settings(os, { openURL, sendIntent } = {}) {
  const calls = [];
  const Linking = {
    openURL: async url => { calls.push(['openURL', url]); if (openURL) await openURL(url); },
    sendIntent: async action => { calls.push(['sendIntent', action]); if (sendIntent) await sendIntent(action); },
    openSettings: async () => { calls.push(['openSettings']); },
  };
  const module = load('src/services/bluetooth-settings.ts', { 'react-native': { Linking, Platform: { OS: os } } });
  return { open: module.openBluetoothSettings, calls };
}

test('iPhone opens Settings > Bluetooth, falling back to the Settings app', async () => {
  const ok = settings('ios');
  assert.equal(await ok.open(), true);
  assert.deepEqual(ok.calls, [['openURL', 'App-Prefs:Bluetooth']]);
  const refused = settings('ios', { openURL: async () => { throw new Error('not allowed'); } });
  assert.equal(await refused.open(), true);
  assert.deepEqual(refused.calls, [['openURL', 'App-Prefs:Bluetooth'], ['openSettings']]);
});

test('Android opens Bluetooth settings through the system intent', async () => {
  const android = settings('android');
  assert.equal(await android.open(), true);
  assert.deepEqual(android.calls, [['sendIntent', 'android.settings.BLUETOOTH_SETTINGS']]);
});

test('web cannot open settings, so the screen shows the steps instead', async () => {
  const web = settings('web');
  assert.equal(await web.open(), false);
  assert.deepEqual(web.calls, []);
});

function screen(openBluetoothSettings, { session = { user: { id: 'kid' } }, inbox = {} } = {}) {
  const hooks = harness();
  const calls = [];
  const studio = { session, authLoading: false,
    inbox: { items: [], unheard: 0, loading: false, error: '', refresh: async () => { calls.push('refresh inbox'); }, ...inbox } };
  const module = load('src/app/bear.tsx', {
    react: hooks.react,
    'react/jsx-runtime': { jsx: (type, props) => ({ type, props }), jsxs: (type, props) => ({ type, props }) },
    'expo-router': { router: { replace: route => calls.push(route), push: route => calls.push(['push', route]) },
      useFocusEffect: fn => hooks.react.useEffect(fn, [fn]) },
    'react-native': { ActivityIndicator: 'ActivityIndicator', Text: 'Text', View: 'View' },
    '../components/inbox-list': { InboxList: 'InboxList' },
    '../context/studio': { useStudio: () => studio },
    '../components/shell': { Shell: 'Shell' },
    '../components/ui': { Body: 'Body', Button: 'Button', colors: {}, Heading: 'Heading', Icon: 'Icon' },
    '../services/bluetooth-settings': { openBluetoothSettings },
  });
  const nodes = node => !node || typeof node !== 'object' ? [] : Array.isArray(node) ? node.flatMap(nodes)
    : [node, ...nodes(node.props?.children)];
  const h = { calls, nodes: () => nodes(h.tree),
    render() { h.tree = hooks.render(module.default); return h; },
    button(title) { return nodes(h.tree).find(n => n.type === 'Button' && n.props.title === title).props; },
    text() { return JSON.stringify(h.tree); },
    async flush() { await tick(); h.render(); } };
  return h.render();
}

test('Connect TedTime Bear opens Bluetooth settings', async () => {
  let opened = 0;
  const h = screen(async () => { opened++; return true; });
  assert.match(h.text(), /Not connected/);
  assert.equal(h.button('Connect TedTime Bear').icon, 'bluetooth');
  h.button('Connect TedTime Bear').onPress(); await h.flush();
  assert.equal(opened, 1);
  assert.doesNotMatch(h.text(), /choose “TedTime Bear”/);
});

test('where settings cannot open, the screen explains what to do', async () => {
  const h = screen(async () => false);
  h.button('Connect TedTime Bear').onPress(); await h.flush();
  assert.match(h.text(), /Open Bluetooth settings on your phone/);
  const failing = screen(async () => { throw new Error('denied'); });
  failing.button('Connect TedTime Bear').onPress(); await failing.flush();
  assert.match(failing.text(), /Could not open Settings/);
});

test('Play on your bear links to your stories and the marketplace', () => {
  const h = screen(async () => true);
  const before = h.calls.length;
  h.button('Choose one of your stories').onPress();
  h.button('Find a story in the marketplace').onPress();
  assert.equal(h.calls[before], '/library');
  assert.equal(h.calls[before + 1].pathname, '/explore');
  assert.equal(h.calls[before + 1].params.tab, 'audio');
});

test('Sent to you lists stories from other people and refreshes on each visit', () => {
  const items = [{ shareId: 's1', id: 'a', title: 'The Dragon', senderName: 'Grandma Rose', listenedAt: null }];
  const h = screen(async () => true, { inbox: { items, unheard: 1 } });
  assert.ok(h.calls.includes('refresh inbox'));
  assert.match(h.text(), /Sent to you/);
  assert.match(h.text(), /\[1," new"\]/, 'shows the count of new stories');
  assert.equal(h.nodes().find(n => n.type === 'InboxList').props.items[0].title, 'The Dragon');
});

test('Sent to you explains itself when empty and asks signed-out users to sign in', () => {
  assert.match(screen(async () => true).text(), /When someone sends you a story/);
  const out = screen(async () => true, { session: null });
  assert.match(out.text(), /Sign in to see stories sent to you/);
  out.button('Sign in').onPress();
  assert.ok(out.calls.some(c => Array.isArray(c) && c[1] === '/auth'));
});
