const assert = require('node:assert/strict');
const { test } = require('node:test');
const { load, harness, tick, deferred } = require('./hook-harness.cjs');

function setup() {
  const hooks = harness(); const calls = []; const published = [];
  const studio = {
    session: { user: { id: 'alice' } }, authLoading: false, storyId: 'my-story',
    draft: { name: 'My story', loading: false, editable: true },
    timeline: { segments: [{ id: 'moment-1' }], ready: true },
    stories: { items: [], saving: false, async save(...args) { calls.push(args); } },
  };
  const module = load('src/components/story-actions.tsx', {
    react: hooks.react,
    'react/jsx-runtime': { jsx: (type, props) => ({ type, props }), jsxs: (type, props) => ({ type, props }) },
    'expo-router': { router: { push: route => calls.push(route) } },
    'react-native': { Text: 'Text', View: 'View' },
    './ui': { Button: 'Button' }, '../context/studio': { useStudio: () => studio },
    '../services/story-api': { warmUp: async () => {} },
    '../services/publish-story': { prepareStoryAudio: async (...args) => {
      published.push(args);
      if (h.publishError) throw h.publishError;
      return { stereoAudioPath: 'alice/my-story/story.mp3', description: 'A tale.', categoryTags: 'calm' };
    } },
  });
  const nodes = node => !node || typeof node !== 'object' ? [] : Array.isArray(node) ? node.flatMap(nodes) : [node, ...nodes(node.props?.children)];
  const h = { studio, calls, published, publishError: null,
    render(disabled = false) { h.tree = hooks.render(() => module.StoryActions({ disabled })); return h; },
    button(title) { return nodes(h.tree).find(n => n.type === 'Button' && n.props.title === title).props; },
    messages() { return nodes(h.tree).filter(n => n.type === 'Text').map(n => n.props.children).join(' '); },
    async flush() { await tick(); h.render(); },
  };
  return h.render();
}

test('Save and Publish use the current story and report confirmed success', async () => {
  const h = setup(); h.button('Save').onPress(); await h.flush();
  assert.deepEqual(h.calls[0].slice(0, 4), ['my-story', 'My story', false, ['moment-1']]);
  assert.match(h.messages(), /saved to your account/);
  h.button('Publish').onPress(); await h.flush();
  assert.equal(h.calls[1][2], true); assert.match(h.messages(), /Story published/);
});

test('Publish sends the moments to the backend first and saves its audio, description and tags', async () => {
  const h = setup(); h.button('Publish').onPress(); await h.flush();
  assert.deepEqual(h.published[0], ['alice', 'my-story', [{ id: 'moment-1' }]]);
  assert.deepEqual(h.calls[0][4], { stereoAudioPath: 'alice/my-story/story.mp3', description: 'A tale.', categoryTags: 'calm' });
  assert.equal(h.button('Publish').title, 'Publish');
});

test('Save never calls the backend, and a backend failure does not save a published row', async () => {
  const h = setup(); h.button('Save').onPress(); await h.flush();
  assert.equal(h.published.length, 0); assert.equal(h.calls[0][4], undefined);
  h.publishError = new Error('The story server took too long to respond.');
  h.button('Publish').onPress(); await h.flush();
  assert.equal(h.calls.length, 1); assert.match(h.messages(), /took too long/);
  assert.equal(h.button('Save').disabled, false);
});

test('unsynced moments and unnamed publications cannot be published', async () => {
  const h = setup(); h.studio.timeline.syncPending = true; h.render(); h.button('Publish').onPress(); await h.flush();
  assert.equal(h.calls.length, 0); assert.match(h.messages(), /finish syncing/);
  h.studio.timeline.syncPending = false; h.studio.draft.name = ''; h.render(); h.button('Publish').onPress(); await h.flush();
  assert.equal(h.calls.length, 0); assert.match(h.messages(), /name before publishing/);
  h.studio.timeline.segments = []; h.render(); assert.equal(h.button('Publish').disabled, true);
});

test('recording locks save actions and guests are routed to sign-in', async () => {
  const h = setup(); h.render(true); assert.equal(h.button('Save').disabled, true);
  h.button('Save').onPress(); assert.equal(h.calls.length, 0);
  h.studio.session = null; h.render(); h.button('Save').onPress();
  assert.deepEqual(h.calls, ['/auth']);
});

test('repeated taps only save once and errors preserve the draft for retry', async () => {
  const h = setup(); const pending = deferred();
  h.studio.stories.save = async () => { h.calls.push('save'); await pending.promise; throw new Error('Offline. Retry.'); };
  h.render(); h.button('Save').onPress(); h.button('Publish').onPress();
  assert.equal(h.calls.length, 1);
  pending.resolve(); await h.flush(); assert.match(h.messages(), /Offline/); assert.equal(h.studio.draft.name, 'My story');
  h.studio.storyId = 'different-story'; h.render(); assert.doesNotMatch(h.messages(), /Offline/);
});
