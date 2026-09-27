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
const read = (spoken, start = 0) => alignSpokenWords(script, spoken.split(' '), start).position;
const at = index => script[index].key;

test('tokenizes words, folds stray punctuation into a neighbor, and normalizes numbers', () => {
  assert.equal(script[11].text, 'stars —');
  assert.equal(at(14), 'three');
  assert.equal(normalizeWord('Don’t'), 'dont');
  assert.equal(normalizeWord('Café,'), 'cafe');
});

test('follows words in order and ignores filler and misrecognitions', () => {
  assert.equal(read('once upon um a time'), 4);
  assert.equal(read('once upon xyzzy a'), 3);
});

test('a wrong word never jumps ahead to where that word appears later', () => {
  // Expecting "counted"; "three" and "bear" both appear further down the script.
  assert.equal(read('three', 9), 9);
  assert.equal(read('bear', 9), 9);
  assert.equal(read('three counted', 9), 10);
});

test('one word never skips ahead, even a distinctive one', () => {
  assert.equal(read('bear', 5), 5);
  assert.equal(read('little bear named', 5), 8);
});

test('reading on past a misheard word moves past it once the next words are heard', () => {
  // "little" was misheard, but the reader carried on with "bear named".
  assert.equal(read('lyrical bear named', 5), 8);
  // Common pairs like "in the" need a third word before moving on.
  const chair = tokenizeScript('He sat in the big chair.');
  assert.equal(alignSpokenWords(chair, ['he', 'sad', 'in', 'the'], 0).position, 1);
  assert.equal(alignSpokenWords(chair, ['he', 'sad', 'in', 'the', 'big'], 0).position, 5);
});

test('keeps going past several misheard or skipped words once the reader is clearly on track', () => {
  // "little bear" both misheard, then "named tedward counted" lines up.
  assert.equal(read('a lyrical pair named tedward counted', 4), 10);
  // Skipped "little" entirely.
  assert.equal(read('a bear named', 4), 8);
});

test('spelling variants that differ in one vowel match', () => {
  const pebble = tokenizeScript('A smooth grey pebble.');
  assert.equal(alignSpokenWords(pebble, ['a', 'smooth', 'gray', 'pebble'], 0).position, 4);
  assert.equal(read('pear', 6), 6); // A consonant change is still a different word.
});

test('unmatched words are returned so recovery works across Deepgram results', () => {
  // A final result ends after the misheard word and one word of the continuation...
  const first = alignSpokenWords(script, ['a', 'lyrical', 'bear'], 4);
  assert.equal(first.position, 5);
  assert.deepEqual([...first.unmatched], ['lyrical', 'bear']);
  // ...and the next result, with those words carried in front, completes the recovery.
  assert.equal(alignSpokenWords(script, [...first.unmatched, 'named'], first.position).position, 8);
});

test('backtracking is ignored until the expected word is heard', () => {
  assert.equal(read('a little bear named tedward', 9), 9);
  assert.equal(read('a little bear named tedward counted the', 9), 11);
});

test('interim revisions re-aligned from the committed position do not drift', () => {
  // Deepgram first hears "pear", then revises to "bear" on the same audio.
  assert.equal(read('a little pear', 4), 6);
  assert.equal(read('a little bear', 4), 7);
});

test('homophones count as the expected word', () => {
  assert.equal(read('won to three', 12), 15);
  assert.equal(read('bare', 6), 7);
});

test('handles the recognizer splitting or joining words', () => {
  assert.equal(read('ted ward counted', 8), 10);
  assert.equal(alignSpokenWords(tokenizeScript('Every one smiled.'), ['everyone', 'smiled'], 0).position, 3);
});

test('tolerates small recognition errors in longer words but not short ones', () => {
  assert.equal(read('named tedwart', 7), 9);
  assert.equal(read('an', 4), 4);
});

test('stops at the end of the script', () => {
  assert.equal(read('bear slept slept the end', 17), script.length);
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
