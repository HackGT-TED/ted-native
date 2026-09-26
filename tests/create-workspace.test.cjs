const assert = require('node:assert/strict');
const { test } = require('node:test');
const { load, harness } = require('./hook-harness.cjs');

function setup() {
  const hooks = harness();
  const calls = [];
  const recorder = {
    phase: 'idle', duration: 0, error: '', permissionBlocked: false,
    start() { calls.push('start'); recorder.phase = 'starting'; },
    finish() { calls.push('finish'); recorder.phase = 'stopping'; },
  };
  const timeline = { ready: true, segments: [], refresh() {}, loading: false };
  const playback = { stop() { calls.push('pause playback'); }, toggle() {} };
  const module = load('src/app/create.tsx', {
    react: hooks.react,
    'react/jsx-runtime': { jsx: (type, props) => ({ type, props }), jsxs: (type, props) => ({ type, props }) },
    'react-native': { Keyboard: { dismiss() {} }, Platform: { OS: 'ios' }, ...Object.fromEntries(['ActivityIndicator', 'FlatList', 'Pressable', 'Text', 'View'].map(name => [name, name])) },
    'expo-router': { router: {}, useFocusEffect: fn => hooks.react.useEffect(fn, [fn]) },
    'react-native-reanimated': { default: { View: 'AnimatedView' },
      useSharedValue: initial => hooks.react.useRef({ value: initial }).current,
      useAnimatedStyle: fn => fn(), withTiming: value => value },
    '../components/recording/draggable-recording-list': { DraggableRecordingList: 'DraggableRecordingList' },
    '../hooks/use-segment-drag': { useSegmentDrag: segments => ({ data: segments, dragging: false, generation: 0 }) },
    '../components/story-name-form': { StoryNameForm: 'StoryNameForm' },
    '../components/shell': { Shell: 'Shell' },
    '../components/ui': { Body: 'Body', Button: 'Button', Heading: 'Heading', Icon: 'Icon', colors: {} },
    '../components/recording/recording-timeline-item': { RecordingTimelineItem: 'TimelineItem' },
    '../context/studio': { useStudio: () => ({ recorder, timeline }) },
    '../hooks/use-timeline-playback': { useTimelinePlayback: () => playback },
    '../utils/recordings': load('src/utils/recordings.ts', {}),
  });
  const nodes = node => !node || typeof node !== 'object' ? [] : Array.isArray(node)
    ? node.flatMap(nodes) : [node, ...nodes(node.props?.children)];
  const h = { calls, recorder, timeline,
    render() { h.tree = hooks.render(module.default); return h; },
    button() { return nodes(h.tree).find(node => node.props?.accessibilityLabel === 'Hold to record a story moment').props; },
    unmount: hooks.unmount,
  };
  return h.render();
}

test('press down starts without a long-press threshold; touch release stops exactly once', () => {
  const h = setup();
  h.button().onPressIn();
  assert.deepEqual(h.calls, ['pause playback', 'start']);
  h.render();
  assert.equal(h.button().disabled, false, 'Preparing must keep the held control enabled');
  h.recorder.phase = 'recording'; h.render();
  assert.equal(h.button().disabled, false);
  assert.equal(h.tree.props.quiet, true);
  h.button().onTouchEnd();
  h.button().onPressOut();
  assert.deepEqual(h.calls, ['pause playback', 'start', 'finish']);
  h.render();
  assert.equal(h.button().disabled, true, 'Wait for finalization before the next take');
});

test('touch cancellation and navigation finish the current hold', () => {
  const h = setup();
  h.button().onPressIn(); h.button().onTouchCancel(); h.button().onPressOut();
  assert.equal(h.calls.filter(call => call === 'finish').length, 1);
  h.recorder.phase = 'idle'; h.render();
  h.button().onPressIn(); h.unmount();
  assert.equal(h.calls.filter(call => call === 'finish').length, 2);
});

test('successive holds start fresh takes without a name or save action', () => {
  const h = setup();
  for (let i = 0; i < 3; i++) {
    h.recorder.phase = 'idle'; h.render();
    h.button().onPressIn(); h.button().onPressOut();
  }
  assert.equal(h.calls.filter(call => call === 'start').length, 3);
  assert.equal(h.calls.filter(call => call === 'finish').length, 3);
});

test('capture is unavailable until the stored timeline is ready', () => {
  const h = setup();
  h.timeline.ready = false; h.render();
  assert.equal(h.button().disabled, true);
  h.button().onPressIn();
  assert.deepEqual(h.calls, []);
});
