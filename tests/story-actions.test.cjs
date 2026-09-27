const assert = require('node:assert/strict');
const { test } = require('node:test');
const { load, harness, tick, deferred } = require('./hook-harness.cjs');

function setup() {
  const hooks = harness(); const calls = []; const published = []; const toasts = [];
  const studio = {
    session: { user: { id: 'alice' } }, authLoading: false, storyId: 'my-story',
    draft: { name: 'My story', loading: false, editable: true },
    cover: { uploading: false, pathForSave: undefined },
    timeline: { segments: [{ id: 'moment-1' }], ready: true },
    stories: { items: [], saving: false, async save(...args) { calls.push(args); return { id: 'story-row' }; } },
  };
  const module = load('src/components/story-actions.tsx', {
    react: hooks.react,
    'react/jsx-runtime': { jsx: (type, props) => ({ type, props }), jsxs: (type, props) => ({ type, props }) },
    'expo-router': { router: { push: route => calls.push(route) } },
    'react-native': { Switch: 'Switch', Text: 'Text', View: 'View' },
    'react-native-toast-message': { show: options => toasts.push(options) },
    './ui': { Button: 'Button', colors: {} }, '../context/studio': { useStudio: () => studio },
    '../services/story-api': { warmUp: async () => {} },
    './story-recipients': { StoryRecipients: 'StoryRecipients' },
    '../services/story-shares': { personName: p => p.full_name, sendStory: async (storyId, ids) => {
      calls.push(['send', storyId, ids]); if (h.sendError) throw h.sendError; } },
    '../services/publish-story': { prepareStoryAudio: async (...args) => {
      published.push(args);
      if (h.publishError) throw h.publishError;
      return { stereoAudioPath: 'alice/my-story/story.mp3', description: 'A tale.', categoryTags: 'calm' };
    } },
  });
  const nodes = node => !node || typeof node !== 'object' ? [] : Array.isArray(node) ? node.flatMap(nodes) : [node, ...nodes(node.props?.children)];
  const h = { studio, calls, published, toasts, publishError: null, sendError: null,
    render(disabled = false) { h.tree = hooks.render(() => module.StoryActions({ disabled })); return h; },
    toggle() { return nodes(h.tree).find(n => n.type === 'Switch').props; },
    recipients() { return nodes(h.tree).find(n => n.type === 'StoryRecipients')?.props; },
    button(title) { return nodes(h.tree).find(n => n.type === 'Button' && n.props.title === title).props; },
    messages() { return nodes(h.tree).filter(n => n.type === 'Text').map(n => n.props.children).join(' '); },
    async flush() { await tick(); h.render(); },
  };
  return h.render();
}

test('Save and Publish use the current story and report confirmed success', async () => {
  const h = setup(); h.button('Save').onPress(); await h.flush();
  assert.deepEqual(h.calls[0].slice(0, 4), ['my-story', 'My story', false, ['moment-1']]);
  assert.equal(h.toasts.length, 1);
  assert.equal(h.toasts[0].text1, 'Creation saved');
  assert.match(h.toasts[0].text2, /saved to your account/);
  h.button('Publish').onPress(); await h.flush();
  assert.equal(h.calls[1][2], true); assert.match(h.messages(), /Story published/);
  assert.equal(h.toasts.length, 1);
});

test('Publish sends the moments to the backend first and saves its audio, description and tags', async () => {
  const h = setup(); h.button('Publish').onPress(); await h.flush();
  assert.deepEqual(h.published[0], ['alice', 'my-story', [{ id: 'moment-1' }]]);
  assert.deepEqual(h.calls[0][4].audio, { stereoAudioPath: 'alice/my-story/story.mp3', description: 'A tale.', categoryTags: 'calm' });
  assert.equal(h.button('Publish').title, 'Publish');
});

