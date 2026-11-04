/**
 * Built-artifact smoke: the shipped client bundle must register itself and its
 * factory must execute against the platform module table.
 *
 * The bundle is minified and carries no readable module ids any more, so a
 * string check cannot prove it still runs. This evaluates the real published
 * file in a browser-shaped sandbox: a missing import, a broken CSS injection or
 * a bundle that stops registering would fail here instead of in the browser.
 */
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import vm from 'node:vm'

const bundleCode = readFileSync(new URL('../lib/client.js', import.meta.url), 'utf8')
const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'))

/** Browser-shaped sandbox with just enough surface for a bundle factory. */
function sandbox() {
  const styleTags = []
  const document = {
    visibilityState: 'visible',
    head: { appendChild: (node) => { styleTags.push(node); node.parentNode = document.head } },
    // antd's cssinjs probes a server-rendered style host on body at module init.
    body: {
      appendChild: () => {},
      append: () => {},
      querySelector: () => null,
      querySelectorAll: () => [],
      getAttribute: () => null,
    },
    documentElement: { style: { setProperty: () => {}, removeProperty: () => {} }, setAttribute: () => {}, removeAttribute: () => {} },
    createElement: () => ({ dataset: {}, style: {}, setAttribute: () => {}, appendChild: () => {}, textContent: '' }),
    createTextNode: () => ({}),
    querySelector: () => null,
    querySelectorAll: () => [],
    getElementById: () => null,
    addEventListener: () => {},
    removeEventListener: () => {},
  }
  const noop = () => {}
  const window = {
    document,
    location: { href: 'http://127.0.0.1/', origin: 'http://127.0.0.1', search: '', pathname: '/' },
    navigator: { language: 'zh-CN', languages: ['zh-CN'], userAgent: 'node' },
    localStorage: { getItem: () => null, setItem: noop, removeItem: noop, key: () => null, length: 0 },
    matchMedia: () => ({ matches: false, addEventListener: noop, removeEventListener: noop, addListener: noop, removeListener: noop }),
    addEventListener: noop,
    removeEventListener: noop,
    dispatchEvent: () => true,
    requestAnimationFrame: (callback) => setTimeout(() => callback(0), 0),
    cancelAnimationFrame: noop,
    setInterval,
    clearInterval,
    setTimeout,
    clearTimeout,
    fetch: async () => ({ ok: true, json: async () => ({}), text: async () => '{}' }),
    AbortController,
    URL,
    Date,
    Math,
    JSON,
    performance: { now: () => 0 },
    getComputedStyle: () => ({ getPropertyValue: () => '' }),
    __ModuleLoader__: { load: (module) => { window.__loaded = module } },
  }
  return { window, document, styleTags }
}

/**
 * Minimal React face. The bundle now carries antd, whose module init calls
 * `createContext`; the previous callable Proxy answered every read with itself,
 * so `createContext(...)` returned a function instead of a context object and
 * the factory aborted. Only module-init APIs need real shapes here — the test
 * executes the factory, it never renders.
 */
class ReactComponent {
  constructor(props) { this.props = props }
  setState() {}
  forceUpdate() {}
  render() { return null }
}
const reactStub = {
  Component: ReactComponent,
  PureComponent: ReactComponent,
  createContext: defaultValue => ({ Provider: ({ children }) => children, Consumer: () => null, _currentValue: defaultValue }),
  useContext: () => undefined,
  createElement: () => ({}),
  createRef: () => ({ current: null }),
  forwardRef: render => render,
  memo: component => component,
  useId: () => 'test-id',
  Fragment: Symbol('Fragment'),
  Children: { toArray: () => [], map: () => [] },
}
reactStub.default = reactStub
const requireStub = (id) => {
  if (id === 'react') return reactStub
  if (id === 'react-dom') return { ...reactStub, createPortal: () => null, flushSync: callback => callback() }
  if (id === 'react/jsx-runtime') return { jsx: () => ({}), jsxs: () => ({}), Fragment: Symbol('Fragment') }
  if (id === 'react-dom/client') return { createRoot: () => ({ render: () => {}, unmount: () => {} }) }
  return reactStub
}

test('the minified client bundle registers and its factory executes', () => {
  const env = sandbox()
  const context = vm.createContext({
    window: env.window,
    document: env.document,
    navigator: env.window.navigator,
    localStorage: env.window.localStorage,
    fetch: env.window.fetch,
    console,
    setTimeout,
    clearTimeout,
    setInterval,
    clearInterval,
    AbortController,
    URL,
    Date,
    Math,
    JSON,
    performance: env.window.performance,
    requestAnimationFrame: env.window.requestAnimationFrame,
    cancelAnimationFrame: env.window.cancelAnimationFrame,
  })
  vm.runInContext(bundleCode, context, { filename: 'lib/client.js' })
  const loaded = env.window.__loaded
  assert.ok(loaded, 'bundle did not call __ModuleLoader__.load')
  assert.equal(loaded.id, pkg.name, 'bundle registers under the wrong id')
  assert.equal(typeof loaded.factory, 'function')
  const exports = loaded.factory(requireStub)
  assert.ok(exports !== null && typeof exports === 'object', 'factory returned no exports')
  assert.ok(env.styleTags.length > 0, 'factory injected no stylesheet; CSS compilation broke')
  assert.ok(env.styleTags.every(tag => typeof tag.textContent === 'string' && tag.textContent.length > 0))
})

test('the shipped bundle carries no expert prompt bodies', () => {
  // The host catalog owns the prompt text; shipping it here would re-inflate the
  // download by ~1 MB (see agency-role-prompts.ts).
  assert.equal(bundleCode.includes('AGENCY_ROLE_PROMPTS'), false)
  // antd (Tabs / ConfigProvider / theme) is deliberately bundled for the 洪荒
  // sidebar's card tabs; it accounts for roughly 300 KB of the payload.
  assert.ok(Buffer.byteLength(bundleCode) < 1536 * 1024, 'client bundle grew past its budget')
})

