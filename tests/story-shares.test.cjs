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
  const community = load('src/hooks/use-community-stories.ts', { react: hooks.react, '../lib/supabase': { supabase: null } });
  const supabase = {
    rpc: async name => { calls.push(['rpc', name]); return { data: rows, error: null }; },
    channel(name) { calls.push(['channel', name]);
      const ch = { on(event, filter, handler) { calls.push(['on', filter]); supabase.onInsert = handler; return ch; }, subscribe() { return ch; } };
      return ch; },
    removeChannel: async () => { calls.push(['removeChannel']); },
    from(table) { assert.equal(table, 'story_shares');
      const q = { update(v) { calls.push(['update', v]); return q; }, eq(f, v) { calls.push(['eq', f, v]); return q; },
        is(f, v) { calls.push(['is', f, v]); return q; }, then(ok) { return Promise.resolve({ error: null }).then(ok); } };
      return q; },
  };
  const module = load('src/hooks/use-inbox.ts', { react: hooks.react, '../lib/supabase': { supabase }, './use-community-stories': community,
    'react-native': { AppState: { addEventListener: (_event, handler) => { supabase.onForeground = handler; return { remove() {} }; } } } });
  const h = { calls, supabase, render() { h.result = hooks.render(() => module.useInbox('kid', false)); return h.result; },
    async flush() { await tick(); h.render(); await tick(); h.render(); } };
  h.render(); return h;
}

const row = (id, listened = null) => ({ share_id: `share-${id}`, story_id: id, author_id: 'rose', sender_name: 'Grandma Rose',
  sent_at: '2026-09-26T00:00:00Z', listened_at: listened, title: `Story ${id}`, description: null, published_at: null,
  cover_image_path: null, stereo_audio_path: `rose/${id}/story.mp3`, duration_ms: 1000 });

test('the inbox loads stories with the sender name and counts the new ones', async () => {
  const h = inbox([row('a'), row('b', '2026-09-26T01:00:00Z')]); await h.flush();
  assert.deepEqual(h.calls.find(c => c[0] === 'rpc'), ['rpc', 'get_inbox']);
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

test('a newly sent story, or returning to the app, refreshes the inbox', async () => {
  const h = inbox([row('a')]); await h.flush();
  const on = h.calls.find(c => c[0] === 'on')[1];
  assert.equal(on.table, 'story_shares');
  assert.equal(on.event, 'INSERT');
  assert.equal(on.filter, 'recipient_id=eq.kid', 'only shares sent to this user');
  const before = h.calls.filter(c => c[0] === 'rpc').length;
  h.supabase.onInsert(); await h.flush();
  assert.equal(h.calls.filter(c => c[0] === 'rpc').length, before + 1);
  h.supabase.onForeground('active'); await h.flush();
  assert.equal(h.calls.filter(c => c[0] === 'rpc').length, before + 2);
});
