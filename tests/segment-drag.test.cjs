const assert = require('node:assert/strict');
const { test } = require('node:test');
const { load, harness } = require('./hook-harness.cjs');
const a = { id: 'first' }, b = { id: 'second' }, c = { id: 'third' };
function setup() {
  const hooks = harness(), moves = [], calls = [];
  let background;
  const module = load('src/hooks/use-segment-drag.ts', {
    react: hooks.react,
    'react-native': { Keyboard: { dismiss: () => calls.push('keyboard') },
      AppState: { addEventListener: (_, fn) => { background = fn; return { remove() {} }; } } },
    'expo-router': { useFocusEffect: fn => hooks.react.useEffect(fn, [fn]) },
  });
  const move = (...args) => moves.push(args), stop = () => calls.push('stop');
  const h = { segments: [a, b, c], owner: 'owner', enabled: true, moves, calls,
    render() { h.result = hooks.render(() => module.useSegmentDrag(h.segments, h.owner, h.enabled, move, stop)); return h.result; },
    background: () => background('background'), unmount: hooks.unmount,
  };
  h.render(); return h;
}

test('drag freezes displayed items until drop and applies only the moved identity', () => {
  const h = setup(); h.result.onDragBegin(); h.render();
  h.segments = [a, b, c, { id: 'arrived-during-drag' }]; h.render();
  assert.equal(h.result.data.length, 3);
  h.result.onDragEnd({ from: 2, to: 0, data: [c, a, b] }); h.render();
  assert.deepEqual(h.moves, [['third', 'first']]);
  assert.equal(h.result.data.length, 4);
  assert.equal(h.result.dragging, false);
  assert.deepEqual(h.calls, ['keyboard', 'stop']);
});

test('dropping in the same position does not write order changes', () => {
  const h = setup(); h.result.onDragBegin(); h.render();
  h.result.onDragEnd({ from: 1, to: 1, data: [a, b, c] });
  assert.equal(h.moves.length, 0);
});

test('background cancellation resets the gesture and ignores late drop callbacks', () => {
  const h = setup(); h.result.onDragBegin(); h.render();
  const end = h.result.onDragEnd;
  h.background(); h.render(); end({ from: 2, to: 0, data: [c, a, b] });
  assert.equal(h.moves.length, 0);
  assert.equal(h.result.dragging, false);
  assert.equal(h.result.generation, 1);
});

test('changing account cancels the old drag and cannot reorder another account', () => {
  const h = setup(); h.result.onDragBegin(); h.render();
  const end = h.result.onDragEnd;
  h.owner = 'different-owner'; h.render();
  end({ from: 2, to: 0, data: [c, a, b] });
  assert.equal(h.moves.length, 0);
});

test('recording disables drag start', () => {
  const h = setup(); h.enabled = false; h.render();
  h.result.onDragBegin(); h.render();
  assert.equal(h.result.dragging, false);
  assert.equal(h.calls.length, 0);
});
