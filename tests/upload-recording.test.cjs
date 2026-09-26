const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { test } = require('node:test');
const vm = require('node:vm');
const ts = require('typescript');

const source = ts.transpileModule(readFileSync('src/services/upload-recording.ts', 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText;
const recording = { uri: 'file:///take.m4a', title: 'Bedtime story', duration: 1234 };
const url = 'https://uploads.example.test/recordings';

// Exercise the installed SDK's actual multipart encoder, not just a fetch mock.
const encoderExports = {};
vm.runInNewContext(ts.transpileModule(readFileSync('node_modules/expo/src/winter/fetch/convertFormData.ts', 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText, {
  exports: encoderExports, Blob, TextEncoder, Uint8Array,
  require: name => {
    assert.equal(name, '../../utils/blobUtils');
    return { blobToArrayBufferAsync: blob => blob.arrayBuffer() };
  },
});

function setup({ os = 'ios', fetch, timer = setTimeout, signedIn = true, configured = true, fileExists = true } = {}) {
  const calls = [];
  const timers = new Set();
  class Multipart {
    fields = [];
    append(...field) { this.fields.push(field); }
    get(name) { return this.fields.find(field => field[0] === name)?.[1]; }
    entries() { return this.fields.map(([name, value]) => [name, value]); }
  }
  class File {
    constructor(uri) { this.uri = uri; }
    exists = fileExists;
    name = 'take.m4a';
    type = 'audio/mp4';
    size = 11;
    async bytes() { return new TextEncoder().encode('audio bytes'); }
  }
  const exports = {};
  vm.runInNewContext(source, {
    exports, require: name => {
      if (name === 'react-native') return { Platform: { OS: os } };
      if (name === 'expo-file-system') return { File };
      assert.equal(name, '../lib/supabase');
      return { supabase: configured ? { auth: { getSession: async () => ({
        data: { session: signedIn ? { access_token: 'user-jwt' } : null }, error: null,
      }) } } : null };
    },
    process: { env: {} }, FormData: Multipart, AbortController, Error, TypeError,
    setTimeout: (...args) => { const id = timer(...args); timers.add(id); return id; },
    clearTimeout: id => { timers.delete(id); clearTimeout(id); },
    fetch: async (...args) => {
      calls.push(args);
      const response = fetch ? await fetch(...args) : { ok: true, status: 204 };
      return { json: async () => null, ...response };
    },
  });
  return { upload: exports.uploadRecording, calls, timers };
}

test('native upload sends an Expo File and metadata as multipart POST', async () => {
  const h = setup();
  await h.upload(recording, { url });
  assert.equal(h.calls.length, 1);
  const [destination, options] = h.calls[0];
  assert.equal(destination, url);
  assert.equal(options.method, 'POST');
  assert.equal(options.headers.Authorization, 'Bearer user-jwt');
  assert.equal(options.headers['Content-Type'], undefined, 'fetch must supply its own multipart boundary');
  assert.equal(options.body.get('audio').uri, recording.uri);
  assert.equal(options.body.get('audio').type, 'audio/mp4');
  assert.equal(options.body.get('audio').name, 'take.m4a');
  assert.equal(options.body.get('title'), recording.title);
  assert.equal(options.body.get('durationMs'), '1234');
  assert.equal(h.timers.size, 0);
});

test('native upload serializes through the Expo encoder into a readable audio part', async () => {
  let parsed;
  const h = setup({ fetch: async (_url, { body }) => {
    const encoded = await encoderExports.convertFormDataAsync(body);
    parsed = await new Response(encoded.body, {
      headers: { 'Content-Type': `multipart/form-data; boundary=${encoded.boundary}` },
    }).formData();
    return { ok: true, status: 201 };
  } });
  await h.upload(recording);
  assert.equal(parsed.get('audio').name, 'take.m4a');
  assert.equal(parsed.get('audio').type, 'audio/mp4');
  assert.equal(await parsed.get('audio').text(), 'audio bytes');
  assert.equal(parsed.get('title'), recording.title);
  assert.equal(parsed.get('durationMs'), '1234');
});

test('a missing native recording never sends an upload', async () => {
  const h = setup({ fileExists: false });
  await assert.rejects(h.upload(recording), /could not be read/);
  assert.equal(h.calls.length, 0);
  assert.equal(h.timers.size, 0);
});

test('web upload reads the browser blob and preserves its file format', async () => {
  const blob = new Blob(['audio'], { type: 'audio/webm;codecs=opus' });
  const h = setup({ os: 'web', fetch: async destination => destination.startsWith('blob:')
    ? { ok: true, blob: async () => blob } : { ok: true, status: 201 } });
  await h.upload({ ...recording, uri: 'blob:take' }, { url });
  assert.equal(h.calls.length, 2);
  const field = h.calls[1][1].body.fields[0];
  assert.equal(field[1], blob);
  assert.equal(field[2], 'recording.webm');
});

test('missing configuration and unreadable browser recordings do not POST', async () => {
  const h = setup({ configured: false });
  await assert.rejects(h.upload(recording), /aren’t available/);
  assert.equal(h.calls.length, 0);
  const web = setup({ os: 'web', fetch: async () => ({ ok: false }) });
  await assert.rejects(web.upload(recording, { url }), /could not be read/);
  assert.equal(web.calls.length, 1);
});

test('default endpoint is the same-origin Expo API route', async () => {
  const h = setup();
  await h.upload(recording);
  assert.equal(h.calls[0][0], '/api/recordings');
});

test('signed-out users cannot upload', async () => {
  const h = setup({ signedIn: false });
  await assert.rejects(h.upload(recording), /Sign in/);
  assert.equal(h.calls.length, 0);
  assert.equal(h.timers.size, 0);
});

test('validation errors from the API are shown to the user', async () => {
  const h = setup({ fetch: async () => ({ ok: false, status: 400, json: async () => ({ error: 'A title is required.' }) }) });
  await assert.rejects(h.upload(recording), /A title is required/);
});

test('HTTP rejection never counts as success and does not retry automatically', async () => {
  for (const status of [413, 500]) {
    const h = setup({ fetch: async () => ({ ok: false, status }) });
    await assert.rejects(h.upload(recording, { url }), status === 413 ? /too large/ : /500/);
    assert.equal(h.calls.length, 1);
    assert.equal(h.timers.size, 0);
  }
});

test('network failure provides a readable error', async () => {
  const h = setup({ fetch: async () => { throw new TypeError('Failed to fetch'); } });
  await assert.rejects(h.upload(recording, { url }), /Check your connection/);
});

test('cancelled requests abort fetch; already cancelled requests never send', async () => {
  const controller = new AbortController();
  const h = setup({ fetch: async (_url, { signal }) => new Promise((_, reject) => {
    signal.addEventListener('abort', () => reject(new Error('aborted')));
  }) });
  const pending = h.upload(recording, { url, signal: controller.signal });
  await new Promise(resolve => setImmediate(resolve));
  controller.abort();
  await assert.rejects(pending, /aborted/);
  assert.equal(h.calls[0][1].signal.aborted, true);
  await assert.rejects(h.upload(recording, { url, signal: controller.signal }), /cancelled/);
  assert.equal(h.calls.length, 1);
  assert.equal(h.timers.size, 0);
});

test('timeout aborts the request and gives a retry message', async () => {
  let expire;
  const h = setup({ timer: callback => { expire = callback; return 1; }, fetch: async (_url, { signal }) => new Promise((_, reject) => {
    signal.addEventListener('abort', () => reject(new Error('aborted')));
  }) });
  const pending = h.upload(recording, { url });
  await new Promise(resolve => setImmediate(resolve));
  expire();
  await assert.rejects(pending, /timed out/);
  assert.equal(h.timers.size, 0);
});
