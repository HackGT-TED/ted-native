const assert = require('node:assert/strict');
const { test } = require('node:test');
const { load, harness, tick, deferred } = require('./hook-harness.cjs');
const utils = load('src/utils/recordings.ts', {});
const capture = { uri: 'file:///moment.m4a', title: 'A memory', duration: 1234, recordedAt: '2026-09-26T12:00:00Z' };
const cached = (id, userId = 'owner', status = 'local') => ({
  id, userId, creationSessionId: null, localUri: `file:///${id}.m4a`,
  title: 'A memory', durationMs: 1200, createdAt: '2026-09-26T12:00:00Z', order: 1, status,
});
function setup(options = {}) {
  const hooks = harness();
  let projectId = null;
  let owner = options.owner === undefined ? 'owner' : options.owner;
  let storage = JSON.stringify(options.cache ?? []);
  const writes = [], uploads = [], edits = [];
  const query = { select: () => query, eq: () => query, is: () => query, order: () => query,
    range: async () => options.remote ? await options.remote : { data: [], error: null } };
  const modules = {
    react: hooks.react,
    '@react-native-async-storage/async-storage': { __esModule: true, default: {
      getItem: async () => storage,
      setItem: async (_, value) => { await options.write; storage = value; writes.push(JSON.parse(value)); },
    } },
    '../lib/supabase': { supabase: { from: () => query } },
    '../services/recording-files': {
      preserveRecordingFile: async () => { if (options.diskFailure) throw new Error('Disk full'); await options.preserve; },
      localRecordingUri: async segment => segment.localUri,
    },
    '../services/upload-recording': { uploadRecording: async (recording, config) => {
      uploads.push({ recording, config });
      await options.upload;
      if (options.uploadFailure) throw new Error('Offline');
      return { id: config.segment.id, path: `${config.segment.userId}/${config.segment.id}.m4a` };
    } },
    '../services/edit-recording-segment': { syncSegmentChange: async segment => {
      edits.push({ ...segment });
      await options.edit;
      if (options.editFailure) throw new Error('Offline');
    } },
    '../utils/recordings': utils,
  };
  const module = load('src/hooks/use-recording-segments.ts', modules);
  const h = {
    uploads, writes, edits,
    render() { h.result = hooks.render(() => module.useRecordingSegments(owner, false, projectId)); return h.result; },
    async flush() { for (let i = 0; i < 5; i++) { await tick(); h.render(); } },
    switchProject(id) { projectId = id; h.render(); },
    switchUser(id) { owner = id; h.render(); },
  };
  h.render(); return h;
}

test('a take enters the timeline before preservation or network upload completes', async () => {
  const preserve = deferred(), upload = deferred();
  const h = setup({ preserve: preserve.promise, upload: upload.promise }); await h.flush();
  const saving = h.result.addRecording(capture);
  assert.equal(h.render().segments.length, 1);
  assert.equal(h.uploads.length, 0);
  preserve.resolve(); await saving; await h.flush();
  assert.equal(h.result.segments[0].status, 'uploading');
  upload.resolve(); await h.flush();
  assert.equal(h.result.segments[0].status, 'uploaded');
  assert.equal(h.result.segments[0].localUri, capture.uri);
});

test('failed uploads retain bytes and retry the same segment identity', async () => {
  const options = { uploadFailure: true }; const h = setup(options); await h.flush();
  await h.result.addRecording(capture); await h.flush();
  const failed = h.result.segments[0];
  assert.equal(failed.status, 'error'); assert.equal(failed.localUri, capture.uri);
  options.uploadFailure = false; await h.result.retry(failed.id); await h.flush();
  assert.equal(h.result.segments[0].status, 'uploaded');
  assert.equal(h.uploads[0].config.segment.id, h.uploads[1].config.segment.id);
});

test('restart resumes pending uploads and restores each account in isolation', async () => {
  const h = setup({ cache: [cached('pending-take', 'owner', 'uploading'), cached('other-take', 'other', 'uploaded')] });
  await h.flush();
  assert.equal(h.uploads.length, 1);
  assert.equal(h.result.segments.length, 1);
  h.switchUser('other'); await h.flush();
  assert.equal(h.result.segments[0].id, 'other-take');
});

