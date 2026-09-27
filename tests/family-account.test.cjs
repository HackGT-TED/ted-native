const assert = require('node:assert/strict');
const { test } = require('node:test');
const { load, harness, tick } = require('./hook-harness.cjs');

const jsx = { jsx: (type, props) => ({ type, props }), jsxs: (type, props) => ({ type, props }) };
const nodes = node => !node || typeof node !== 'object' ? [] : Array.isArray(node) ? node.flatMap(nodes)
  : [node, ...nodes(node.props?.children)];
const render = node => typeof node?.type === 'function' ? render(node.type(node.props))
  : !node || typeof node !== 'object' ? node : Array.isArray(node) ? node.map(render)
    : { ...node, props: { ...node.props, children: render(node.props?.children) } };

test('Family lists stories sent to you and refreshes each visit', () => {
  const hooks = harness();
  let refreshed = 0;
  const items = [{ shareId: 's1', id: 'a', title: 'The Dragon', listenedAt: null }];
  const module = load('src/app/family.tsx', {
    react: hooks.react, 'react/jsx-runtime': jsx,
    'expo-router': { useFocusEffect: fn => hooks.react.useEffect(fn, [fn]) },
    'react-native': { ActivityIndicator: 'ActivityIndicator', Text: 'Text', View: 'View' },
    '../components/shell': { Shell: 'Shell' }, '../components/inbox-list': { InboxList: 'InboxList' },
    '../components/family-card': { FamilyCard: 'FamilyCard' },
    '../components/ui': { Body: 'Body', Button: 'Button', colors: {}, Heading: 'Heading' },
    '../context/studio': { useStudio: () => ({ inbox: { items, unheard: 1, loading: false, error: '', refresh: async () => { refreshed++; } },
      family: { refresh: async () => { refreshed++; } } }) },
  });
  const tree = hooks.render(module.default);
  assert.equal(refreshed, 2, 'both the inbox and the family refresh');
  assert.ok(nodes(tree).some(n => n.type === 'FamilyCard'), 'the family card is at the top');
  assert.equal(nodes(tree).find(n => n.type === 'InboxList').props.items[0].title, 'The Dragon');
  assert.match(JSON.stringify(tree), /\[1," new"\]/);
});

test('Family explains itself when nothing has been sent', () => {
  const hooks = harness();
  const module = load('src/app/family.tsx', {
    react: hooks.react, 'react/jsx-runtime': jsx,
    'expo-router': { useFocusEffect: () => {} },
    'react-native': { ActivityIndicator: 'ActivityIndicator', Text: 'Text', View: 'View' },
    '../components/shell': { Shell: 'Shell' }, '../components/inbox-list': { InboxList: 'InboxList' },
    '../components/family-card': { FamilyCard: 'FamilyCard' },
    '../components/ui': { Body: 'Body', Button: 'Button', colors: {}, Heading: 'Heading' },
    '../context/studio': { useStudio: () => ({ inbox: { items: [], unheard: 0, loading: false, error: '', refresh: async () => {} },
      family: { refresh: async () => {} } }) },
  });
  assert.match(JSON.stringify(hooks.render(module.default)), /No stories yet/);
});

function accountPage(openBluetoothSettings) {
  const hooks = harness();
  const module = load('src/app/account.tsx', {
    react: hooks.react, 'react/jsx-runtime': jsx,
    'react-native': { Text: 'Text', View: 'View' },
    '../components/shell': { Shell: 'Shell' }, '../components/Account': { default: 'AccountForm', __esModule: true },
    '../components/ui': { Body: 'Body', Button: 'Button', colors: {}, Heading: 'Heading', Icon: 'Icon' },
    '../context/studio': { useStudio: () => ({ session: { user: { id: 'u1', email: 'rose@example.com' } }, name: 'Rose' }) },
    '../services/bluetooth-settings': { openBluetoothSettings },
  });
  const h = { render() { h.tree = render(hooks.render(module.default)); return h; },
    all() { return nodes(h.tree); }, async flush() { await tick(); h.render(); } };
  return h.render();
}

test('Account is a page with the profile form and a compact bear connection', async () => {
  let opened = 0;
  const h = accountPage(async () => { opened++; return true; });
  const form = h.all().find(n => n.type === 'AccountForm');
  assert.equal(form.props.userId, 'u1');
  assert.equal(form.props.email, 'rose@example.com');
  assert.match(JSON.stringify(h.tree), /TedTime Bear/);
  assert.match(JSON.stringify(h.tree), /Not connected/);
  const connect = h.all().find(n => n.type === 'Button' && n.props.title === 'Connect TedTime Bear');
  assert.equal(connect.props.icon, 'bluetooth');
  connect.props.onPress(); await h.flush();
  assert.equal(opened, 1);
});

test('Account explains what to do when settings cannot open', async () => {
  const h = accountPage(async () => false);
  h.all().find(n => n.type === 'Button').props.onPress(); await h.flush();
  assert.match(JSON.stringify(h.tree), /choose “TedTime Bear”/);
});

function shell(unheard) {
  const hooks = harness();
  const calls = [];
  const module = load('src/components/shell.tsx', {
    react: hooks.react, 'react/jsx-runtime': jsx,
    'react-native': { Pressable: 'Pressable', ScrollView: 'ScrollView', Text: 'Text', View: 'View', useWindowDimensions: () => ({ width: 390 }) },
    'expo-router': { router: { replace: r => calls.push(['replace', r]), push: r => calls.push(['push', r]) }, usePathname: () => '/' },
    'react-native-safe-area-context': { SafeAreaView: 'SafeAreaView' },
    './ui': { colors: {}, Icon: 'Icon' },
    '../context/studio': { useStudio: () => ({ name: 'Rose', inbox: { unheard } }) },
    'react-native-reanimated': { __esModule: true, default: { View: 'AnimatedView' },
      useAnimatedStyle: fn => fn(), useSharedValue: v => ({ value: v }), withTiming: v => v },
  });
  const tree = hooks.render(() => module.Shell({ children: null }));
  return { calls, tabs: nodes(tree).filter(n => n.props?.accessibilityRole === 'tab'), all: nodes(tree) };
}

test('the bottom bar has Family in the middle and no Bear tab', () => {
  const { tabs } = shell(0);
  const titles = tabs.map(tab => nodes(tab).find(n => n.type === 'Text').props.children);
  // 'Read' is the temporary read-along test tab; remove it here when the tab goes.
  assert.deepEqual(titles, ['Home', 'Create', 'Family', 'Explore', 'Library', 'Read']);
});

test('Family shows a red dot while stories are waiting, and Account opens its page', () => {
  const quiet = shell(0);
  const busy = shell(2);
  const family = t => t.tabs.find(tab => tab.props.accessibilityLabel.startsWith('Family'));
  assert.equal(family(quiet).props.accessibilityLabel, 'Family');
  assert.equal(nodes(family(quiet)).some(n => /bg-rust/.test(n.props?.className ?? '')), false);
  assert.equal(family(busy).props.accessibilityLabel, 'Family, 2 new stories');
  assert.equal(nodes(family(busy)).some(n => /bg-rust/.test(n.props?.className ?? '')), true);
  busy.all.find(n => n.props?.accessibilityLabel === 'Account').props.onPress();
  assert.deepEqual(busy.calls.at(-1), ['push', '/account']);
});
