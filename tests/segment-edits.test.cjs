const assert = require('node:assert/strict');
const { test } = require('node:test');
const { load } = require('./hook-harness.cjs');
const segment = { id: 'my-segment', userId: 'owner', title: 'A special moment', creationSessionId: null,
  createdAt: '2026-09-26T12:00:00Z', durationMs: 1200, order: 1, storagePath: 'owner/take.m4a' };
function setup(options = {}) {
  const calls = [];
  let requests = 0;
  const query = {
    upsert: (row, config) => { calls.push(['upsert', row, config]); return query; },
    update: fields => { calls.push(['update', fields]); return query; },
    eq: (...args) => { calls.push(['eq', ...args]); return query; },
    is: (...args) => { calls.push(['is', ...args]); return query; },
    select: () => query,
    abortSignal: async () => options.responses?.[requests++] ?? ({ data: options.noRow ? [] : [{ id: segment.id }], error: options.error }),
  };
  const { syncSegmentChange } = load('src/services/edit-recording-segment.ts', {
    '../lib/supabase': { supabase: {
      auth: { getSession: async () => ({ data: { session: { user: { id: options.owner ?? 'owner' } } } }) },
      from: () => query,
    } },
  }, { AbortSignal });
  return { sync: syncSegmentChange, calls };
}

test('rename changes only the title of the owner’s nondeleted segment', async () => {
  const h = setup(); await h.sync(segment);
  assert.equal(h.calls[0][0], 'update');
  assert.deepEqual(Object.keys(h.calls[0][1]), ['title']);
  assert.ok(h.calls.some(call => call[0] === 'eq' && call[1] === 'user_id' && call[2] === 'owner'));
  assert.ok(h.calls.some(call => call[0] === 'eq' && call[1] === 'id' && call[2] === segment.id));
  assert.ok(h.calls.some(call => call[0] === 'is' && call[1] === 'deleted_at' && call[2] === null));
});

test('deletion records a stable marker even without a confirmed uploaded path', async () => {
  const h = setup(); const deletedAt = '2026-09-26T13:00:00Z';
  await h.sync({ ...segment, storagePath: undefined, deletedAt });
  const [, row, config] = h.calls[0];
  assert.equal(row.id, segment.id); assert.equal(row.deleted_at, deletedAt);
  assert.equal(row.storage_path, null); assert.equal(config.onConflict, 'user_id,id');
});

test('account mismatch and missing rows never report successful edits', async () => {
  const wrongOwner = setup({ owner: 'someone-else' });
  await assert.rejects(wrongOwner.sync(segment), /account that owns/);
  assert.equal(wrongOwner.calls.length, 0);
  const missing = setup({ noRow: true });
  await assert.rejects(missing.sync(segment), /could not sync/);
});


test('reordering updates position without overwriting a remotely renamed title', async () => {
  const h = setup(); await h.sync({ ...segment, pendingChange: 'reorder', order: 2048 });
  assert.deepEqual(Object.keys(h.calls[0][1]), ['position']);
  assert.equal(h.calls[0][1].position, 2048);
});

test('combined name and order changes are written together', async () => {
  const h = setup(); await h.sync({ ...segment, pendingChange: 'edit', order: 2048 });
  assert.equal(h.calls[0][1].title, segment.title);
  assert.equal(h.calls[0][1].position, 2048);
});

test('position zero is saved when a segment moves to the start', async () => {
  const h = setup(); await h.sync({ ...segment, pendingChange: 'reorder', order: 0 });
  assert.equal(h.calls[0][1].position, 0);
});

test('sync failures identify permission, schema, and validation errors without exposing row details', async () => {
  for (const [code, expected] of [['42501', /permission/], ['42703', /database update/],
    ['23514', /rejected/], ['23505', /conflicts/], ['22003', /position/], ['PGRST301', /sign in again/]]) {
    const h = setup({ error: { code, message: 'Private title and row details' } });
    await assert.rejects(h.sync({ ...segment, pendingChange: 'reorder' }), error => {
      assert.match(error.message, expected);
      assert.ok(error.message.includes(code));
      assert.ok(!error.message.includes('Private title'));
      return true;
    });
  }
});

test('a silently denied update is distinguished from a missing or deleted segment', async () => {
  for (const [rows, expected] of [[[], /missing from your account/], [[{ id: segment.id }], /cannot update/],
    [[{ id: segment.id, deleted_at: '2026-09-26T12:00:00Z' }], /was deleted/]]) {
    const h = setup({ responses: [{ data: [], error: null }, { data: rows, error: null }] });
    await assert.rejects(h.sync({ ...segment, pendingChange: 'reorder' }), expected);
    assert.equal(h.calls.filter(call => call[0] === 'update').length, 1);
    assert.equal(h.calls.filter(call => call[0] === 'upsert').length, 0);
  }
});
