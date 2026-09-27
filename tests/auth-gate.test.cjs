const assert = require('node:assert/strict');
const { test } = require('node:test');
const { load, harness } = require('./hook-harness.cjs');

function layout(studio) {
  const hooks = harness();
  const Stack = Object.assign(function Stack() {}, { Protected: 'Protected', Screen: 'Screen' });
  const modules = {
    '../../global.css': {},
    react: hooks.react,
    'react/jsx-runtime': { jsx: (type, props) => ({ type, props }), jsxs: (type, props) => ({ type, props }) },
    'expo-router': { Stack },
    'expo-font': { useFonts: () => [true, null] },
    'expo-status-bar': { StatusBar: 'StatusBar' },
    'react-native': { ActivityIndicator: 'ActivityIndicator', View: 'View' },
    'react-native-gesture-handler': { GestureHandlerRootView: 'GestureHandlerRootView' },
    '../context/studio': { StudioProvider: 'StudioProvider', useStudio: () => studio },
    '../components/ui': { colors: {} },
  };
  // Font files are bundled assets; everything else resolves to the mocks above.
  const module = load('src/app/_layout.tsx', modules, {
    require: name => name.endsWith('.ttf') ? 1 : modules[name],
  });
  // Render the root, then the AppStack component inside the provider.
  const root = hooks.render(module.default);
  const provider = root.props.children;
  const appStack = provider.props.children.find(child => child && typeof child.type === 'function');
  return appStack.type(appStack.props);
}

const groups = stack => {
  const children = [stack.props.children].flat(2).filter(Boolean);
  const protectedGroups = children.filter(child => child.type === 'Protected').map(group => ({
    guard: group.props.guard,
    screens: [group.props.children].flat(2).map(screen => screen.props.name),
  }));
  const open = children.filter(child => child.type === 'Screen').map(screen => screen.props.name);
  return { protectedGroups, open };
};

test('signed out: only the welcome screen and sign-in are reachable', () => {
  const { protectedGroups, open } = groups(layout({ session: null, authLoading: false }));
  const welcome = protectedGroups.find(group => group.screens.includes('welcome'));
  const app = protectedGroups.find(group => group.screens.includes('index'));
  assert.equal(welcome.guard, true);
  assert.equal(app.guard, false);
  for (const name of ['index', 'create', 'family', 'explore', 'library', 'account', 'story/[id]', 'item/[id]', 'read/[slug]']) {
    assert.ok(app.screens.includes(name), `${name} is behind sign-in`);
  }
  assert.deepEqual(open, ['auth'], 'the sign-in sheet stays reachable');
});

test('signed in: the whole app is reachable and the welcome screen is not', () => {
  const { protectedGroups } = groups(layout({ session: { user: { id: 'u' } }, authLoading: false }));
  assert.equal(protectedGroups.find(group => group.screens.includes('welcome')).guard, false);
  assert.equal(protectedGroups.find(group => group.screens.includes('index')).guard, true);
});

test('while the saved session loads, nothing is shown but a spinner', () => {
  const view = layout({ session: null, authLoading: true });
  assert.equal(typeof view.type, 'function', 'the loading view, not the stack');
  assert.equal(view.type().props.children.type, 'ActivityIndicator');
});

test('the welcome screen shows the title with a sign-in button under it', () => {
  const calls = [];
  const module = load('src/app/welcome.tsx', {
    'react/jsx-runtime': { jsx: (type, props) => ({ type, props }), jsxs: (type, props) => ({ type, props }) },
    'expo-router': { router: { push: route => calls.push(route) } },
    'react-native': { Text: 'Text', View: 'View' },
    'react-native-safe-area-context': { SafeAreaView: 'SafeAreaView' },
    '../components/ui': { Button: 'Button' },
  });
  const [title, button] = module.default().props.children.props.children;
  assert.equal(title.props.children, 'Welcome to TedTime');
  assert.equal(button.props.title, 'Sign in');
  button.props.onPress();
  assert.deepEqual(calls, ['/auth']);
});
