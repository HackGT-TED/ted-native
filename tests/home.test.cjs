const assert = require('node:assert/strict');
const { test } = require('node:test');
const { load, harness } = require('./hook-harness.cjs');

function setup({ projects = [], marketplace = [], inbox = [] } = {}) {
  const hooks = harness();
  const calls = [];
  const studio = {
    timeline: { ready: true, projects, diskError: '' }, recorder: { phase: 'idle' }, name: 'Rose', authLoading: false,
    stories: { items: [{ creation_session_id: 'p1', title: 'The Dragon' }] },
    openStory: (id, record) => calls.push(['open', id, record]),
    session: { user: { id: 'kid' } }, inbox: { items: inbox, unheard: inbox.filter(i => !i.listenedAt).length },
  };
  const router = { push: route => calls.push(['push', route]), replace: route => calls.push(['replace', route]) };
  const module = load('src/app/index.tsx', {
    react: hooks.react,
    'react/jsx-runtime': { jsx: (type, props) => ({ type, props }), jsxs: (type, props) => ({ type, props }) },
    'expo-router': { router, useFocusEffect: fn => hooks.react.useEffect(fn, [fn]) },
    'react-native': Object.fromEntries(['ActivityIndicator', 'Pressable', 'Text', 'View'].map(n => [n, n])),
    '../components/shell': { Shell: 'Shell' },
    '../components/audio-story-grid': { AudioStoryGrid: 'AudioStoryGrid' },
    '../components/inbox-list': { InboxList: 'InboxList' },
    '../components/ui': { Body: 'Body', Button: 'Button', colors: {}, Heading: 'Heading', Icon: 'Icon' },
    '../context/studio': { useStudio: () => studio },
    '../hooks/use-marketplace-stories': { useMarketplaceStories: () => ({ items: marketplace, loading: false, error: '', refresh() {} }) },
    '../utils/recordings': { formatRecordingDay: () => 'Today',
      newProjectId: () => '11111111-2222-4333-8444-555555555555' },
  });
  const nodes = node => !node || typeof node !== 'object' ? [] : Array.isArray(node) ? node.flatMap(nodes)
    : [node, ...nodes(node.props?.children)];
  const tree = hooks.render(module.default);
  // SectionHeader is a component: expand it so its links are reachable.
  const expand = node => !node || typeof node !== 'object' ? node : Array.isArray(node) ? node.map(expand)
    : typeof node.type === 'function' ? expand(node.type(node.props))
      : { ...node, props: { ...node.props, children: expand(node.props?.children) } };
  const all = nodes(expand(tree));
  return { calls, all, text: () => JSON.stringify(expand(tree)),
    byLabel: label => all.find(n => n.props?.accessibilityLabel === label)?.props,
    link: title => all.find(n => n.props?.accessibilityRole === 'link' && JSON.stringify(n).includes(title))?.props,
    grid: () => all.find(n => n.type === 'AudioStoryGrid')?.props };
}

const project = (id, n) => ({ id, createdAt: `2026-09-2${n}T00:00:00Z`, moments: n });

test('Tap to record starts a new story and opens Create recording', () => {
  const h = setup();
  h.byLabel('Tap to record a new story').onPress();
  assert.equal(h.calls[0][0], 'open');
  assert.match(h.calls[0][1], /^[0-9a-f-]{36}$/);
  assert.equal(h.calls[0][2], true);
  assert.deepEqual(h.calls[1], ['push', '/create']);
});

test('Pick up where you left off shows the three newest stories by name and reopens them', () => {
  const h = setup({ projects: [project('p1', 4), project('p2', 3), project('p3', 2), project('p4', 1)] });
  assert.ok(h.byLabel('Continue The Dragon'), 'saved title is used');
  assert.ok(h.byLabel('Continue Story 3'));
  assert.ok(h.byLabel('Continue Story 2'));
  assert.equal(h.byLabel('Continue Story 1'), undefined, 'only three are shown');
  h.byLabel('Continue Story 3').onPress();
  assert.deepEqual(h.calls[0], ['open', 'p2', false]);
  h.link('See all').onPress();
  assert.ok(h.calls.some(c => c[0] === 'replace' && c[1] === '/library'));
});

test('with no recordings the section explains itself', () => {
  assert.match(setup().text(), /Your recordings will show up here/);
});

test('Explore shows four marketplace stories and opens the marketplace on Audio Stories', () => {
  const stories = ['a', 'b', 'c', 'd', 'e'].map(id => ({ id }));
  const h = setup({ marketplace: stories });
  assert.deepEqual(Array.from(h.grid().stories, s => s.id), ['a', 'b', 'c', 'd']);
  const open = h.all.find(n => n.type === 'Button' && n.props.title === 'See more').props;
  open.onPress();
  const replace = h.calls.find(c => c[0] === 'replace')[1];
  assert.equal(replace.pathname, '/explore');
  assert.equal(replace.params.tab, 'audio');
});

test('Sent to you previews the newest two stories and links to the Bear tab', () => {
  const inbox = ['a', 'b', 'c'].map((id, i) => ({ shareId: id, id, title: id, listenedAt: i ? 'x' : null }));
  const h = setup({ inbox });
  assert.match(h.text(), /Sent to you \(1 new\)/);
  assert.deepEqual(Array.from(h.all.find(n => n.type === 'InboxList').props.items, s => s.id), ['a', 'b']);
  h.all.filter(n => n.props?.accessibilityRole === 'link' && JSON.stringify(n).includes('See all'))[0].props.onPress();
  assert.ok(h.calls.some(c => c[0] === 'replace' && c[1] === '/bear'));
  assert.doesNotMatch(setup().text(), /Sent to you/, 'hidden when nothing was sent');
});
