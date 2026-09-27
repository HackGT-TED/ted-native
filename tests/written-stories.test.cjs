const assert = require('node:assert/strict');
const { test } = require('node:test');
const { readFileSync, existsSync } = require('node:fs');
const { execFileSync } = require('node:child_process');
const { load, harness, tick } = require('./hook-harness.cjs');

const stories = JSON.parse(readFileSync('content/written-stories.json', 'utf8'));

test('ten public-domain stories, each with a cover, a Gutenberg source, and clean text', () => {
  assert.equal(stories.length, 10);
  const covers = readFileSync('src/content/story-covers.ts', 'utf8');
  for (const story of stories) {
    assert.ok(existsSync(`assets/stories/${story.slug}.jpg`), `${story.slug} cover file`);
    assert.ok(covers.includes(`'${story.slug}': require('../../assets/stories/${story.slug}.jpg')`), `${story.slug} cover mapping`);
    assert.match(story.source_url, /^https:\/\/www\.gutenberg\.org\/ebooks\/\d+$/);
    assert.match(story.cover_credit, /^Illustration by .+ \(\d{4}\)\. Project Gutenberg eBook #\d+\.$/);
    assert.ok(story.paragraphs.length >= 2);
    for (const paragraph of story.paragraphs) {
      assert.doesNotMatch(paragraph, /\[Illustration|Gutenberg|\*\*\*|_\w/, `${story.slug}: leftover markup`);
    }
  }
  assert.equal(new Set(stories.map(s => s.slug)).size, 10, 'slugs are unique');
});

test('the seed SQL escapes apostrophes and matches the committed migration', () => {
  const sql = execFileSync('node', ['scripts/build-written-stories.mjs'], { encoding: 'utf8' });
  assert.match(sql, /I''ll huff, and I''ll puff/, 'apostrophes are doubled');
  assert.equal((sql.match(/^ {2}\('/gm) ?? []).length, 10);
  assert.match(sql, /on conflict \(slug\) do update/);
  const migration = readFileSync('supabase/migrations/20260926001700_written_stories.sql', 'utf8');
  assert.ok(migration.includes(sql.trim()), 'regenerate the migration after editing content/written-stories.json');
  // Every row's JSON text survives the SQL quoting.
  for (const match of sql.matchAll(/'(\[.*?\])'::jsonb/g)) {
    assert.ok(Array.isArray(JSON.parse(match[1].replaceAll("''", "'"))));
  }
});

function hooks(responses) {
  const h = harness();
  const calls = [];
  const supabase = { from(table) {
    assert.equal(table, 'written_stories');
    const q = { select(f) { calls.push(['select', f]); return q; }, order(f) { calls.push(['order', f]); return q; },
      eq(f, v) { calls.push(['eq', f, v]); return q; },
      maybeSingle: async () => responses.one(), then(ok, fail) { return Promise.resolve(responses.all()).then(ok, fail); } };
    return q;
  } };
  const module = load('src/hooks/use-written-stories.ts', { react: h.react, '../lib/supabase': { supabase } });
  return { module, h, calls };
}

test('the list loads summaries in curated order, without the full text', async () => {
  const { module, h, calls } = hooks({ all: () => ({ data: [{ slug: 'a', title: 'A', excerpt: 'Once' }], error: null }) });
  let result = h.render(() => module.useWrittenStories());
  await tick(); result = h.render(() => module.useWrittenStories());
  assert.equal(result.items.length, 1);
  const fields = calls.find(c => c[0] === 'select')[1];
  assert.match(fields, /excerpt:paragraphs->>0/);
  assert.doesNotMatch(fields, /,paragraphs,/);
  assert.deepEqual(calls.filter(c => c[0] === 'order').map(c => c[1]), ['position', 'title']);
});

test('one story loads with its full text, and failures can be retried', async () => {
  let fail = true;
  const { module, h, calls } = hooks({ one: () => fail ? { data: null, error: new Error('offline') }
    : { data: { slug: 'a', title: 'A', paragraphs: ['One', 'Two'] }, error: null } });
  let result = h.render(() => module.useWrittenStory('a'));
  await tick(); result = h.render(() => module.useWrittenStory('a'));
  assert.match(result.error, /Could not load this story/);
  fail = false; await result.refresh(); result = h.render(() => module.useWrittenStory('a'));
  assert.equal(result.story.paragraphs.length, 2);
  assert.deepEqual(calls.find(c => c[0] === 'eq'), ['eq', 'slug', 'a']);
});

test('the reader shows the cover, every paragraph, and the credits', () => {
  const h = harness();
  const story = { slug: 'the-ugly-duckling', title: 'The Ugly Duckling', author: 'Hans Christian Andersen', category: 'Fairy tale',
    reading_minutes: 25, paragraphs: ['It was lovely summer weather.', 'Line one\nLine two'], source_title: 'Fairy Tales',
    source_url: 'https://www.gutenberg.org/ebooks/27200', cover_credit: 'Illustration by Edna F. Hart (1914).' };
  const module = load('src/app/read/[slug].tsx', {
    'react/jsx-runtime': { jsx: (type, props) => ({ type, props }), jsxs: (type, props) => ({ type, props }) },
    'expo-image': { Image: 'Image' },
    'expo-router': { router: {}, useLocalSearchParams: () => ({ slug: 'the-ugly-duckling' }) },
    'react-native': { ActivityIndicator: 'ActivityIndicator', Linking: { openURL: async () => {} }, Pressable: 'Pressable', Text: 'Text', View: 'View',
      useWindowDimensions: () => ({ width: 390 }) },
    '../../components/shell': { Shell: 'Shell' },
    '../../components/ui': { Body: 'Body', Button: 'Button', colors: {}, Heading: 'Heading', Icon: 'Icon' },
    '../../content/story-covers': { storyCovers: { 'the-ugly-duckling': 42 } },
    '../../hooks/use-written-stories': { useWrittenStory: () => ({ story, loading: false, error: '', refresh: async () => {} }) },
  });
  const text = JSON.stringify(h.render(module.default));
  assert.match(text, /"source":42/, 'the bundled cover');
  assert.match(text, /It was lovely summer weather/);
  assert.match(text, /Line one\\nLine two/, 'verse keeps its line breaks');
  assert.match(text, /courtesy of Project Gutenberg/);
  assert.match(text, /Edna F\. Hart/);
});
