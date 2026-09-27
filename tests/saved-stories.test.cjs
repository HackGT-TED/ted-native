const assert = require('node:assert/strict');
const { test } = require('node:test');
const { load, harness, tick } = require('./hook-harness.cjs');

const row = (id, author = 'bob') => ({ id, author_id: author, title: `Story ${id}`, description: 'A tale.', published_at: null, cover_image_path: null, stereo_audio_path: `u/${id}/story.mp3` });
const story = (id, author = 'bob') => ({ id, authorId: author, title: `Story ${id}`, description: 'A tale.', publishedAt: null, coverUrl: null, audioPath: `u/${id}/story.mp3` });

function setup({ list, write } = {}) {
  const hooks = harness();
  const calls = [];
  const community = load('src/hooks/use-community-stories.ts', { react: hooks.react, '../lib/supabase': { supabase: null } });
  const module = load('src/hooks/use-saved-stories.ts', {
    react: hooks.react,
    './use-community-stories': community,
    '../lib/supabase': { supabase: {
      from(table) {
        assert.equal(table, 'saved_stories');
        const query = {
          select(fields) { calls.push(['select', fields]); return query; },
          eq(field, value) { calls.push(['eq', field, value]); return query; },
          order() { return query; },
          limit() { return list?.() ?? Promise.resolve({ data: [{ story: row('a') }, { story: null }], error: null }); },
          insert(value) { calls.push(['insert', value]); return write?.() ?? Promise.resolve({ error: null }); },
          delete() { calls.push(['delete']); const del = { eq(f, v) { calls.push(['eq', f, v]); return del; },
            then(resolve, reject) { return (write?.() ?? Promise.resolve({ error: null })).then(resolve, reject); } }; return del; },
        };
        return query;
      },
    } },
  });
  const h = { calls,
    render() { h.result = hooks.render(() => module.useSavedStories('alice', false)); return h.result; },
    async flush() { await tick(); h.render(); },
  };
  h.render(); return h;
}

test('saved stories load with their story, skipping ones no longer on the community', async () => {
  const h = setup(); await h.flush();
  assert.match(h.calls[0][1], /story:all_stories\(id,author_id,title,description,published_at,cover_image_path,stereo_audio_path,duration_ms\)/);
  assert.deepEqual(h.calls[1], ['eq', 'user_id', 'alice']);
  assert.equal(h.result.items.length, 1);
  assert.equal(h.result.items[0].audioPath, 'u/a/story.mp3');
  assert.equal(h.result.ids.has('a'), true);
});

test('saving adds the story right away and removing deletes only that save', async () => {
  const h = setup(); await h.flush();
  await h.result.toggle(story('b')); await h.flush();
  assert.equal(JSON.stringify(h.calls.find(c => c[0] === 'insert')[1]), JSON.stringify({ user_id: 'alice', story_id: 'b' }));
  assert.equal(h.result.ids.has('b'), true);
  await h.result.toggle(story('a')); await h.flush();
  assert.ok(h.calls.some(c => c[0] === 'delete'));
  assert.ok(h.calls.some(c => c[0] === 'eq' && c[1] === 'story_id' && c[2] === 'a'));
  assert.equal(h.result.ids.has('a'), false);
});

test('a failed save is rolled back and reported', async () => {
  const h = setup({ write: async () => ({ error: new Error('offline') }) }); await h.flush();
  await assert.rejects(h.result.toggle(story('b')), /Could not save this story/);
  await h.flush();
  assert.equal(h.result.ids.has('b'), false);
  assert.equal(h.result.pending.length, 0);
});

test("the user's own stories are never listed as saved and cannot be saved", async () => {
  const h = setup({ list: async () => ({ data: [{ story: row('mine', 'alice') }, { story: row('theirs') }], error: null }) });
  await h.flush();
  assert.deepEqual(Array.from(h.result.items, item => item.id), ['theirs']);
  await assert.rejects(h.result.toggle(story('mine', 'alice')), /your story/);
  assert.equal(h.calls.some(c => c[0] === 'insert'), false);
});
