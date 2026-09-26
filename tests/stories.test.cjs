const assert = require('node:assert/strict');
const { test } = require('node:test');
const { load, harness, tick, deferred } = require('./hook-harness.cjs');

const row = (owner, id = 'story-1') => ({ id, user_id: owner, creation_session_id: id, title: 'My story', status: 'draft' });
function setup(options = {}) {
  const hooks = harness();
  let owner = 'alice';
  const calls = [];
  const module = load('src/hooks/use-stories.ts', {
    react: hooks.react,
    '../lib/supabase': { supabase: {
      from(table) {
        assert.equal(table, 'all_stories');
        let user;
        const query = { select() { return query; }, eq(field, value) { assert.equal(field, 'user_id'); user = value; return query; },
          order() { return query; }, range(start, end) { calls.push({ user, start, end }); return options.list?.(user, start) ?? Promise.resolve({ data: [row(user)], error: null }); } };
        return query;
      },
      rpc(name, args) { calls.push({ name, args }); return options.save?.(args) ?? Promise.resolve({ data: { ...row(owner), status: args.p_publish ? 'published' : 'draft' }, error: null }); },
    } },
  });
  const h = { calls,
    render() { h.result = hooks.render(() => module.useStories(owner, false)); return h.result; },
    async flush() { await tick(); h.render(); },
    switchOwner(next) { owner = next; h.render(); },
  };
  h.render(); return h;
}

test('stories are paginated beyond the database row limit', async () => {
  const h = setup({ list: async (owner, start) => ({ data: start === 0 ? Array.from({ length: 500 }, (_, i) => row(owner, `${i}`)) : [row(owner, 'last')] }) });
  await h.flush();
  assert.equal(h.result.items.length, 501);
  assert.deepEqual(h.calls.map(c => c.start), [0, 500]);
});

test('a late previous-account response cannot expose its stories', async () => {
  const pending = deferred();
  const h = setup({ list: owner => owner === 'alice' ? pending.promise : Promise.resolve({ data: [row('bob')] }) });
  h.switchOwner('bob'); await h.flush();
  pending.resolve({ data: [row('alice')] }); await h.flush();
  assert.equal(h.result.items[0].user_id, 'bob');
  h.switchOwner(null);
  assert.equal(h.result.items.length, 0);
});

test('saving publishes the same story and ignores an older list response', async () => {
  const pending = deferred();
  const h = setup({ list: () => pending.promise });
  await h.result.save('story-1', ' My story ', true, ['moment-1']); await h.flush();
  assert.equal(h.result.items[0].status, 'published');
  assert.equal(h.calls.at(-1).args.p_title, 'My story');
  assert.equal(h.calls.at(-1).args.p_creation_session_id, 'story-1');
  pending.resolve({ data: [row('alice')] }); await h.flush();
  assert.equal(h.result.items[0].status, 'published');
});

test('failed saves preserve existing stories and can be retried', async () => {
  let fail = true;
  const h = setup({ save: async () => fail ? { error: new Error('offline') } : { data: row('alice') } });
  await h.flush();
  await assert.rejects(h.result.save('story-1', 'My story', false, []), /could not be saved/);
  h.render(); assert.equal(h.result.saving, false); assert.equal(h.result.items.length, 1);
  fail = false; await h.result.save('story-1', 'My story', false, []); await h.flush();
  assert.equal(h.result.items.length, 1);
});

test('duplicate saves are blocked and late saves do not enter another account', async () => {
  const pending = deferred(); const h = setup({ save: () => pending.promise }); await h.flush();
  const first = h.result.save('story-1', 'My story', true, ['moment-1']);
  await assert.rejects(h.result.save('story-1', 'My story', true, ['moment-1']), /already in progress/);
  h.switchOwner('bob'); await h.flush();
  pending.resolve({ data: row('alice') }); await first; await h.flush();
  assert.equal(h.result.items[0].user_id, 'bob');
});