test('guest recordings stay local until explicitly claimed by a signed-in user', async () => {
  const h = setup({ owner: null, cache: [cached('guest-take', null)] }); await h.flush();
  assert.equal(h.uploads.length, 0);
  h.switchUser('owner'); await h.flush();
  assert.equal(h.result.segments.length, 0); assert.equal(h.result.guestCount, 1);
  h.result.claimGuestRecordings(); await h.flush();
  assert.equal(h.result.segments.length, 1); assert.equal(h.uploads.length, 1);
});

test('late remote hydration preserves newly captured segments and local URIs', async () => {
  const remote = deferred(); const h = setup({ remote: remote.promise, uploadFailure: true }); await h.flush();
  await h.result.addRecording(capture); await h.flush();
  const local = h.result.segments[0];
  remote.resolve({ data: [{ id: 'remote-take', user_id: 'owner', creation_session_id: null,
    storage_path: 'owner/remote.m4a', title: 'Earlier', recorded_at: '2026-09-25T12:00:00Z', duration_ms: 1500, position: 1 }], error: null });
  await h.flush();
  assert.equal(h.result.segments.length, 2);
  assert.equal(h.result.segments[1].localUri, local.localUri);
});

test('full local storage does not prevent rescuing audio by uploading it', async () => {
  const h = setup({ diskFailure: true }); await h.flush();
  await h.result.addRecording(capture); await h.flush();
  assert.equal(h.result.segments[0].status, 'uploaded');
});

test('serialized cache writes retain both rapidly captured moments', async () => {
  const write = deferred(); const h = setup({ owner: null, write: write.promise }); await h.flush();
  await h.result.addRecording(capture); await h.result.addRecording({ ...capture, uri: 'file:///second.m4a' });
  write.resolve(); await h.flush();
  assert.equal(h.writes.at(-1).length, 2);
  assert.ok(h.result.segments[1].order > h.result.segments[0].order);
});

test('date grouping uses calendar days and handles year boundaries', () => {
  const now = new Date(2026, 0, 1, 12);
  assert.equal(utils.formatRecordingDay(new Date(2026, 0, 1, 1).toISOString(), now), 'Today');
  assert.equal(utils.formatRecordingDay(new Date(2025, 11, 31, 23).toISOString(), now), 'Yesterday');
  assert.equal(utils.formatDuration(720999), '12:00');
});


test('rename is immediate and a late upload syncs the newest name', async () => {
  const upload = deferred(); const h = setup({ upload: upload.promise }); await h.flush();
  await h.result.addRecording(capture); await h.flush();
  const id = h.result.segments[0].id;
  h.result.rename(id, '  Grandma’s garden  ');
  assert.equal(h.render().segments[0].title, 'Grandma’s garden');
  upload.resolve(); await h.flush();
  assert.equal(h.edits.at(-1).title, 'Grandma’s garden');
  assert.equal(h.result.segments[0].pendingChange, undefined);
});

test('delete during upload stays removed after upload completes and persists a deletion marker', async () => {
  const upload = deferred(); const h = setup({ upload: upload.promise }); await h.flush();
  await h.result.addRecording(capture); await h.flush();
  h.result.remove(h.result.segments[0].id);
  assert.equal(h.render().segments.length, 0);
  upload.resolve(); await h.flush();
  assert.equal(h.result.segments.length, 0);
  assert.ok(h.edits.at(-1).deletedAt);
  assert.ok(h.writes.at(-1)[0].deletedAt);
});

test('failed deletion remains hidden and can sync on retry', async () => {
  const options = { cache: [cached('delete-me', 'owner', 'uploaded')], editFailure: true };
  const h = setup(options); await h.flush();
  h.result.remove('delete-me'); await h.flush();
  assert.equal(h.result.segments.length, 0);
  assert.equal(h.result.deletionSyncError, true);
  options.editFailure = false; h.result.retryDeletions(); await h.flush();
  assert.equal(h.result.deletionSyncError, false);
  assert.equal(h.result.segments.length, 0);
});

