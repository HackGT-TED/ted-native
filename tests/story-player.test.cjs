const assert = require('node:assert/strict');
const { test } = require('node:test');
const { load, harness, tick } = require('./hook-harness.cjs');

function setup({ sign } = {}) {
  const hooks = harness();
  const calls = [];
  const player = { playing: false, currentTime: 0, duration: 0, replace(uri) { calls.push(['replace', uri]); }, play() { calls.push(['play']); player.playing = true; },
    pause() { calls.push(['pause']); player.playing = false; }, async seekTo(t) { calls.push(['seek', t]); }, addListener() { return { remove() {} }; } };
  const module = load('src/hooks/use-story-player.ts', {
    react: hooks.react,
    'react-native': { AppState: { addEventListener: () => ({ remove() {} }) } },
    'expo-router': { useIsFocused: () => true },
    'expo-audio': { useAudioPlayer: () => player, useAudioPlayerStatus: () => ({ playing: player.playing, isBuffering: false, currentTime: 0, duration: 0 }),
      setAudioModeAsync: async () => {} },
    '../lib/supabase': { supabase: { storage: { from(bucket) { assert.equal(bucket, 'recordings');
      return { createSignedUrl: async path => { calls.push(['sign', path]); return sign?.(path) ?? { data: { signedUrl: `https://signed/${path}` } }; } }; } } } },
  });
  const h = { calls, render() { h.result = hooks.render(() => module.useStoryPlayer()); return h.result; },
    async flush() { await tick(); h.render(); } };
  h.render(); return h;
}
const story = (id, audioPath = `u/${id}/story.mp3`) => ({ id, title: id, description: '', publishedAt: null, coverUrl: null, audioPath });

test('tapping a tile signs its audio and plays it; tapping again pauses', async () => {
  const h = setup();
  await h.result.toggle(story('a')); await h.flush();
  assert.deepEqual(h.calls.filter(c => c[0] !== 'pause'), [['sign', 'u/a/story.mp3'], ['replace', 'https://signed/u/a/story.mp3'], ['play']]);
  assert.equal(h.result.activeId, 'a');
  assert.equal(h.result.playing, true);
  await h.result.toggle(story('a')); await h.flush();
  assert.equal(h.result.playing, false);
  assert.equal(h.calls.filter(c => c[0] === 'sign').length, 1, 'resuming does not request a new link');
});

test('a story the user cannot open shows an error on that tile', async () => {
  const h = setup({ sign: () => ({ error: new Error('denied') }) });
  await h.result.toggle(story('a')); await h.flush();
  assert.equal(h.result.activeId, null);
  assert.equal(h.result.error.id, 'a');
  assert.match(h.result.error.message, /could not be played/);
  const none = setup();
  await none.result.toggle(story('b', null)); await none.flush();
  assert.match(none.result.error.message, /no audio yet/);
});

test('seeking and skipping stay inside the story and only work once it is loaded', async () => {
  const h = setup();
  await h.result.seekTo(5_000);
  assert.equal(h.calls.filter(c => c[0] === 'seek').length, 0, 'nothing loaded yet');
  await h.result.toggle(story('a')); await h.flush();
  await h.result.seekTo(30_000);
  await h.result.seekTo(-5_000);
  await h.result.skip(10_000);
  const seeks = h.calls.filter(c => c[0] === 'seek').map(c => c[1]);
  assert.deepEqual(seeks, [30, 0, 10]);
});
