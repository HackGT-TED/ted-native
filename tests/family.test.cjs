const assert = require('node:assert/strict');
const { test } = require('node:test');
const { load, harness, tick } = require('./hook-harness.cjs');

const jsx = { jsx: (type, props) => ({ type, props }), jsxs: (type, props) => ({ type, props }) };
const nodes = node => !node || typeof node !== 'object' ? [] : Array.isArray(node) ? node.flatMap(nodes)
  : [node, ...nodes(node.props?.children)];

const theRiveras = { id: 'f1', name: 'The Riveras', invite_code: 'ABC234', members: [
  { id: 'me', username: 'rose', full_name: 'Grandma Rose', is_me: true },
  { id: 'kid', username: 'teddy', full_name: 'Teddy', is_me: false },
] };

function familyHook(responses) {
  const hooks = harness();
  const calls = [];
  const module = load('src/hooks/use-family.ts', { react: hooks.react, '../lib/supabase': { supabase: {
    rpc: async (name, args) => { calls.push([name, args]); return responses[name]?.(args) ?? { data: null, error: null }; },
  } } });
  const h = { calls, render() { h.result = hooks.render(() => module.useFamily('me', false)); return h.result; },
    async flush() { await tick(); h.render(); } };
  h.render(); return h;
}

test('the family loads through get_my_family', async () => {
  const h = familyHook({ get_my_family: () => ({ data: theRiveras, error: null }) });
  await h.flush();
  assert.equal(h.calls[0][0], 'get_my_family');
  assert.equal(h.result.family.invite_code, 'ABC234');
  assert.equal(h.result.family.members.length, 2);
});

test('starting and joining a family replace the current one; leaving clears it', async () => {
  const h = familyHook({
    create_family: () => ({ data: theRiveras, error: null }),
    join_family: () => ({ data: { ...theRiveras, name: 'Joined' }, error: null }),
  });
  await h.flush();
  assert.equal(h.result.family, null);
  await h.result.create('  The Riveras '); h.render();
  assert.equal(h.calls.find(c => c[0] === 'create_family')[1].p_name, 'The Riveras', 'the name is trimmed');
  assert.equal(h.result.family.name, 'The Riveras');
  await h.result.join('abc-234'); h.render();
  assert.equal(h.calls.find(c => c[0] === 'join_family')[1].p_code, 'abc-234');
  assert.equal(h.result.family.name, 'Joined');
  await h.result.leave(); h.render();
  assert.equal(h.result.family, null);
});

test('bad input is rejected before any request, and database messages reach the user', async () => {
  const h = familyHook({ join_family: () => ({ data: null, error: { message: 'That code did not match a family. Check it and try again' } }) });
  await h.flush();
  await assert.rejects(h.result.create('  '), /Give your family a name/);
  await assert.rejects(h.result.join('AB'), /6-character code/);
  assert.equal(h.calls.some(c => c[0] !== 'get_my_family'), false);
  await assert.rejects(h.result.join('ZZZ999'), /did not match a family\./);
  const other = familyHook({ create_family: () => ({ data: null, error: { message: 'permission denied for table families' } }) });
  await other.flush();
  await assert.rejects(other.result.create('Us'), /Could not start your family/, 'technical errors stay hidden');
});

function card(family, { share } = {}) {
  const hooks = harness();
  const shared = [];
  const module = load('src/components/family-card.tsx', {
    react: hooks.react, 'react/jsx-runtime': jsx,
    'react-native': { ActivityIndicator: 'ActivityIndicator', Pressable: 'Pressable', Text: 'Text', TextInput: 'TextInput', View: 'View',
      Share: { share: async content => { shared.push(content); if (share) await share(); } } },
    './ui': { Button: 'Button', colors: {}, Icon: 'Icon' },
    '../context/studio': { useStudio: () => ({ family }) },
  });
  const h = { shared, render() { h.tree = hooks.render(module.FamilyCard); return h; },
    all() { return nodes(h.tree); }, text() { return JSON.stringify(h.tree); },
    button(title) { return h.all().find(n => n.type === 'Button' && n.props.title === title).props; },
    input(label) { return h.all().find(n => n.props?.accessibilityLabel === label).props; },
    async flush() { await tick(); h.render(); } };
  return h.render();
}

test('without a family, you can start one or join with a code', async () => {
  const calls = [];
  const family = { family: null, loading: false, error: '', busy: false,
    create: async name => { calls.push(['create', name]); }, join: async code => { calls.push(['join', code]); } };
  const h = card(family);
  assert.match(h.text(), /Start a family/);
  assert.match(h.text(), /Join with a code/);
  h.input('Family name').onChangeText('The Riveras'); h.render();
  h.button('Start a family').onPress(); await h.flush();
  h.input('Family invite code').onChangeText('abc234'); h.render();
  assert.equal(h.input('Family invite code').value, 'ABC234', 'codes are shown in capitals');
  h.button('Join family').onPress(); await h.flush();
  assert.deepEqual(calls, [['create', 'The Riveras'], ['join', 'ABC234']]);
});

test('in a family, the code can be shared and members are listed', () => {
  const h = card({ family: theRiveras, loading: false, error: '', busy: false });
  assert.match(h.text(), /ABC234/);
  assert.match(h.text(), /Grandma Rose/);
  assert.match(h.text(), /\(you\)/);
  h.button('Share code').onPress();
  assert.match(h.shared[0].message, /The Riveras/);
  assert.match(h.shared[0].message, /ABC234/);
});

test('leaving asks for a second tap first', async () => {
  let left = 0;
  const h = card({ family: theRiveras, loading: false, error: '', busy: false, leave: async () => { left++; } });
  const leaveButton = () => h.all().find(n => n.props?.accessibilityRole === 'button' && /The Riveras/.test(n.props.accessibilityLabel)).props;
  leaveButton().onPress(); h.render();
  assert.equal(left, 0);
  assert.match(leaveButton().accessibilityLabel, /Confirm leaving/);
  leaveButton().onPress(); await h.flush();
  assert.equal(left, 1);
});

test('Send to suggests family members and can add everyone at once', () => {
  const hooks = harness();
  const changes = [];
  const module = load('src/components/story-recipients.tsx', {
    react: hooks.react, 'react/jsx-runtime': jsx,
    'react-native': { ActivityIndicator: 'ActivityIndicator', Pressable: 'Pressable', Text: 'Text', TextInput: 'TextInput', View: 'View' },
    '../context/studio': { useStudio: () => ({ family: { family: { ...theRiveras, members: [...theRiveras.members,
      { id: 'pa', username: null, full_name: 'Grandpa', is_me: false }] } } }) },
    '../services/story-shares': { personName: p => p.full_name || p.username, searchPeople: async () => [] },
    './ui': { colors: {}, Icon: 'Icon' },
  });
  const all = () => nodes(hooks.render(() => module.StoryRecipients({ selected: [], onChange: people => changes.push(people) })));
  const labels = all().map(n => n.props?.accessibilityLabel).filter(Boolean);
  assert.ok(labels.includes('Send to Teddy'));
  assert.ok(labels.includes('Send to Grandpa'));
  assert.equal(labels.includes('Send to Grandma Rose'), false, 'you are not suggested');
  all().find(n => n.props?.accessibilityLabel === 'Send to Teddy').props.onPress();
  assert.deepEqual(Array.from(changes[0], p => p.id), ['kid']);
  all().find(n => JSON.stringify(n).includes('Send to everyone') && n.type === 'Pressable').props.onPress();
  assert.deepEqual(Array.from(changes[1], p => p.id), ['kid', 'pa']);
});