test('Save never calls the backend, and a backend failure does not save a published row', async () => {
  const h = setup(); h.button('Save').onPress(); await h.flush();
  assert.equal(h.published.length, 0); assert.equal(h.calls[0][4].audio, undefined);
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
  assert.equal(h.toasts.length, 0, 'pending saves must not show success');
  pending.resolve(); await h.flush(); assert.match(h.messages(), /Offline/); assert.equal(h.studio.draft.name, 'My story');
  assert.equal(h.toasts.length, 0, 'failed saves must not show success');
  h.studio.storyId = 'different-story'; h.render(); assert.doesNotMatch(h.messages(), /Offline/);
});

test('the community switch defaults off and is sent only with Publish', async () => {
  const h = setup();
  assert.equal(h.toggle().value, false);
  assert.equal(h.toggle().accessibilityLabel, 'Publish to Community for all to see!');
  h.button('Publish').onPress(); await h.flush();
  assert.equal(h.calls[0][4].community, false);
  assert.match(h.messages(), /Find it in your library/);
  h.toggle().onValueChange(true); h.render();
  assert.equal(h.toggle().value, true);
  h.button('Save').onPress(); await h.flush();
  assert.equal(h.calls[1][2], false); assert.equal(h.calls[1][4].community, undefined, 'Save must not change community visibility');
  h.button('Publish').onPress(); await h.flush();
  assert.equal(h.calls[2][4].community, true);
  assert.match(h.messages(), /published to the community/);
});

test('the switch starts from how the story was last published and resets per story', () => {
  const h = setup();
  h.studio.stories.items = [{ creation_session_id: 'my-story', status: 'published', community: true }];
  h.render();
  assert.equal(h.toggle().value, true);
  assert.match(h.messages(), /Published to the community/);
  h.toggle().onValueChange(false); h.render();
  assert.equal(h.toggle().value, false);
  h.studio.storyId = 'another-story'; h.render();
  assert.equal(h.toggle().value, false);
});

test('the switch is locked while publishing', async () => {
  const h = setup(); h.render(true);
  assert.equal(h.toggle().disabled, true);
});

test('a chosen or removed cover is sent with Save and Publish, and saving waits for its upload', async () => {
  const h = setup();
  h.studio.cover.pathForSave = 'alice/my-story/cover_1.jpg'; h.render();
  h.button('Save').onPress(); await h.flush();
  assert.equal(h.calls[0][4].coverPath, 'alice/my-story/cover_1.jpg');
  h.studio.cover.pathForSave = ''; h.render();
  h.button('Publish').onPress(); await h.flush();
  assert.equal(h.calls[1][4].coverPath, '');
  h.studio.cover.uploading = true; h.render();
  assert.equal(h.button('Save').disabled, true);
  assert.equal(h.button('Publish').disabled, true);
});

test('chosen people get the story right after Publish, and Save never sends', async () => {
  const h = setup();
  const rose = { id: 'rose', full_name: 'Grandma Rose' };
  h.recipients().onChange([rose]); h.render();
  assert.equal(h.recipients().selected[0].id, 'rose');
  h.button('Save').onPress(); await h.flush();
  assert.equal(h.calls.some(c => c[0] === 'send'), false);
  h.button('Publish').onPress(); await h.flush();
  assert.deepEqual(h.calls.find(c => c[0] === 'send'), ['send', 'story-row', ['rose']]);
  assert.match(h.messages(), /Sent to Grandma Rose/);
  assert.equal(h.recipients().selected.length, 0, 'cleared once sent');
});

test('a failed send keeps the people chosen so Publish can retry', async () => {
  const h = setup();
  h.recipients().onChange([{ id: 'rose', full_name: 'Grandma Rose' }, { id: 'ted', full_name: 'Ted' }]); h.render();
  h.sendError = new Error('Your story was published, but it could not be sent. Tap Publish to try again.');
  h.button('Publish').onPress(); await h.flush();
  assert.match(h.messages(), /could not be sent/);
  assert.equal(h.recipients().selected.length, 2);
});
