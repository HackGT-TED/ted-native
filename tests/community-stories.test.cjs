const assert = require('node:assert/strict');
const { test } = require('node:test');
const { load, harness, tick, deferred } = require('./hook-harness.cjs');

const row = (id, extra = {}) => ({ id, title: `Story ${id}`, description: 'A tale.', published_at: '2026-09-26T00:00:00Z', cover_image_path: null, ...extra });

function setup({ list, sign, authLoading = false } = {}) {
  const hooks = harness();
  const calls = { filters: [], signed: [] };
  const module = load('src/hooks/use-community-stories.ts', {
    react: hooks.react,
    '../lib/supabase': { supabase: {
      from(table) {
        assert.equal(table, 'all_stories');
        const query = { select() { return query; }, eq(field, value) { calls.filters.push([field, value]); return query; },
          order() { return query; }, limit() { return list?.() ?? Promise.resolve({ data: [row('a')], error: null }); } };
        return query;
      },
      storage: { from(bucket) { assert.equal(bucket, 'recordings');
        return { createSignedUrls: async paths => { calls.signed.push(paths); return sign?.(paths) ?? { data: paths.map(path => ({ path, signedUrl: `https://signed/${path}` })) }; } }; } },
    } },
  });
  const h = { calls, authLoading,
    render() { h.result = hooks.render(() => module.useCommunityStories(h.authLoading)); return h.result; },
    async flush() { await tick(); h.render(); },
  };
  h.render(); return h;
}

test('only published community stories are requested and mapped for tiles', async () => {
  const h = setup({ list: async () => ({ data: [row('a'), row('b', { description: null, cover_image_path: 'u/b/cover.jpg' })], error: null }) });
  await h.flush();
  assert.deepEqual(h.calls.filters, [['marketplace_visible', true], ['visibility', 'published']]);
  assert.equal(h.result.items.length, 2);
  assert.equal(JSON.stringify(h.result.items[0]), JSON.stringify({ id: 'a', title: 'Story a', description: 'A tale.', publishedAt: '2026-09-26T00:00:00Z', coverUrl: null }));
  assert.equal(h.result.items[1].description, '');
  assert.equal(h.result.items[1].coverUrl, 'https://signed/u/b/cover.jpg');
  assert.deepEqual(h.calls.signed, [['u/b/cover.jpg']]);
});

test('a cover that cannot be signed falls back to the placeholder', async () => {
  const h = setup({ list: async () => ({ data: [row('a', { cover_image_path: 'u/a/c.jpg' })], error: null }), sign: () => { throw new Error('denied'); } });
  await h.flush();
  assert.equal(h.result.items[0].coverUrl, null);
  assert.equal(h.result.error, '');
});

test('the community loads for everyone once the session is known', async () => {
  const h = setup({ authLoading: true }); await h.flush();
  assert.deepEqual(h.calls.filters, [], 'waits while the session is restored');
  h.authLoading = false; h.render(); await h.flush();
  assert.deepEqual(h.calls.filters, [['marketplace_visible', true], ['visibility', 'published']]);
  assert.equal(h.result.items.length, 1);
});

test('failures show a retryable error and a late response cannot overwrite a newer one', async () => {
  let fail = true;
  const h = setup({ list: async () => fail ? { error: new Error('offline') } : { data: [row('a')], error: null } });
  await h.flush();
  assert.match(h.result.error, /Could not load audio stories/);
  fail = false; await h.result.refresh(); await h.flush();
  assert.equal(h.result.error, ''); assert.equal(h.result.items.length, 1);
  const pending = deferred();
  let first = true;
  const late = setup({ list: () => { if (first) { first = false; return pending.promise; } return Promise.resolve({ data: [row('fresh')], error: null }); } });
  await late.result.refresh(); await late.flush();
  pending.resolve({ data: [row('stale')], error: null }); await late.flush();
  assert.deepEqual(Array.from(late.result.items, item => item.id), ['fresh']);
});