test('a refetch begun before renaming cannot restore the old title', async () => {
  const remote = deferred();
  const h = setup({ remote: remote.promise, cache: [{ ...cached('rename-me', 'owner', 'uploaded'), storagePath: 'owner/take.m4a' }] });
  await h.flush(); h.result.rename('rename-me', 'My new name'); await h.flush();
  remote.resolve({ data: [{ id: 'rename-me', user_id: 'owner', creation_session_id: null, storage_path: 'owner/take.m4a',
    title: 'Old name', recorded_at: capture.recordedAt, duration_ms: 1200, position: 1 }], error: null });
  await h.flush();
  assert.equal(h.result.segments[0].title, 'My new name');
});

test('a deletion takes precedence over an in-flight rename', async () => {
  const edit = deferred();
  const h = setup({ edit: edit.promise, cache: [{ ...cached('edit-me', 'owner', 'uploaded'), storagePath: 'owner/take.m4a' }] });
  await h.flush(); h.result.rename('edit-me', 'New name'); await h.flush();
  h.result.remove('edit-me'); await h.flush();
  edit.resolve(); await h.flush();
  assert.equal(h.result.segments.length, 0);
  assert.equal(h.edits.length, 2);
  assert.equal(h.edits[1].pendingChange, 'delete');
});

test('guest deletion survives restart and never uploads when claiming guest takes', async () => {
  const h = setup({ owner: null, cache: [cached('guest-delete', null)] }); await h.flush();
  h.result.remove('guest-delete'); await h.flush();
  const restored = setup({ owner: null, cache: h.writes.at(-1) }); await restored.flush();
  assert.equal(restored.result.segments.length, 0);
  restored.switchUser('owner'); await restored.flush();
  restored.result.claimGuestRecordings(); await restored.flush();
  assert.equal(restored.uploads.length, 0);
  assert.equal(restored.result.guestCount, 0);
});

test('blank names and editing a different account’s segment are ignored', async () => {
  const h = setup({ cache: [cached('my-take', 'owner', 'uploaded'), cached('their-take', 'other', 'uploaded')] }); await h.flush();
  h.result.rename('my-take', '   '); h.result.rename('their-take', 'Wrong account'); h.result.remove('their-take');
  assert.equal(h.render().segments[0].title, 'A memory');
  h.switchUser('other'); await h.flush();
  assert.equal(h.result.segments[0].title, 'A memory');
});


const orderedCache = () => ['first', 'second', 'third'].map((id, i) => ({
  ...cached(id, 'owner', 'uploaded'), storagePath: `owner/${id}.m4a`, order: (i + 1) * 1024,
}));
const ids = h => Array.from(h.result.segments, item => item.id);

test('moving a segment persists order and survives restart without changing metadata', async () => {
  const h = setup({ cache: orderedCache() }); await h.flush();
  h.result.move('third', 'first'); await h.flush();
  assert.deepEqual(ids(h), ['third', 'first', 'second']);
  assert.equal(h.result.segments[0].localUri, 'file:///third.m4a');
  assert.equal(h.result.segments[0].title, 'A memory');
  assert.equal(h.edits.at(-1).pendingChange, 'reorder');
  const restarted = setup({ cache: h.writes.at(-1) }); await restarted.flush();
  assert.deepEqual(ids(restarted), ['third', 'first', 'second']);
});

test('moving to the end and recording again preserve the chosen order', async () => {
  const h = setup({ cache: orderedCache() }); await h.flush();
  h.result.move('first', null); await h.flush();
  await h.result.addRecording(capture); await h.flush();
  assert.deepEqual(ids(h).slice(0, 3), ['second', 'third', 'first']);
  assert.equal(h.result.segments.at(-1).localUri, capture.uri);
});

test('moves during an upload use the latest order after that upload completes', async () => {
  const pending = deferred(); const h = setup({ cache: orderedCache(), upload: pending.promise }); await h.flush();
  await h.result.addRecording(capture); await h.flush();
  const id = h.result.segments.at(-1).id;
  h.result.move(id, 'first'); await h.flush();
  pending.resolve(); await h.flush();
  assert.equal(h.result.segments[0].id, id);
  assert.equal(h.edits.at(-1).order, h.result.segments[0].order);
});

