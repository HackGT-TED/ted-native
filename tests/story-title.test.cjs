const assert = require('node:assert/strict');
const { test } = require('node:test');
const { load, harness } = require('./hook-harness.cjs');

function setup() {
  const hooks = harness();
  const saved = [];
  const draft = { name: 'The Little Bear', loading: false, editable: true, saving: false, error: '',
    saveName(name) { saved.push(name); draft.name = name; }, retry() { saved.push('retry'); } };
  const module = load('src/components/story-title.tsx', {
    react: hooks.react,
    'react/jsx-runtime': { jsx: (type, props) => ({ type, props }), jsxs: (type, props) => ({ type, props }) },
    'react-native': { Pressable: 'Pressable', Text: 'Text', TextInput: 'TextInput', View: 'View' },
    '../context/studio': { useStudio: () => ({ draft }) },
    './ui': { colors: {} }, './loading-skeleton': { LoadingSkeleton: 'LoadingSkeleton' },
  });
  const nodes = node => !node || typeof node !== 'object' ? [] : Array.isArray(node) ? node.flatMap(nodes)
    : [node, ...nodes(node.props?.children)];
  const h = { draft, saved,
    render(disabled = false) { h.tree = hooks.render(() => module.StoryTitle({ disabled })); return h; },
    find(type) { return nodes(h.tree).find(node => node.type === type)?.props; },
  };
  return h.render();
}

test('the title replaces the persistent input and holding opens editing; Done saves the displayed name', () => {
  const h = setup();
  assert.equal(h.find('TextInput'), undefined);
  assert.match(JSON.stringify(h.tree), /The Little Bear/);
  h.find('Pressable').onLongPress(); h.render();
  const input = h.find('TextInput');
  assert.equal(input.value, 'The Little Bear');
  assert.equal(input.autoFocus, true);
  assert.equal(input.selectTextOnFocus, true);
  input.onChangeText('A New Adventure'); h.render();
  h.find('TextInput').onSubmitEditing(); h.render();
  assert.equal(h.find('TextInput'), undefined);
  assert.match(JSON.stringify(h.tree), /A New Adventure/);
  assert.deepEqual(h.saved, ['A New Adventure']);
});

test('unnamed stories have a title, accessibility can open editing, and blur closes it', () => {
  const h = setup(); h.draft.name = ''; h.render();
  assert.match(JSON.stringify(h.tree), /Untitled story/);
  h.find('Pressable').onAccessibilityAction({ nativeEvent: { actionName: 'activate' } }); h.render();
  assert.equal(h.find('TextInput').value, '');
  h.find('TextInput').onBlur(); h.render();
  assert.equal(h.find('TextInput'), undefined);
});

test('recording and unavailable drafts prevent editing; save errors retain the title and retry', () => {
  const h = setup(); h.render(true);
  assert.equal(h.find('Pressable').disabled, true);
  h.find('Pressable').onLongPress(); h.render(true);
  assert.equal(h.find('TextInput'), undefined);
  h.draft.editable = false; h.render();
  assert.equal(h.find('Pressable').disabled, true);
  h.draft.loading = true; h.render();
  assert.ok(h.find('LoadingSkeleton'));
  h.draft.loading = false; h.draft.editable = true; h.draft.error = 'Could not save title'; h.render();
  assert.match(JSON.stringify(h.tree), /The Little Bear/);
  assert.match(JSON.stringify(h.tree), /Could not save title/);
  const retry = h.tree.props.children.find(node => node?.type === 'View').props.children.find(node => node?.type === 'Pressable');
  retry.props.onPress();
  assert.deepEqual(h.saved, ['retry']);
});
