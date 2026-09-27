const assert = require('node:assert/strict');
const { test } = require('node:test');
const { load } = require('./hook-harness.cjs');

function setup({ os = 'ios', fetch, fileExists = true } = {}) {
  const calls = [];
  const written = [];
  class File {
    constructor(...parts) { this.uri = parts.map(p => (typeof p === 'string' ? p : p.uri)).join('/'); }
    get exists() { return fileExists; }
    get size() { return fileExists ? 10 : 0; }
    write(content, options) { written.push({ uri: this.uri, content, options }); }
  }
  class FormData {
    constructor() { this.parts = []; }
    append(...args) { this.parts.push(args); }
  }
  class FileReader {
    readAsDataURL(blob) { this.result = `data:audio/mpeg;base64,${blob.base64}`; this.onloadend(); }
  }
  const api = load('src/services/story-api.ts', {
    'react-native': { Platform: { OS: os } },
    'expo-file-system': { File, Paths: { document: { uri: 'file:///docs' } } },
  }, {
    FormData, FileReader, process: { env: {} },
    URL: { createObjectURL: () => 'blob:mixed' },
    fetch: async (url, init = {}) => { calls.push({ url, init }); return fetch(url, init); },
  });
  return { api, calls, written };
}

const headers = values => ({ get: name => values[name] ?? null });

test('render posts the recording as multipart audio and saves the MP3 on the device', async () => {
  const h = setup({ fetch: async () => ({ ok: true, status: 200,
    headers: headers({ 'X-Story-Cue-Count': '3', 'X-Story-Duration-Seconds': '17.23' }),
    blob: async () => ({ base64: 'TVAz' }) }) });
  const result = await h.api.renderStory('file:///rec/story.m4a');
  const { url, init } = h.calls[0];
  assert.equal(url, 'https://backend-1opa.onrender.com/stories/render');
  assert.equal(init.method, 'POST');
  assert.equal(init.headers, undefined, 'fetch must supply its own multipart boundary');
  assert.equal(init.body.parts[0][0], 'audio');
  assert.equal(init.body.parts[0][1].uri, 'file:///rec/story.m4a');
  assert.equal(result.cueCount, 3);
  assert.equal(result.durationSeconds, 17.23);
  assert.equal(result.warnings, null);
  assert.equal(h.written[0].content, 'TVAz');
  assert.equal(h.written[0].options.encoding, 'base64');
  assert.match(result.uri, /^file:\/\/\/docs\/story_\d+\.mp3$/);
});

test("a story's moments are sent as repeated audio fields in order", async () => {
  const h = setup({ fetch: async () => ({ ok: true, status: 200, headers: headers({}), blob: async () => ({ base64: '' }) }) });
  await h.api.renderStory(['file:///rec/one.m4a', 'file:///rec/two.m4a']);
  const parts = h.calls[0].init.body.parts;
  assert.deepEqual(parts.map(p => p[0]), ['audio', 'audio']);
  assert.deepEqual(parts.map(p => p[1].uri), ['file:///rec/one.m4a', 'file:///rec/two.m4a']);
  await assert.rejects(h.api.describeStory([]), /at least one moment/);
});

test('describe returns the summary JSON', async () => {
  const summary = { audio: 'story.m4a', duration_seconds: 5, transcript_text: 'Once', description: 'A tale.', hashtags: ['calm'] };
  const h = setup({ fetch: async () => ({ ok: true, status: 200, json: async () => summary }) });
  assert.deepEqual(await h.api.describeStory('file:///rec/story.m4a'), summary);
  assert.equal(h.calls[0].url, 'https://backend-1opa.onrender.com/stories/describe');
});

test('FastAPI detail strings and objects become readable errors with the status', async () => {
  const h = setup({ fetch: async () => ({ ok: false, status: 422, json: async () => ({ detail: 'No speech found' }) }) });
  await assert.rejects(h.api.describeStory('file:///rec/a.m4a'), error => error.status === 422 && /No speech found/.test(error.message));
  const o = setup({ fetch: async () => ({ ok: false, status: 502, json: async () => ({ detail: { message: 'Upstream timed out' } }) }) });
  await assert.rejects(o.api.renderStory('file:///rec/a.m4a'), /Upstream timed out/);
});

test('network failures and missing recordings give user-facing messages', async () => {
  const h = setup({ fetch: async () => { throw new TypeError('Network request failed'); } });
  await assert.rejects(h.api.renderStory('file:///rec/a.m4a'), /Could not reach the story server/);
  const missing = setup({ fileExists: false, fetch: async () => assert.fail('should not upload') });
  await assert.rejects(missing.api.renderStory('file:///rec/gone.m4a'), /could not be read/);
});

test('web renders return an object URL instead of writing a file', async () => {
  const h = setup({ os: 'web', fetch: async url => url.startsWith('blob:')
    ? { ok: true, blob: async () => ({ type: 'audio/webm' }) }
    : { ok: true, status: 200, headers: headers({}), blob: async () => ({}) } });
  const result = await h.api.renderStory('blob:recording');
  assert.equal(result.uri, 'blob:mixed');
  assert.equal(h.written.length, 0);
  assert.equal(h.calls[1].init.body.parts[0][2], 'moment-1.webm');
});

test('warmUp never throws', async () => {
  const h = setup({ fetch: async () => { throw new Error('asleep'); } });
  await h.api.warmUp();
  assert.equal(h.calls[0].url, 'https://backend-1opa.onrender.com/health');
});