test('a queued rename and move are both synced without losing either edit', async () => {
  const edit = deferred(); const h = setup({ cache: orderedCache(), edit: edit.promise }); await h.flush();
  h.result.rename('third', 'The ending'); await h.flush();
  h.result.move('third', 'first'); await h.flush();
  edit.resolve(); await h.flush();
  assert.equal(h.edits.at(-1).pendingChange, 'edit');
  assert.equal(h.edits.at(-1).title, 'The ending');
  assert.equal(h.edits.at(-1).order, h.result.segments[0].order);
});

test('failed order sync retains the local order and can retry', async () => {
  const options = { cache: orderedCache(), editFailure: true };
  const h = setup(options); await h.flush();
  h.result.move('third', 'first'); await h.flush();
  assert.deepEqual(ids(h), ['third', 'first', 'second']);
  assert.ok(h.result.segments[0].changeError);
  options.editFailure = false; await h.result.retry('third'); await h.flush();
  assert.equal(h.result.segments[0].pendingChange, undefined);
});

test('moves ignore removed targets and do not overwrite a concurrent deletion', async () => {
  const h = setup({ cache: orderedCache() }); await h.flush();
  h.result.remove('first'); await h.flush();
  h.result.move('third', 'first'); await h.flush();
  assert.deepEqual(ids(h), ['second', 'third']);
  h.result.move('first', 'second'); await h.flush();
  assert.deepEqual(ids(h), ['second', 'third']);
});

test('exhausted position gaps are re-spaced using safe integers', () => {
  const original = orderedCache().map((item, i) => ({ ...item, order: i }));
  const moved = utils.moveSegmentBefore(original, 'third', 'first');
  assert.deepEqual(Array.from(moved, item => item.id), ['third', 'first', 'second']);
  assert.ok(moved.every(item => Number.isSafeInteger(item.order) && item.order >= 0));
  assert.ok(moved[0].order < moved[1].order && moved[1].order < moved[2].order);
});

test('moving the first segment between adjacent positions syncs every re-spaced row', async () => {
  const cache = orderedCache().map((item, i) => ({ ...item, order: i }));
  const h = setup({ cache }); await h.flush();
  h.result.move('first', 'third'); await h.flush();
  assert.deepEqual(ids(h), ['second', 'first', 'third']);
  const remote = new Map(cache.map(item => [item.id, item.order]));
  for (const edit of h.edits) remote.set(edit.id, edit.order);
  assert.deepEqual([...remote].sort((a, b) => a[1] - b[1]).map(([id]) => id), ids(h));
  assert.ok(h.result.segments.every(item => !item.pendingChange && !item.changeError));
});

test('a refresh started before moving the first segment cannot roll back the saved order', async () => {
  const remote = deferred(), cache = orderedCache();
  const h = setup({ cache, remote: remote.promise }); await h.flush();
  h.result.move('first', null); await h.flush();
  remote.resolve({ data: cache.map(item => ({ id: item.id, user_id: item.userId, creation_session_id: null,
    storage_path: item.storagePath, title: item.title, recorded_at: item.createdAt,
    duration_ms: item.durationMs, position: item.order, deleted_at: null })), error: null });
  await h.flush();
  assert.deepEqual(ids(h), ['second', 'third', 'first']);
  assert.equal(h.edits.at(-1).id, 'first');
  assert.equal(h.edits.at(-1).order, h.result.segments.at(-1).order);
});


test('new stories isolate recordings, retain upload association, and restore independently', async () => {
  const h = setup({ cache: [cached('legacy-story', 'owner', 'uploaded')] }); await h.flush();
  h.switchProject('aa222222-2222-4222-8222-222222222222'); await h.flush();
  assert.equal(h.result.segments.length, 0);
  await h.result.addRecording(capture); await h.flush();
  assert.equal(h.result.segments.length, 1);
  assert.equal(h.uploads[0].config.segment.creationSessionId, 'aa222222-2222-4222-8222-222222222222');
  assert.equal(h.result.projects.length, 2);
  h.switchProject(null); await h.flush();
  assert.equal(h.result.segments[0].id, 'legacy-story');
  const restored = setup({ cache: h.writes.at(-1) }); await restored.flush();
  restored.switchProject('aa222222-2222-4222-8222-222222222222'); await restored.flush();
  assert.equal(restored.result.segments.length, 1);
  assert.equal(restored.result.segments[0].localUri, capture.uri);
});
