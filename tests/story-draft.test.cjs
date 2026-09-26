const assert = require('node:assert/strict');
const { test } = require('node:test');
const { load, harness, tick, deferred } = require('./hook-harness.cjs');

function setup(options = {}) {
  const hooks = harness();
  const stored = new Map();
  let owner = 'alice';
  const module = load('src/hooks/use-story-draft.ts', {
    react: hooks.react,
    '@react-native-async-storage/async-storage': {
      getItem: async key => options.read ? options.read(key) : stored.get(key) ?? null,
      setItem: async (key, name) => {
        await options.write;
        if (options.fail) throw new Error('Disk full');
        stored.set(key, name);
      },
    },
  });
  const h = { stored,
    render() { h.result = hooks.render(() => module.useStoryDraft(owner, false)); return h.result; },
    async flush() { await tick(); h.render(); },
    switchUser(id) { owner = id; h.render(); },
  };
  h.render(); return h;
}

test('rapid edits retain the latest name and restore it after switching accounts', async () => {
  const write = deferred(); const h = setup({ write: write.promise }); await h.flush();
  h.result.saveName('The'); h.result.saveName('The Little Bear');
  write.resolve(); await h.flush();
  assert.equal(h.result.name, 'The Little Bear');
  h.switchUser('bob'); await h.flush();
  assert.equal(h.result.name, '');
  h.switchUser('alice'); await h.flush();
  assert.equal(h.result.name, 'The Little Bear');
});

test('a delayed previous-account load cannot replace the current story name', async () => {
  const pending = deferred();
  const h = setup({ read: key => key.endsWith('alice') ? pending.promise : 'Bob’s story' });
  h.switchUser('bob'); await h.flush();
  pending.resolve('Alice’s story'); await h.flush();
  assert.equal(h.result.name, 'Bob’s story');
});

test('a failed save preserves the typed name and supports retry', async () => {
  const options = { fail: true }; const h = setup(options); await h.flush();
  h.result.saveName('A Bedtime Adventure'); await h.flush();
  assert.equal(h.result.name, 'A Bedtime Adventure');
  assert.match(h.result.error, /could not be saved/);
  options.fail = false; h.result.retry(); await h.flush();
  assert.equal(h.result.error, '');
  assert.equal(h.stored.get('tedtime.story-draft.v1.alice'), 'A Bedtime Adventure');
});
