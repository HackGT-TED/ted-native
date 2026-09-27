const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { test } = require('node:test');
const vm = require('node:vm');
const ts = require('typescript');

function load(path, context = {}) {
  const source = ts.transpileModule(readFileSync(path, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const exports = {};
  vm.runInNewContext(source, { exports, ...context });
  return exports;
}

const { tokenizeScript, alignSpokenWords, normalizeWord, scriptKeyterms } = load('src/utils/read-along.ts');
const script = tokenizeScript('Once upon a time, a little bear named Tedward counted the stars — one, two, 3! Then the bear slept.');
const read = (spoken, start = 0) => alignSpokenWords(script, spoken.split(' '), start);
const at = index => script[index].key;

test('tokenizes words, folds stray punctuation into a neighbor, and normalizes numbers', () => {
  assert.equal(script[11].text, 'stars —');
  assert.equal(at(14), 'three');
  assert.equal(normalizeWord('Don’t'), 'dont');
  assert.equal(normalizeWord('Café,'), 'cafe');
});

test('follows words in order and ignores filler and misrecognitions', () => {
  assert.equal(read('once upon um a time').position, 4);
  assert.equal(read('once upon xyzzy a').position, 3);
});

test('interim revisions re-aligned from the committed position do not drift', () => {
  // Deepgram first hears "bare", then revises to "bear" on the same audio.
  assert.equal(read('a little bare', 4).position, 6);
  assert.equal(read('a little bear', 4).position, 7);
});

test('tolerates small recognition errors in longer words but not short ones', () => {
  assert.equal(read('named tedwart', 7).position, 9);
  assert.equal(read('a', 6).position, 6);
});

test('follows a skipped word only when the landing is trustworthy', () => {
  // Skipping "little" onto distinctive "bear" is followed.
  assert.equal(read('bear named', 5).position, 8);
  // Jumping from "once" to a later "a" on a common word alone is not.
  assert.equal(read('the', 0).position, 0);
});

test('repeating the current word does not count toward relocation', () => {
  assert.equal(read('the the the stars', 10).position, 12);
});

test('relocates when the reader jumps back to reread a phrase', () => {
  const { position, relocated } = read('once upon a time', 14);
  assert.equal(relocated, true);
  assert.equal(position, 4);
});

test('keyterms pick names and long words without duplicates', () => {
  const terms = scriptKeyterms('Tedward met Tedward in the Whispering Woods. The extraordinary night.');
  assert.deepEqual([...terms], ['Tedward', 'Whispering', 'Woods', 'extraordinary']);
});

function grant(options = {}) {
  const calls = [];
  const { POST } = load('src/server/deepgram-token.ts', {
    Response, console: { error() {} },
    process: { env: options.env ?? {
      EXPO_PUBLIC_SUPABASE_URL: 'https://project.supabase.co',
      EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY: 'public-key',
      DEEPGRAM_API_KEY: 'secret',
    } },
    require: () => ({ createClient: () => ({ auth: { getUser: async () => options.auth ?? { data: { user: { id: 'u' } }, error: null } } }) }),
    fetch: async (url, init) => {
      calls.push({ url, init });
      return options.deepgram ?? new Response(JSON.stringify({ access_token: 'jwt', expires_in: 30 }));
    },
  });
  const request = (auth = 'Bearer session') => new Request('http://x/api/deepgram-token', {
    method: 'POST', headers: auth ? { Authorization: auth } : {},
  });
  return { POST, calls, request };
}

test('token route mints a short-lived token for a signed-in user without exposing the key', async () => {
  const { POST, calls, request } = grant();
  const response = await POST(request());
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { token: 'jwt', expiresIn: 30 });
  assert.equal(calls[0].url, 'https://api.deepgram.com/v1/auth/grant');
  assert.equal(calls[0].init.headers.Authorization, 'Token secret');
  assert.deepEqual(JSON.parse(calls[0].init.body), { ttl_seconds: 30 });
});

test('token route rejects missing sessions, missing config, and Deepgram failures', async () => {
  assert.equal((await grant().POST(grant().request(null))).status, 401);
  const expired = grant({ auth: { data: { user: null }, error: new Error('expired') } });
  assert.equal((await expired.POST(expired.request())).status, 401);
  assert.equal(expired.calls.length, 0);
  const unconfigured = grant({ env: {} });
  assert.equal((await unconfigured.POST(unconfigured.request())).status, 503);
  const failing = grant({ deepgram: new Response('{}', { status: 403 }) });
  const response = await failing.POST(failing.request());
  assert.equal(response.status, 502);
  assert.doesNotMatch(await response.text(), /secret/);
});
