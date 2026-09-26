const assert = require('node:assert/strict');
const { test } = require('node:test');
const { load, harness } = require('./hook-harness.cjs');

test('Library combines all account stories and local drafts, filters status, and preserves bookmarks', () => {
  const hooks = harness();
  const studio = { stories: { items: [
    { id: 'draft', creation_session_id: 'draft', title: 'Draft one', status: 'draft', updated_at: '2026-09-25T00:00:00Z' },
    { id: 'published', creation_session_id: 'published', title: 'Published one', status: 'published', updated_at: '2026-09-26T00:00:00Z' },
  ], refresh() {} }, timeline: { projects: [{ id: 'draft', createdAt: '2026-09-25T00:00:00Z' }, { id: 'local', createdAt: '2026-09-24T00:00:00Z' }], refresh() {} },
    creations: [{ id: 'bookmark' }], saved: ['bookmark'], session: { user: { id: 'alice' } }, draft: { name: '' } };
  const module = load('src/app/library.tsx', {
    react: hooks.react, 'react/jsx-runtime': { jsx: (type, props) => ({ type, props }), jsxs: (type, props) => ({ type, props }) },
    'expo-router': { router: {}, useFocusEffect: fn => hooks.react.useEffect(fn, [fn]) },
    'react-native': Object.fromEntries(['ActivityIndicator', 'FlatList', 'Pressable', 'Text', 'View'].map(n => [n, n])),
    '../components/shell': { Shell: 'Shell' }, '../components/creation-card': { CreationCard: 'CreationCard' },
    '../components/ui': { Body: 'Body', Button: 'Button', colors: {}, Heading: 'Heading' },
    '../context/studio': { useStudio: () => studio }, '../hooks/use-story-draft': {},
  });
  const render = () => hooks.render(module.default).props.children.props;
  let list = render();
  assert.deepEqual(Array.from(list.data, item => item.id), ['published', 'draft', 'local']);
  assert.equal(list.data[2].local, true);
  assert.equal(list.ListFooterComponent.props.children[1][0].props.item.id, 'bookmark');
  const tabs = list.ListHeaderComponent.props.children[2].props.children;
  tabs[2].props.onPress(); list = render();
  assert.deepEqual(Array.from(list.data, item => item.id), ['published']);
  tabs[1].props.onPress(); list = render();
  assert.deepEqual(Array.from(list.data, item => item.id), ['draft', 'local']);
});
