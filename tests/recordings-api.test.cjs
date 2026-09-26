const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { test } = require('node:test');
const { webcrypto } = require('node:crypto');
const vm = require('node:vm');
const ts = require('typescript');

const source = ts.transpileModule(readFileSync('src/server/upload-recording.ts', 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText;
const userId = '6c588dc6-f1c1-4f98-a8e7-641b648390f4';

function setup(options = {}) {
  const clients = [];
  const uploads = [];
  const tokens = [];
  const logs = [];
  const exports = {};
  vm.runInNewContext(source, {
    exports, Request, Response, FormData, Uint8Array, crypto: webcrypto,
    console: { error: (...args) => logs.push(args) },
    process: { env: options.env ?? {
      EXPO_PUBLIC_SUPABASE_URL: 'https://project.supabase.co',
      EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY: 'public-key',
    } },
    require(name) {
      assert.equal(name, '@supabase/supabase-js');
      return { createClient(url, key, config) {
        clients.push({ url, key, config });
        return {
          auth: { getUser: async token => {
            tokens.push(token);
            return options.auth ?? { data: { user: { id: userId } }, error: null };
          } },
          storage: { from: bucket => ({ upload: async (path, bytes, config) => {
            uploads.push({ bucket, path, bytes, config });
            if (options.throwStorage) throw new Error('upstream credential details');
            return { data: options.storageError ? null : { id: 'storage-id', path }, error: options.storageError };
          } }) },
        };
      } };
    },
  });
  return { post: exports.POST, clients, uploads, tokens, logs };
}

function request(fields = {}, headers = {}) {
  const form = new FormData();
  const entries = {
    audio: new Blob(['audio bytes'], { type: 'audio/mp4' }),
    title: '  Bedtime story  ', durationMs: '1234', ...fields,
  };
  for (const [key, value] of Object.entries(entries)) {
    if (value !== null) form.append(key, value);
  }
  return new Request('http://localhost/api/recordings', {
    method: 'POST', headers: { Authorization: 'Bearer user-jwt', ...headers }, body: form,
  });
}

test('POST uploads bytes privately under the verified user with metadata', async () => {
  const h = setup();
  const response = await h.post(request());
  assert.equal(response.status, 201);
  const result = await response.json();
  const upload = h.uploads[0];
  assert.equal(upload.bucket, 'recordings');
  assert.match(upload.path, new RegExp(`^${userId}/[a-f0-9-]+\\.m4a$`));
  assert.equal(new TextDecoder().decode(upload.bytes), 'audio bytes');
  assert.equal(upload.config.upsert, false);
  assert.equal(upload.config.contentType, 'audio/mp4');
  assert.equal(upload.config.metadata.title, 'Bedtime story');
  assert.equal(upload.config.metadata.durationMs, 1234);
  assert.equal(result.id, 'storage-id');
  assert.equal(result.path, upload.path);
  assert.equal(result.size, 11);
  assert.equal(result.url, undefined, 'Private recordings must not get public URLs');
  assert.deepEqual(h.tokens, ['user-jwt']);
  assert.equal(h.clients[0].config.global.headers.Authorization, 'Bearer user-jwt');
  assert.equal(h.clients[0].config.auth.persistSession, false);
});

test('each upload receives its own client and unique file path', async () => {
  const h = setup();
  await h.post(request());
  await h.post(request());
  assert.equal(h.clients.length, 2);
  assert.notEqual(h.uploads[0].path, h.uploads[1].path);
});

test('missing and rejected authentication never upload', async () => {
  const missing = setup();
  assert.equal((await missing.post(request({}, { Authorization: '' }))).status, 401);
  assert.equal(missing.clients.length, 0);
  const invalid = setup({ auth: { data: { user: null }, error: { message: 'Invalid JWT' } } });
  assert.equal((await invalid.post(request())).status, 401);
  assert.equal(invalid.uploads.length, 0);
});

test('unconfigured storage reports 503', async () => {
  const h = setup({ env: {} });
  assert.equal((await h.post(request())).status, 503);
  assert.equal(h.uploads.length, 0);
});

test('invalid audio and metadata are rejected before storage', async () => {
  for (const fields of [
    { audio: null }, { audio: 'file:///not-uploaded.m4a' }, { audio: new Blob([]) },
    { title: '' }, { title: ' '.repeat(3) }, { title: 'x'.repeat(81) },
    { durationMs: null }, { durationMs: '-1' }, { durationMs: '1.2' },
    { durationMs: '0' }, { durationMs: 'NaN' }, { durationMs: '9007199254740992' },
  ]) {
    const h = setup();
    assert.equal((await h.post(request(fields))).status, 400, JSON.stringify(fields));
    assert.equal(h.uploads.length, 0);
  }
});

test('unsupported file types and malformed multipart bodies are rejected', async () => {
  const h = setup();
  assert.equal((await h.post(request({ audio: new Blob(['html'], { type: 'text/html' }) }))).status, 415);
  assert.equal((await h.post(request({}, { 'Content-Type': 'application/json' }))).status, 415);
  const malformed = new Request('http://localhost/api/recordings', {
    method: 'POST', headers: { Authorization: 'Bearer user-jwt', 'Content-Type': 'multipart/form-data; boundary=missing' },
    body: 'not multipart',
  });
  assert.equal((await h.post(malformed)).status, 400);
  assert.equal(h.uploads.length, 0);
});

test('browser codec parameters are normalized while preserving the file format', async () => {
  for (const [type, extension] of [['audio/webm;codecs=opus', 'webm'], ['audio/ogg', 'ogg']]) {
    const h = setup();
    assert.equal((await h.post(request({ audio: new Blob(['audio'], { type }) }))).status, 201);
    assert.ok(h.uploads[0].path.endsWith(`.${extension}`));
    assert.equal(h.uploads[0].config.contentType, type.split(';')[0]);
  }
});

test('oversized files and requests are rejected, including without Content-Length', async () => {
  const h = setup();
  assert.equal((await h.post(request({}, { 'Content-Length': String(27 * 1024 * 1024) }))).status, 413);
  const audio = new Blob([new Uint8Array(25 * 1024 * 1024 + 1)], { type: 'audio/mp4' });
  assert.equal((await h.post(request({ audio }))).status, 413);
  const stream = new ReadableStream({ start(controller) {
    controller.enqueue(new Uint8Array(26 * 1024 * 1024));
    controller.close();
  } });
  const chunked = new Request('http://localhost/api/recordings', {
    method: 'POST', duplex: 'half', body: stream,
    headers: { Authorization: 'Bearer user-jwt', 'Content-Type': 'multipart/form-data; boundary=test' },
  });
  assert.equal((await h.post(chunked)).status, 413);
  assert.equal(h.uploads.length, 0);
});

test('storage failures never report success or expose upstream details', async () => {
  for (const options of [{ storageError: { message: 'internal details' } }, { throwStorage: true }]) {
    const h = setup(options);
    const response = await h.post(request());
    assert.equal(response.status, 502);
    assert.doesNotMatch(await response.text(), /internal details|credential/);
    assert.doesNotMatch(JSON.stringify(h.logs), /internal details|credential|user-jwt/);
  }
});

test('storage setup failures and limits have actionable, safe error responses', async () => {
  for (const [storageError, status, code] of [
    [{ code: 'NoSuchBucket', status: 404 }, 503, 'STORAGE_BUCKET_UNAVAILABLE'],
    [{ message: 'Bucket not found', status: 400 }, 503, 'STORAGE_BUCKET_UNAVAILABLE'],
    [{ code: 'AccessDenied', status: 403 }, 403, 'STORAGE_ACCESS_DENIED'],
    [{ message: 'new row violates row-level security policy', statusCode: '403' }, 403, 'STORAGE_ACCESS_DENIED'],
    [{ code: 'InvalidJWT', status: 401 }, 401, 'STORAGE_SESSION_EXPIRED'],
    [{ code: 'EntityTooLarge', status: 413 }, 413, 'STORAGE_FILE_TOO_LARGE'],
    [{ code: 'InvalidMimeType', status: 400 }, 415, 'STORAGE_AUDIO_TYPE_REJECTED'],
  ]) {
    const h = setup({ storageError });
    const response = await h.post(request());
    assert.equal(response.status, status);
    const result = await response.json();
    assert.equal(result.code, code);
    assert.ok(result.error);
    assert.equal(h.logs[0][1].code, code);
  }
});
