const assert = require('node:assert/strict');
const { test } = require('node:test');
const { load, harness } = require('./hook-harness.cjs');

function setup(options = {}) {
  const hooks = harness();
  const calls = [];
  const recorder = {
    phase: 'idle', duration: 0, error: '', permissionBlocked: false,
    start() { calls.push('start'); recorder.phase = 'starting'; },
    finish() { calls.push('finish'); recorder.phase = 'stopping'; },
  };
  const timeline = { ready: true, segments: [], refresh() {}, loading: false };
  const studio = { recorder, timeline, stories: { saving: false }, storyOpen: options.storyOpen ?? true, autoRecord: options.autoRecord ?? false, draft: { loading: false }, consumeAutoRecord() { studio.autoRecord = false; },
    openStory(id) { calls.push(['openStory', id]); } };
  const playback = { stop() { calls.push('pause playback'); }, toggle() {} };
  const module = load('src/app/create.tsx', {
    react: hooks.react,
    'react/jsx-runtime': { jsx: (type, props) => ({ type, props }), jsxs: (type, props) => ({ type, props }) },
    'react-native': { Keyboard: { dismiss() {} }, Platform: { OS: 'ios' }, ...Object.fromEntries(['ActivityIndicator', 'FlatList', 'Pressable', 'Text', 'View'].map(name => [name, name])) },
    'expo-router': { Redirect: 'Redirect', router: {}, useFocusEffect: fn => hooks.react.useEffect(fn, [fn]) },
    'react-native-reanimated': { default: { View: 'AnimatedView' },
      useSharedValue: initial => hooks.react.useRef({ value: initial }).current,
      useAnimatedStyle: fn => fn(), withTiming: value => value },
    '../components/recording/draggable-recording-list': { DraggableRecordingList: 'DraggableRecordingList' },
    '../hooks/use-segment-drag': { useSegmentDrag: segments => ({ data: segments, dragging: false, generation: 0 }) },
    '../components/story-title': { StoryTitle: 'StoryTitle' },
    '../components/story-cover-picker': { StoryCoverPicker: 'StoryCoverPicker' },
    '../components/story-actions': { StoryActions: 'StoryActions' },
    '../components/read-along/continue-reading': { ContinueReading: 'ContinueReading' },
    '../components/shell': { Shell: 'Shell' },
    '../components/loading-skeleton': { LoadingSkeleton: 'LoadingSkeleton' },
    '../components/ui': { Body: 'Body', Button: 'Button', Heading: 'Heading', Icon: 'Icon', colors: {} },
    '../components/recording/recording-timeline-item': { RecordingTimelineItem: 'TimelineItem' },
    '../context/studio': { useStudio: () => studio },
    '../hooks/use-timeline-playback': { useTimelinePlayback: () => playback },
    '../utils/recordings': load('src/utils/recordings.ts', {}),
  });
  const nodes = node => !node || typeof node !== 'object' ? [] : Array.isArray(node)
    ? node.flatMap(nodes) : [node, ...nodes(node.props?.children)];
  const h = { calls, recorder, timeline,
    render() { h.tree = hooks.render(() => { const page = module.default(); return typeof page.type === 'function' ? page.type() : page; }); return h; },
    button() { return nodes(h.tree).find(node => ['Record a story moment', 'Stop recording'].includes(node.props?.accessibilityLabel)).props; },
    unmount: hooks.unmount,
  };
  return h.render();
}

test('one tap starts a take and a second tap stops it exactly once', () => {
  const h = setup();
  assert.equal(h.button().accessibilityLabel, 'Record a story moment');
  h.button().onPress();
  assert.deepEqual(h.calls, ['pause playback', 'start']);
  h.render();
  assert.equal(h.button().disabled, false, 'Preparing must keep the stop control enabled');
  h.recorder.phase = 'recording'; h.render();
  assert.equal(h.button().disabled, false);
  assert.equal(h.button().accessibilityLabel, 'Stop recording');
  assert.equal(h.tree.props.quiet, true);
  h.button().onPress();
  assert.deepEqual(h.calls, ['pause playback', 'start', 'finish']);
  h.render();
  assert.equal(h.button().disabled, true, 'Wait for finalization before the next take');
});

test('recording keeps going without holding the button', () => {
  const h = setup();
  h.button().onPress();
  h.recorder.phase = 'recording'; h.render();
  assert.equal(h.button().onPressOut, undefined);
  assert.equal(h.button().onTouchEnd, undefined);
  assert.equal(h.button().onTouchCancel, undefined);
  assert.deepEqual(h.calls, ['pause playback', 'start']);
});

test('navigation finishes the current take', () => {
  const h = setup();
  h.button().onPress(); h.unmount();
  assert.equal(h.calls.filter(call => call === 'finish').length, 1);
});

test('successive taps start fresh takes without a name or save action', () => {
  const h = setup();
  for (let i = 0; i < 3; i++) {
    h.recorder.phase = 'idle'; h.render();
    h.button().onPress();
    h.recorder.phase = 'recording'; h.render();
    h.button().onPress();
  }
  assert.equal(h.calls.filter(call => call === 'start').length, 3);
  assert.equal(h.calls.filter(call => call === 'finish').length, 3);
});

test('capture is unavailable until the stored timeline is ready', () => {
  const h = setup();
  h.timeline.ready = false; h.render();
  assert.equal(h.button().disabled, true);
  assert.deepEqual(h.calls, []);
});


test('opening Create with no story open starts a new one', () => {
  const h = setup({ storyOpen: false });
  assert.equal(h.calls.length, 1);
  assert.equal(h.calls[0][0], 'openStory');
  assert.match(h.calls[0][1], /^[0-9a-f-]{36}$/);
  assert.equal(h.tree.type, 'Shell', 'shows a skeleton while the new story opens');
});

test('welcome starts one hands-free take and tapping stop saves it once', () => {
  const h = setup({ autoRecord: true });
  h.render();
  assert.deepEqual(h.calls, ['start']);
  h.recorder.phase = 'recording'; h.render();
  assert.equal(h.button().accessibilityLabel, 'Stop recording');
  h.button().onPress(); h.render();
  assert.deepEqual(h.calls, ['start', 'finish']);
  h.recorder.phase = 'idle'; h.render();
  assert.equal(h.button().accessibilityLabel, 'Record a story moment');
  assert.deepEqual(h.calls, ['start', 'finish']);
});
