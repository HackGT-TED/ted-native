const assert = require('node:assert/strict');
const { test } = require('node:test');
const { load, harness, tick } = require('./hook-harness.cjs');

function setup({ picked = { uri: 'file:///photos/cover.png', mimeType: 'image/png' }, upload, projectId = 'story-1', savedPath = null, stored = null } = {}) {
  const hooks = harness();
  const calls = [];
  const storage = {};
  class File { constructor(uri) { this.uri = uri; } async arrayBuffer() { calls.push(['read', this.uri]); return new ArrayBuffer(4); } }
  const module = load('src/hooks/use-story-cover.ts', {
    react: hooks.react,
    'react-native': { Platform: { OS: 'ios' } },
    'expo-file-system': { File },
    'expo-image-picker': { launchImageLibraryAsync: async options => { calls.push(['pick', options]);
      return picked ? { canceled: false, assets: [picked] } : { canceled: true, assets: null }; } },
    '@react-native-async-storage/async-storage': { __esModule: true, default: {
      getItem: async key => storage[key] ?? stored, setItem: async (key, value) => { storage[key] = value; } } },
    '../lib/supabase': { supabase: { storage: { from(bucket) { assert.equal(bucket, 'recordings'); return {
      upload: async (path, bytes, options) => { calls.push(['upload', path, options.contentType]); return upload?.() ?? { error: null }; },
      createSignedUrl: async path => ({ data: { signedUrl: `https://signed/${path}` } }),
    }; } } } },
  }, { Date: { now: () => 1234 } });
  const h = { calls, storage,
    render() { h.result = hooks.render(() => module.useStoryCover('alice', false, projectId, savedPath)); return h.result; },
    async flush() { await tick(); h.render(); await tick(); h.render(); },
  };
  h.render(); return h;
}

test('a picked cover uploads into the story folder and is sent with the next save', async () => {
  const h = setup(); await h.flush();
  assert.equal(h.result.hasCover, false);
  await h.result.pick(); await h.flush();
  const pick = h.calls.find(c => c[0] === 'pick')[1];
  assert.equal(pick.allowsEditing, true);
  assert.deepEqual(Array.from(pick.aspect), [1, 1]);
  assert.deepEqual(h.calls.find(c => c[0] === 'upload'), ['upload', 'alice/story-1/cover_1234.png', 'image/png']);
  assert.equal(h.result.pathForSave, 'alice/story-1/cover_1234.png');
  assert.equal(h.result.previewUri, 'file:///photos/cover.png');
  assert.equal(h.result.unsaved, true);
  assert.equal(Object.values(h.storage)[0], 'alice/story-1/cover_1234.png');
});

test('the legacy draft uploads into the author folder, which is its story id', async () => {
  const h = setup({ projectId: null, picked: { uri: 'file:///p.jpg' } }); await h.flush();
  await h.result.pick(); await h.flush();
  assert.equal(h.calls.find(c => c[0] === 'upload')[1], 'alice/alice/cover_1234.jpg');
});

test('a saved cover is shown, can be removed, and nothing changes when the picker is cancelled', async () => {
  const h = setup({ savedPath: 'alice/story-1/old.jpg', picked: null }); await h.flush();
  assert.equal(h.result.hasCover, true);
  assert.equal(h.result.pathForSave, undefined);
  assert.equal(h.result.previewUri, 'https://signed/alice/story-1/old.jpg');
  await h.result.pick(); await h.flush();
  assert.equal(h.calls.some(c => c[0] === 'upload'), false);
  h.result.remove(); await h.flush();
  assert.equal(h.result.hasCover, false);
  assert.equal(h.result.pathForSave, '');
});

test('a failed upload shows an error and keeps the previous cover', async () => {
  const h = setup({ upload: () => ({ error: new Error('denied') }) }); await h.flush();
  await h.result.pick(); await h.flush();
  assert.match(h.result.error, /could not be uploaded/);
  assert.equal(h.result.pathForSave, undefined);
  assert.equal(h.result.uploading, false);
});
