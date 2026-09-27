const assert = require('node:assert/strict');
const { test } = require('node:test');
const { load, harness } = require('./hook-harness.cjs');

function setup(items) {
  const hooks = harness();
  const studio = { stories: { items, refresh() {} },
    timeline: { projects: [{ id: 'draft', createdAt: '2026-09-25T00:00:00Z' }, { id: 'local', createdAt: '2026-09-24T00:00:00Z' }], refresh() {} },
    creations: [{ id: 'bookmark' }], saved: ['bookmark'], session: { user: { id: 'alice' } }, draft: { name: '' },
    savedStories: { items: [{ id: 'saved-audio', title: 'Rainy night' }], error: '', refresh() {} } };
  const module = load('src/app/library.tsx', {
    react: hooks.react, 'react/jsx-runtime': { jsx: (type, props) => ({ type, props }), jsxs: (type, props) => ({ type, props }) },
    'expo-router': { router: {}, useFocusEffect: fn => hooks.react.useEffect(fn, [fn]) },
    'react-native': Object.fromEntries(['ActivityIndicator', 'FlatList', 'Pressable', 'Text', 'View'].map(n => [n, n])),
    '../components/shell': { Shell: 'Shell' }, '../components/creation-card': { CreationCard: 'CreationCard' },
    '../components/audio-story-grid': { AudioStoryGrid: 'AudioStoryGrid' },
    '../components/ui': { Body: 'Body', Button: 'Button', colors: {}, Heading: 'Heading' },
    '../context/studio': { useStudio: () => studio }, '../hooks/use-story-draft': {},
    '../hooks/use-library-tab': { useLibraryTab: (_tabs, fallback) => {
      const [tab, select] = hooks.react.useState(fallback);
      return { tab, select };
    } },
  });
  const nodes = node => !node || typeof node !== 'object' ? [] : Array.isArray(node) ? node.flatMap(nodes)
    : [node, ...nodes(node.props?.children)];
  const h = {
    render() { h.list = hooks.render(module.default).props.children.props; return h; },
    ids() { return Array.from(h.list.data, item => item.id); },
    tab(title) { return nodes(h.list.ListHeaderComponent).find(n => n.props?.accessibilityRole === 'tab' && n.props.accessibilityLabel.startsWith(title)).props; },
    select(title) { h.tab(title).onPress(); return h.render(); },
  };
  return h.render();
}

const story = (id, status, marketplace, updated) => ({ id, creation_session_id: id, title: id, status, marketplace, updated_at: updated });
const mixed = () => setup([
  story('draft', 'draft', false, '2026-09-25T00:00:00Z'),
  story('public', 'published', true, '2026-09-26T00:00:00Z'),
  story('private', 'published', false, '2026-09-27T00:00:00Z'),
]);

test('Library opens on Drafts and each tab shows only its own stories', () => {
  const h = mixed();
  assert.equal(h.tab('Drafts').accessibilityState.selected, true);
  assert.deepEqual(h.ids(), ['draft', 'local'], 'drafts on this device are included');
  assert.equal(h.tab('Drafts').accessibilityLabel, 'Drafts, 2 stories');
  assert.equal(h.tab('Public').accessibilityLabel, 'Public, 1 story');
  h.select('Public');
  assert.deepEqual(h.ids(), ['public']);
  assert.equal(h.tab('Public').accessibilityState.selected, true);
  assert.equal(h.tab('Drafts').accessibilityState.selected, false);
  h.select('Private');
  assert.deepEqual(h.ids(), ['private']);
});

test('an empty tab explains itself, and only Drafts offers to create a story', () => {
  const h = setup([]);
  h.select('Public');
  const empty = JSON.stringify(h.list.ListEmptyComponent);
  assert.match(empty, /Nothing public yet/);
  assert.doesNotMatch(empty, /Create a story/);
  h.select('Private');
  assert.match(JSON.stringify(h.list.ListEmptyComponent), /No private stories yet/);
  assert.match(JSON.stringify(h.list.ListHeaderComponent), /Published, but not in the marketplace/);
});

test('saved stories stay below the list on every tab', () => {
  const h = mixed().select('Public');
  const [savedAudio, bookmarks] = h.list.ListFooterComponent.props.children;
  assert.equal(savedAudio.props.children[2].props.stories[0].id, 'saved-audio');
  assert.equal(bookmarks.props.children[1][0].props.item.id, 'bookmark');
});
