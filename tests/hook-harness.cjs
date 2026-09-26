const { readFileSync } = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');

exports.load = (file, modules, globals = {}) => {
  const source = ts.transpileModule(readFileSync(file, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX },
  }).outputText;
  const exports = {};
  vm.runInNewContext(source, { exports, require: name => {
    if (!(name in modules)) throw new Error(`Unexpected module: ${name}`);
    return modules[name];
  }, Date, Error, AbortController, setTimeout, clearTimeout, ...globals });
  return exports;
};
exports.harness = () => {
  const slots = [];
  let cursor = 0;
  let effects = [];
  const changed = (a, b) => !a || b.some((value, i) => value !== a[i]);
  const react = {
    useRef(value) { const i = cursor++; return slots[i] ??= { current: value }; },
    useState(initial) {
      const i = cursor++;
      if (!(i in slots)) slots[i] = initial;
      return [slots[i], value => { slots[i] = typeof value === 'function' ? value(slots[i]) : value; }];
    },
    useCallback(fn, deps) {
      const i = cursor++;
      if (!slots[i] || changed(slots[i].deps, deps)) slots[i] = { fn, deps };
      return slots[i].fn;
    },
    useEffect(fn, deps) {
      const i = cursor++;
      if (!slots[i] || changed(slots[i].deps, deps)) effects.push(() => {
        slots[i]?.cleanup?.();
        slots[i] = { deps, cleanup: fn() };
      });
    },
  };
  return { react, render(fn) { cursor = 0; effects = []; const result = fn(); effects.forEach(fn => fn()); return result; },
    unmount() { slots.forEach(slot => slot?.cleanup?.()); } };
};
exports.tick = () => new Promise(resolve => setImmediate(resolve));
exports.deferred = () => { let resolve; const promise = new Promise(done => { resolve = done; }); return { promise, resolve }; };
