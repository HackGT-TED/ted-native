const assert = require('node:assert/strict');
const { test } = require('node:test');
const { load, harness, tick } = require('./hook-harness.cjs');

function service(supabase) {
  return load('src/services/story-shares.ts', { '../lib/supabase': { supabase } });
}

test('searching needs two characters and returns names only', async () => {
  const calls = [];
  const s = service({ rpc: async (name, args) => { calls.push([name, args]); return { data: [{ id: 'rose', username: 'rose', full_name: 'Grandma Rose' }], error: null }; } });
  assert.equal((await s.searchPeople(' r ')).length, 0);
  assert.equal(calls.length, 0);
  const people = await s.searchPeople('  ro ');
  assert.equal(calls[0][0], 'search_profiles');
  assert.equal(calls[0][1].p_query, 'ro');
  assert.equal(s.personName(people[0]), 'Grandma Rose');
  assert.equal(s.personName({ id: 'x', username: 'ted', full_name: ' ' }), 'ted');
});

test('sending creates one share per person and ignores repeats', async () => {
  let sent;
  const s = service({ from(table) { assert.equal(table, 'story_shares');
    return { upsert: async (rows, options) => { sent = { rows, options }; return { error: null }; } }; } });
  await s.sendStory('story-1', ['rose', 'ted']);
  assert.equal(JSON.stringify(sent.rows), JSON.stringify([{ story_id: 'story-1', recipient_id: 'rose' }, { story_id: 'story-1', recipient_id: 'ted' }]));
  assert.equal(sent.options.ignoreDuplicates, true);
  const failing = service({ from: () => ({ upsert: async () => ({ error: new Error('denied') }) }) });
  await assert.rejects(failing.sendStory('story-1', ['rose']), /published, but it could not be sent/);
});

function inbox(rows) {
  const hooks = harness();
  const calls = [];
  const marketplace = load('src/hooks/use-marketplace-stories.ts', { react: hooks.react, '../lib/supabase': { supabase: null } });
  const supabase = {
    rpc: async name => { calls.push(['rpc', name]); return { data: rows, error: null }; },
    from(table) { assert.equal(table, 'story_shares');
      const q = { update(v) { calls.push(['update', v]); return q; }, eq(f, v) { calls.push(['eq', f, v]); return q; },
        is(f, v) { calls.push(['is', f, v]); return q; }, then(ok) { return Promise.resolve({ error: null }).then(ok); } };
      return q; },
  };
  const module = load('src/hooks/use-inbox.ts', { react: hooks.react, '../lib/supabase': { supabase }, './use-marketplace-stories': marketplace });
  const h = { calls, render() { h.result = hooks.render(() => module.useInbox('kid', false)); return h.result; },
    async flush() { await tick(); h.render(); await tick(); h.render(); } };
  h.render(); return h;
}

const row = (id, listened = null) => ({ share_id: `share-${id}`, story_id: id, author_id: 'rose', sender_name: 'Grandma Rose',
  sent_at: '2026-09-26T00:00:00Z', listened_at: listened, title: `Story ${id}`, description: null, published_at: null,
  cover_image_path: null, stereo_audio_path: `rose/${id}/story.mp3`, duration_ms: 1000 });

test('the inbox loads stories with the sender name and counts the new ones', async () => {
  const h = inbox([row('a'), row('b', '2026-09-26T01:00:00Z')]); await h.flush();
  assert.deepEqual(h.calls[0], ['rpc', 'get_inbox']);
  assert.equal(h.result.items.length, 2);
  assert.equal(h.result.items[0].senderName, 'Grandma Rose');
  assert.equal(h.result.items[0].audioPath, 'rose/a/story.mp3');
  assert.equal(h.result.unheard, 1);
});

test('playing a story clears its new dot right away and records it once', async () => {
  const h = inbox([row('a')]); await h.flush();
  h.result.markListened('share-a'); h.render();
  assert.equal(h.result.unheard, 0);
  assert.ok(h.calls.some(c => c[0] === 'eq' && c[1] === 'id' && c[2] === 'share-a'));
  assert.ok(h.calls.some(c => c[0] === 'eq' && c[1] === 'recipient_id' && c[2] === 'kid'));
  assert.ok(h.calls.some(c => c[0] === 'is' && c[1] === 'listened_at' && c[2] === null));
});
